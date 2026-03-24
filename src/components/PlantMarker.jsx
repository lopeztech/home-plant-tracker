import React, { useState } from 'react'

function getDaysUntilWatering(plant) {
  if (!plant.lastWatered) return 0
  const lastWatered = new Date(plant.lastWatered)
  const nextWatering = new Date(lastWatered.getTime() + plant.frequencyDays * 86400000)
  const today = new Date()
  return Math.ceil((nextWatering - today) / 86400000)
}

function getUrgencyColor(days) {
  if (days < 0) return '#ef4444'   // red - overdue
  if (days === 0) return '#f97316' // orange - today
  if (days <= 2) return '#eab308'  // yellow - soon
  return '#22c55e'                 // green - all good
}

function getUrgencyLabel(days) {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days}d remaining`
}

export default function PlantMarker({ plant, onClick }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const days = getDaysUntilWatering(plant)
  const color = getUrgencyColor(days)
  const label = getUrgencyLabel(days)
  const isOverdue = days < 0

  const initial = plant.name ? plant.name.charAt(0).toUpperCase() : '?'

  return (
    <div
      className="plant-marker"
      style={{ left: `${plant.x}%`, top: `${plant.y}%` }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(plant)
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={isOverdue ? 'plant-marker-overdue' : ''}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: color,
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: `0 2px 8px ${color}80, 0 0 0 3px ${color}30`,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {initial}
      </div>

      {showTooltip && (
        <div className="tooltip">
          <div className="font-semibold">{plant.name}</div>
          {plant.species && (
            <div className="text-gray-400 text-xs">{plant.species}</div>
          )}
          <div className="text-xs mt-0.5" style={{ color }}>
            {label}
          </div>
        </div>
      )}
    </div>
  )
}
