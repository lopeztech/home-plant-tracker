import React, { useMemo } from 'react'
import { C } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const STAGE_STYLE = {
  sown:         { color: '#D99A2B', soft: '#F7E8C6', label: 'Callousing' },
  rooted:       { color: '#5E9C4F', soft: '#DCEBCB', label: 'Rooting' },
  transplanted: { color: '#3E5641', soft: '#E4EDDD', label: 'Established' },
  failed:       { color: '#857F6E', soft: '#F0EBE0', label: 'Failed' },
  Callousing:   { color: '#D99A2B', soft: '#F7E8C6', label: 'Callousing' },
  Rooting:      { color: '#5E9C4F', soft: '#DCEBCB', label: 'Rooting' },
  'Ready soon': { color: '#5C7E4F', soft: '#E4EDDD', label: 'Ready soon' },
  Established:  { color: '#3E5641', soft: '#E4EDDD', label: 'Established' },
}

function speciesIcon(species = '') {
  const s = species.toLowerCase()
  if (s.includes('monstera')) return 'monstera'
  if (s.includes('pothos')) return 'pothos'
  if (s.includes('snake') || s.includes('sansevieria')) return 'snake'
  if (s.includes('aloe')) return 'succulent'
  if (s.includes('fern')) return 'fern'
  if (s.includes('palm')) return 'palm'
  if (s.includes('cactus')) return 'cactus'
  return 'herb'
}

function PropCard({ prop }) {
  const stKey = prop.stage || prop.status || 'rooted'
  const st = STAGE_STYLE[stKey] || STAGE_STYLE.rooted
  const pct = prop.pct ?? Math.min(1, prop.startDate ? (Date.now() - new Date(prop.startDate).getTime()) / (28 * 86400000) : 0.5)
  const daysSince = prop.startDate ? Math.round((Date.now() - new Date(prop.startDate).getTime()) / 86400000) : 0
  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.line2}`, boxShadow: '0 8px 24px -16px rgba(120,70,30,.4)', padding: 18, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, background: st.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 1.5px ${st.color}` }}>
          <PlantIcon type={speciesIcon(prop.species || '')} size={38} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: C.serif, fontSize: 20, color: C.ink, lineHeight: 1.05 }}>{prop.name || 'Cutting'}</div>
          <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>from {prop.species || '—'}</div>
        </div>
        <span style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.soft, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{st.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>Day {daysSince} · {prop.method || 'Water'}</span>
        <span style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: st.color }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: C.panel, overflow: 'hidden', border: `1px solid ${C.line2}` }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: st.color, borderRadius: 4 }} />
      </div>
      {prop.notes && (
        <div style={{ display: 'flex', gap: 9, marginTop: 14, alignItems: 'flex-start' }}>
          <CIcon d={IC.leaf} size={16} color={C.sage} fill={C.sageBg} w={1.4} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontFamily: C.sans, fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{prop.notes}</div>
        </div>
      )}
    </div>
  )
}

function BenchStat({ n, label, color }) {
  return (
    <div style={{ flex: 1, background: C.panel, borderRadius: 7, border: `1px solid ${C.line2}`, padding: '12px 14px' }}>
      <div style={{ fontFamily: C.serif, fontSize: 30, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

export function Propagation({ propagations = [], ctx }) {
  const active = propagations.filter((p) => p.status !== 'failed')
  const ready = propagations.filter((p) => (p.pct ?? 0) >= 0.8 && p.status !== 'failed')
  const methodCounts = useMemo(() => {
    const c = {}
    active.forEach((p) => { c[p.method || 'Water'] = (c[p.method || 'Water'] || 0) + 1 })
    return Object.entries(c)
  }, [active])
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="propagation" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 30, padding: '30px 34px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <CKicker>The propagation bench</CKicker>
              <h1 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
                {active.length > 0
                  ? <>{active.length} cutting{active.length !== 1 ? 's' : ''} <span style={{ fontStyle: 'italic', color: C.terra }}>taking root.</span></>
                  : <>Nothing on the <span style={{ fontStyle: 'italic', color: C.terra }}>bench yet.</span></>}
              </h1>
              <div style={{ marginTop: 8, marginLeft: 2 }}><CSwash width={200} /></div>
            </div>
            <CBtn kind="primary"><CIcon d={IC.scissors} size={17} color="#FFF6EE" w={1.8} /> New cutting</CBtn>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: 'min-content', gap: 16, alignContent: 'start', overflowY: 'auto' }}>
            {active.length === 0
              ? <div style={{ gridColumn: '1/-1', padding: '40px 0', textAlign: 'center', fontFamily: C.serif, fontStyle: 'italic', fontSize: 17, color: C.muted }}>Start a cutting to track its progress here.</div>
              : active.map((p) => <PropCard key={p.id} prop={p} />)}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <CKicker>On the bench</CKicker>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <BenchStat n={active.length} label="propagating" color={C.terra} />
              <BenchStat n={ready.length} label="ready to pot" color={C.greenBright} />
            </div>
            {methodCounts.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line2}` }}>
                <div style={{ fontFamily: C.serif, fontSize: 17, fontStyle: 'italic', color: C.ink, marginBottom: 10 }}>Method mix</div>
                {methodCounts.map(([method, n]) => (
                  <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.terra }} />
                    <span style={{ flex: 1, fontFamily: C.sans, fontSize: 13.5, color: C.muted }}>{method}</span>
                    <span style={{ fontFamily: C.serif, fontSize: 16, color: C.ink }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {ready.length > 0 && (
            <div style={{ background: C.goldSoft, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.serif, fontSize: 17, fontStyle: 'italic', color: C.goldDeep, marginBottom: 3 }}>{ready[0].name} is ready.</div>
              <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Roots are strong — pot it up this weekend to keep it thriving.</div>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <CBtn kind="ghost" full><CIcon d={IC.prop} size={16} color={C.terra} w={1.7} /> Propagation guide</CBtn>
        </aside>
      </div>
    </div>
  )
}
