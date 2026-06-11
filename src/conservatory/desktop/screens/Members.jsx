import React from 'react'
import { C } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn } from '../../primitives.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const ROLE_STYLE = {
  Owner:  { color: '#3E5641', soft: '#E4EDDD' },
  Carer:  { color: '#5E9C4F', soft: '#DCEBCB' },
  Viewer: { color: '#857F6E', soft: '#ECE6D8' },
}

function RolePill({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.Viewer
  return <span style={{ fontFamily: C.sans, fontSize: 11.5, fontWeight: 700, color: s.color, background: s.soft, padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>{role}</span>
}

const TINTS = ['#3E5641', '#C9784F', '#6E7F4E', '#D9A441', '#5E9C4F', '#857F6E']

function MemberRow({ member, index, last }) {
  const tint = TINTS[index % TINTS.length]
  const roleKey = member.role === 'owner' ? 'Owner' : member.role === 'carer' ? 'Carer' : 'Viewer'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 0', borderBottom: last ? 'none' : `1px solid ${C.line2}` }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: tint, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.serif, fontSize: 20, flexShrink: 0 }}>
        {(member.name || member.email || '?')[0].toUpperCase()}
      </div>
      <div style={{ width: 220, minWidth: 0 }}>
        <div style={{ fontFamily: C.serif, fontSize: 18, color: C.ink, lineHeight: 1.05 }}>{member.name || 'Member'}</div>
        <div style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email || ''}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginBottom: 2 }}>Access</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: C.serif, fontSize: 15, fontStyle: 'italic', color: C.ink }}>
          <CIcon d={IC.pin} size={14} color={C.terra} w={1.7} />All rooms
        </div>
      </div>
      <div style={{ width: 110 }}>
        <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, marginBottom: 2 }}>Last active</div>
        <div style={{ fontFamily: C.sans, fontSize: 13, color: C.muted }}>Recently</div>
      </div>
      <RolePill role={roleKey} />
      <CIcon d={IC.sliders} size={18} color={C.muted} w={1.7} style={{ cursor: 'pointer' }} />
    </div>
  )
}

export function Members({ household, ctx }) {
  const members = household?.members || []
  const invites = household?.pendingInvites || []
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <CKicker>Who tends this garden</CKicker>
            <h1 style={{ fontFamily: C.serif, fontSize: 33, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
              The <span style={{ fontStyle: 'italic', color: C.terra }}>household.</span>
            </h1>
          </div>
          <CBtn kind="primary" style={{ borderRadius: 8, fontSize: 15 }}>
            <CIcon d={IC.plus} size={16} color="#FFF6EE" w={2} /> Invite someone
          </CBtn>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 312px', gap: 26, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 24, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <CKicker>Members</CKicker>
                <div style={{ fontFamily: C.serif, fontSize: 21, marginTop: 2 }}>{members.length} people</div>
              </div>
              <span style={{ fontFamily: C.sans, fontSize: 12.5, color: C.muted }}>Greenhouse plan · up to 5</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {members.length === 0 ? (
                <div style={{ padding: '30px 0', textAlign: 'center', fontFamily: C.serif, fontStyle: 'italic', fontSize: 16, color: C.muted }}>No household members yet. Invite someone to share care.</div>
              ) : (
                members.map((m, i) => <MemberRow key={m.id || i} member={m} index={i} last={i === members.length - 1} />)
              )}
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <CKicker>Pending invites</CKicker>
                <span style={{ fontFamily: C.serif, fontSize: 28, color: C.gold, lineHeight: 1 }}>{invites.length}</span>
              </div>
              {invites.length === 0 && <div style={{ fontFamily: C.serif, fontStyle: 'italic', fontSize: 15, color: C.muted }}>No pending invites.</div>}
              {invites.map((inv, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: i === invites.length - 1 ? 'none' : `1px solid ${C.line2}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.panel, border: `1px dashed ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CIcon d={IC.bell} size={15} color={C.muted} w={1.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: C.sans, fontSize: 13.5, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                    <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>{inv.role || 'Viewer'}</div>
                  </div>
                  <span style={{ fontFamily: C.serif, fontSize: 13.5, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>Resend</span>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05)', padding: 20, flex: 1 }}>
              <CKicker>What roles can do</CKicker>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['Owner', 'Manages plants, billing & people'], ['Carer', 'Logs care in their rooms'], ['Viewer', "Sees the garden, can't edit"]].map(([r, d]) => (
                  <div key={r} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <RolePill role={r} />
                    <span style={{ flex: 1, fontFamily: C.sans, fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
