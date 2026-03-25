import React from 'react'

export default function FloorNav({ floors, activeFloorId, onChange }) {
  // Sort: highest order at top, lowest at bottom (physical building order)
  const sorted = [...floors].sort((a, b) => b.order - a.order)

  return (
    <div className="floor-nav">
      <div className="floor-nav-list">
        {sorted.map((floor) => {
          const isActive = floor.id === activeFloorId
          const isOutdoor = floor.type === 'outdoor'
          return (
            <button
              key={floor.id}
              onClick={() => onChange(floor.id)}
              className={[
                'floor-nav-item',
                isActive ? 'floor-nav-item-active' : '',
                isOutdoor ? 'floor-nav-item-outdoor' : '',
              ].filter(Boolean).join(' ')}
              title={floor.name}
            >
              <span className="floor-nav-label">{floor.name}</span>
              {isActive && <span className="floor-nav-dot" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
