import React, { useState } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn } from '../../primitives.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function Toggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} aria-label={label}
      style={{ width: 44, height: 26, borderRadius: 20, background: on ? C.greenBright : C.line, padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

function SetRow({ title, desc, on, onToggle, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 0', borderBottom: last ? 'none' : `1px solid ${C.line2}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: C.serif, fontSize: 17, color: C.ink }}>{title}</div>
        <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, marginTop: 1, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <Toggle on={on} onClick={onToggle} label={title} />
    </div>
  )
}

function SetField({ label, value, icon }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: C.sans, fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: `1px solid ${C.line}`, borderRadius: 6, padding: '11px 13px', background: C.card }}>
        {icon && <CIcon d={IC[icon]} size={15} color={C.muted} w={1.7} />}
        <span style={{ fontFamily: C.sans, fontSize: 14, color: C.ink }}>{value}</span>
      </div>
    </div>
  )
}

export function Settings({ user, subscription, ctx }) {
  const [prefs, setPrefs] = useState({ watering: true, weather: true, propagation: false, digest: true })
  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }))

  const initial = user?.initial || (user?.name ? user.name[0].toUpperCase() : 'A')
  const tierLabel = subscription?.tier === 'landscaper_pro' ? 'Glasshouse' : subscription?.tier === 'home_pro' ? 'Greenhouse' : 'Windowsill'
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  const nav = [
    ['Account', 'sliders', 'account'],
    ['Notifications', 'bell', 'notifications'],
    ['Weather & location', 'forecast', 'weather'],
    ['Care defaults', 'drop', 'care'],
    ['Plan & billing', 'star', 'billing'],
  ]
  const [activeNav, setActiveNav] = useState('account')

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ marginBottom: 20 }}>
          <CKicker>Preferences</CKicker>
          <h1 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
            Settings &amp; <span style={{ fontStyle: 'italic', color: C.terra }}>care defaults.</span>
          </h1>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '236px 1fr', gap: 28, minHeight: 0, overflow: 'hidden' }}>
          {/* sub-nav */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nav.map(([label, ic, key]) => (
              <div key={key} onClick={() => { setActiveNav(key); if (key === 'billing') ctx.navigate('billing') }}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 8, cursor: 'pointer', background: activeNav === key ? C.terraSoft : 'transparent', color: activeNav === key ? C.green : C.muted }}>
                <CIcon d={IC[ic]} size={17} color={activeNav === key ? C.terra : C.muted} w={1.7} />
                <span style={{ fontFamily: C.serif, fontSize: 16.5, fontStyle: activeNav === key ? 'italic' : 'normal' }}>{label}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div onClick={ctx.onSignOut}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 8, cursor: 'pointer', color: CSTAT.overdue.color }}>
              <CIcon d={IC.logout} size={17} color={CSTAT.overdue.color} w={1.7} />
              <span style={{ fontFamily: C.serif, fontSize: 16.5 }}>Sign out</span>
            </div>
          </aside>

          {/* content */}
          <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 22, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <CKicker>Account</CKicker>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '14px 0 18px' }}>
                <div style={{ width: 66, height: 66, borderRadius: '50%', background: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.serif, fontSize: 28, flexShrink: 0 }}>{initial}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink }}>{user?.name || 'Plant Keeper'}</div>
                  <div style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted }}>{user?.email || ''}</div>
                </div>
                <CBtn kind="ghost" style={{ borderRadius: 6, fontSize: 14, padding: '10px 16px' }}>Change photo</CBtn>
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <SetField label="Display name" value={user?.name || 'Plant Keeper'} />
                <SetField label="Home location" value="—" icon="pin" />
                <SetField label="Units" value="Metric · °C" />
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 22 }}>
              <CKicker>Notifications</CKicker>
              <div style={{ marginTop: 6 }}>
                <SetRow title="Watering reminders" desc="A gentle nudge the morning a plant is due." on={prefs.watering} onToggle={() => toggle('watering')} />
                <SetRow title="Weather-aware skips" desc="Tell me when rain pauses or shifts a watering." on={prefs.weather} onToggle={() => toggle('weather')} />
                <SetRow title="Propagation milestones" desc="When a cutting is ready to pot up." on={prefs.propagation} onToggle={() => toggle('propagation')} />
                <SetRow title="Weekly digest" desc="A Sunday summary of the week's care." on={prefs.digest} onToggle={() => toggle('digest')} last />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05)', flex: 1, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: C.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CIcon d={IC.star} size={24} color={C.goldDeep} fill={C.goldSoft} w={1.6} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: C.serif, fontSize: 19, color: C.ink }}>Conservatory <span style={{ fontStyle: 'italic', color: C.gold }}>{tierLabel}</span></div>
                  <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted }}>Unlimited plants · weather sync</div>
                </div>
                <CBtn kind="ghost" style={{ borderRadius: 6, fontSize: 14, padding: '10px 16px' }} onClick={() => ctx.navigate('billing')}>Manage plan</CBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
