import { useMemo } from 'react'
import { getSeason } from '../utils/watering.js'

const SEASON_CONFIG = {
  spring: {
    label: 'Spring',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.25)',
    particles: ['🌸', '🌸', '🌸', '🌱', '🌸'],
  },
  summer: {
    label: 'Summer',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    particles: ['☀️', '✨', '☀️', '✨', '☀️'],
  },
  autumn: {
    label: 'Autumn',
    color: '#ea580c',
    bg: 'rgba(234,88,12,0.12)',
    border: 'rgba(234,88,12,0.25)',
    particles: ['🍂', '🍁', '🍂', '🍁', '🍂'],
  },
  winter: {
    label: 'Winter',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.25)',
    particles: ['❄️', '❄️', '✨', '❄️', '❄️'],
  },
}

const ANIMATIONS = `
@keyframes seasonFloat {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(18px) translateX(6px) rotate(45deg); opacity: 0; }
}
@keyframes seasonPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}
`

export default function SeasonBadge({ lat }) {
  const season = useMemo(() => getSeason(lat), [lat])

  if (!season) return null
  const cfg = SEASON_CONFIG[season]

  return (
    <div
      className="season-badge"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px 2px 6px',
        borderRadius: 20,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: '0.75rem',
        fontWeight: 600,
        overflow: 'hidden',
        lineHeight: 1.4,
      }}
    >
      <style>{ANIMATIONS}</style>
      {/* Floating particles */}
      <span
        style={{
          position: 'relative',
          width: 20,
          height: 20,
          display: 'inline-block',
          flexShrink: 0,
        }}
      >
        {cfg.particles.map((p, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              fontSize: 10,
              left: `${(i * 18) % 16}px`,
              top: -2,
              animation: `seasonFloat ${1.8 + i * 0.3}s ease-in-out ${i * 0.4}s infinite`,
              opacity: 0,
              pointerEvents: 'none',
            }}
          >
            {p}
          </span>
        ))}
        {/* Static icon */}
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: 2,
            fontSize: 13,
            animation: 'seasonPulse 2.5s ease-in-out infinite',
          }}
        >
          {cfg.particles[0]}
        </span>
      </span>
      <span>{cfg.label}</span>
    </div>
  )
}
