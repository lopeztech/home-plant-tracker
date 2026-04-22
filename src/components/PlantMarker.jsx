import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Move } from 'lucide-react'
import { getMoistureDisplay } from '../utils/watering.js'

const DRAG_THRESHOLD = 5 // px — minimum movement before treating as a drag
const LONG_PRESS_MS = 400 // ms before showing drag hint on touch

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

export default function PlantMarker({ plant, onClick, onDragEnd, containerRef }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPos, setDragPos] = useState(null)
  const [showDragHint, setShowDragHint] = useState(false)

  // Mutable ref so handlers don't need to declare isDragging as a dependency
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0 })
  const longPressTimer = useRef(null)

  const [imgError, setImgError] = useState(false)

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(longPressTimer.current), [])

  const days = getDaysUntilWatering(plant)
  const color = getUrgencyColor(days)
  const label = getUrgencyLabel(days)
  const isOverdue = days < 0
  const initial = plant.name ? plant.name.charAt(0).toUpperCase() : '?'
  const showPhoto = plant.imageUrl && !imgError

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    // Capture the pointer so pointermove/up fire here even when cursor leaves the element
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY }
    setShowTooltip(false)

    // On touch, show drag hint after a long press
    if (e.pointerType === 'touch') {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = setTimeout(() => setShowDragHint(true), LONG_PRESS_MS)
    }
  }, [])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return

    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY

    // Ignore small jitter below the threshold
    if (!dragRef.current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

    dragRef.current.moved = true
    setIsDragging(true)
    setShowDragHint(false)
    clearTimeout(longPressTimer.current)

    if (!containerRef?.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100))
    setDragPos({ x, y })
  }, [containerRef])

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current)
    setShowDragHint(false)
    if (!dragRef.current.active) return
    const { moved } = dragRef.current
    dragRef.current.active = false
    setIsDragging(false)

    if (moved && dragPos) {
      onDragEnd?.(plant, dragPos.x, dragPos.y)
      setDragPos(null)
    }
  }, [dragPos, plant, onDragEnd])

  const handleClick = useCallback((e) => {
    // Suppress the synthetic click that fires after a drag ends
    if (dragRef.current.moved) return
    e.stopPropagation()
    onClick(plant)
  }, [onClick, plant])

  const displayX = isDragging && dragPos ? dragPos.x : plant.x
  const displayY = isDragging && dragPos ? dragPos.y : plant.y

  // Smart tooltip positioning: flip when near edges
  const nearTop = displayY < 20
  const nearRight = displayX > 80
  const tooltipClass = [
    'tooltip',
    nearTop ? 'tooltip-below' : '',
    nearRight ? 'tooltip-left' : '',
  ].filter(Boolean).join(' ')

  return (
    <motion.div
      role="button"
      aria-label={`${plant.name}${plant.species ? ` (${plant.species})` : ''} — ${label}`}
      tabIndex={0}
      className={[
        'plant-marker',
        isOverdue ? 'plant-marker-overdue' : '',
        isDragging ? 'plant-marker-dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: `${displayX}%`, top: `${displayY}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(plant) } }}
      onMouseEnter={() => { if (!isDragging) setShowTooltip(true) }}
      onMouseLeave={() => setShowTooltip(false)}
      animate={isOverdue ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={isOverdue
        ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.2 }
      }
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: showPhoto ? 'transparent' : color,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: `0 2px 8px ${color}80, 0 0 0 3px ${color}30`,
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {showPhoto ? (
          <img
            src={plant.imageUrl}
            alt={plant.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
          />
        ) : initial}
      </div>

      {/* Move icon overlay shown during drag */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#1f2937',
            border: '1.5px solid #6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Move size={9} className="text-gray-300" />
        </div>
      )}

      {/* Drag hint tooltip (touch long-press) */}
      {showDragHint && !isDragging && (
        <div className={tooltipClass}>
          <div className="text-xs text-gray-300">Drag to reposition</div>
        </div>
      )}

      {showTooltip && !isDragging && !showDragHint && (
        <div className={tooltipClass}>
          <div className="font-semibold">{plant.name}</div>
          {plant.species && (
            <div className="text-gray-400 text-xs">{plant.species}</div>
          )}
          <div className="text-xs mt-0.5" style={{ color }}>
            {label}
          </div>
          {plant.lastMoistureReading && plant.lastMoistureDate &&
            (Date.now() - new Date(plant.lastMoistureDate).getTime()) < 72 * 3600000 && (() => {
              const m = getMoistureDisplay(plant.lastMoistureReading)
              return (
                <div className="text-xs mt-0.5 d-flex align-items-center gap-1">
                  <span className="rounded-circle d-inline-block" style={{ width: 6, height: 6, background: m.color }} />
                  <span style={{ color: m.color }}>{m.label} ({plant.lastMoistureReading}/10)</span>
                </div>
              )
            })()}
        </div>
      )}
    </motion.div>
  )
}
