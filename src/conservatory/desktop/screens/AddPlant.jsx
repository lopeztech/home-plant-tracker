import React, { useState, useCallback } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn, pressProps } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { FloorPlan } from '../../FloorPlan.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function APStep({ n, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? C.greenBright : active ? C.terra : 'transparent', border: `1.5px solid ${done ? C.greenBright : active ? C.terra : C.line}`, color: (done || active) ? '#fff' : C.muted, fontFamily: C.serif, fontSize: 14 }}>
        {done ? <CIcon d={IC.check} size={15} color="#fff" w={2.6} /> : n}
      </div>
      <span style={{ fontFamily: C.serif, fontSize: 17, fontStyle: active ? 'italic' : 'normal', color: active ? C.ink : done ? C.green : C.muted }}>{label}</span>
    </div>
  )
}

const ROOM_FILL = { kitchen: '#EFE7D0', bath: '#E5EFE6', bathroom: '#E5EFE6', bedroom: '#F2E7D8', living: '#EFDDC8', 'living room': '#EFDDC8', study: '#ECE4CD' }
function roomFill(r) { return ROOM_FILL[(r.name || '').toLowerCase()] || '#F2EBDB' }

export function AddPlant({ floors, plants, ctx }) {
  const [step, setStep] = useState(2) // show the Place step by default
  const [identified, setIdentified] = useState(null)
  const [placing, setPlacing] = useState({ room: null, x: 74, y: 60 })
  const activeFloor = floors.find((f) => f.id === ctx.activeFloorId) || floors[0]
  const floorRooms = activeFloor?.rooms || []
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '24px 34px 30px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* title + steps */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <CKicker>Welcome a new plant</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 32, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
              Add to your <span style={{ fontStyle: 'italic', color: C.terra }}>collection.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <APStep n={1} label="Identify" done={step > 1} active={step === 1} />
            <div style={{ width: 30, height: 1, background: C.line }} />
            <APStep n={2} label="Place" active={step === 2} done={step > 2} />
            <div style={{ width: 30, height: 1, background: C.line }} />
            <APStep n={3} label="Schedule" active={step === 3} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 30, marginTop: 18, minHeight: 0, overflow: 'hidden' }}>
          {/* left: identify result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <CKicker>Photo</CKicker>
              <div style={{ marginTop: 12, height: 168, borderRadius: 10, border: `2px dashed ${C.line}`, background: C.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' }}>
                <PlantIcon type={identified?.icon || 'monstera'} size={76} />
                <div style={{ position: 'absolute', bottom: 10, display: 'flex', alignItems: 'center', gap: 7, background: C.card, borderRadius: 20, padding: '5px 12px', border: `1px solid ${C.line}`, boxShadow: '0 2px 8px rgba(40,30,20,.08)', cursor: 'pointer' }}>
                  <CIcon d={IC.camera} size={14} color={C.terra} w={1.7} />
                  <span style={{ fontFamily: C.sans, fontSize: 12.5, fontWeight: 600, color: C.ink }}>Retake photo</span>
                </div>
              </div>
              <div style={{ marginTop: 16, background: C.sageBg, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <CIcon d={IC.sparkle} size={16} color={C.gold} fill={C.gold} w={0} />
                  <span style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.green }}>Identified</span>
                  <span style={{ marginLeft: 'auto', fontFamily: C.sans, fontSize: 12, fontWeight: 700, color: C.greenBright }}>97% match</span>
                </div>
                <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink, lineHeight: 1.05 }}>{identified?.species || 'Monstera deliciosa'}</div>
                <div style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.muted }}>Swiss cheese plant</div>
              </div>
              <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                {[['Light', 'Bright, indirect'], ['Water', 'Every 7 days'], ['Difficulty', 'Easy']].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontFamily: C.serif, fontSize: 14, color: C.ink }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.goldSoft, borderLeft: `3px solid ${C.gold}`, borderRadius: 4, padding: '13px 15px' }}>
              <div style={{ fontFamily: C.serif, fontSize: 16, fontStyle: 'italic', color: C.goldDeep, marginBottom: 2 }}>Not quite right?</div>
              <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>Tap to pick from 3 close matches, or search the catalogue by name.</div>
            </div>
          </div>

          {/* right: place on floorplan */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div><CKicker>Place it on the map</CKicker><div style={{ fontFamily: C.serif, fontSize: 21, marginTop: 2 }}>Where will this plant live?</div></div>
                <span style={{ fontFamily: C.serif, fontSize: 15, fontStyle: 'italic', color: C.terra }}>Tap a room, then a spot</span>
              </div>
              <div style={{ flex: 1, background: C.panel, borderRadius: 10, border: `1px solid ${C.line2}`, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'relative', width: 660, height: 360 }}>
                  <FloorPlan width={660} height={360} bg={C.panel}
                    rooms={floorRooms} plants={plants}
                    activeId="__none"
                    renderMarker={(p) => <div style={{ width: 9, height: 9, borderRadius: '50%', background: CSTAT[p._status]?.color || '#ccc', opacity: 0.45, boxShadow: `0 0 0 2px ${C.panel}` }} />} />
                  <div style={{ position: 'absolute', left: `${placing.x}%`, top: `${placing.y}%`, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 6 }}>
                    <div style={{ background: C.card, borderRadius: 10, padding: '6px 11px', boxShadow: '0 8px 22px rgba(80,50,20,.22)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', border: `1.5px solid ${C.terra}`, marginBottom: 6 }}>
                      <PlantIcon type="monstera" size={26} />
                      <span style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.ink }}>New plant</span>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: C.terra, boxShadow: '0 3px 8px rgba(40,30,20,.3)' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <CBtn kind="ghost" style={{ borderRadius: 6 }} onClick={() => setStep(1)}>← Back to identify</CBtn>
                <CBtn kind="primary" style={{ borderRadius: 6 }} onClick={() => setStep(3)}>Continue to schedule →</CBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
