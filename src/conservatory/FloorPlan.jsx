import React from 'react'
import { C } from './tokens.js'

const ROOM_COLORS = {
  kitchen: '#EFE7D0', bath: '#E5EFE6', bathroom: '#E5EFE6',
  bedroom: '#F2E7D8', living: '#EFDDC8', 'living room': '#EFDDC8',
  study: '#ECE4CD', office: '#ECE4CD',
}

function roomFill(room) {
  const key = (room.name || '').toLowerCase()
  return ROOM_COLORS[key] || ROOM_COLORS[room.id] || '#F2EBDB'
}

export function FloorPlan({
  width = 300, height = 188,
  bg = C.panel,
  wall = C.soil,
  wallW = 1.3,
  rooms = [],
  plants = [],
  activeId,
  renderMarker,
  showLabels = false,
}) {
  return (
    <div style={{ position: 'relative', width, height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        width={width} height={height}
        style={{ position: 'absolute', inset: 0, display: 'block' }}>
        {rooms.map((r) => (
          <rect key={r.id}
            x={r.x} y={r.y}
            width={r.width ?? r.w}
            height={r.height ?? r.h}
            rx={3}
            fill={roomFill(r)}
            stroke={wall}
            strokeWidth={wallW}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {showLabels && rooms.map((r) => (
        <div key={r.id} style={{
          position: 'absolute',
          left: `${r.x}%`, top: `${r.y}%`,
          width: `${r.width ?? r.w}%`,
          paddingTop: 7, textAlign: 'center', pointerEvents: 'none',
          fontFamily: C.sans, color: wall, fontSize: 9, letterSpacing: 0.4,
        }}>
          {r.name}
        </div>
      ))}
      {plants.map((p) => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x ?? 50}%`,
          top: `${p.y ?? 50}%`,
          transform: 'translate(-50%,-50%)',
          zIndex: p.id === activeId ? 5 : 2,
        }}>
          {renderMarker ? renderMarker(p, p.id === activeId) : null}
        </div>
      ))}
    </div>
  )
}
