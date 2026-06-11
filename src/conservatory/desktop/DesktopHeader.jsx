import React from 'react'
import { C } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'

const NAV = [
  ['Garden',      'garden',      'garden'],
  ['Today',       'today',       'today'],
  ['Calendar',    'calendar',    'calendar'],
  ['Forecast',    'forecast',    'forecast'],
  ['Propagation', 'propagation', 'prop'],
  ['Insights',    'insights',    'chart'],
]

function CWordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: C.terra,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 0 ${C.terraDeep}`,
      }}>
        <CIcon d={IC.leaf} size={17} color={C.goldSoft} fill={C.goldSoft} w={0} />
      </div>
      <span style={{
        fontFamily: C.serif, fontSize: 22, fontStyle: 'italic',
        fontWeight: 500, color: C.ink, letterSpacing: 0.2,
      }}>Conservatory</span>
    </div>
  )
}

export function DesktopHeader({ activeScreen = 'garden', onNav = () => {}, user = {}, weather = null }) {
  const initial = user.initial || (user.name ? user.name[0].toUpperCase() : 'A')
  return (
    <div>
      {/* 5px gradient top rule */}
      <div style={{
        height: 5,
        background: `linear-gradient(90deg, ${C.terra} 0%, ${C.terra} 60%, ${C.gold} 60%, ${C.gold} 100%)`,
      }} />
      {/* 66px nav bar */}
      <header style={{
        height: 66, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 34px',
        background: C.card, borderBottom: `1px solid ${C.line}`,
      }}>
        <CWordmark />
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.map(([label, key, ic]) => {
            const on = key === activeScreen
            return (
              <button key={key} onClick={() => onNav(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontFamily: C.serif, fontSize: 17,
                  fontStyle: on ? 'italic' : 'normal',
                  color: on ? C.terra : C.muted,
                  padding: '7px 14px',
                  borderBottom: on ? `2px solid ${C.gold}` : '2px solid transparent',
                  border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  background: 'transparent', cursor: 'pointer',
                  outline: 'none',
                }}>
                <CIcon d={IC[ic]} size={16} color={on ? C.terra : C.muted} w={1.7} />
                {label}
              </button>
            )
          })}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {weather && (
            <span style={{
              fontFamily: C.sans, fontSize: 12.5, color: C.muted,
              display: 'flex', alignItems: 'center', gap: 7,
              background: C.paper, padding: '6px 12px', borderRadius: 20,
            }}>
              <CIcon d={IC.rain} size={15} color={C.sage} w={1.6} />
              {weather.temp}° · {weather.condition}
            </span>
          )}
          <button style={{ border: 'none', background: 'transparent', padding: 6, cursor: 'pointer' }}
            aria-label="Notifications">
            <CIcon d={IC.bell} size={19} color={C.muted} w={1.6} />
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: C.green,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: C.serif, fontSize: 16,
          }} aria-hidden="true">{initial}</div>
        </div>
      </header>
    </div>
  )
}
