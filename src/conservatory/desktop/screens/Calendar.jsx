import React, { useState, useMemo } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn, CIconBadge, pressProps } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildEvents(plants) {
  const events = {}
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const year = now.getFullYear()
  const month = now.getMonth()
  plants.forEach((p) => {
    if (!p.frequencyDays) return
    const cadence = p.frequencyDays
    const base = p.lastWatered ? new Date(p.lastWatered) : new Date(now.getTime() - p._daysUntil * 86400000)
    // future events
    let d = new Date(base.getTime() + cadence * 86400000)
    while (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!events[day]) events[day] = []
      events[day].push(p)
      d = new Date(d.getTime() + cadence * 86400000)
    }
    // past events for texture
    let b = new Date(base.getTime())
    while (b >= new Date(year, month, 1) && b.getMonth() === month) {
      const day = b.getDate()
      if (!events[day]) events[day] = []
      if (!events[day].some((x) => x.id === p.id)) events[day].push({ ...p, _past: true })
      b = new Date(b.getTime() - cadence * 86400000)
    }
  })
  return events
}

function CalCell({ day, events, isToday, isPast, openPlant }) {
  if (day == null) return <div />
  const evs = (events[day] || []).slice(0, 4)
  return (
    <div style={{
      background: isToday ? C.terraSoft : C.card,
      border: `1px solid ${isToday ? C.terra + '66' : C.line2}`,
      borderRadius: 7, padding: '8px 9px', minHeight: 92,
      display: 'flex', flexDirection: 'column', opacity: isPast ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: C.serif, fontSize: 16, fontStyle: isToday ? 'italic' : 'normal', color: isToday ? C.terra : C.ink }}>{day}</span>
        {isToday && <span style={{ fontFamily: C.sans, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.terra }}>Today</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
        {evs.map((p, i) => {
          const s = CSTAT[p._past ? 'ok' : p._status] || CSTAT.ok
          return (
            <div key={i} title={p.name} style={{ width: 22, height: 22, borderRadius: '50%', background: p._past ? C.panel : s.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: p._past ? 'none' : `inset 0 0 0 1.2px ${s.color}` }}>
              <PlantIcon type={p.icon || 'monstera'} size={16} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalWeekRow({ plant, daysUntil, openPlant }) {
  const d = new Date()
  d.setDate(d.getDate() + daysUntil)
  const label = d.toLocaleDateString('en-US', { weekday: 'short' })
  const day = d.getDate()
  const s = CSTAT[plant._status] || CSTAT.ok
  return (
    <div {...pressProps(() => openPlant(plant.id), `Open ${plant.name}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.line2}`, cursor: 'pointer' }}>
      <div style={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: C.sans, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.muted, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontFamily: C.serif, fontSize: 20, color: C.ink, lineHeight: 1 }}>{day}</div>
      </div>
      <CIconBadge plant={plant} size={38} radius={11} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.serif, fontSize: 16, color: C.ink, lineHeight: 1.05 }}>{plant.name}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{plant.room}</div>
      </div>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
    </div>
  )
}

export function Calendar({ plants, ctx }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(today)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const calEvents = useMemo(() => buildEvents(plants), [plants])
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year
  const todayDate = today.getDate()
  const weekAhead = [...plants].filter((p) => p._daysUntil >= 0 && p._daysUntil <= 7).sort((a, b) => a._daysUntil - b._daysUntil).slice(0, 5)
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="calendar" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 336px', gap: 30, padding: '28px 34px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
            <div>
              <CKicker>The watering calendar</CKicker>
              <h1 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
                {monthName} <span style={{ fontStyle: 'italic', color: C.terra }}>{year}</span>
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.line}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <CIcon d={IC.chevL} size={18} color={C.ink} />
              </button>
              <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.line}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <CIcon d={IC.chevR} size={18} color={C.ink} />
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7, marginBottom: 7 }}>
            {WD.map((d) => <div key={d} style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: C.muted, textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: '1fr', gap: 7 }}>
            {cells.map((d, i) => <CalCell key={i} day={d} events={calEvents} isToday={isCurrentMonth && d === todayDate} isPast={isCurrentMonth && d < todayDate} openPlant={ctx.openPlant} />)}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <CKicker>This week</CKicker>
            <div style={{ fontFamily: C.serif, fontSize: 21, color: C.ink, margin: '4px 0 6px' }}>{weekAhead.length} waterings ahead</div>
            {weekAhead.map((p) => <CalWeekRow key={p.id} plant={p} daysUntil={p._daysUntil} openPlant={ctx.openPlant} />)}
            {weekAhead.length === 0 && <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted, padding: '12px 0' }}>All caught up this week.</div>}
          </div>
          {ctx.weather?.rainSoon && (
            <div style={{ background: C.goldSoft, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.serif, fontSize: 17, fontStyle: 'italic', color: C.goldDeep, marginBottom: 3 }}>Due dates shifted.</div>
              <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Rain in the forecast has automatically pushed outdoor plant waterings.</div>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <CBtn kind="ghost" full><CIcon d={IC.plus} size={17} color={C.terra} w={2} /> Add a care reminder</CBtn>
        </aside>
      </div>
    </div>
  )
}
