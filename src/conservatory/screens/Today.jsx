import React from 'react'
import { C } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'
import { MPlantRow, MRing, statusOf } from '../primitives.jsx'
import { MStatusSpace, MBrandHeader, MScroll } from '../shell.jsx'

export function Today({ plants, wateredSet, onWater, openPlant }) {
  const total = plants.length
  const done = plants.filter((p) => statusOf(p, wateredSet) === 'ok').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 100

  // Group remaining thirsty plants by room
  const roomMap = {}
  plants.forEach((p) => {
    if (statusOf(p, wateredSet) !== 'ok') {
      if (!roomMap[p.room]) roomMap[p.room] = []
      roomMap[p.room].push(p)
    }
  })
  const groups = Object.entries(roomMap).map(([room, ps]) => ({ room, plants: ps }))

  return (
    <>
      <MStatusSpace />
      <MBrandHeader />
      <div style={{ padding: '4px 18px 0', flexShrink: 0 }}>
        <h1 style={{
          fontFamily: C.serif, fontSize: 26, fontWeight: 400,
          lineHeight: 1.08, margin: 0, letterSpacing: -0.3,
        }}>
          The day's <span style={{ fontStyle: 'italic', color: C.terra }}>round.</span>
        </h1>
      </div>

      {/* progress card */}
      <div style={{
        margin: '14px 16px 0', background: C.card,
        border: `1px solid ${C.line}`, borderRadius: C.r.lg,
        padding: 16, display: 'flex', alignItems: 'center',
        gap: 16, flexShrink: 0,
      }}>
        <MRing pct={pct} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: C.serif, fontSize: 22, color: C.ink, lineHeight: 1 }}>
            {done}{' '}
            <span style={{ fontStyle: 'italic', color: C.muted, fontSize: 16 }}>
              / {total}
            </span>{' '}done
          </div>
          <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, marginTop: 3 }}>
            {total - done === 0
              ? 'The round is complete 🌿'
              : `${total - done} still need water today`}
          </div>
        </div>
      </div>

      <MScroll style={{ padding: '16px 18px 12px' }}>
        {groups.length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontFamily: C.serif, fontStyle: 'italic', fontSize: 17, color: C.muted,
          }}>
            Every plant has been watered today.
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.room} style={{ marginBottom: C.sp.xl }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: C.sp.sm, marginBottom: C.sp.xs,
              }}>
                <CIcon d={IC.pin} size={14} color={C.terra} w={1.7} />
                <span style={{ fontFamily: C.serif, fontSize: 17, color: C.ink }}>{g.room}</span>
                <div style={{ flex: 1, height: 1, background: C.line }} />
              </div>
              {g.plants.map((p) => (
                <MPlantRow key={p.id} plant={p} wateredSet={wateredSet} onWater={onWater} onOpen={openPlant} />
              ))}
            </div>
          ))
        )}
      </MScroll>
    </>
  )
}
