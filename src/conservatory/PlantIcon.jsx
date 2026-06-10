import React from 'react'

const PAL = {
  fern: '#4A6B4F', leaf: '#3E5641', sage: '#8BA888', sageLt: '#A9C0A2', olive: '#6E7F4E',
  clay: '#C26B4A', clayLt: '#D58A63', clayDk: '#A8542F', rust: '#B2543A',
  soil: '#6B4E3D', ochre: '#D9A441', cream: '#F5EFE3', paper: '#FBF7EE', sand: '#EBE2D0', ink: '#2C2A24',
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt)
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

export function PlantIcon({ type = 'monstera', size = 64, tint, pot, style }) {
  const L = tint || PAL.leaf
  const Ld = shade(L, -0.16)
  const Ll = shade(L, 0.18)
  const P = pot || PAL.clay
  const Pd = shade(P, -0.14)
  const Pr = shade(P, 0.08)

  const Pot = (
    <g>
      <ellipse cx="32" cy="60" rx="15" ry="3.4" fill={PAL.soil} />
      <path d="M18.5 60.5 L23 80 H41 L45.5 60.5 Z" fill={P} />
      <path d="M32 60.5 L41 80 H41 L45.5 60.5 Z" fill={Pd} opacity="0.55" />
      <rect x="15.5" y="55.5" width="33" height="6.6" rx="2.4" fill={Pr} />
      <rect x="15.5" y="55.5" width="33" height="2.4" rx="1.2" fill="#fff" opacity="0.18" />
    </g>
  )

  const foliage = {
    monstera: (
      <g>
        <path d="M32 56 C20 50 14 38 18 26 C28 28 35 36 35 50 Z" fill={Ld} />
        <path d="M32 56 C44 48 50 36 46 24 C36 27 30 35 31 50 Z" fill={L} />
        <path d="M32 57 C32 44 33 32 34 22 C36 30 36 44 35 56 Z" fill={Ll} />
        <path d="M24 34 l5 2 M22 41 l6 2 M40 32 l-5 2 M42 39 l-6 2" stroke={PAL.cream} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
    snake: (
      <g fill={L}>
        <path d="M28 56 C25 40 24 24 27 12 C30 24 30 42 30 56 Z" fill={Ld} />
        <path d="M32 56 C31 36 31 18 33 8 C35 20 35 40 35 56 Z" />
        <path d="M37 56 C38 42 40 28 43 18 C42 32 41 46 40 56 Z" fill={Ll} />
        <path d="M27 12 C30 24 30 42 30 56 M33 8 C35 20 35 40 35 56" stroke={PAL.ochre} strokeWidth="0.9" opacity="0.5" fill="none" />
      </g>
    ),
    pothos: (
      <g>
        <path d="M32 56 C30 46 30 38 32 32" stroke={Ld} strokeWidth="2" fill="none" />
        <path d="M32 33 C26 30 22 33 23 39 C29 41 33 38 32 33 Z" fill={L} />
        <path d="M33 38 C40 34 45 37 44 44 C37 46 32 43 33 38 Z" fill={Ld} />
        <path d="M30 44 C24 42 20 46 22 52 C28 53 32 49 30 44 Z" fill={Ll} />
        <path d="M35 47 C42 45 47 49 45 55 C39 56 34 52 35 47 Z" fill={L} />
        <path d="M31 30 C28 24 31 19 36 19 C38 25 35 30 31 30 Z" fill={Ll} />
      </g>
    ),
    fiddle: (
      <g>
        <path d="M32 56 L32 26" stroke={Ld} strokeWidth="2.2" fill="none" />
        <ellipse cx="24" cy="30" rx="8" ry="11" fill={Ld} transform="rotate(-18 24 30)" />
        <ellipse cx="40" cy="28" rx="8.5" ry="12" fill={L} transform="rotate(16 40 28)" />
        <ellipse cx="32" cy="18" rx="8" ry="11.5" fill={Ll} />
        <path d="M32 18 v9 M24 30 l3 3 M40 28 l-3 3" stroke={PAL.cream} strokeWidth="1.2" opacity="0.5" fill="none" />
      </g>
    ),
    succulent: (
      <g>
        <path d="M32 54 l-10 2 8 -10 Z" fill={Ld} />
        <path d="M32 54 l10 2 -8 -10 Z" fill={L} />
        <path d="M32 54 l-7 -12 7 -3 Z" fill={Ll} />
        <path d="M32 54 l7 -12 -7 -3 Z" fill={L} />
        <path d="M32 54 l0 -16 -5 4 Z" fill={Ld} />
        <path d="M32 54 l0 -16 5 4 Z" fill={Ll} />
        <circle cx="32" cy="48" r="2.4" fill={PAL.ochre} />
      </g>
    ),
    fern: (
      <g stroke={L} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M32 56 C28 42 24 30 18 22" />
        <path d="M32 56 C32 40 32 26 32 14" stroke={Ld} />
        <path d="M32 56 C36 42 40 30 46 22" stroke={Ll} />
        <g stroke={Ld} strokeWidth="1.4">
          <path d="M27 40 l-5 -2 M25 33 l-5 -3 M30 30 l-4 -4" />
        </g>
        <g stroke={Ll} strokeWidth="1.4">
          <path d="M37 40 l5 -2 M39 33 l5 -3 M34 30 l4 -4" />
        </g>
      </g>
    ),
    cactus: (
      <g fill={L}>
        <rect x="28" y="26" width="8" height="32" rx="4" fill={Ld} />
        <path d="M28 40 q-7 0 -7 -7 v-4 q0 -3 3 -3 t3 3 v6 q0 2 1 2 Z" fill={L} />
        <path d="M36 36 q7 0 7 -7 v-2 q0 -3 -3 -3 t-3 3 v4 q0 2 -1 2 Z" fill={Ll} />
        <g stroke={PAL.ochre} strokeWidth="0.9" fill="none">
          <path d="M32 30 v-2 M30 38 v-1.5 M34 46 v-1.5" />
        </g>
        <circle cx="32" cy="24" r="2.4" fill={PAL.rust} />
      </g>
    ),
    palm: (
      <g fill={L}>
        <path d="M32 56 C30 44 30 32 32 22" stroke={Ld} strokeWidth="2" fill="none" />
        <path d="M32 24 C22 18 14 20 10 26 C20 28 28 28 32 24 Z" fill={Ld} />
        <path d="M32 24 C42 18 50 20 54 26 C44 28 36 28 32 24 Z" fill={Ll} />
        <path d="M32 23 C26 14 26 8 28 4 C32 10 33 17 32 23 Z" fill={L} />
        <path d="M32 23 C38 14 40 9 42 6 C40 13 36 19 32 23 Z" fill={Ld} />
      </g>
    ),
    lily: (
      <g>
        <path d="M28 56 C24 44 22 32 26 24 C30 32 31 44 30 56 Z" fill={Ld} />
        <path d="M36 56 C40 44 42 32 38 24 C34 32 33 44 34 56 Z" fill={Ll} />
        <path d="M32 56 C32 42 32 30 32 22" stroke={L} strokeWidth="2.4" fill="none" />
        <path d="M40 26 C46 22 47 14 42 12 C37 16 37 23 40 26 Z" fill={PAL.paper} />
        <path d="M41 24 l1.5 -8" stroke={PAL.ochre} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>
    ),
    herb: (
      <g fill={L}>
        <circle cx="26" cy="42" r="7" fill={Ld} />
        <circle cx="38" cy="40" r="7.5" fill={Ll} />
        <circle cx="32" cy="34" r="8" fill={L} />
        <circle cx="30" cy="46" r="6" fill={Ld} />
        <circle cx="32" cy="33" r="1.6" fill={PAL.ochre} opacity="0.7" />
      </g>
    ),
  }

  return (
    <svg viewBox="0 0 64 84" width={size} height={size * 84 / 64} style={style} role="img" aria-label={type + ' plant'}>
      {foliage[type] || foliage.monstera}
      {Pot}
    </svg>
  )
}
