import React, { useMemo } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn, CStatusChip, CIconBadge, statusOf, pressProps } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { FloorPlan } from '../../FloorPlan.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const ROOM_FILL = {
  kitchen: '#EFE7D0', bath: '#E5EFE6', bathroom: '#E5EFE6',
  bedroom: '#F2E7D8', living: '#EFDDC8', 'living room': '#EFDDC8',
  study: '#ECE4CD', office: '#ECE4CD',
}
function roomFill(r) {
  return ROOM_FILL[(r.name || '').toLowerCase()] || ROOM_FILL[r.id] || '#F2EBDB'
}

function GardenMarker({ plant, isActive, wateredSet, openPlant }) {
  const wet = wateredSet.has(plant.id)
  const status = wet ? 'ok' : plant._status
  const s = CSTAT[status] || CSTAT.ok
  return (
    <div {...pressProps((e) => { e.stopPropagation(); openPlant(plant.id) }, `Open ${plant.name}`)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
      <div style={{
        width: isActive ? 17 : 12, height: isActive ? 17 : 12,
        borderRadius: '50%', background: s.color,
        boxShadow: `0 0 0 3px ${C.panel}, 0 1px 3px rgba(0,0,0,.3)`,
        transition: 'all .2s',
      }} />
      {isActive && (
        <div style={{
          marginTop: 6, background: '#fff', borderRadius: 9, padding: '5px 10px',
          boxShadow: '0 8px 22px rgba(80,50,20,.2)', display: 'flex',
          alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
          border: `1px solid ${C.line}`,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
          <span style={{ fontFamily: C.serif, fontSize: 13, fontStyle: 'italic', color: C.ink }}>{plant.name}</span>
          <span style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: s.color }}>
            {status === 'overdue' ? `${Math.abs(plant._daysUntil)}d late` : status === 'today' ? 'today' : `${plant._daysUntil}d`}
          </span>
        </div>
      )}
    </div>
  )
}

function GARow({ plant, wateredSet, onWater, openPlant }) {
  const wet = wateredSet.has(plant.id)
  const status = wet ? 'ok' : plant._status
  const s = CSTAT[status] || CSTAT.ok
  const effectivePlant = { ...plant, _status: status }
  return (
    <div {...pressProps(() => openPlant(plant.id), `Open ${plant.name}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '12px 0', borderBottom: `1px solid ${C.line2}`, cursor: 'pointer',
      }}>
      <CIconBadge plant={effectivePlant} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.serif, fontSize: 18, color: C.ink, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plant.name}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plant.species || ''}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>
          {status === 'overdue' ? `${Math.abs(plant._daysUntil)}d late` : 'Due today'}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onWater(plant.id) }}
          style={{ border: 'none', background: 'none', padding: 0, fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>
          Water →
        </button>
      </div>
    </div>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function Garden({ plants, floors, activeFloorId, weather, wateredSet, onWater, waterAll, openPlant, ctx }) {
  const thirsty = plants.filter((p) => statusOf(p, wateredSet) !== 'ok')
  const allDone = thirsty.length === 0

  const activeFloor = floors.find((f) => f.id === activeFloorId) || floors[0]
  const floorRooms = activeFloor?.rooms || []
  const floorName = activeFloor?.name || 'Ground floor'
  const firstThirsty = thirsty[0]

  const thirstyCount = thirsty.length
  const countWord = ['zero', 'one plant is', 'two plants are', 'three plants are', 'four plants are', 'five plants are'][thirstyCount] || `${thirstyCount} plants are`

  const weatherDisplay = weather?.current
    ? { temp: Math.round(weather.current.temp), condition: weather.current.condition?.sky || 'Clear' }
    : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={weatherDisplay} />
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 372px',
        gap: 34, padding: '30px 34px', minHeight: 0, overflow: 'hidden',
      }}>
        {/* main floorplan */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ marginBottom: 22 }}>
            <CKicker>{todayLabel()} · The morning round</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 37, fontWeight: 400, lineHeight: 1.1, margin: '8px 0 0', letterSpacing: -0.3 }}>
              {allDone
                ? <>Every plant is <span style={{ fontStyle: 'italic', color: C.greenBright }}>happy.</span></>
                : <>Good morning — <span style={{ fontStyle: 'italic', color: C.terra }}>{countWord} thirsty.</span></>}
            </h1>
            <div style={{ marginTop: 8, marginLeft: 2 }}><CSwash width={300} /></div>
          </div>
          <div style={{
            flex: 1, background: C.card, borderRadius: 8,
            border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)',
            padding: 22, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {/* gold corner bracket */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <div>
                <CKicker>Plate I · The Home</CKicker>
                <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink, marginTop: 2 }}>{floorName}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {Object.values(CSTAT).map((v) => (
                  <span key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.muted, fontFamily: C.sans, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, background: C.panel, borderRadius: 8, border: `1px solid ${C.line2}`, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FloorPlan
                width={660} height={384}
                bg={C.panel} rooms={floorRooms} plants={plants}
                activeId={firstThirsty?.id || plants[0]?.id}
                renderMarker={(p, isActive) => (
                  <GardenMarker plant={p} isActive={isActive} wateredSet={wateredSet} openPlant={openPlant} />
                )}
              />
            </div>
          </div>
        </div>

        {/* right rail */}
        <aside style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: C.terraSoft, border: `1px solid ${C.terra}33`, borderRadius: 8, padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: C.serif, fontSize: 56, lineHeight: 0.9, color: C.terra }}>{thirstyCount}</span>
              <div>
                <div style={{ fontFamily: C.serif, fontSize: 22, fontStyle: 'italic', color: C.ink }}>need water</div>
                <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>of {plants.length} plants · {[...new Set(plants.map(p => p.room).filter(Boolean))].length} rooms</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {thirsty.map((p) => (
              <GARow key={p.id} plant={p} wateredSet={wateredSet} onWater={onWater} openPlant={openPlant} />
            ))}
            {allDone && (
              <div style={{ padding: '30px 0', textAlign: 'center', fontFamily: C.serif, fontStyle: 'italic', fontSize: 17, color: C.muted }}>
                Nothing on the round — nicely done.
              </div>
            )}
          </div>
          {weather?.rainSoon && (
            <div style={{ margin: '14px 0', background: C.sageBg, borderLeft: `3px solid ${C.greenBright}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontFamily: C.serif, fontSize: 17, fontStyle: 'italic', color: C.green, marginBottom: 3 }}>Rain is on the way.</div>
              <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Your outdoor plants have been skipped today — the forecast will do the watering.</div>
            </div>
          )}
          {!allDone && (
            <CBtn kind="primary" full onClick={() => waterAll(thirsty.map((p) => p.id))}>
              <CIcon d={IC.drop} size={18} color="#FFF6EE" fill="#FFF6EE" w={0} /> Water all {thirstyCount} →
            </CBtn>
          )}
        </aside>
      </div>
    </div>
  )
}
