import React, { useState } from 'react'
import { C } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'
import { MStatChip, MToggle, MRowItem, CKicker, statusOf } from '../primitives.jsx'
import { MStatusSpace, MBrandHeader, MScroll } from '../shell.jsx'

export function You({ plants, wateredSet, user = {}, onSignOut, onNavigate }) {
  const [weatherAware, setWeatherAware] = useState(true)
  const [reminders, setReminders] = useState(true)

  const thriving = plants.filter((p) => statusOf(p, wateredSet) === 'ok').length
  const rooms = [...new Set(plants.map((p) => p.room).filter(Boolean))].length

  const initial = user.initial || (user.name ? user.name[0].toUpperCase() : 'A')
  const planLabel = user.plan || 'Home Pro'

  return (
    <>
      <MStatusSpace />
      <MBrandHeader />
      <MScroll style={{ padding: '8px 16px 12px' }}>
        {/* profile card */}
        <div style={{
          background: C.card, border: `1px solid ${C.line}`,
          borderRadius: C.r.xl, padding: 18,
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 14, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 50, height: 3.5, background: C.gold }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 3.5, height: 50, background: C.gold }} />
          <div style={{
            width: 58, height: 58, borderRadius: C.r.round,
            background: C.green, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: C.serif, fontSize: 26, fontStyle: 'italic', flexShrink: 0,
          }}>{initial}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink, lineHeight: 1.05 }}>
              {user.name || 'Plant Keeper'}
            </div>
            <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>
              Conservatory · {planLabel}
            </div>
          </div>
        </div>

        {/* mini stats */}
        <div style={{ display: 'flex', gap: C.sp.sm, marginBottom: 16 }}>
          <MStatChip n={plants.length} label="plants" color={C.terra} bg={C.card} />
          <MStatChip n={thriving} label="thriving" color={C.greenBright} bg={C.card} />
          <MStatChip n={rooms} label="rooms" color={C.gold} bg={C.card} />
        </div>

        <CKicker>Care preferences</CKicker>
        <div style={{
          background: C.card, border: `1px solid ${C.line}`,
          borderRadius: C.r.xl, overflow: 'hidden', margin: '10px 0 16px',
        }}>
          <MRowItem
            icon={IC.rain}
            label="Weather-aware watering"
            detail="Skip the round when rain is due"
            right={<MToggle on={weatherAware} onClick={() => setWeatherAware((v) => !v)} label="Weather-aware watering" />}
          />
          <MRowItem
            icon={IC.bell}
            label="Care reminders"
            detail="Daily at 8:00 am"
            right={<MToggle on={reminders} onClick={() => setReminders((v) => !v)} label="Care reminders" />}
            last
          />
        </div>

        <CKicker>Account</CKicker>
        <div style={{
          background: C.card, border: `1px solid ${C.line}`,
          borderRadius: C.r.xl, overflow: 'hidden', margin: '10px 0 16px',
        }}>
          <MRowItem
            icon={IC.grid}
            label="Household & roles"
            detail="Manage members"
            onClick={() => onNavigate?.('settings/billing')}
          />
          <MRowItem
            icon={IC.star}
            label="Plan & billing"
            detail={planLabel}
            onClick={() => onNavigate?.('settings/billing')}
          />
          <MRowItem
            icon={IC.sliders}
            label="Settings"
            onClick={() => onNavigate?.('settings')}
            last
          />
        </div>

        <button
          onClick={onSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: C.sp.sm,
            border: `1.5px solid ${C.line}`, background: 'transparent',
            borderRadius: C.r.lg, padding: '13px',
            minHeight: C.tap, fontFamily: C.serif, fontStyle: 'italic',
            fontSize: 16, color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <CIcon d={IC.logout} size={17} color={C.muted} w={1.7} /> Sign out
        </button>
      </MScroll>
    </>
  )
}
