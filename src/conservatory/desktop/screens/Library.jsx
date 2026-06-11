import React, { useState, useMemo } from 'react'
import { C, CSTAT } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn, pressProps, statusOf } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

function LibCard({ plant, onOpen }) {
  const s = CSTAT[plant._status] || CSTAT.ok
  const daysLabel = plant._status === 'overdue'
    ? `${Math.abs(plant._daysUntil)}d overdue`
    : plant._status === 'today' ? 'Water today' : `Water in ${plant._daysUntil}d`
  return (
    <div {...pressProps(() => onOpen(plant.id), `Open ${plant.name}`)}
      style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.line2}`, boxShadow: '0 6px 20px -14px rgba(120,90,40,.35)', padding: 16, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: C.panel, border: `1px solid ${C.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PlantIcon type={plant.icon || 'monstera'} size={48} />
        </div>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, marginTop: 4 }} title={s.label} />
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 20, color: C.ink, marginTop: 12, lineHeight: 1.05 }}>{plant.name}</div>
      <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>{plant.species || ''}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontFamily: C.sans, fontSize: 12, color: C.muted }}>
        <CIcon d={IC.pin} size={13} color={C.muted} w={1.6} />{plant.room || '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line2}` }}>
        <span style={{ fontFamily: C.sans, fontSize: 12, color: s.color, fontWeight: 700 }}>{daysLabel}</span>
        <span style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>Open →</span>
      </div>
    </div>
  )
}

export function Library({ plants, wateredSet, ctx }) {
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState('list')

  const rooms = useMemo(() => [...new Set(plants.map((p) => p.room).filter(Boolean))], [plants])

  const filtered = useMemo(() => {
    if (filter === 'water') return plants.filter((p) => statusOf(p, wateredSet) !== 'ok')
    if (rooms.includes(filter)) return plants.filter((p) => p.room === filter)
    return plants
  }, [plants, wateredSet, filter, rooms])

  const needsWater = plants.filter((p) => statusOf(p, wateredSet) !== 'ok').length
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  const filters = [
    { id: 'all', label: 'All plants', count: plants.length },
    { id: 'water', label: 'Needs water', count: needsWater },
    ...rooms.slice(0, 4).map((r) => ({ id: r, label: r, count: plants.filter((p) => p.room === r).length })),
  ]

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <CKicker>The whole collection</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
              Every plant you <span style={{ fontStyle: 'italic', color: C.terra }}>tend.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', background: C.panel, borderRadius: 9, padding: 3, border: `1px solid ${C.line2}` }}>
              {[['Map', 'map'], ['List', 'list']].map(([label, key]) => (
                <span key={key} onClick={() => setView(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', background: view === key ? C.card : 'transparent', color: view === key ? C.terra : C.muted, boxShadow: view === key ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}>
                  <CIcon d={key === 'map' ? IC.pin : IC.grid} size={14} color={view === key ? C.terra : C.muted} w={1.7} />{label}
                </span>
              ))}
            </div>
            <CBtn kind="primary" style={{ borderRadius: 8, padding: '11px 16px', fontSize: 15 }} onClick={() => ctx.navigate('addplant')}>
              <CIcon d={IC.plus} size={16} color="#FFF6EE" w={2} /> Add plant
            </CBtn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 9, marginBottom: 20, flexWrap: 'wrap' }}>
          {filters.map(({ id, label, count }) => (
            <span key={id} onClick={() => setFilter(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: C.sans, fontSize: 13.5, fontWeight: 600, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', background: filter === id ? C.terra : C.card, color: filter === id ? '#FFF6EE' : C.muted, border: `1px solid ${filter === id ? C.terra : C.line}` }}>
              {label} <span style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 700, opacity: filter === id ? 0.85 : 0.7 }}>{count}</span>
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: C.sans, fontSize: 13.5, color: C.muted, padding: '8px 14px' }}>
            <CIcon d={IC.sliders} size={15} color={C.muted} w={1.7} />Sort: next due
          </span>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridAutoRows: 'min-content', gap: 16, alignContent: 'start', overflowY: 'auto' }}>
          {filtered.map((p) => <LibCard key={p.id} plant={p} onOpen={ctx.openPlant} />)}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '40px 0', textAlign: 'center', fontFamily: C.serif, fontStyle: 'italic', fontSize: 17, color: C.muted }}>No plants match that filter.</div>
          )}
        </div>
      </div>
    </div>
  )
}
