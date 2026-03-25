import React, { useCallback } from 'react'
import { Plus } from 'lucide-react'

export default function FloorNav({ floors, activeFloorId, onChange, onAddFloor }) {
  // Sort: highest order at top, lowest at bottom (physical building order)
  const sorted = [...floors].sort((a, b) => b.order - a.order)

  const handleAdd = useCallback(() => {
    const name = prompt('Floor name (e.g. Second Floor):')
    if (name?.trim()) onAddFloor(name.trim())
  }, [onAddFloor])

  return (
    <div className="floor-nav">
      <button
        onClick={handleAdd}
        className="floor-nav-add"
        title="Add floor"
      >
        <Plus size={12} />
      </button>

      <div className="floor-nav-list">
        {sorted.map((floor, i) => {
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
