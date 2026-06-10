import React from 'react'
import { C, CSTAT } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'
import { CSwash, CBtn, MPlantRow, pressProps, statusOf } from '../primitives.jsx'
import { PlantIcon } from '../PlantIcon.jsx'
import { FloorPlan } from '../FloorPlan.jsx'
import { MStatusSpace, MBrandHeader, MScroll } from '../shell.jsx'

const COUNT_WORDS = [
  'Every plant is',
  'One plant is',
  'Two plants are',
  'Three plants are',
  'Four plants are',
]

function GardenMarker({ plant, isActive, wateredSet, openPlant }) {
  const wet = wateredSet.has(plant.id)
  const status = wet ? 'ok' : plant._status
  const s = CSTAT[status] || CSTAT.ok
  return (
    <div {...pressProps((e) => { e.stopPropagation(); openPlant(plant.id) }, `Open ${plant.name}`)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
      <div style={{
        width: isActive ? 30 : 23, height: isActive ? 30 : 23,
        borderRadius: C.r.round, background: '#fff',
        border: `2px solid ${s.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(80,50,20,.2)',
      }}>
        <PlantIcon type={plant.icon} size={isActive ? 20 : 16} />
      </div>
    </div>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function Garden({ plants, floors, activeFloorId, wateredSet, onWater, waterAll, openPlant }) {
  const thirsty = plants.filter((p) => statusOf(p, wateredSet) !== 'ok')
  const allDone = thirsty.length === 0
  const firstThirsty = thirsty[0]

  const activeFloor = floors.find((f) => f.id === activeFloorId) || floors[0]
  const floorRooms = activeFloor?.rooms || []
  const floorName = activeFloor?.name || 'Ground floor'

  const countLabel = COUNT_WORDS[thirsty.length] || `${thirsty.length} plants are`

  return (
    <>
      <MStatusSpace />
      <MBrandHeader />
      <div style={{ padding: '4px 18px 0', flexShrink: 0 }}>
        <div style={{
          fontFamily: C.sans, fontSize: 10.5, letterSpacing: 1.5,
          textTransform: 'uppercase', color: C.terra, fontWeight: 700,
        }}>
          {todayLabel()}
        </div>
        <h1 style={{
          fontFamily: C.serif, fontSize: 26, fontWeight: 400,
          lineHeight: 1.08, margin: '4px 0 0', letterSpacing: -0.3,
        }}>
          {allDone
            ? <>Every plant is <span style={{ fontStyle: 'italic', color: C.greenBright }}>happy.</span></>
            : <>{countLabel} <span style={{ fontStyle: 'italic', color: C.terra }}>thirsty.</span></>}
        </h1>
        <div style={{ marginTop: C.sp.xs }}><CSwash width={132} /></div>
      </div>

      <MScroll style={{ padding: '0 0 12px' }}>
        {/* floorplan plate */}
        <div style={{
          margin: '16px 16px 0', background: C.card,
          borderRadius: C.r.lg, border: `1px solid ${C.line}`,
          boxShadow: '0 10px 30px -20px rgba(120,70,30,.45)',
          padding: 13, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 46, height: 3.5, background: C.gold }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 3.5, height: 46, background: C.gold }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: C.sp.sm }}>
            <span style={{ fontFamily: C.serif, fontSize: 16, color: C.ink, whiteSpace: 'nowrap' }}>{floorName}</span>
            <span style={{
              fontFamily: C.sans, fontSize: 10, color: C.terra,
              fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            }}>Plate I</span>
          </div>
          <div style={{
            background: C.panel, borderRadius: C.r.sm,
            border: `1px solid ${C.line2}`, padding: C.sp.sm,
          }}>
            <FloorPlan
              width={300} height={188}
              bg={C.panel}
              rooms={floorRooms}
              plants={plants}
              activeId={firstThirsty?.id || plants[0]?.id}
              renderMarker={(p, isActive) => (
                <GardenMarker
                  plant={p} isActive={isActive}
                  wateredSet={wateredSet} openPlant={openPlant}
                />
              )}
            />
          </div>
        </div>

        {/* needs water list */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline',
            justifyContent: 'space-between', marginBottom: 2,
          }}>
            <span style={{
              fontFamily: C.serif, fontSize: 18, fontStyle: 'italic',
              color: C.ink, whiteSpace: 'nowrap',
            }}>
              {allDone ? 'All watered' : 'Needs water'}
            </span>
            {!allDone && (
              <span style={{
                fontFamily: C.sans, fontSize: 12, fontWeight: 700,
                color: '#fff', background: C.terra,
                padding: '2px 9px', borderRadius: C.r.pill,
              }}>{thirsty.length} today</span>
            )}
          </div>
          {allDone ? (
            <div style={{
              padding: '22px 0', textAlign: 'center',
              fontFamily: C.serif, fontStyle: 'italic', fontSize: 16, color: C.muted,
            }}>
              Nothing on the round — nicely done.
            </div>
          ) : (
            thirsty.map((p) => (
              <MPlantRow key={p.id} plant={p} wateredSet={wateredSet} onWater={onWater} onOpen={openPlant} />
            ))
          )}
        </div>
      </MScroll>

      {!allDone && (
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <CBtn kind="primary" full style={{ borderRadius: C.r.lg }}
            onClick={() => waterAll(thirsty.map((p) => p.id))}>
            <CIcon d={IC.drop} size={17} color="#FFF6EE" fill="#FFF6EE" w={0} />
            {` Water all ${thirsty.length} →`}
          </CBtn>
        </div>
      )}
    </>
  )
}
