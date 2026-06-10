import React from 'react'

export function CIcon({ d, size = 18, color = 'currentColor', w = 1.7, fill = 'none', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">{d}</svg>
  )
}

export const IC = {
  garden: <><path d="M3 21h18" /><path d="M12 21V11" /><path d="M12 11c-3 0-6-2-6-5 4 0 6 2 6 5Z" /><path d="M12 9c0-3 2-5 6-5 0 3-3 5-6 5Z" /></>,
  today: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  drop: <path d="M12 3s6.5 7.2 6.5 12a6.5 6.5 0 01-13 0C5.5 10.2 12 3 12 3Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  chevL: <path d="M15 18l-6-6 6-6" />,
  chevR: <path d="M9 18l6-6-6-6" />,
  leaf: <path d="M11 20A7 7 0 014 13c0-5 4-9 16-9 0 9-4 13-9 16Z" />,
  pin: <><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  rain: <><path d="M6 14a4 4 0 010-8 5 5 0 019.6-1.5A3.5 3.5 0 0118 14" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></>,
  chart: <><path d="M3 21h18" /><path d="M6 21v-7M11 21V6M16 21v-10M21 21V9" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h12M20 17h0" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="18" cy="17" r="2" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></>,
  star: <path d="M12 3.2l2.5 5.6 6.1.6-4.6 4 1.4 6L12 16.8 6.6 19.4 8 13.4 3.4 9.4l6.1-.6z" />,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  bloom: <><circle cx="12" cy="12" r="3" /><path d="M12 9c0-3 1-5 0-7-1 2 0 4 0 7zM12 15c0 3-1 5 0 7 1-2 0-4 0-7zM15 12c3 0 5-1 7 0-2 1-4 0-7 0zM9 12c-3 0-5 1-7 0 2-1 4 0 7 0z" /></>,
}
