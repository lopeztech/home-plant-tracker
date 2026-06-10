import React from 'react'
import { C } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'
import { CIconBadge, pressProps, iconBtn } from '../primitives.jsx'
import { MStatusSpace, MBrandHeader, MScroll } from '../shell.jsx'

function buildWeekStrip() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()
  // Build 7 days starting from Monday of current week
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const isToday = d.toDateString() === today.toDateString()
    return { abbr: days[d.getDay()], date: d.getDate(), isToday }
  })
}

function buildAgenda(plants) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const groups = []

  // today
  const todayPlants = plants.filter((p) => p._daysUntil <= 0)
  if (todayPlants.length > 0) {
    const label = `Today · ${today.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}`
    groups.push({ day: label, isToday: true, plants: todayPlants })
  }

  // upcoming 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    const due = plants.filter((p) => p._daysUntil === offset)
    if (due.length > 0) {
      const label = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
      groups.push({ day: label, isToday: false, plants: due })
    }
  }

  return groups
}

export function Calendar({ plants, wateredSet, onWater, openPlant }) {
  const weekStrip = buildWeekStrip()
  const agenda = buildAgenda(plants)
  const today = new Date()
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long' })
  const yearLabel = today.getFullYear().toString()

  return (
    <>
      <MStatusSpace />
      <MBrandHeader />
      <div style={{ padding: '4px 18px 0', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: C.serif, fontSize: 26, fontWeight: 400,
          margin: 0, letterSpacing: -0.3,
        }}>
          {monthLabel}{' '}
          <span style={{ fontStyle: 'italic', color: C.terra }}>{yearLabel}</span>
        </h1>
      </div>

      {/* week strip */}
      <div style={{ display: 'flex', gap: C.sp.xs, padding: '14px 16px 0', flexShrink: 0 }}>
        {weekStrip.map(({ abbr, date, isToday }) => (
          <div key={date} style={{
            flex: 1, background: isToday ? C.terra : C.card,
            border: `1px solid ${isToday ? C.terra : C.line2}`,
            borderRadius: C.r.md, padding: '9px 0', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: C.sans, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', color: isToday ? '#fff' : C.muted,
            }}>{abbr}</div>
            <div style={{
              fontFamily: C.serif, fontSize: 18,
              color: isToday ? '#fff' : C.ink, marginTop: 2,
            }}>{date}</div>
          </div>
        ))}
      </div>

      <MScroll style={{ padding: '18px 18px 12px' }}>
        {agenda.length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontFamily: C.serif, fontStyle: 'italic', fontSize: 16, color: C.muted,
          }}>
            No waterings coming up this week.
          </div>
        ) : (
          agenda.map((g) => (
            <div key={g.day} style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: C.sans, fontSize: 11, fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase',
                color: g.isToday ? C.terra : C.muted, marginBottom: C.sp.sm,
              }}>
                {g.day}
              </div>
              {g.plants.map((p) => {
                const wet = wateredSet.has(p.id)
                const effectivePlant = wet ? { ...p, _status: 'ok' } : p
                return (
                  <div key={p.id}
                    {...pressProps(() => openPlant(p.id), `Open ${p.name}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: C.sp.md,
                      padding: '9px 0', borderBottom: `1px solid ${C.line2}`, cursor: 'pointer',
                    }}>
                    <CIconBadge plant={effectivePlant} size={38} radius={C.r.sm} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: C.serif, fontSize: 16, color: C.ink, lineHeight: 1.05 }}>
                        {p.name}
                      </div>
                      <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                        {p.room}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onWater(p.id) }}
                      aria-label={`Mark ${p.name} watered`}
                      style={{ ...iconBtn, minWidth: C.tap, minHeight: C.tap }}>
                      <CIcon
                        d={wet ? IC.check : IC.drop}
                        size={18}
                        color={wet ? C.greenBright : C.terra}
                        fill={wet ? 'none' : C.terra}
                        w={wet ? 2.2 : 0}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </MScroll>
    </>
  )
}
