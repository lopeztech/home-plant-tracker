import React from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn, CStatusChip, CIconBadge, statusOf, pressProps } from '../../primitives.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function Ring({ pct }) {
  const r = 30, cir = 2 * Math.PI * r
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${pct}% of plants cared for`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke={C.line} strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={C.greenBright} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={cir}
        strokeDashoffset={cir * (1 - pct / 100)}
        transform="rotate(-90 38 38)"
        style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="38" y="43" textAnchor="middle" fontFamily={C.serif} fontSize="19" fill={C.ink}>{pct}%</text>
    </svg>
  )
}

function MiniStat({ n, label, color }) {
  return (
    <div style={{ flex: 1, background: C.panel, borderRadius: 6, border: `1px solid ${C.line2}`, padding: '10px 12px' }}>
      <div style={{ fontFamily: C.serif, fontSize: 26, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function TDTask({ plant, isDone, onWater, openPlant }) {
  const s = CSTAT[plant._status] || CSTAT.ok
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
      background: isDone ? 'transparent' : C.card, borderRadius: 8,
      border: `1px solid ${isDone ? 'transparent' : C.line2}`, opacity: isDone ? 0.55 : 1,
    }}>
      <button onClick={() => !isDone && onWater(plant.id)}
        aria-label={isDone ? 'Watered' : `Water ${plant.name}`}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: `2px solid ${isDone ? C.greenBright : s.color}`,
          background: isDone ? C.greenBright : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, cursor: isDone ? 'default' : 'pointer',
          padding: 0,
        }}>
        {isDone && <CIcon d={IC.check} size={15} color="#fff" w={2.6} />}
      </button>
      <CIconBadge plant={isDone ? { ...plant, _status: 'ok' } : plant} size={44} radius={13} />
      <div {...pressProps(() => openPlant(plant.id), `Open ${plant.name}`)}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <div style={{ fontFamily: C.serif, fontSize: 18, color: C.ink, lineHeight: 1.05, textDecoration: isDone ? 'line-through' : 'none' }}>{plant.name}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>{plant.species || ''}</div>
      </div>
      {isDone
        ? <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 700, color: C.greenBright }}>Watered</span>
        : <>
            <CStatusChip status={plant._status}>{plant._status === 'overdue' ? `${Math.abs(plant._daysUntil)}d late` : 'today'}</CStatusChip>
            <CBtn kind="ghost" style={{ padding: '8px 16px', fontSize: 14 }} onClick={() => onWater(plant.id)}>Water</CBtn>
          </>}
    </div>
  )
}

function TDGroup({ room, plants, wateredSet, onWater, openPlant }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <CIcon d={IC.pin} size={16} color={C.terra} w={1.7} />
        <h3 style={{ fontFamily: C.serif, fontSize: 21, margin: 0, color: C.ink, whiteSpace: 'nowrap' }}>{room}</h3>
        <div style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>{plants.length} plant{plants.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plants.map((p) => (
          <TDTask key={p.id} plant={p} isDone={wateredSet.has(p.id)} onWater={onWater} openPlant={openPlant} />
        ))}
      </div>
    </div>
  )
}

export function Today({ plants, wateredSet, onWater, waterAll, openPlant, ctx }) {
  const total = plants.length
  const done = plants.filter((p) => statusOf(p, wateredSet) === 'ok').length
  const dueCount = total - done
  const pct = total > 0 ? Math.round((done / total) * 100) : 100

  // Group plants by room
  const roomMap = {}
  plants.forEach((p) => {
    if (!roomMap[p.room]) roomMap[p.room] = []
    roomMap[p.room].push(p)
  })
  const groups = Object.entries(roomMap).map(([room, ps]) => ({ room, plants: ps }))

  const weatherDisplay = ctx.weather?.current
    ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' }
    : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="today" onNav={ctx.navigate} user={ctx.user} weather={weatherDisplay} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 34, padding: '30px 34px', minHeight: 0, overflow: 'hidden' }}>
        {/* main task list */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ marginBottom: 20 }}>
            <CKicker>{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 37, fontWeight: 400, lineHeight: 1.1, margin: '8px 0 0', letterSpacing: -0.3 }}>
              The day's <span style={{ fontStyle: 'italic', color: C.terra }}>watering round.</span>
            </h1>
            <div style={{ marginTop: 8, marginLeft: 2 }}><CSwash width={210} /></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {groups.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: C.serif, fontStyle: 'italic', fontSize: 18, color: C.muted }}>Every plant has been cared for today.</div>
            ) : (
              groups.map((g) => (
                <TDGroup key={g.room} room={g.room} plants={g.plants} wateredSet={wateredSet} onWater={onWater} openPlant={openPlant} />
              ))
            )}
          </div>
        </div>

        {/* right rail */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{
            background: C.card, borderRadius: 8, border: `1px solid ${C.line}`,
            boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)',
            padding: 20, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <CKicker>Today's progress</CKicker>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
              <Ring pct={pct} />
              <div>
                <div style={{ fontFamily: C.serif, fontSize: 30, color: C.ink, lineHeight: 1 }}>
                  {done} <span style={{ fontStyle: 'italic', color: C.muted, fontSize: 20 }}>/ {total}</span>
                </div>
                <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, marginTop: 3 }}>plants cared for</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <MiniStat n={dueCount} label="still due" color={C.terra} />
              <MiniStat n={done} label="watered" color={C.greenBright} />
            </div>
          </div>

          {ctx.weather?.rainSoon && (
            <div style={{ background: C.sageBg, borderLeft: `3px solid ${C.greenBright}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.serif, fontSize: 17, fontStyle: 'italic', color: C.green, marginBottom: 3 }}>Two plants skipped.</div>
              <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Rain is forecast today, so your outdoor plants don't need watering.</div>
            </div>
          )}

          <div style={{ flex: 1 }} />
          <CBtn kind="primary" full onClick={() => waterAll(plants.map((p) => p.id))}>
            <CIcon d={IC.check} size={17} color="#FFF6EE" w={2.4} /> Mark all as watered
          </CBtn>
        </aside>
      </div>
    </div>
  )
}
