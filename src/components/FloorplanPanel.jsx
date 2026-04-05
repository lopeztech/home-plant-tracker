import { useMemo, useState, lazy, Suspense } from 'react'
import { Nav, Spinner, ButtonGroup, Button } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'
import LeafletFloorplan from './LeafletFloorplan.jsx'
import HouseWeatherFrame from './HouseWeatherFrame.jsx'

const Floorplan3D = lazy(() => import('./Floorplan3D.jsx'))

export default function FloorplanPanel({ onPlantClick, onFloorplanClick }) {
  const {
    plants, floors, activeFloorId, setActiveFloorId,
    weather, location, handleMarkerDrag, handleFloorRoomsChange,
    isAnalysingFloorplan,
  } = usePlantContext()

  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('2d')

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
            onMarkerDrag={handleMarkerDrag}
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
