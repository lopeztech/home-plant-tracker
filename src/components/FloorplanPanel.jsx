import { useMemo } from 'react'
import { Nav, Spinner } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import LeafletFloorplan from './LeafletFloorplan.jsx'

const WEATHER_STYLES = {
  sunny:  { bg: 'linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)', emoji: '☀️', label: 'Sunny' },
  partly: { bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd, #7dd3fc)', emoji: '⛅', label: 'Partly Cloudy' },
  cloudy: { bg: 'linear-gradient(135deg, #e2e8f0, #cbd5e1, #94a3b8)', emoji: '☁️', label: 'Cloudy' },
  foggy:  { bg: 'linear-gradient(135deg, #e2e8f0, #d1d5db, #9ca3af)', emoji: '🌫️', label: 'Foggy' },
  rainy:  { bg: 'linear-gradient(135deg, #bfdbfe, #93c5fd, #60a5fa)', emoji: '🌧️', label: 'Rainy' },
  stormy: { bg: 'linear-gradient(135deg, #c7d2fe, #a5b4fc, #818cf8)', emoji: '⛈️', label: 'Stormy' },
  snowy:  { bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0, #cbd5e1)', emoji: '🌨️', label: 'Snowy' },
  night:  { bg: 'linear-gradient(135deg, #1e293b, #334155, #475569)', emoji: '🌙', label: 'Night' },
}

function WeatherStrip({ weather }) {
  if (!weather?.current) return null
  const condition = weather.current.condition?.sky || 'sunny'
  const style = WEATHER_STYLES[condition] || WEATHER_STYLES.sunny
  const isNight = !weather.current.isDay
  const display = isNight ? WEATHER_STYLES.night : style

  return (
    <div
      className="d-flex align-items-center justify-content-center gap-2 py-2 px-3"
      style={{ background: display.bg, color: isNight ? '#e2e8f0' : '#1e293b' }}
    >
      <span style={{ fontSize: '1.5rem' }}>{weather.current.condition?.emoji || display.emoji}</span>
      <span className="fw-500">{weather.current.temp}°{weather.unit === 'fahrenheit' ? 'F' : 'C'}</span>
      <span className="opacity-75 fs-sm">{weather.current.condition?.label || display.label}</span>
    </div>
  )
}

export default function FloorplanPanel({ onPlantClick, onFloorplanClick }) {
  const {
    plants, floors, activeFloorId, setActiveFloorId,
    weather, handleMarkerDrag, handleFloorRoomsChange,
    isAnalysingFloorplan,
  } = usePlantContext()

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
        <span>Floorplan</span>
        <div className="panel-toolbar"></div>
      </div>
      <div className="panel-container">
        <div className="panel-content p-0">
          {/* Weather strip */}
          <WeatherStrip weather={weather} />

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
                editMode={false}
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
