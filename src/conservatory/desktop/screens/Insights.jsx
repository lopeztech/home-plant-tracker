import React, { useState, useMemo } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CKicker, pressProps, statusOf } from '../../primitives.jsx'
import { CIconBadge } from '../../primitives.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function InHero({ value, label, sub, accent }) {
  return (
    <div style={{ flex: 1, background: C.card, borderRadius: 8, border: `1px solid ${C.line2}`, padding: '18px' }}>
      <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: C.serif, fontSize: 38, lineHeight: 0.9, color: accent || C.ink }}>{value}</span>
        {sub && <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>{sub}</span>}
      </div>
    </div>
  )
}

function TrendChart({ data, max }) {
  const W = 560, H = 190, pad = 26
  const bw = (W - pad * 2) / data.length
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Waterings per week over the last 8 weeks">
      {[0, 4, 8, 12, 16].map((g) => {
        const y = H - pad - (g / max) * (H - pad * 2)
        return <g key={g}><line x1={pad} y1={y} x2={W - pad} y2={y} stroke={C.line2} strokeWidth="1" /><text x={pad - 8} y={y + 4} textAnchor="end" fontFamily={C.sans} fontSize="10" fill={C.muted}>{g}</text></g>
      })}
      {data.map((v, i) => {
        const h = (v / max) * (H - pad * 2)
        const x = pad + i * bw + bw * 0.22
        const last = i === data.length - 1
        return (
          <g key={i}>
            <rect x={x} y={H - pad - h} width={bw * 0.56} height={h} rx="3" fill={last ? C.terra : C.terraSoft} />
            {last && <rect x={x} y={H - pad - h} width={bw * 0.56} height={h} rx="3" fill="none" stroke={C.terra} strokeWidth="1.5" />}
          </g>
        )
      })}
    </svg>
  )
}

function Donut({ plants }) {
  const healthy = plants.filter((p) => p._status === 'ok').length
  const dueToday = plants.filter((p) => p._status === 'today').length
  const overdue = plants.filter((p) => p._status === 'overdue').length
  const total = plants.length
  const segs = [['Healthy', healthy, CSTAT.ok.color], ['Due today', dueToday, CSTAT.today.color], ['Overdue', overdue, CSTAT.overdue.color]].filter((s) => s[1] > 0)
  const r = 52, cir = 2 * Math.PI * r
  let off = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${healthy} of ${total} plants healthy`}>
        <circle cx="66" cy="66" r={r} fill="none" stroke={C.panel} strokeWidth="16" />
        {segs.map(([name, n, col]) => {
          const len = (n / total) * cir
          const el = <circle key={name} cx="66" cy="66" r={r} fill="none" stroke={col} strokeWidth="16" strokeDasharray={`${len} ${cir - len}`} strokeDashoffset={-off} transform="rotate(-90 66 66)" />
          off += len; return el
        })}
        <text x="66" y="62" textAnchor="middle" fontFamily={C.serif} fontSize="30" fill={C.ink}>{total}</text>
        <text x="66" y="80" textAnchor="middle" fontFamily={C.sans} fontSize="11" fill={C.muted}>plants</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {segs.map(([name, n, col]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
            <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted, width: 78 }}>{name}</span>
            <span style={{ fontFamily: C.serif, fontSize: 17, color: C.ink }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoomBar({ name, n, max }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <span style={{ fontFamily: C.sans, fontSize: 13, color: C.ink, width: 96 }}>{name}</span>
      <div style={{ flex: 1, height: 9, background: C.panel, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? (n / max) * 100 : 0}%`, height: '100%', background: C.greenBright, borderRadius: 5 }} />
      </div>
      <span style={{ fontFamily: C.serif, fontSize: 15, color: C.ink, width: 20, textAlign: 'right' }}>{n}</span>
    </div>
  )
}

export function Insights({ plants, wateredSet, ctx }) {
  const [range, setRange] = useState('season')
  const effective = plants.map((p) => ({ ...p, _status: statusOf(p, wateredSet) }))
  const thriving = effective.filter((p) => p._status === 'ok').length

  const roomCounts = useMemo(() => {
    const c = {}
    plants.forEach((p) => { if (p.room) c[p.room] = (c[p.room] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [plants])
  const maxRoom = Math.max(1, ...roomCounts.map(([, n]) => n))

  const soonest = [...effective].filter((p) => p._status !== 'ok').sort((a, b) => a._daysUntil - b._daysUntil).slice(0, 4)

  const totalWaterings = plants.reduce((acc, p) => acc + (p.wateringLog?.length || 0), 0)
  const weeklyData = [6, 9, 7, 11, 8, 12, 10, totalWaterings > 0 ? Math.min(20, totalWaterings) : 14]

  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="insights" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <CKicker>How your garden is doing</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
              A season of <span style={{ fontStyle: 'italic', color: C.terra }}>good care.</span>
            </h1>
          </div>
          <div style={{ display: 'inline-flex', background: C.panel, borderRadius: 9, padding: 3, border: `1px solid ${C.line2}` }}>
            {[['Month', 'month'], ['Season', 'season'], ['Year', 'year']].map(([label, key]) => (
              <span key={key} onClick={() => setRange(key)}
                style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', padding: '7px 16px', borderRadius: 7, cursor: 'pointer', background: range === key ? C.card : 'transparent', color: range === key ? C.terra : C.muted }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <InHero label="Waterings this season" value={totalWaterings || '—'} sub="+12% vs last" accent={C.terra} />
          <InHero label="Care streak" value="—" sub="days" accent={C.gold} />
          <InHero label="Skipped by rain" value="—" sub="this month" accent={C.greenBright} />
          <InHero label="Plants thriving" value={`${thriving}/${plants.length}`} sub={plants.length > 0 ? `${Math.round(thriving / plants.length * 100)}%` : ''} accent={C.green} />
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16, minHeight: 0 }}>
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line2}`, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div><CKicker>Watering activity</CKicker><div style={{ fontFamily: C.serif, fontSize: 19, marginTop: 2 }}>Per week</div></div>
              <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>Last 8 weeks</span>
            </div>
            <TrendChart data={weeklyData} max={20} />
          </div>

          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line2}`, padding: 20 }}>
            <CKicker>Health right now</CKicker>
            <div style={{ marginTop: 16 }}><Donut plants={effective} /></div>
          </div>

          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line2}`, padding: 20 }}>
            <CKicker>Plants per room</CKicker>
            <div style={{ marginTop: 10 }}>
              {roomCounts.map(([name, n]) => <RoomBar key={name} name={name} n={n} max={maxRoom} />)}
              {roomCounts.length === 0 && <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted }}>No room data yet.</div>}
            </div>
          </div>

          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line2}`, padding: 20 }}>
            <CKicker>Needs you soonest</CKicker>
            <div style={{ marginTop: 8 }}>
              {soonest.length === 0
                ? <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted, padding: '12px 0' }}>All caught up.</div>
                : soonest.map((p) => {
                    const s = CSTAT[p._status] || CSTAT.ok
                    const label = p._status === 'overdue' ? `${Math.abs(p._daysUntil)}d late` : p._status === 'today' ? 'today' : `${p._daysUntil}d`
                    return (
                      <div key={p.id} {...pressProps(() => ctx.openPlant(p.id), `Open ${p.name}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0', borderBottom: `1px solid ${C.line2}`, cursor: 'pointer' }}>
                        <CIconBadge plant={p} size={34} radius={10} />
                        <span style={{ flex: 1, fontFamily: C.serif, fontSize: 16, color: C.ink }}>{p.name}</span>
                        <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 700, color: s.color }}>{label}</span>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
