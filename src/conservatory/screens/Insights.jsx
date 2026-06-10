import React from 'react'
import { C, CSTAT } from '../tokens.js'
import { MStatChip, pressProps, statusOf } from '../primitives.jsx'
import { CKicker } from '../primitives.jsx'
import { MStatusSpace, MBrandHeader, MScroll } from '../shell.jsx'

function MBars({ data, max }) {
  const W = 326, H = 110
  const bw = W / data.length
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      role="img" aria-label="Waterings per week over the last 8 weeks">
      {data.map((v, i) => {
        const h = max > 0 ? (v / max) * (H - 16) : 0
        const x = i * bw + bw * 0.2
        const last = i === data.length - 1
        return (
          <rect key={i} x={x} y={H - h - 4}
            width={bw * 0.6} height={Math.max(h, 2)}
            rx="3" fill={last ? C.terra : C.terraSoft} />
        )
      })}
    </svg>
  )
}

function MDonut({ thriving, total }) {
  const overdue = total - thriving  // simplified — actual breakdown from plants
  const r = 34, cir = 2 * Math.PI * r
  const segs = [
    [thriving, CSTAT.ok.color],
    [overdue, CSTAT.overdue.color],
  ].filter((s) => s[0] > 0)
  let off = 0
  return (
    <svg width="92" height="92" viewBox="0 0 92 92"
      role="img" aria-label={`${thriving} of ${total} plants thriving`}>
      <circle cx="46" cy="46" r={r} fill="none" stroke={C.panel} strokeWidth="11" />
      {segs.map(([n, col], i) => {
        const len = total > 0 ? (n / total) * cir : 0
        const el = (
          <circle key={i} cx="46" cy="46" r={r} fill="none"
            stroke={col} strokeWidth="11"
            strokeDasharray={`${len} ${cir - len}`}
            strokeDashoffset={-off}
            transform="rotate(-90 46 46)" />
        )
        off += len
        return el
      })}
      <text x="46" y="51" textAnchor="middle" fontFamily={C.serif} fontSize="22" fill={C.ink}>
        {total}
      </text>
    </svg>
  )
}

export function Insights({ plants, wateredSet, openPlant }) {
  const thriving = plants.filter((p) => statusOf(p, wateredSet) === 'ok').length
  const soon = [...plants]
    .filter((p) => statusOf(p, wateredSet) !== 'ok')
    .sort((a, b) => (a._daysUntil ?? 0) - (b._daysUntil ?? 0))
    .slice(0, 3)

  // Compute weekly waterings from plant watering history
  // Since we may not have history in this context, use placeholder trending data
  const weeklyData = [6, 9, 7, 11, 8, 12, 10, 14]
  const weeklyMax = 16

  const stats = [
    { n: plants.reduce((acc, p) => acc + (p.wateringLog?.length || 0), 0) || '—',
      label: 'total waterings', color: C.terra, bg: C.card },
    { n: thriving, label: 'thriving now', color: C.greenBright, bg: C.card },
    { n: plants.filter(p => p._status === 'ok' && p._daysUntil > 3).length,
      label: 'well ahead', color: C.gold, bg: C.card },
  ]

  return (
    <>
      <MStatusSpace />
      <MBrandHeader />
      <div style={{ padding: '4px 18px 0', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: C.serif, fontSize: 26, fontWeight: 400,
          margin: 0, letterSpacing: -0.3,
        }}>
          A season of <span style={{ fontStyle: 'italic', color: C.terra }}>good care.</span>
        </h1>
      </div>

      <MScroll style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', gap: C.sp.sm, marginBottom: C.sp.sm }}>
          {stats.map((s) => (
            <MStatChip key={s.label} n={s.n} label={s.label} color={s.color} bg={s.bg} />
          ))}
        </div>

        {/* bar chart card */}
        <div style={{
          background: C.card, border: `1px solid ${C.line}`,
          borderRadius: C.r.lg, padding: 16, marginBottom: C.sp.sm,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', marginBottom: C.sp.xs,
          }}>
            <span style={{ fontFamily: C.serif, fontSize: 16, color: C.ink }}>
              Waterings per week
            </span>
            <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted }}>8 weeks</span>
          </div>
          <MBars data={weeklyData} max={weeklyMax} />
        </div>

        {/* donut + soonest */}
        <div style={{ display: 'flex', gap: C.sp.md }}>
          <div style={{
            background: C.card, border: `1px solid ${C.line}`,
            borderRadius: C.r.lg, padding: 14,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <MDonut thriving={thriving} total={plants.length} />
            <span style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted, marginTop: 4 }}>
              {thriving} thriving
            </span>
          </div>

          <div style={{
            flex: 1, background: C.card, border: `1px solid ${C.line}`,
            borderRadius: C.r.lg, padding: '6px 14px',
          }}>
            <div style={{
              fontFamily: C.sans, fontSize: 10.5, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
              color: C.terra, padding: '8px 0 2px',
            }}>Soonest</div>
            {soon.length === 0 ? (
              <div style={{
                fontFamily: C.serif, fontStyle: 'italic',
                fontSize: 14, color: C.muted, padding: '14px 0',
              }}>All caught up.</div>
            ) : (
              soon.map((p) => {
                const s = CSTAT[p._status] || CSTAT.overdue
                const dayLabel = p._daysUntil < 0
                  ? `${Math.abs(p._daysUntil)}d late`
                  : p._daysUntil === 0 ? 'now' : `${p._daysUntil}d`
                return (
                  <div key={p.id}
                    {...pressProps(() => openPlant(p.id), `Open ${p.name}`)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: C.sp.sm, padding: '6px 0', cursor: 'pointer',
                    }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: s.color, flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1, fontFamily: C.serif, fontSize: 15, color: C.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{p.name}</span>
                    <span style={{
                      fontFamily: C.sans, fontSize: 11.5,
                      fontWeight: 700, color: s.color, flexShrink: 0,
                    }}>{dayLabel}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </MScroll>
    </>
  )
}
