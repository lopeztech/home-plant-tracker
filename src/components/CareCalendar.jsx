import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Droplets, Calendar } from 'lucide-react'
import { getWateringStatus } from '../utils/watering.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday-based
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

export default function CareCalendar({ plants, weather, floors, onClose }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1); setSelectedDay(null) }
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1); setSelectedDay(null) }

  // Build watering events map: day number → [{ plant, type }]
  const { dayMap, dueDays } = useMemo(() => {
    const map = {}
    const dues = new Set()
    const daysInMonth = getDaysInMonth(year, month)

    for (const plant of plants) {
      // Past waterings from wateringLog
      for (const entry of (plant.wateringLog || [])) {
        const d = new Date(entry.date)
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate()
          if (!map[day]) map[day] = []
          map[day].push({ plant, type: 'watered' })
        }
      }

      // Future due dates (projected from lastWatered + frequencyDays)
      if (plant.lastWatered && plant.frequencyDays) {
        let nextDue = new Date(plant.lastWatered)
        for (let i = 0; i < 60; i++) {
          nextDue = new Date(nextDue.getTime() + plant.frequencyDays * 86400000)
          if (nextDue.getFullYear() === year && nextDue.getMonth() === month) {
            const day = nextDue.getDate()
            if (!map[day]) map[day] = []
            map[day].push({ plant, type: 'due' })
            dues.add(day)
          }
          if (nextDue > new Date(year, month + 2, 0)) break
        }
      }
    }
    return { dayMap: map, dueDays: dues }
  }, [plants, year, month])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const today = new Date()
  const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d

  const selectedEvents = selectedDay ? (dayMap[selectedDay] || []) : []
  const monthName = new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' })

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in-up w-full flex-1 md:flex-none md:max-w-md bg-gray-900 md:border md:border-gray-800 md:rounded-soft-xl shadow-soft-xl flex flex-col md:max-h-[calc(100vh-2rem)]"
        style={{ background: 'linear-gradient(180deg, var(--tw-gray-900) 0%, var(--surface-gradient-end) 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-emerald-400" />
            <h2 className="text-sm font-medium text-gray-100">Care Schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-300 font-medium w-36 text-center">{monthName}</span>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-4 pt-3 pb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs text-gray-600 font-medium">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-4 pb-3 gap-y-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const events = dayMap[day]
            const hasWatered = events?.some(e => e.type === 'watered')
            const hasDue = events?.some(e => e.type === 'due')
            const isSelected = selectedDay === day

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                className={`relative flex flex-col items-center justify-center h-10 rounded-lg text-xs transition-colors ${
                  isSelected
                    ? 'bg-emerald-900/50 border border-emerald-700 text-white'
                    : isToday(day)
                      ? 'bg-gray-800 text-white font-bold'
                      : 'hover:bg-gray-800/50 text-gray-400'
                }`}
              >
                <span>{day}</span>
                {events && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasWatered && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    {hasDue && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Watered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span>Due</span>
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="border-t border-gray-800 px-5 py-3 max-h-48 overflow-y-auto scrollbar-thin">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              {new Date(year, month, selectedDay).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-gray-600">No watering events</p>
            ) : (
              <div className="space-y-1.5">
                {selectedEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Droplets size={11} className={ev.type === 'watered' ? 'text-blue-400' : 'text-orange-400'} />
                    <span className="text-gray-300">{ev.plant.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      ev.type === 'watered' ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'
                    }`}>
                      {ev.type === 'watered' ? 'Watered' : 'Due'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
