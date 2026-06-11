import React from 'react'
import { C } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CKicker, CBtn } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'
import { DesktopHeader } from '../DesktopHeader.jsx'

const PLANS = [
  { id: 'free', apiId: 'free', name: 'Windowsill', price: '£0', cadence: 'free forever', icon: 'succulent', blurb: 'For a small, happy collection.', features: ['Up to 8 plants', 'One floorplan', 'Watering reminders'] },
  { id: 'home_pro', apiId: 'home_pro', name: 'Greenhouse', price: '£4', cadence: 'per month', icon: 'monstera', blurb: 'For a home that\'s filling up.', features: ['Unlimited plants', 'Weather-aware care', 'Propagation bench', 'Care journal'] },
  { id: 'landscaper_pro', apiId: 'landscaper_pro', name: 'Glasshouse', price: '£8', cadence: 'per month', icon: 'palm', blurb: 'For the devoted, many-roomed grower.', features: ['Everything in Greenhouse', 'Multiple floorplans', 'Household sharing', 'AI plant doctor'] },
]

function PlanCard({ plan, isCurrent, onSelect }) {
  return (
    <div style={{ flex: 1, background: isCurrent ? C.green : C.card, color: isCurrent ? '#FBF7EE' : C.ink, borderRadius: 12, border: `1px solid ${isCurrent ? C.green : C.line}`, padding: 22, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: isCurrent ? '0 18px 40px -22px rgba(40,60,40,.6)' : '0 6px 20px -16px rgba(120,90,40,.35)' }}>
      {isCurrent && <div style={{ position: 'absolute', top: 14, right: 14, fontFamily: C.sans, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.green, background: C.gold, padding: '4px 10px', borderRadius: 20 }}>Current</div>}
      <div style={{ width: 54, height: 54, borderRadius: 15, background: isCurrent ? 'rgba(255,255,255,0.12)' : C.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <PlantIcon type={plan.icon} size={40} tint={isCurrent ? '#A9C0A2' : undefined} pot={isCurrent ? '#C9784F' : undefined} />
      </div>
      <div style={{ fontFamily: C.serif, fontSize: 24, fontStyle: 'italic' }}>{plan.name}</div>
      <div style={{ fontFamily: C.sans, fontSize: 13, color: isCurrent ? '#D8E4D3' : C.muted, marginTop: 2, marginBottom: 14 }}>{plan.blurb}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 16 }}>
        <span style={{ fontFamily: C.serif, fontSize: 38, lineHeight: 0.9 }}>{plan.price}</span>
        <span style={{ fontFamily: C.sans, fontSize: 13, color: isCurrent ? '#D8E4D3' : C.muted }}>{plan.cadence}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <CIcon d={IC.check} size={15} color={isCurrent ? C.gold : C.greenBright} w={2.4} />
            <span style={{ fontFamily: C.sans, fontSize: 13.5, color: isCurrent ? '#EAF0E4' : C.ink }}>{f}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        {isCurrent
          ? <div style={{ textAlign: 'center', fontFamily: C.serif, fontSize: 15, fontStyle: 'italic', color: C.gold }}>Your current plan</div>
          : <CBtn kind={plan.id === 'landscaper_pro' ? 'primary' : 'ghost'} full style={{ borderRadius: 7, fontSize: 15 }} onClick={() => onSelect(plan)}>
              {plan.id === 'free' ? 'Downgrade' : 'Upgrade →'}
            </CBtn>}
      </div>
    </div>
  )
}

export function Billing({ subscription, ctx }) {
  const currentTier = subscription?.tier || 'free'
  const wx = ctx.weather?.current ? { temp: Math.round(ctx.weather.current.temp), condition: ctx.weather.current.condition?.sky || 'Clear' } : null

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader activeScreen="garden" onNav={ctx.navigate} user={ctx.user} weather={wx} />
      <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontFamily: C.sans, fontSize: 13, color: C.muted }}>
          <button onClick={() => ctx.navigate('settings')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.muted, fontFamily: C.sans, fontSize: 13 }}>Settings</button>
          <CIcon d={IC.chevR} size={14} color={C.muted} />
          <span style={{ color: C.ink, fontStyle: 'italic', fontFamily: C.serif, fontSize: 15 }}>Plan &amp; billing</span>
        </div>
        <div style={{ marginBottom: 18 }}>
          <CKicker>Choose how much you grow</CKicker>
          <h1 style={{ fontFamily: C.serif, fontSize: 33, fontWeight: 400, margin: '6px 0 0', letterSpacing: -0.3 }}>
            A plan for every <span style={{ fontStyle: 'italic', color: C.terra }}>green thumb.</span>
          </h1>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 330px', gap: 26, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} isCurrent={plan.apiId === currentTier} onSelect={() => {}} />
            ))}
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05), 0 18px 44px -30px rgba(120,60,30,.45)', padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 4, background: C.gold }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: 60, background: C.gold }} />
              <CKicker>This billing period</CKicker>
              <div style={{ fontFamily: C.serif, fontSize: 21, color: C.ink, margin: '4px 0 14px' }}>
                {PLANS.find((p) => p.apiId === currentTier)?.name || 'Windowsill'}
                {subscription?.currentPeriodEnd ? ` · renews ${new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
              </div>
              {[['Plants', `${subscription?.usage?.plants ?? 0} used`], ['Floorplans', '1'], ['Household', 'Just you']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontFamily: C.sans, fontSize: 13.5, color: C.muted }}>{k}</span>
                  <span style={{ fontFamily: C.serif, fontSize: 16, color: C.ink }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.line2}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 28, borderRadius: 5, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: C.serif, fontSize: 11, fontStyle: 'italic', color: C.goldSoft }}>VISA</span>
                </div>
                <span style={{ flex: 1, fontFamily: C.sans, fontSize: 13.5, color: C.ink }}>•••• 4821</span>
                <span style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>Update</span>
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(40,30,20,.05)', padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <CKicker>Recent invoices</CKicker>
                <span style={{ fontFamily: C.serif, fontSize: 13.5, fontStyle: 'italic', color: C.terra, cursor: 'pointer' }}>View all</span>
              </div>
              {[['1 Jun 2026', 'Greenhouse · monthly', '£4.00'], ['1 May 2026', 'Greenhouse · monthly', '£4.00'], ['1 Apr 2026', 'Greenhouse · monthly', '£4.00']].map(([d, desc, amt], i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${C.line2}` }}>
                  <CIcon d={IC.check} size={15} color={C.greenBright} w={2.4} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: C.serif, fontSize: 15, color: C.ink, lineHeight: 1.1 }}>{d}</div>
                    <div style={{ fontFamily: C.sans, fontSize: 12, color: C.muted }}>{desc}</div>
                  </div>
                  <span style={{ fontFamily: C.serif, fontSize: 15, color: C.ink }}>{amt}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
