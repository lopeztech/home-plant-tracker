import { useState, useMemo, useCallback } from 'react'
import { Nav, Button, Spinner } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import LeafletFloorplan from './LeafletFloorplan.jsx'

export default function FloorplanPanel({ onPlantClick, onFloorplanClick }) {
  const {
    plants, floors, activeFloorId, setActiveFloorId,
    weather, handleMarkerDrag, handleFloorRoomsChange,
    isAnalysingFloorplan,
  } = usePlantContext()

  const [editZones, setEditZones] = useState(false)

  const visibleFloors = useMemo(
    () => [...floors].filter((f) => !f.hidden).sort((a, b) => b.order - a.order),
    [floors],
  )

  const activeFloor = useMemo(
    () => floors.find((f) => f.id === activeFloorId),
    [floors, activeFloorId],
  )

  const plantsOnFloor = useMemo(
    () => plants.filter((p) => (p.floor || 'ground') === activeFloorId),
    [plants, activeFloorId],
  )

  return (
    <div className="panel panel-icon">
      <div className="panel-hdr">
        <span>
          Floorplan
          {activeFloor && <small className="text-muted ms-2">— {activeFloor.name}</small>}
        </span>
        <div className="panel-toolbar">
          {activeFloor?.rooms?.length > 0 && (
            <Button
              variant={editZones ? 'primary' : 'outline-default'}
              size="sm"
              className="waves-effect waves-themed me-2"
              onClick={() => setEditZones((z) => !z)}
            >
              <svg className="sa-icon me-1"><use href="/icons/sprite.svg#edit-3"></use></svg>
              {editZones ? 'Done' : 'Edit Zones'}
            </Button>
          )}
        </div>
      </div>
      <div className="panel-container">
        <div className="panel-content p-0">
          {/* Floor tabs */}
          {visibleFloors.length > 1 && (
            <Nav variant="pills" className="px-3 pt-2 gap-1 flex-nowrap overflow-auto">
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
          )}

          {/* Leaflet map */}
          <div className="floorplan-wrapper" style={{ minHeight: 450 }}>
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
            {activeFloor && (
              <LeafletFloorplan
                key={activeFloor.id}
                floor={activeFloor}
                floors={floors}
                plants={plantsOnFloor}
                weather={weather}
                onFloorplanClick={onFloorplanClick}
                onMarkerClick={onPlantClick}
                onMarkerDrag={handleMarkerDrag}
                editMode={editZones}
                onRoomsChange={handleFloorRoomsChange}
              />
            )}
          </div>

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
        </div>
      </div>
    </div>
  )
}
