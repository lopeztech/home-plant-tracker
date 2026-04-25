import { useState, useMemo, useCallback } from 'react'
import { Button, Badge } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { getWateringStatus, localDateStr } from '../utils/watering.js'
import { getFeedingStatus } from '../utils/feeding.js'
import EmptyState from '../components/EmptyState.jsx'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function eventBadgeColor(type) {
  if (type === 'watered') return 'info'
  if (type === 'due') return 'warning'
  if (type === 'fertilised') return 'success'
  if (type === 'feed-due') return 'primary'
  return 'secondary'
}

export default function CalendarPage() {
  const { plants, weather, floors, timezone, handleWaterPlant } = usePlantContext()
  const [monthOffset, setMonthOffset] = useState(0)
  const [watering, setWatering] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)

  const handleWater = useCallback(async (plantId) => {
    setWatering(prev => ({ ...prev, [plantId]: true }))
    try {
      await handleWaterPlant(plantId)
    } finally {
      setWatering(prev => ({ ...prev, [plantId]: false }))
    }
  }, [handleWaterPlant])

  // Use the user's timezone for "today" and date boundary calculations
  const todayStr = localDateStr(new Date(), timezone)
  const [todayYear, todayMonth1, todayDay] = todayStr.split('-').map(Number)
  const todayMonth = todayMonth1 - 1

  const viewYear  = monthOffset === 0 ? todayYear  : (() => { const d = new Date(todayYear, todayMonth + monthOffset, 1); return d.getFullYear() })()
  const viewMonth = monthOffset === 0 ? todayMonth : (() => { const d = new Date(todayYear, todayMonth + monthOffset, 1); return d.getMonth() })()
  const year  = viewYear
  const month = viewMonth
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

  const isToday = (day) => day === todayDay && month === todayMonth && year === todayYear

  const dayMap = useMemo(() => {
    const map = {}
    const monthEndTs = new Date(year, month + 1, 0).getTime()
    for (const plant of plants) {
      // Past waterings — place on the day they occurred in the user's timezone
      for (const entry of plant.wateringLog || []) {
        const ds = localDateStr(new Date(entry.date), timezone)
        const [eY, eM1, eD] = ds.split('-').map(Number)
        if (eM1 - 1 === month && eY === year) {
          if (!map[eD]) map[eD] = []
          map[eD].push({ type: 'watered', plant })
        }
      }
      // Past fertilisings
      for (const entry of plant.fertiliserLog || []) {
        const ds = localDateStr(new Date(entry.date), timezone)
        const [eY, eM1, eD] = ds.split('-').map(Number)
        if (eM1 - 1 === month && eY === year) {
          if (!map[eD]) map[eD] = []
          map[eD].push({ type: 'fertilised', plant })
        }
      }
      // Future watering due dates
      if (plant.lastWatered && plant.frequencyDays) {
        let nextDue = new Date(plant.lastWatered)
        for (let i = 0; i < 60; i++) {
          nextDue = new Date(nextDue.getTime() + plant.frequencyDays * 86400000)
          const ds = localDateStr(nextDue, timezone)
          const [eY, eM1, eD] = ds.split('-').map(Number)
          if (eM1 - 1 === month && eY === year) {
            if (!map[eD]) map[eD] = []
            map[eD].push({ type: 'due', plant })
          }
          if (nextDue.getTime() > monthEndTs) break
        }
      }
      // Future feeding due dates
      const feedStatus = getFeedingStatus(plant, weather)
      if (!feedStatus.skip && plant.lastFertilised && feedStatus.effectiveFrequencyDays) {
        let nextFeed = new Date(plant.lastFertilised)
        for (let i = 0; i < 24; i++) {
          nextFeed = new Date(nextFeed.getTime() + feedStatus.effectiveFrequencyDays * 86400000)
          const ds = localDateStr(nextFeed, timezone)
          const [eY, eM1, eD] = ds.split('-').map(Number)
          if (eM1 - 1 === month && eY === year) {
            if (!map[eD]) map[eD] = []
            map[eD].push({ type: 'feed-due', plant })
          }
          if (nextFeed.getTime() > monthEndTs) break
        }
      }
    }
    return map
  }, [plants, weather, floors, month, year, timezone])

  const selectedEvents = selectedDay ? dayMap[selectedDay] || [] : []

  if (plants.length === 0) {
    return (
      <div className="content-wrapper">
        <h1 className="subheader-title mb-4">Care Calendar</h1>
        <div className="main-content">
          <div className="panel panel-icon">
            <div className="panel-container"><div className="panel-content">
              <EmptyState
                icon="calendar"
                title="Nothing scheduled yet"
                description="Your care calendar will fill up once you add plants and start logging waterings. Add your first plant to get started."
                actions={[
                  { label: 'Add a plant', icon: 'plus', href: '/' },
                ]}
              />
            </div></div>
          </div>
        </div>
      </div>
    )
  }

  const hasEventsThisMonth = Object.keys(dayMap).length > 0

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-4">Care Calendar</h1>
      <div className="main-content">
        <div className="panel panel-icon">
          <div className="panel-hdr">
            <span>
              <svg className="sa-icon me-2"><use href="/icons/sprite.svg#calendar"></use></svg>
              {monthName}
            </span>
            <div className="panel-toolbar">
              <Button variant="outline-default" size="sm" className="me-1" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month">
                <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#chevron-left"></use></svg>
              </Button>
              <Button variant="outline-default" size="sm" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month">
                <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#chevron-right"></use></svg>
              </Button>
            </div>
          </div>
          <div className="panel-container">
            <div className="panel-content care-calendar">
              {/* Weekday headers — show first letter only on phones to keep cells wide */}
              <div className="d-grid mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-muted fs-xs fw-600 py-1">
                    <span className="d-none d-sm-inline">{d}</span>
                    <span className="d-inline d-sm-none" aria-hidden="true">{d.charAt(0)}</span>
                    <span className="visually-hidden d-sm-none">{d}</span>
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="d-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const events = dayMap[day]
                  const hasWatered = events?.some((e) => e.type === 'watered')
                  const hasDue = events?.some((e) => e.type === 'due')
                  const hasFertilised = events?.some((e) => e.type === 'fertilised')
                  const hasFeedDue = events?.some((e) => e.type === 'feed-due')
                  const isSelected = selectedDay === day

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                      className={`btn btn-sm calendar-day d-flex flex-column align-items-center justify-content-center py-2 ${
                        isSelected ? 'btn-primary' : isToday(day) ? 'btn-outline-primary fw-bold' : 'btn-light'
                      }`}
                    >
                      <span>{day}</span>
                      {events && (
                        <div className="d-flex gap-1 mt-1">
                          {hasWatered && <span className="rounded-circle bg-info d-inline-block calendar-day-marker" style={{ width: 5, height: 5 }} />}
                          {hasDue && <span className="rounded-circle bg-warning d-inline-block calendar-day-marker" style={{ width: 5, height: 5 }} />}
                          {hasFertilised && <span className="rounded-circle bg-success d-inline-block calendar-day-marker" style={{ width: 5, height: 5 }} />}
                          {hasFeedDue && <span className="rounded-circle bg-primary d-inline-block calendar-day-marker" style={{ width: 5, height: 5 }} />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="d-flex flex-wrap gap-3 mt-3 fs-xs text-muted">
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-info d-inline-block" style={{ width: 6, height: 6 }} /> Watered
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-warning d-inline-block" style={{ width: 6, height: 6 }} /> Water due
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-success d-inline-block" style={{ width: 6, height: 6 }} /> Fertilised
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-primary d-inline-block" style={{ width: 6, height: 6 }} /> Feed due
                </span>
              </div>

              {/* Empty month notice */}
              {!hasEventsThisMonth && (
                <div className="mt-3 text-center text-muted fs-sm">
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#calendar"></use></svg>
                  No care events recorded or scheduled this month.
                </div>
              )}

              {/* Selected day events */}
              {selectedDay && (
                <div className="mt-3 border-top pt-3">
                  <h6 className="fw-500 mb-2">{monthName.split(' ')[0]} {selectedDay}</h6>
                  {selectedEvents.length === 0 ? (
                    <p className="text-muted fs-sm">No events this day.</p>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {selectedEvents.map((evt, i) => (
                        <li key={i} className="d-flex align-items-center gap-2 mb-2 fs-sm flex-wrap">
                          <Badge bg={eventBadgeColor(evt.type)} className="fs-nano">{evt.type.replace('-', ' ')}</Badge>
                          <span className="flex-grow-1">{evt.plant.name}</span>
                          {evt.type === 'due' && handleWaterPlant && (
                            <Button
                              size="sm"
                              variant="outline-info"
                              style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}
                              disabled={!!watering[evt.plant.id]}
                              onClick={() => handleWater(evt.plant.id)}
                            >
                              {watering[evt.plant.id] ? '…' : 'Mark watered'}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
