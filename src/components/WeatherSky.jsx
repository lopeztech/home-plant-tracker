import React, { useMemo } from 'react'

// Sky condition → gradient tint over the floorplan
const SKY_GRADIENTS = {
  sunny:  'linear-gradient(to bottom, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.06) 45%, transparent 75%)',
  partly: 'linear-gradient(to bottom, rgba(147,197,253,0.15) 0%, rgba(147,197,253,0.04) 50%, transparent 80%)',
  cloudy: 'linear-gradient(to bottom, rgba(100,116,139,0.22) 0%, rgba(100,116,139,0.08) 55%, transparent 80%)',
  foggy:  'linear-gradient(to bottom, rgba(148,163,184,0.32) 0%, rgba(148,163,184,0.12) 60%, transparent 90%)',
  rainy:  'linear-gradient(to bottom, rgba(30,58,138,0.28) 0%, rgba(30,64,175,0.12) 50%, transparent 80%)',
  stormy: 'linear-gradient(to bottom, rgba(49,46,129,0.38) 0%, rgba(67,56,202,0.16) 55%, transparent 80%)',
  snowy:  'linear-gradient(to bottom, rgba(186,230,253,0.22) 0%, rgba(186,230,253,0.07) 55%, transparent 80%)',
  night:  'linear-gradient(to bottom, rgba(15,23,42,0.55) 0%, rgba(30,27,75,0.22) 55%, transparent 85%)',
}

// Floorplan container border glow by sky condition
export const SKY_BORDER_COLORS = {
  sunny:  'rgba(251,191,36,0.5)',
  partly: 'rgba(147,197,253,0.35)',
  cloudy: 'rgba(100,116,139,0.3)',
  foggy:  'rgba(148,163,184,0.28)',
  rainy:  'rgba(59,130,246,0.4)',
  stormy: 'rgba(129,140,248,0.5)',
  snowy:  'rgba(186,230,253,0.4)',
  night:  'rgba(99,102,241,0.35)',
}

// CSS keyframes injected once — stable string so React won't replace the <style> node
const ANIMATIONS = `
@keyframes wSunPulse {
  0%, 100% { transform: scale(1);    opacity: 0.85; }
  50%       { transform: scale(1.1); opacity: 1;    }
}
@keyframes wSunRay {
  0%, 100% { transform: scaleX(1);    opacity: 0.45; }
  50%       { transform: scaleX(1.4); opacity: 0.75; }
}
@keyframes wCloudDrift {
  0%, 100% { transform: translateX(0px); }
  50%       { transform: translateX(7px);  }
}
@keyframes wRainFall {
  0%   { transform: translateY(-8px)  translateX(0);   opacity: 0;   }
  10%  { opacity: 0.6; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(52px) translateX(10px); opacity: 0;   }
}
@keyframes wSnowFall {
  0%   { transform: translateY(-10px) translateX(0)    rotate(0deg);   opacity: 0;   }
  12%  { opacity: 0.75; }
  88%  { opacity: 0.75; }
  100% { transform: translateY(52px)  translateX(14px) rotate(200deg); opacity: 0;   }
}
@keyframes wLightning {
  0%, 87%, 100% { opacity: 0; }
  88%, 90%      { opacity: 0.9; }
  89%            { opacity: 0.1; }
}
@keyframes wFogDrift {
  0%, 100% { transform: translateX(0);   opacity: 0.35; }
  50%       { transform: translateX(12px); opacity: 0.5; }
}
`

// ── Sub-elements ──────────────────────────────────────────────────────────────

function Sun() {
  return (
    <div style={{ position: 'absolute', top: '3%', right: '7%', width: 54, height: 54 }}>
      {/* Rays */}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 20, height: 2.5,
          background: 'rgba(251,191,36,0.5)',
          borderRadius: 2,
          transformOrigin: '0 50%',
          transform: `rotate(${i * 45}deg) translateX(20px)`,
          animation: `wSunRay 2.4s ease-in-out infinite`,
          animationDelay: `${i * 0.3}s`,
        }} />
      ))}
      {/* Core */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 26, height: 26,
        background: 'radial-gradient(circle, rgba(251,191,36,1) 35%, rgba(251,191,36,0.25) 100%)',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 18px rgba(251,191,36,0.7), 0 0 36px rgba(251,191,36,0.25)',
        animation: 'wSunPulse 3.5s ease-in-out infinite',
      }} />
    </div>
  )
}

function Moon() {
  return (
    <div style={{
      position: 'absolute', top: '3%', right: '8%',
      width: 22, height: 22,
      background: 'rgba(226,232,240,0.88)',
      borderRadius: '50%',
      boxShadow: '0 0 14px rgba(226,232,240,0.45)',
      // Crescent: mask an overlapping circle
      WebkitMaskImage: 'radial-gradient(circle at 70% 35%, transparent 38%, black 42%)',
      maskImage: 'radial-gradient(circle at 70% 35%, transparent 38%, black 42%)',
    }} />
  )
}

function Cloud({ x, y, scale = 1, opacity = 0.65, delay = 0 }) {
  const w = 64 * scale
  const h = 32 * scale
  return (
    <svg style={{
      position: 'absolute', top: `${y}%`, left: `${x}%`,
      width: w, height: h, overflow: 'visible',
      opacity,
      animation: 'wCloudDrift 9s ease-in-out infinite',
      animationDelay: `${delay}s`,
    }} viewBox="0 0 64 32">
      <ellipse cx="32" cy="24" rx="30" ry="10" fill="rgba(148,163,184,0.6)" />
      <ellipse cx="22" cy="20" rx="15" ry="13" fill="rgba(148,163,184,0.68)" />
      <ellipse cx="40" cy="18" rx="13" ry="12" fill="rgba(148,163,184,0.65)" />
      <ellipse cx="32" cy="15" rx="11" ry="10" fill="rgba(148,163,184,0.7)" />
    </svg>
  )
}

// Deterministic rain drop positions (avoid Math.random on each render)
function Rain({ count = 24, heavy = false }) {
  const drops = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: `${((i * 4.17) % 100).toFixed(1)}%`,
    top:  `${((i * 6.5)  % 55).toFixed(1)}%`,
    delay: `${((i * 0.137) % 0.85).toFixed(2)}s`,
    dur:   heavy ? '0.52s' : '0.78s',
    h:     heavy ? 14 : 10,
  })), [count, heavy])

  return (
    <>
      {drops.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', left: d.left, top: d.top,
          width: 1.5, height: d.h,
          background: heavy ? 'rgba(147,197,253,0.65)' : 'rgba(147,197,253,0.48)',
          borderRadius: 1,
          transform: 'rotate(13deg)',
          animation: `wRainFall ${d.dur} linear infinite`,
          animationDelay: d.delay,
        }} />
      ))}
    </>
  )
}

function Snow({ count = 16 }) {
  const flakes = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left:  `${((i * 6.25) % 98).toFixed(1)}%`,
    top:   `${((i * 5.8)  % 50).toFixed(1)}%`,
    delay: `${((i * 0.19) % 1.1).toFixed(2)}s`,
    size:  3.5 + (i % 3),
  })), [count])

  return (
    <>
      {flakes.map((f, i) => (
        <div key={i} style={{
          position: 'absolute', left: f.left, top: f.top,
          width: f.size, height: f.size,
          background: 'rgba(186,230,253,0.82)',
          borderRadius: '50%',
          animation: '1.5s wSnowFall linear infinite',
          animationDelay: f.delay,
        }} />
      ))}
    </>
  )
}

function Lightning() {
  return (
    <svg style={{
      position: 'absolute', top: '2%', left: '52%',
      width: 14, height: 30,
      animation: 'wLightning 4.5s infinite',
      animationDelay: '2s',
    }} viewBox="0 0 14 30">
      <polygon points="10,0 3,14 8,14 4,30 11,14 6,14" fill="rgba(250,204,21,0.92)" />
    </svg>
  )
}

function Fog() {
  return (
    <>
      {[10, 21, 33].map((top, i) => (
        <div key={i} style={{
          position: 'absolute', top: `${top}%`, left: 0, right: 0, height: 7,
          background: 'linear-gradient(to right, transparent 0%, rgba(148,163,184,0.35) 15%, rgba(148,163,184,0.45) 50%, rgba(148,163,184,0.35) 85%, transparent 100%)',
          animation: 'wFogDrift 14s ease-in-out infinite',
          animationDelay: `${i * 3}s`,
        }} />
      ))}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WeatherSky({ weather }) {
  if (!weather) return null

  const { current } = weather
  const sky = current.isDay ? current.condition.sky : 'night'

  return (
    <>
      <style>{ANIMATIONS}</style>
      <div style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        background: SKY_GRADIENTS[sky] ?? SKY_GRADIENTS.sunny,
        borderRadius: 'inherit',
        overflow: 'hidden',
      }}>
        {sky === 'sunny'  && <Sun />}
        {sky === 'night'  && <Moon />}

        {sky === 'partly' && (
          <>
            <Sun />
            <Cloud x={3}  y={2} scale={1.1} opacity={0.55} delay={0} />
            <Cloud x={32} y={1} scale={0.85} opacity={0.45} delay={4} />
          </>
        )}

        {sky === 'cloudy' && (
          <>
            <Cloud x={2}  y={1} scale={1.2} opacity={0.6} delay={0} />
            <Cloud x={35} y={0} scale={0.9} opacity={0.5} delay={3} />
            <Cloud x={62} y={2} scale={1.0} opacity={0.55} delay={7} />
          </>
        )}

        {sky === 'foggy' && <Fog />}

        {sky === 'rainy' && (
          <>
            <Cloud x={5}  y={0} scale={1.3} opacity={0.6} delay={0} />
            <Cloud x={48} y={1} scale={1.0} opacity={0.55} delay={5} />
            <Rain count={24} />
          </>
        )}

        {sky === 'stormy' && (
          <>
            <Cloud x={3}  y={0} scale={1.5} opacity={0.7} delay={0} />
            <Cloud x={48} y={0} scale={1.2} opacity={0.65} delay={4} />
            <Lightning />
            <Rain count={32} heavy />
          </>
        )}

        {sky === 'snowy' && (
          <>
            <Cloud x={5}  y={0} scale={1.2} opacity={0.55} delay={0} />
            <Cloud x={52} y={1} scale={0.9} opacity={0.5} delay={6} />
            <Snow count={18} />
          </>
        )}
      </div>
    </>
  )
}
