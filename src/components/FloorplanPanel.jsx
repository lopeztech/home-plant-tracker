import { useMemo, useState, useCallback, lazy, Suspense } from 'react'
import { Nav, Spinner, ButtonGroup, Button } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'
import LeafletFloorplan from './LeafletFloorplan.jsx'
import HouseWeatherFrame from './HouseWeatherFrame.jsx'

const Floorplan3D = lazy(() => import('./Floorplan3D.jsx'))

export default function FloorplanPanel({ onPlantClick, onFloorplanClick }) {
  const {
    plants, floors, activeFloorId, setActiveFloorId,
    weather, location, handleFloorRoomsChange,
    isAnalysingFloorplan, isGuest, updatePlantsLocally,
  } = usePlantContext()

  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('2d')
  const [pendingMoves, setPendingMoves] = useState({}) // { plantId: { x, y, room } }
  const [saving, setSaving] = useState(false)

  const visibleFloors = useMemo(
    () => [...floors].filter((f) => !f.hidden).sort((a, b) => b.order - a.order),
    [floors],
  )

  const activeFloor = useMemo(
    () => floors.find((f) => f.id === activeFloorId),
    [floors, activeFloorId],
  )

  // Merge pending moves into plants for display
  const plantsOnFloor = useMemo(() => {
    return plants
      .filter((p) => (p.floor || 'ground') === activeFloorId)
      .map((p) => pendingMoves[p.id] ? { ...p, ...pendingMoves[p.id] } : p)
  }, [plants, activeFloorId, pendingMoves])

  const hasPendingMoves = Object.keys(pendingMoves).length > 0

  // Local drag handler — doesn't call API, just stores pending position
  const handleLocalDrag = useCallback((plant, x, y) => {
    const floor = floors.find((f) => f.id === (plant.floor || activeFloorId))
    let room = plant.room
    if (floor?.rooms?.length) {
      for (const r of floor.rooms) {
        if (r.hidden) continue
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          room = r.name
          break
        }
      }
    }
    setPendingMoves((prev) => ({ ...prev, [plant.id]: { x, y, room } }))
  }, [floors, activeFloorId])

  // Save all pending moves to API
  const handleSaveMoves = useCallback(async () => {
    setSaving(true)
    // Apply to local state first
    updatePlantsLocally(pendingMoves)
    // Persist to API
    if (!isGuest) {
      try {
        const { plantsApi } = await import('../api/plants.js')
        await Promise.all(
          Object.entries(pendingMoves).map(([id, fields]) =>
            plantsApi.update(id, fields)
          )
        )
      } catch (err) {
        console.error('Failed to save plant positions:', err)
      }
    }
    setPendingMoves({})
    setSaving(false)
  }, [pendingMoves, isGuest, updatePlantsLocally])

  return (
    <HouseWeatherFrame weather={weather} location={location} onLocationClick={() => navigate('/settings')}>
      {/* Floor tabs + view toggle */}
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom flex-wrap gap-2">
        <Nav variant="pills" className="gap-1 flex-nowrap overflow-auto flex-grow-1">
          {visibleFloors.map((f) => (
            <Nav.Item key={f.id}>
              <Nav.Link
                active={f.id === activeFloorId}
                onClick={() => setActiveFloorId(f.id)}
                className="floor-tab py-1 px-2"
              >
                <span className="d-inline-flex align-items-center gap-1">
                  {f.type === 'outdoor' && (
                    <svg className="sa-icon sa-thin" style={{ width: 12, height: 12 }}>
                      <use href="/icons/sprite.svg#sun"></use>
                    </svg>
                  )}
                  {f.name}
                </span>
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <ButtonGroup size="sm" className="flex-shrink-0">
          <Button variant={viewMode === '2d' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('2d')} title="2D View">
            <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#grid"></use></svg>
            2D
          </Button>
          <Button variant={viewMode === '3d' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('3d')} title="3D View">
            <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#box"></use></svg>
            3D
          </Button>
        </ButtonGroup>
      </div>

      {/* Map view */}
      <div className="floorplan-wrapper" style={{ height: 500 }}>
        {isAnalysingFloorplan && (
          <div
            className="position-absolute d-flex flex-column align-items-center justify-content-center gap-2 w-100 h-100"
            style={{ background: 'rgba(0,0,0,0.7)', zIndex: 1000, top: 0, left: 0 }}
          >
            <Spinner animation="border" variant="primary" />
            <p className="text-white fw-500 mb-0">Analysing floorplan...</p>
            <small className="text-muted">Identifying floors and rooms</small>
          </div>
        )}
        {activeFloor && viewMode === '2d' && (
          <LeafletFloorplan
            key={activeFloor.id}
            floor={activeFloor}
            floors={floors}
            plants={plantsOnFloor}
            weather={weather}
            onFloorplanClick={onFloorplanClick}
            onMarkerClick={onPlantClick}
            onMarkerDrag={handleLocalDrag}
            editMode={false}
            onRoomsChange={handleFloorRoomsChange}
          />
        )}
        {activeFloor && viewMode === '3d' && (
          <Suspense fallback={<div className="d-flex align-items-center justify-content-center h-100"><Spinner animation="border" variant="primary" /></div>}>
            <Floorplan3D
              floor={activeFloor}
              floors={floors}
              plants={plantsOnFloor}
              weather={weather}
              onPlantClick={onPlantClick}
              onFloorplanClick={onFloorplanClick}
            />
          </Suspense>
        )}
      </div>

      {/* Save positions button */}
      {hasPendingMoves && (
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top bg-warning bg-opacity-10">
          <small className="text-muted">{Object.keys(pendingMoves).length} plant{Object.keys(pendingMoves).length !== 1 ? 's' : ''} moved</small>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={() => setPendingMoves({})}>
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveMoves} disabled={saving}>
              {saving ? 'Saving...' : 'Save Positions'}
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      {plantsOnFloor.length > 0 && (
        <div className="d-flex align-items-center gap-3 px-3 py-2 border-top fs-xs text-muted">
          {[
            { color: '#ef4444', label: 'Overdue' },
            { color: '#f97316', label: 'Due today' },
            { color: '#eab308', label: '1-2 days' },
            { color: '#22c55e', label: 'All good' },
          ].map(({ color, label }) => (
            <span key={label} className="d-flex align-items-center gap-1">
              <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </HouseWeatherFrame>
  )
}
