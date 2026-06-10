import React from 'react'
import { C, CSTAT } from './tokens.js'
import { CIcon, IC } from './icons.jsx'
import { PlantIcon } from './PlantIcon.jsx'

// ── a11y: make a non-button element behave like a button ─────────────────────
export function pressProps(onClick, label) {
  return {
    role: 'button', tabIndex: 0, 'aria-label': label,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e) }
    },
  }
}

// Derive display status from a plant's watering status
// status: 'overdue' | 'today' | 'ok'
export function statusOf(plant, wateredSet) {
  return wateredSet.has(plant.id) ? 'ok' : plant._status
}

export const iconBtn = {
  border: 'none', background: 'transparent', padding: 6, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
}

// ── Design primitives ────────────────────────────────────────────────────────
export function CSwash({ width = 250, color = C.gold }) {
  return (
    <svg width={width} height="13" viewBox={`0 0 ${width} 13`} fill="none"
      style={{ display: 'block' }} aria-hidden="true">
      <path
        d={`M3 8 C ${width * 0.25} 2, ${width * 0.5} 12, ${width * 0.72} 6 S ${width - 6} 4, ${width - 3} 7`}
        stroke={color} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

export function CKicker({ children, color = C.terra }) {
  return (
    <div style={{
      fontFamily: C.sans, fontSize: 11.5, letterSpacing: 2,
      textTransform: 'uppercase', color, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {children}
    </div>
  )
}

export function CBtn({ children, kind = 'primary', style, full, onClick }) {
  const base = {
    border: 'none', borderRadius: 4, padding: '13px 18px',
    fontFamily: C.serif, fontStyle: 'italic', fontSize: 16, cursor: 'pointer',
    width: full ? '100%' : 'auto', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
  }
  const kinds = {
    primary: { background: C.terra, color: '#FFF6EE', boxShadow: `0 3px 0 ${C.terraDeep}` },
    green: { background: C.green, color: '#FFF6EE', boxShadow: `0 3px 0 ${C.green}aa` },
    ghost: { background: 'transparent', color: C.terra, boxShadow: `inset 0 0 0 1.5px ${C.terra}66` },
  }
  return <button onClick={onClick} style={{ ...base, ...kinds[kind], ...style }}>{children}</button>
}

export function CStatusChip({ status, children }) {
  const s = CSTAT[status] || CSTAT.ok
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: C.sans, fontSize: 11.5, fontWeight: 700,
      color: s.color, background: s.soft,
      padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
      {children}
    </span>
  )
}

// plant._status and plant.icon must exist on the plant object passed in
export function CIconBadge({ plant, size = 46, radius }) {
  const s = CSTAT[plant._status] || CSTAT.ok
  return (
    <div style={{
      width: size, height: size,
      borderRadius: radius != null ? radius : '50%',
      background: s.soft, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
      boxShadow: `inset 0 0 0 1.5px ${s.color}`,
    }}>
      <PlantIcon type={plant.icon} size={size * 0.68} />
    </div>
  )
}

// Stat chip used in Insights, PlantDetail, You screens
export function MStatChip({ n, label, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: C.r.lg, padding: '11px 13px' }}>
      <div style={{ fontFamily: C.serif, fontSize: 26, lineHeight: 1, color }}>{n}</div>
      <div style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 600, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// Plant row for Garden + Today lists
export function MPlantRow({ plant, wateredSet, onWater, onOpen }) {
  const isWet = wateredSet.has(plant.id)
  const effectivePlant = isWet ? { ...plant, _status: 'ok' } : plant
  return (
    <div {...pressProps(() => onOpen(plant.id), `Open ${plant.name} in ${plant.room}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: C.sp.md,
        padding: '11px 0', borderBottom: `1px solid ${C.line2}`, cursor: 'pointer',
      }}>
      <CIconBadge plant={effectivePlant} size={42} radius={C.r.md} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.serif, fontSize: 17, color: C.ink, lineHeight: 1.05 }}>{plant.name}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{plant.room}</div>
      </div>
      {isWet ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: C.sp.xs,
          fontFamily: C.sans, fontSize: 13, fontWeight: 700, color: C.greenBright,
        }}>
          <CIcon d={IC.check} size={16} color={C.greenBright} w={2.2} /> Watered
        </span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onWater(plant.id) }}
          aria-label={`Mark ${plant.name} watered`}
          style={{
            border: `1.5px solid ${C.terra}66`, background: 'transparent',
            color: C.terra, borderRadius: C.r.md, fontFamily: C.serif,
            fontStyle: 'italic', fontSize: 13.5, padding: '0 16px',
            minHeight: C.tap, cursor: 'pointer',
          }}
        >Water</button>
      )}
    </div>
  )
}

// Progress ring for the Today screen
export function MRing({ pct, size = 58 }) {
  const r = size / 2 - 5, cir = 2 * Math.PI * r, c = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={`${pct}% of today's round complete`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.line} strokeWidth="6" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.greenBright} strokeWidth="6"
        strokeLinecap="round" strokeDasharray={cir}
        strokeDashoffset={cir * (1 - pct / 100)}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x={c} y={c + 5} textAnchor="middle" fontFamily={C.serif} fontSize="16" fill={C.ink}>{pct}%</text>
    </svg>
  )
}

// Toggle switch for You screen preferences
export function MToggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} aria-label={label}
      style={{
        width: 46, height: 28, borderRadius: C.r.pill,
        border: 'none', background: on ? C.terra : C.line,
        position: 'relative', cursor: 'pointer',
        transition: 'background .2s', flexShrink: 0,
      }}>
      <span style={{
        position: 'absolute', top: 3,
        left: on ? 21 : 3, width: 22, height: 22,
        borderRadius: C.r.round, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        transition: 'left .2s',
      }} />
    </button>
  )
}

// Settings/preferences row used in the You screen
export function MRowItem({ icon, label, detail, right, onClick, last }) {
  const interactive = !!onClick
  const base = {
    display: 'flex', alignItems: 'center', gap: 13,
    padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${C.line2}`,
    minHeight: C.tap, cursor: interactive ? 'pointer' : 'default',
  }
  const inner = (
    <>
      <div style={{
        width: 34, height: 34, borderRadius: C.r.sm,
        background: C.terraSoft, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <CIcon d={icon} size={17} color={C.terraDeep} w={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.serif, fontSize: 16.5, color: C.ink }}>{label}</div>
        {detail && <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>{detail}</div>}
      </div>
      {right || (interactive && <CIcon d={IC.chevR} size={17} color={C.muted} />)}
    </>
  )
  return interactive
    ? <div {...pressProps(onClick, label)} style={base}>{inner}</div>
    : <div style={base}>{inner}</div>
}

export { CIcon, IC }
