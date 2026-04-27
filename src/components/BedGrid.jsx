import { useState, useEffect, useCallback } from 'react'
import { Button } from 'react-bootstrap'
import { companionsApi } from '../api/plants.js'
import { getPlantEmoji } from '../utils/plantEmoji.js'

const CELL_SIZE = 48 // px per grid cell
const COMPAT_COLORS = {
  good:    'rgba(34,197,94,0.25)',
  bad:     'rgba(239,68,68,0.25)',
  neutral: 'rgba(156,163,175,0.15)',
}
const COMPAT_BORDER = {
  good:    '#22c55e',
  bad:     '#ef4444',
  neutral: '#9ca3af',
}

export default function BedGrid({ room, plants, onPlantMoved, readOnly }) {
  const cols = room.gridCellsX || 4
  const rows = room.gridCellsY || 4

  const [compat, setCompat]       = useState(null)
  const [dragging, setDragging]   = useState(null) // { plantId, startX, startY }
  const [hoverCell, setHoverCell] = useState(null)
  const [tooltip, setTooltip]     = useState(null)

  // Map plantId → compatibility info
  const compatMap = {}
  if (compat?.cells) {
    for (const c of compat.cells) compatMap[c.plantId] = c
  }

  useEffect(() => {
    if (!room?.id) return
    let cancelled = false
    companionsApi.getCompatibility(room.id)
      .then(d => { if (!cancelled) setCompat(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [room?.id, plants])

  // Build a cellMap: "x,y" → plant
  const cellMap = {}
  for (const p of plants) {
    const bp = p.bedPlacement
    if (!bp || bp.roomId !== room.id) continue
    for (let dx = 0; dx < (bp.cellWidth || 1); dx++) {
      for (let dy = 0; dy < (bp.cellHeight || 1); dy++) {
        cellMap[`${bp.cellX + dx},${bp.cellY + dy}`] = p
      }
    }
  }

  const plantAt = (x, y) => cellMap[`${x},${y}`]

  const handleCellPointerDown = useCallback((x, y, e) => {
    if (readOnly) return
    const p = plantAt(x, y)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ plantId: p.id, startX: x, startY: y })
    e.preventDefault()
  }, [plants, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellPointerMove = useCallback((x, y) => {
    if (dragging) setHoverCell({ x, y })
  }, [dragging])

  const handleCellPointerUp = useCallback((x, y) => {
    if (!dragging) return
    const { plantId, startX, startY } = dragging
    setDragging(null)
    setHoverCell(null)
    if (x === startX && y === startY) return
    // Check target is empty
    const target = plantAt(x, y)
    if (target && target.id !== plantId) return
    onPlantMoved?.(plantId, { roomId: room.id, cellX: x, cellY: y })
  }, [dragging, plants, room, onPlantMoved]) // eslint-disable-line react-hooks/exhaustive-deps

  const svgWidth  = cols * CELL_SIZE
  const svgHeight = rows * CELL_SIZE

  return (
    <div>
      <div className="mb-2 d-flex align-items-center gap-2 fs-xs text-muted">
        <span>
          <span className="rounded-circle d-inline-block me-1" style={{ width: 8, height: 8, background: COMPAT_BORDER.good }} />
          Compatible
        </span>
        <span>
          <span className="rounded-circle d-inline-block me-1" style={{ width: 8, height: 8, background: COMPAT_BORDER.bad }} />
          Conflict
        </span>
        <span>
          <span className="rounded-circle d-inline-block me-1" style={{ width: 8, height: 8, background: COMPAT_BORDER.neutral }} />
          Neutral
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ display: 'block', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb' }}
          data-testid="bed-grid"
          onPointerLeave={() => { if (dragging) { setDragging(null); setHoverCell(null) } }}
        >
          {/* Grid cells */}
          {Array.from({ length: rows }, (_, y) =>
            Array.from({ length: cols }, (_, x) => {
              const plant  = plantAt(x, y)
              const cellC  = compatMap[plant?.id]
              const effect = cellC?.compatibility ?? 'neutral'
              const isDragTarget = hoverCell?.x === x && hoverCell?.y === y && dragging
              const isDragged    = dragging?.startX === x && dragging?.startY === y && !plant

              return (
                <g
                  key={`${x},${y}`}
                  onPointerDown={e => handleCellPointerDown(x, y, e)}
                  onPointerMove={() => handleCellPointerMove(x, y)}
                  onPointerUp={() => handleCellPointerUp(x, y)}
                  style={{ cursor: plant ? (readOnly ? 'default' : 'grab') : 'default', touchAction: 'none' }}
                  onMouseEnter={() => {
                    if (cellC && (cellC.warnings.length || cellC.compatible.length)) {
                      setTooltip({ x, y, cellC })
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Cell background */}
                  <rect
                    x={x * CELL_SIZE + 1}
                    y={y * CELL_SIZE + 1}
                    width={CELL_SIZE - 2}
                    height={CELL_SIZE - 2}
                    rx={4}
                    fill={isDragTarget ? 'rgba(99,102,241,0.15)' : isDragged ? 'rgba(0,0,0,0.04)' : plant ? COMPAT_COLORS[effect] : '#fff'}
                    stroke={isDragTarget ? '#6366f1' : plant ? COMPAT_BORDER[effect] : '#e5e7eb'}
                    strokeWidth={plant ? 2 : 1}
                  />
                  {/* Plant emoji */}
                  {plant && !isDragged && (
                    <text
                      x={x * CELL_SIZE + CELL_SIZE / 2}
                      y={y * CELL_SIZE + CELL_SIZE / 2 + 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={22}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {getPlantEmoji(plant)}
                    </text>
                  )}
                  {/* Plant name label */}
                  {plant && !isDragged && (
                    <text
                      x={x * CELL_SIZE + CELL_SIZE / 2}
                      y={y * CELL_SIZE + CELL_SIZE - 5}
                      textAnchor="middle"
                      fontSize={8}
                      fill="#374151"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {(plant.name || plant.species || '').slice(0, 8)}
                    </text>
                  )}
                  {/* Conflict indicator */}
                  {plant && effect === 'bad' && (
                    <text x={x * CELL_SIZE + CELL_SIZE - 8} y={y * CELL_SIZE + 12} fontSize={10} style={{ pointerEvents: 'none' }}>⚠</text>
                  )}
                  {plant && effect === 'good' && (
                    <text x={x * CELL_SIZE + CELL_SIZE - 8} y={y * CELL_SIZE + 12} fontSize={10} style={{ pointerEvents: 'none' }}>✓</text>
                  )}
                </g>
              )
            })
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-2 p-2 rounded border bg-white fs-xs" data-testid="bed-grid-tooltip">
          {tooltip.cellC.compatible.length > 0 && (
            <div className="text-success mb-1">
              <strong>Good companions:</strong>
              {tooltip.cellC.compatible.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}
          {tooltip.cellC.warnings.length > 0 && (
            <div className="text-danger">
              <strong>Conflicts:</strong>
              {tooltip.cellC.warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Plants not yet placed */}
      {!readOnly && (() => {
        const unplaced = plants.filter(p => !p.bedPlacement || p.bedPlacement.roomId !== room.id)
        if (!unplaced.length) return null
        return (
          <div className="mt-3">
            <p className="fs-xs text-muted mb-2">Drag to place on grid — or click a plant to assign it:</p>
            <div className="d-flex flex-wrap gap-2">
              {unplaced.map(p => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline-secondary"
                  className="fs-xs"
                  onClick={() => {
                    // Find first empty cell
                    for (let y = 0; y < rows; y++) {
                      for (let x = 0; x < cols; x++) {
                        if (!plantAt(x, y)) {
                          onPlantMoved?.(p.id, { roomId: room.id, cellX: x, cellY: y })
                          return
                        }
                      }
                    }
                  }}
                >
                  {getPlantEmoji(p)} {p.name || p.species}
                </Button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
