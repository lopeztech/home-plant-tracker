import React from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn, CStatusChip, pressProps } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const HIST_ICON = { water: 'drop', mist: 'rain', feed: 'leaf', note: 'bell' }
const HIST_COLOR = (kind) => ({ water: C.terra, mist: C.greenBright, feed: C.gold, note: C.muted }[kind] || C.muted)

function PDStat({ label, value, sub, accent }) {
  return (
    <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: C.serif, fontSize: 25, color: accent || C.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function PDEnv({ iconKey, iconColor, label, value, bar }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${C.line2}` }}>
      <CIcon d={IC[iconKey]} size={18} color={iconColor} w={1.7} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted, width: 78 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.panel, overflow: 'hidden' }}>
        <div style={{ width: `${bar}%`, height: '100%', background: iconColor, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: C.serif, fontSize: 15, color: C.ink, width: 64, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function PDHistory({ h, isLast }) {
  const col = HIST_COLOR(h.kind)
  const iconKey = HIST_ICON[h.kind] || 'bell'
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: C.card,
          border: `1.5px solid ${col}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <CIcon d={IC[iconKey]} size={16} color={col} w={1.7} fill={h.kind === 'water' ? col : 'none'} />
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: C.line, marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: C.serif, fontSize: 17, color: C.ink }}>{h.label}</span>
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>{h.date}</span>
        </div>
        {h.detail && <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, marginTop: 1 }}>{h.detail}</div>}
      </div>
    </div>
  )
}

export function Plant({ plantId, plants, careHistory = [], onWater, ctx }) {
  const plant = plants.find((p) => p.id === plantId) || plants[0]
  if (!plant) return null

  const wet = ctx.wateredSet?.has(plant.id)
  const status = wet ? 'ok' : plant._status
  const s = CSTAT[status] || CSTAT.ok

  const statusLabel = status === 'overdue' ? `${Math.abs(plant._daysUntil)}d late`
    : status === 'today' ? 'today' : 'Healthy'

  const weatherDisplay = ctx.weather?.current
    ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' }
    : null

  // Build journal with optional "just watered" entry
  const journal = wet
    ? [{ date: 'Today', kind: 'water', label: 'Watered', detail: 'Just now · marked done' }, ...careHistory]
    : careHistory

  const sinceDays = plant._daysUntil < 0 ? Math.abs(plant._daysUntil) : 0

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={weatherDisplay} />
      <div style={{ flex: 1, padding: '22px 34px 30px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontFamily: C.sans, fontSize: 13, color: C.muted }}>
          <button onClick={() => ctx.navigate('garden')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.muted, fontFamily: C.sans, fontSize: 13 }}>Garden</button>
          <CIcon d={IC.chevR} size={14} color={C.muted} />
          <span style={{ whiteSpace: 'nowrap' }}>{plant.room || 'Living Room'}</span>
          <CIcon d={IC.chevR} size={14} color={C.muted} />
          <span style={{ color: C.ink, fontStyle: 'italic', fontFamily: C.serif, fontSize: 15 }}>{plant.name}</span>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 30, minHeight: 0, overflow: 'hidden' }}>
          {/* left: profile + environment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{
              background: C.card, borderRadius: 8, border: `1px solid ${C.line}`,
              boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)',
              padding: 24, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  width: 150, height: 150, borderRadius: '50%', background: C.panel,
                  border: `1px solid ${C.line2}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 16, position: 'relative',
                }}>
                  <PlantIcon type={plant.icon || 'monstera'} size={118} />
                  <div style={{ position: 'absolute', bottom: 6, right: 14 }}>
                    <CStatusChip status={status}>{statusLabel}</CStatusChip>
                  </div>
                </div>
                <h1 style={{ fontFamily: C.serif, fontSize: 32, margin: 0, color: C.ink }}>{plant.name}</h1>
                <div style={{ fontFamily: C.serif, fontSize: 16, fontStyle: 'italic', color: C.muted, marginTop: 2 }}>{plant.species || ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontFamily: C.sans, fontSize: 13, color: C.muted }}>
                  <CIcon d={IC.pin} size={15} color={C.terra} w={1.7} />{plant.room || ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
                <CBtn kind={wet ? 'green' : 'primary'} style={{ flex: 1, fontSize: 15, padding: '12px' }} onClick={() => onWater(plant.id)}>
                  <CIcon d={wet ? IC.check : IC.drop} size={16} color="#FFF6EE" fill={wet ? 'none' : '#FFF6EE'} w={wet ? 2.4 : 0} />
                  {wet ? ' Watered' : ' Water now'}
                </CBtn>
                <CBtn kind="ghost" style={{ fontSize: 15, padding: '12px 16px' }}>Edit</CBtn>
              </div>
            </div>

            {/* environment card */}
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, flex: 1 }}>
              <CKicker>Its corner of the home</CKicker>
              <div style={{ marginTop: 12 }}>
                <PDEnv iconKey="sun" iconColor={C.gold} label="Light" value="Bright" bar={72} />
                <PDEnv iconKey="drop" iconColor={C.terra} label="Soil moist." value={wet ? 'Moist' : 'Dry'} bar={wet ? 70 : 24} />
                <PDEnv iconKey="rain" iconColor={C.sage} label="Humidity" value="45%" bar={45} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
                  <CIcon d={IC.clock} size={18} color={C.muted} w={1.7} style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted, flex: 1 }}>In your care</span>
                  <span style={{ fontFamily: C.serif, fontSize: 15, color: C.ink }}>
                    {plant.createdAt ? new Date(plant.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* right: stats + care journal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <PDStat label="Waters every" value={plant.frequencyDays ? `${plant.frequencyDays} days` : '—'} sub="Adjusts with season" />
              <PDStat label="Last watered" value={plant.lastWatered ? `${sinceDays}d ago` : '—'} sub={plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} />
              <PDStat label="Next due" value={status === 'overdue' ? 'Overdue' : status === 'today' ? 'Today' : `${plant._daysUntil}d`} sub={status === 'overdue' ? `was ${Math.abs(plant._daysUntil)}d ago` : ''} accent={status !== 'ok' ? C.terra : undefined} />
              <PDStat label="Health" value={plant.health || '—'} accent={C.green} />
            </div>

            {/* care journal */}
            <div style={{
              background: C.card, borderRadius: 8, border: `1px solid ${C.line}`,
              boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)',
              padding: 22, position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <CKicker>Care journal</CKicker>
                  <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink, marginTop: 2, whiteSpace: 'nowrap' }}>Recent history</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['All', 'Water', 'Notes'].map((t, i) => (
                    <span key={t} style={{
                      fontFamily: C.sans, fontSize: 13, fontWeight: 600, padding: '6px 13px',
                      borderRadius: 20, cursor: 'pointer',
                      background: i === 0 ? C.terraSoft : 'transparent',
                      color: i === 0 ? C.terra : C.muted,
                    }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {journal.length === 0 ? (
                  <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted, padding: '12px 0' }}>No care events recorded yet.</div>
                ) : (
                  journal.slice(0, 6).map((h, i, a) => (
                    <PDHistory key={i} h={h} isLast={i === a.length - 1} />
                  ))
                )}
              </div>
              <div style={{ paddingTop: 12, borderTop: `1px solid ${C.line2}`, marginTop: 4 }}>
                <span style={{ fontFamily: C.serif, fontSize: 15, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>View full journal →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
