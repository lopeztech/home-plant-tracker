import React from 'react'
import { C } from './tokens.js'
import { CIcon, IC } from './icons.jsx'
import { iconBtn } from './primitives.jsx'

export function MRule() {
  return (
    <div style={{
      height: 4, flexShrink: 0,
      background: `linear-gradient(90deg, ${C.terra} 0%, ${C.terra} 60%, ${C.gold} 60%, ${C.gold} 100%)`,
    }} />
  )
}

export function MStatusSpace() {
  return <div style={{ height: 46, flexShrink: 0 }} aria-hidden="true" />
}

export function MBrandHeader({ userName, userInitial = 'A' }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 18px 8px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: C.sp.sm }}>
        <div style={{
          width: 30, height: 30, borderRadius: C.r.round,
          background: C.terra, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <CIcon d={IC.leaf} size={16} color={C.goldSoft} fill={C.goldSoft} w={0} />
        </div>
        <span style={{
          fontFamily: C.serif, fontSize: 19,
          fontStyle: 'italic', fontWeight: 500, color: C.ink,
        }}>Conservatory</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: C.sp.md }}>
        <button aria-label="Notifications" style={{ ...iconBtn, minWidth: 32, minHeight: 32 }}>
          <CIcon d={IC.bell} size={19} color={C.muted} w={1.6} />
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: C.r.round, background: C.green,
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: C.serif, fontSize: 14,
        }} aria-hidden="true">{userInitial}</div>
      </div>
    </header>
  )
}

export function MBackHeader({ title, onBack, action }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', flexShrink: 0,
    }}>
      <button onClick={onBack} aria-label={`Back to ${title}`}
        style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: C.sp.xs, padding: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: C.r.round,
          border: `1px solid ${C.line}`, background: C.card,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CIcon d={IC.chevL} size={18} color={C.ink} />
        </div>
        <span style={{ fontFamily: C.serif, fontSize: 18, fontStyle: 'italic', color: C.ink }}>
          {title}
        </span>
      </button>
      {action}
    </header>
  )
}

const M_TABS = [
  ['Garden', 'garden', 'garden'],
  ['Today', 'today', 'today'],
  ['Calendar', 'calendar', 'calendar'],
  ['Insights', 'insights', 'chart'],
  ['You', 'you', 'sliders'],
]

export function MTabBar({ active, onNav }) {
  return (
    <nav aria-label="Primary" style={{
      display: 'flex', justifyContent: 'space-around',
      alignItems: 'flex-start', paddingTop: 9,
      height: 84, borderTop: `1px solid ${C.line}`,
      background: C.card, flexShrink: 0,
    }}>
      {M_TABS.map(([n, key, ic]) => {
        const on = key === active
        return (
          <button key={key} onClick={() => onNav(key)}
            aria-current={on ? 'page' : undefined}
            style={{
              ...iconBtn, flexDirection: 'column', gap: 3,
              padding: '2px 6px', minHeight: C.tap,
            }}>
            <CIcon d={IC[ic]} size={21} color={on ? C.terra : C.muted} w={1.7} />
            <span style={{
              fontFamily: C.serif, fontSize: 11.5,
              fontStyle: on ? 'italic' : 'normal',
              color: on ? C.terra : C.muted,
            }}>{n}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function MScroll({ children, style }) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      WebkitOverflowScrolling: 'touch', ...style,
    }}>
      {children}
    </div>
  )
}
