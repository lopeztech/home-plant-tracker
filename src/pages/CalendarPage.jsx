import { useState, useMemo } from 'react'
import { Button, Badge } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { getWateringStatus } from '../utils/watering.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const { plants, weather, floors } = usePlantContext()
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const now = new Date()
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const monthName = viewDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })

  const isToday = (day) => {
    const t = new Date()
    return day === t.getDate() && month === t.getMonth() && year === t.getFullYear()
  }

  const dayMap = useMemo(() => {
    const map = {}
    for (const plant of plants) {
      // Past waterings
      for (const entry of plant.wateringLog || []) {
        const d = new Date(entry.date)
        if (d.getMonth() === month && d.getFullYear() === year) {
          const day = d.getDate()
          if (!map[day]) map[day] = []
          map[day].push({ type: 'watered', plant })
        }
      }
      // Future due dates
      const status = getWateringStatus(plant, weather, floors)
      if (plant.lastWatered && plant.frequencyDays) {
        let nextDue = new Date(plant.lastWatered)
        for (let i = 0; i < 60; i++) {
          nextDue = new Date(nextDue.getTime() + plant.frequencyDays * 86400000)
          if (nextDue.getMonth() === month && nextDue.getFullYear() === year) {
            const day = nextDue.getDate()
            if (!map[day]) map[day] = []
            map[day].push({ type: 'due', plant })
          }
          if (nextDue > new Date(year, month + 1, 0)) break
        }
      }
    }
    return map
  }, [plants, weather, floors, month, year])

  const selectedEvents = selectedDay ? dayMap[selectedDay] || [] : []

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
              <Button variant="outline-default" size="sm" className="me-1" onClick={() => setMonthOffset((m) => m - 1)}>
                <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#chevron-left"></use></svg>
              </Button>
              <Button variant="outline-default" size="sm" onClick={() => setMonthOffset((m) => m + 1)}>
                <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#chevron-right"></use></svg>
              </Button>
            </div>
          </div>
          <div className="panel-container">
            <div className="panel-content">
              {/* Weekday headers */}
              <div className="d-grid mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-muted fs-xs fw-600 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="d-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const events = dayMap[day]
                  const hasWatered = events?.some((e) => e.type === 'watered')
                  const hasDue = events?.some((e) => e.type === 'due')
                  const isSelected = selectedDay === day

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                      className={`btn btn-sm d-flex flex-column align-items-center justify-content-center py-2 ${
                        isSelected ? 'btn-primary' : isToday(day) ? 'btn-outline-primary fw-bold' : 'btn-light'
                      }`}
                    >
                      <span>{day}</span>
                      {events && (
                        <div className="d-flex gap-1 mt-1">
                          {hasWatered && <span className="rounded-circle bg-info d-inline-block" style={{ width: 5, height: 5 }} />}
                          {hasDue && <span className="rounded-circle bg-warning d-inline-block" style={{ width: 5, height: 5 }} />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="d-flex gap-3 mt-3 fs-xs text-muted">
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-info d-inline-block" style={{ width: 6, height: 6 }} /> Watered
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span className="rounded-circle bg-warning d-inline-block" style={{ width: 6, height: 6 }} /> Due
                </span>
              </div>

              {/* Selected day events */}
              {selectedDay && (
                <div className="mt-3 border-top pt-3">
                  <h6 className="fw-500 mb-2">{monthName.split(' ')[0]} {selectedDay}</h6>
                  {selectedEvents.length === 0 ? (
                    <p className="text-muted fs-sm">No events this day.</p>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {selectedEvents.map((evt, i) => (
                        <li key={i} className="d-flex align-items-center gap-2 mb-1 fs-sm">
                          <Badge bg={evt.type === 'watered' ? 'info' : 'warning'} className="fs-nano">{evt.type}</Badge>
                          <span>{evt.plant.name}</span>
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
