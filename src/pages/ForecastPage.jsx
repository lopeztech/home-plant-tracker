import { useMemo } from 'react'
import { Row, Col, Badge } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { isOutdoor } from '../utils/watering.js'
import { formatTemperatureC } from '../utils/units.js'
import SeasonBadge from '../components/SeasonBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'

function dayLabel(dateStr, index) {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(dateStr + 'T12:00:00'))
}

export default function ForecastPage() {
  const { weather, plants, floors, location, tempUnit } = usePlantContext()

  const outdoorPlants = useMemo(
    () => plants.filter((p) => isOutdoor(p, floors)),
    [plants, floors],
  )

  if (!weather) {
    return (
      <div className="content-wrapper">
        <h1 className="subheader-title mb-4">Forecast</h1>
        <div className="panel panel-icon">
          <div className="panel-container"><div className="panel-content">
            <EmptyState
              icon="cloud"
              title="No weather data yet"
              description="Allow location access so we can fetch your local forecast, or set a city manually in Settings."
              actions={[
                { label: 'Set location', icon: 'map-pin', href: '/settings' },
              ]}
            />
          </div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-2">7-Day Forecast</h1>
      {location?.name && <p className="text-muted mb-4">{location.name}{location.country ? `, ${location.country}` : ''}</p>}

      <div className="main-content">
        {/* Current conditions */}
        <div className="panel panel-icon mb-4">
          <div className="panel-hdr"><span>Current Conditions</span></div>
          <div className="panel-container"><div className="panel-content">
            <div className="d-flex align-items-center gap-3">
              <span style={{ fontSize: '3rem' }}>{weather.current.condition.emoji}</span>
              <div>
                <h2 className="mb-0">{weather.current.temp}°{weather.unit === 'fahrenheit' ? 'F' : 'C'}</h2>
                <span className="text-muted">{weather.current.condition.label}</span>
              </div>
              <div className="ms-auto">
                <SeasonBadge lat={weather.location?.lat} />
              </div>
            </div>
          </div></div>
        </div>

        {/* 7-day forecast */}
        <div className="panel panel-icon mb-4">
          <div className="panel-hdr"><span>7-Day Forecast</span></div>
          <div className="panel-container"><div className="panel-content p-0">
            {weather.days.map((day, i) => {
              const hasRain = day.precipitation >= 2
              return (
                <div
                  key={day.date}
                  className={`d-flex align-items-center gap-3 px-3 py-3 ${i < weather.days.length - 1 ? 'border-bottom' : ''}`}
                >
                  <span className="fw-500" style={{ width: 100 }}>{dayLabel(day.date, i)}</span>
                  <span style={{ fontSize: '1.5rem', width: 40 }}>{day.condition.emoji}</span>
                  <span className="flex-grow-1 text-muted">{day.condition.label}</span>
                  {hasRain && (
                    <Badge bg="info" className="d-flex align-items-center gap-1">
                      <svg className="sa-icon" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#cloud-rain"></use></svg>
                      {day.precipitation.toFixed(1)}mm
                    </Badge>
                  )}
                  <span className="fw-500 text-end" style={{ width: 80 }}>
                    {day.maxTemp}° <span className="text-muted fw-normal">/ {day.minTemp}°</span>
                  </span>
                </div>
              )
            })}
          </div></div>
        </div>

        {/* Outdoor plant impact */}
        {outdoorPlants.length > 0 && (
          <div className="panel panel-icon">
            <div className="panel-hdr"><span>Outdoor Plant Impact</span></div>
            <div className="panel-container"><div className="panel-content">
              <p className="text-muted fs-sm mb-3">
                How the forecast affects your {outdoorPlants.length} outdoor plant{outdoorPlants.length !== 1 ? 's' : ''}:
              </p>
              {(() => {
                const rainyDays = weather.days.filter((d) => d.precipitation >= 2)
                const hotDays = weather.days.filter((d) => {
                  const maxC = weather.unit === 'fahrenheit' ? (d.maxTemp - 32) * 5 / 9 : d.maxTemp
                  return maxC >= 30
                })
                const coldDays = weather.days.filter((d) => {
                  const minC = weather.unit === 'fahrenheit' ? (d.minTemp - 32) * 5 / 9 : d.minTemp
                  return minC <= 10
                })

                return (
                  <div className="d-flex flex-column gap-2">
                    {rainyDays.length > 0 && (
                      <div className="d-flex align-items-center gap-2 p-2 rounded bg-info bg-opacity-10">
                        <svg className="sa-icon text-info" style={{ width: 16, height: 16 }}><use href="/icons/sprite.svg#cloud-rain"></use></svg>
                        <span className="fs-sm">
                          <strong>{rainyDays.length} rainy day{rainyDays.length !== 1 ? 's' : ''}</strong> — outdoor plants will be auto-watered by rain
                        </span>
                      </div>
                    )}
                    {hotDays.length > 0 && (
                      <div className="d-flex align-items-center gap-2 p-2 rounded bg-warning bg-opacity-10">
                        <svg className="sa-icon text-warning" style={{ width: 16, height: 16 }}><use href="/icons/sprite.svg#sun"></use></svg>
                        <span className="fs-sm">
                          <strong>{hotDays.length} hot day{hotDays.length !== 1 ? 's' : ''}</strong> (≥{formatTemperatureC(30, tempUnit?.unit)}) — water amounts increased by 25-50%
                        </span>
                      </div>
                    )}
                    {coldDays.length > 0 && (
                      <div className="d-flex align-items-center gap-2 p-2 rounded bg-primary bg-opacity-10">
                        <svg className="sa-icon text-primary" style={{ width: 16, height: 16 }}><use href="/icons/sprite.svg#thermometer"></use></svg>
                        <span className="fs-sm">
                          <strong>{coldDays.length} cold day{coldDays.length !== 1 ? 's' : ''}</strong> (≤{formatTemperatureC(10, tempUnit?.unit)}) — water amounts reduced by 25%
                        </span>
                      </div>
                    )}
                    {rainyDays.length === 0 && hotDays.length === 0 && coldDays.length === 0 && (
                      <p className="text-muted fs-sm mb-0">Mild conditions — no watering adjustments needed this week.</p>
                    )}
                  </div>
                )
              })()}
            </div></div>
          </div>
        )}
      </div>
    </div>
  )
}
