import React from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn, CStatusChip, CIconBadge } from '../../primitives.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function FCDay({ d, isToday }) {
  const wet = (d.rain ?? d.rainChance ?? 0) >= 50
  const iconKey = d.icon === 'sun' ? 'sun' : d.icon === 'rain' || wet ? 'rain' : 'cloud'
  const iconColor = d.icon === 'sun' ? C.gold : wet ? C.sage : C.muted
  return (
    <div style={{ flex: 1, background: isToday ? C.terraSoft : C.card, border: `1px solid ${isToday ? C.terra + '55' : C.line2}`, borderRadius: 9, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontFamily: C.sans, fontSize: 12, fontWeight: 700, color: isToday ? C.terra : C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{d.d || d.label}</div>
      <CIcon d={IC[iconKey]} size={26} color={iconColor} w={1.7} />
      <div style={{ fontFamily: C.serif, fontSize: 19, color: C.ink }}>{Math.round(d.hi ?? d.tempHigh ?? d.t ?? 20)}°</div>
      <div style={{ fontFamily: C.sans, fontSize: 11.5, color: C.muted }}>{Math.round(d.lo ?? d.tempLow ?? 12)}°</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: wet ? C.sage : C.muted }}>
        <CIcon d={IC.drop} size={11} color={wet ? C.sage : C.muted} fill={wet ? C.sage : 'none'} w={1.4} />
        {d.rain ?? d.rainChance ?? 0}%
      </div>
    </div>
  )
}

function FCAdjust({ iconKey, iconColor, title, body, tag, tagStatus }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '15px 16px', background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CIcon d={IC[iconKey]} size={22} color={iconColor} w={1.7} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <span style={{ fontFamily: C.serif, fontSize: 18, color: C.ink }}>{title}</span>
          {tag && <CStatusChip status={tagStatus}>{tag}</CStatusChip>}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  )
}

export function Forecast({ plants, ctx }) {
  const weather = ctx.weather || {}
  const current = weather.current || {}
  const forecast = weather.days || []
  const skipped = plants.filter((p) => {
    const r = (p.room || '').toLowerCase()
    return r.includes('garden') || r.includes('balcony') || r.includes('outdoor') || r.includes('patio')
  }).slice(0, 3)
  const wx = current.temp ? { temp: Math.round(current.temp), condition: current.condition?.sky || 'Clear' } : null

  const days7 = forecast.length >= 7 ? forecast.slice(0, 7) : [...forecast, ...Array.from({ length: 7 - forecast.length }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + forecast.length + i)
    return { d: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3), hi: 20, lo: 12, rain: 5, icon: 'cloud' }
  })]

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="forecast" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '30px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ marginBottom: 20 }}>
          <CKicker>Weather-aware care</CKicker>
          <h1 style={{ fontFamily: C.serif, fontSize: 37, fontWeight: 400, lineHeight: 1.1, margin: '8px 0 0', letterSpacing: -0.3 }}>
            The sky does some of the <span style={{ fontStyle: 'italic', color: C.terra }}>watering.</span>
          </h1>
          <div style={{ marginTop: 8, marginLeft: 2 }}><CSwash width={260} /></div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 30, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0, overflowY: 'auto' }}>
            {/* current conditions */}
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 22, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 26 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <CIcon d={IC.rain} size={56} color={C.sage} w={1.5} />
                <div>
                  <div style={{ fontFamily: C.serif, fontSize: 52, lineHeight: 0.9, color: C.ink }}>{Math.round(current.temp ?? 18)}°</div>
                  <div style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted, marginTop: 4 }}>{current.condition?.sky || 'Clear'}</div>
                </div>
              </div>
              <div style={{ width: 1, height: 64, background: C.line }} />
              <div style={{ display: 'flex', gap: 28 }}>
                {[['Humidity', `${current.humidity ?? '—'}%`], ['Wind', `${current.windSpeed ?? '—'} km/h`], ['Rain today', `${current.precipMm ?? 0} mm`]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, marginBottom: 3 }}>{k}</div>
                    <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <CKicker color={C.muted}>Your location</CKicker>
                <div style={{ fontFamily: C.serif, fontSize: 16, fontStyle: 'italic', color: C.ink, marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
            </div>

            {/* 7-day strip */}
            <div>
              <div style={{ fontFamily: C.serif, fontSize: 19, marginBottom: 10 }}>The next seven days</div>
              <div style={{ display: 'flex', gap: 9 }}>
                {days7.map((d, i) => <FCDay key={i} d={d} isToday={i === 0} />)}
              </div>
            </div>

            {/* adaptations */}
            <div>
              <div style={{ fontFamily: C.serif, fontSize: 19, marginBottom: 10 }}>How your care adapts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weather.rainSoon && (
                  <FCAdjust iconKey="rain" iconColor={C.sage} title="Watering paused for outdoor plants" tag={`${skipped.length} plants`} tagStatus="ok" body="Rain in the next 48 hours covers your outdoor plants. They'll resume once the soil dries." />
                )}
                <FCAdjust iconKey="sun" iconColor={C.gold} title="Warm spell coming" tag="Heads up" tagStatus="today" body="Higher temperatures may mean plants near windows drink faster — monitor soil moisture." />
              </div>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <CKicker>Skipped by the rain</CKicker>
              <div style={{ fontFamily: C.serif, fontSize: 21, color: C.ink, margin: '4px 0 12px' }}>{skipped.length > 0 ? 'Resting until dry' : 'No skips today'}</div>
              <div>
                {skipped.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${C.line2}` }}>
                    <CIconBadge plant={{ ...p, _status: 'ok' }} size={40} radius={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: C.serif, fontSize: 17, color: C.ink, lineHeight: 1.05 }}>{p.name}</div>
                      <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{p.room}</div>
                    </div>
                    <CStatusChip status="ok">Deferred</CStatusChip>
                  </div>
                ))}
                {skipped.length === 0 && <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted, padding: '12px 0' }}>No plants deferred today.</div>}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.55 }}>Weather-aware care is active for your <span style={{ fontFamily: C.serif, fontStyle: 'italic', color: C.terra, fontSize: 15 }}>outdoor plants</span>.</div>
              </div>
            </div>
            <CBtn kind="ghost" full><CIcon d={IC.forecast} size={17} color={C.terra} w={1.7} /> Forecast settings</CBtn>
          </aside>
        </div>
      </div>
    </div>
  )
}
