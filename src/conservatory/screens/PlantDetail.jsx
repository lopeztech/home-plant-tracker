import React from 'react'
import { C, CSTAT } from '../tokens.js'
import { CIcon, IC } from '../icons.jsx'
import { CStatusChip, CBtn, MStatChip } from '../primitives.jsx'
import { CKicker } from '../primitives.jsx'
import { iconBtn } from '../primitives.jsx'
import { PlantIcon } from '../PlantIcon.jsx'
import { MStatusSpace, MBackHeader, MScroll } from '../shell.jsx'

const KIND_ICON = {
  water: IC.drop,
  mist: IC.rain,
  feed: IC.leaf,
  note: IC.bell,
}
const KIND_COLOR = (kind, C) => ({
  water: C.terra,
  mist: C.greenBright,
  feed: C.gold,
  note: C.muted,
}[kind] || C.muted)

export function PlantDetail({ plantId, plants, wateredSet, onWater, onBack, careHistory = [] }) {
  const plant = plants.find((p) => p.id === plantId) || plants[0]
  if (!plant) return null

  const wet = wateredSet.has(plant.id)
  const status = wet ? 'ok' : plant._status
  const s = CSTAT[status] || CSTAT.ok

  const history = wet
    ? [{ date: 'Today', kind: 'water', label: 'Watered', detail: 'Just now · marked done' }, ...careHistory]
    : careHistory
  const historySlice = history.slice(0, 5)

  const daysLabel = plant._daysUntil < 0
    ? `${Math.abs(plant._daysUntil)}d late`
    : plant._daysUntil === 0 ? 'Due today' : 'Healthy'

  const sinceDays = plant._daysUntil < 0 ? Math.abs(plant._daysUntil) : 0

  return (
    <>
      <MStatusSpace />
      <MBackHeader
        title={plant.room || 'Plant'}
        onBack={onBack}
        action={
          <button aria-label="Plant options" style={{ ...iconBtn, minWidth: C.tap, minHeight: C.tap }}>
            <CIcon d={IC.sliders} size={19} color={C.muted} w={1.7} />
          </button>
        }
      />
      <MScroll>
        {/* hero */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '6px 18px 0',
        }}>
          <div style={{
            width: 124, height: 124, borderRadius: C.r.round,
            background: C.panel, border: `1px solid ${C.line2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <PlantIcon type={plant.icon || 'monstera'} size={98} />
            <div style={{ position: 'absolute', bottom: 2, right: 4 }}>
              <CStatusChip status={status}>{daysLabel}</CStatusChip>
            </div>
          </div>
          <h1 style={{ fontFamily: C.serif, fontSize: 28, margin: '12px 0 0', color: C.ink }}>
            {plant.name}
          </h1>
          <div style={{ fontFamily: C.serif, fontSize: 15, fontStyle: 'italic', color: C.muted }}>
            {plant.species || ''}
          </div>
        </div>

        {/* stat chips */}
        <div style={{ display: 'flex', gap: C.sp.sm, padding: '16px 16px 0' }}>
          <MStatChip
            n={plant.frequencyDays ? `${plant.frequencyDays}d` : '—'}
            label="waters every"
            color={C.ink}
            bg={C.card}
          />
          <MStatChip
            n={wet ? '0d' : `${sinceDays}d`}
            label="since last"
            color={C.greenBright}
            bg={C.card}
          />
          <MStatChip
            n={status === 'ok' ? '✓' : '!'}
            label={status === 'ok' ? 'on track' : 'overdue'}
            color={status === 'ok' ? C.greenBright : C.terra}
            bg={C.terraSoft}
          />
        </div>

        {/* care journal */}
        <div style={{ padding: '18px 18px 8px' }}>
          <CKicker>Care journal</CKicker>
          <div style={{ marginTop: C.sp.md }}>
            {historySlice.length === 0 ? (
              <div style={{
                fontFamily: C.serif, fontStyle: 'italic',
                fontSize: 15, color: C.muted, padding: '12px 0',
              }}>No care events recorded yet.</div>
            ) : (
              historySlice.map((h, i, a) => {
                const col = KIND_COLOR(h.kind, C)
                return (
                  <div key={i} style={{ display: 'flex', gap: C.sp.md }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: C.r.round,
                        background: C.card, border: `1.5px solid ${col}`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <CIcon
                          d={KIND_ICON[h.kind] || IC.bell}
                          size={14} color={col} w={1.7}
                          fill={h.kind === 'water' ? col : 'none'}
                        />
                      </div>
                      {i < a.length - 1 && (
                        <div style={{ width: 2, flex: 1, background: C.line, marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 14, flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', gap: C.sp.sm,
                        alignItems: 'baseline', justifyContent: 'space-between',
                      }}>
                        <span style={{
                          fontFamily: C.serif, fontSize: 16, color: C.ink,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{h.label}</span>
                        <span style={{
                          fontFamily: C.sans, fontSize: 11.5,
                          color: C.muted, whiteSpace: 'nowrap', flexShrink: 0,
                        }}>{h.date}</span>
                      </div>
                      {h.detail && (
                        <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>
                          {h.detail}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </MScroll>

      {/* action row */}
      <div style={{ padding: '8px 16px 16px', display: 'flex', gap: C.sp.md, flexShrink: 0 }}>
        {wet ? (
          <CBtn kind="green" full style={{ borderRadius: C.r.lg }} onClick={() => onWater(plant.id)}>
            <CIcon d={IC.check} size={17} color="#FFF6EE" w={2.2} /> Watered today
          </CBtn>
        ) : (
          <CBtn kind="primary" full style={{ borderRadius: C.r.lg }} onClick={() => onWater(plant.id)}>
            <CIcon d={IC.drop} size={17} color="#FFF6EE" fill="#FFF6EE" w={0} /> Water now
          </CBtn>
        )}
        <CBtn kind="ghost" style={{ borderRadius: C.r.lg, padding: '13px 18px' }}>Edit</CBtn>
      </div>
    </>
  )
}
