import React, { useState } from 'react'
import { C } from '../../tokens.js'
import { CIcon, IC } from '../../icons.jsx'
import { CSwash, CKicker, CBtn } from '../../primitives.jsx'
import { PlantIcon } from '../../PlantIcon.jsx'

function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.6 37.8 46.5 31.7 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export function Login({ onGoogleSignIn }) {
  const [email, setEmail] = useState('')
  const cluster = ['fern', 'monstera', 'snake', 'lily', 'succulent']

  return (
    <div style={{ height: '100%', background: C.paper, fontFamily: C.sans, color: C.ink, display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
      {/* brand panel */}
      <div style={{ background: C.green, color: '#FBF7EE', padding: '54px 56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 5, width: 120, background: `linear-gradient(90deg, ${C.terra} 0%, ${C.terra} 55%, ${C.gold} 55%, ${C.gold} 100%)`, borderRadius: 3 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.terra, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CIcon d={IC.leaf} size={20} color={C.goldSoft} fill={C.goldSoft} w={0} />
          </div>
          <span style={{ fontFamily: C.serif, fontSize: 26, fontStyle: 'italic', fontWeight: 500 }}>Conservatory</span>
        </div>
        <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingRight: 20 }}>
          <div style={{ fontFamily: C.sans, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.goldSoft, fontWeight: 700, marginBottom: 14 }}>Your plants, mapped &amp; minded</div>
          <h1 style={{ fontFamily: C.serif, fontSize: 46, fontWeight: 400, lineHeight: 1.12, margin: 0, letterSpacing: -0.5 }}>
            A quiet home for<br /><span style={{ fontStyle: 'italic', color: C.gold }}>every living thing</span><br />you tend.
          </h1>
          <p style={{ fontFamily: C.serif, fontSize: 18, fontStyle: 'italic', color: '#E4ECDD', lineHeight: 1.5, margin: '20px 0 0', maxWidth: 380 }}>
            Know what needs water, where each plant lives, and let the weather lend a hand.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 30 }}>
          {cluster.map((t) => <PlantIcon key={t} type={t} size={58} tint="#A9C0A2" pot="#C9784F" />)}
          <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.18)', marginBottom: 10, marginLeft: 8 }} />
        </div>
      </div>

      {/* sign-in card */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '54px 80px' }}>
        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <CKicker>Welcome back</CKicker>
          <h2 style={{ fontFamily: C.serif, fontSize: 34, fontWeight: 400, margin: '8px 0 0', letterSpacing: -0.3 }}>
            Sign in to your <span style={{ fontStyle: 'italic', color: C.terra }}>garden.</span>
          </h2>
          <div style={{ marginTop: 8, marginBottom: 30 }}><CSwash width={170} /></div>

          <button onClick={onGoogleSignIn}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 6, padding: '14px', fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.ink, cursor: 'pointer', boxShadow: '0 1px 2px rgba(40,30,20,.05)' }}>
            <GoogleG size={19} /> Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ fontFamily: C.serif, fontSize: 14, fontStyle: 'italic', color: C.muted }}>or with email</span>
            <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          <label style={{ fontFamily: C.sans, fontSize: 12.5, fontWeight: 600, color: C.muted }}>Email address</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 6, padding: '12px 14px', marginTop: 6, marginBottom: 14, background: '#fff' }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: C.sans, fontSize: 14.5, color: C.ink, background: 'transparent' }} />
          </div>
          <CBtn kind="primary" full style={{ borderRadius: 6 }}>Continue →</CBtn>

          <p style={{ fontFamily: C.sans, fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
            New to Conservatory? <span style={{ fontFamily: C.serif, fontStyle: 'italic', color: C.terra, fontSize: 15, cursor: 'pointer' }}>Plant your first →</span>
          </p>
        </div>
      </div>
    </div>
  )
}
