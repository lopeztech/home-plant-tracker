import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlantMarker from '../components/PlantMarker.jsx'

// A plant that is healthy (due in 10 days)
const healthyPlant = {
  id: 'p1',
  name: 'Fern',
  species: 'Nephrolepis',
  x: 40,
  y: 60,
  lastWatered: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 day ago
  frequencyDays: 11, // next watering in 10 days
}

// A plant that is overdue (watered 10 days ago, due every 7)
const overduePlant = {
  id: 'p2',
  name: 'Cactus',
  species: 'Opuntia',
  x: 20,
  y: 30,
  lastWatered: new Date(Date.now() - 10 * 86400000).toISOString(),
  frequencyDays: 7,
}

function renderMarker(plant, extra = {}) {
  const containerRef = { current: document.createElement('div') }
  return render(
    <PlantMarker
      plant={plant}
      onClick={extra.onClick ?? vi.fn()}
      onDragEnd={extra.onDragEnd ?? vi.fn()}
      containerRef={containerRef}
    />
  )
}

describe('PlantMarker', () => {
  // ── Initial render state ──────────────────────────────────────────────────

  it('renders the plant initial inside the marker', () => {
    renderMarker(healthyPlant)
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('positions the marker using percentage-based left/top styles', () => {
    const { container } = renderMarker(healthyPlant)
    const marker = container.querySelector('.plant-marker')
    expect(marker).toHaveStyle({ left: '40%', top: '60%' })
  })

  it('adds the overdue class when the plant is overdue', () => {
    const { container } = renderMarker(overduePlant)
    expect(container.querySelector('.plant-marker-overdue')).toBeInTheDocument()
  })

  it('does not add the overdue class when the plant is healthy', () => {
    const { container } = renderMarker(healthyPlant)
    expect(container.querySelector('.plant-marker-overdue')).not.toBeInTheDocument()
  })

  it('shows "?" as the initial when the plant has no name', () => {
    renderMarker({ ...healthyPlant, name: '' })
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onClick with the plant when the marker is clicked', () => {
    const onClick = vi.fn()
    const { container } = renderMarker(healthyPlant, { onClick })
    fireEvent.click(container.querySelector('.plant-marker'))
    expect(onClick).toHaveBeenCalledWith(healthyPlant)
  })

  it('shows a tooltip with plant name on mouse enter', () => {
    const { container } = renderMarker(healthyPlant)
    fireEvent.mouseEnter(container.querySelector('.plant-marker'))
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('Nephrolepis')).toBeInTheDocument()
  })

  it('hides the tooltip on mouse leave', () => {
    const { container } = renderMarker(healthyPlant)
    const marker = container.querySelector('.plant-marker')
    fireEvent.mouseEnter(marker)
    expect(screen.getByText('Fern')).toBeInTheDocument()
    fireEvent.mouseLeave(marker)
    // After mouse leave the tooltip div is removed from the DOM
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
  })

  it('does not show tooltip text when marker is not hovered (initial state)', () => {
    renderMarker(healthyPlant)
    // Only the initial letter should be visible, not the full name in a tooltip
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when optional onDragEnd is omitted', () => {
    const containerRef = { current: document.createElement('div') }
    expect(() =>
      render(<PlantMarker plant={healthyPlant} onClick={vi.fn()} containerRef={containerRef} />)
    ).not.toThrow()
  })

  it('renders without crashing when containerRef is null', () => {
    expect(() =>
      render(<PlantMarker plant={healthyPlant} onClick={vi.fn()} onDragEnd={vi.fn()} containerRef={{ current: null }} />)
    ).not.toThrow()
  })
})
