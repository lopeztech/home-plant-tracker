import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  // ── Drag behaviour ────────────────────────────────────────────────────────

  // Helper: dispatch a real PointerEvent (so clientX/clientY/pointerId are properly set)
  function pointerDown(el, opts = {}) {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...opts }))
  }
  function pointerMove(el, opts = {}) {
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, ...opts }))
  }
  function pointerUp(el, opts = {}) {
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...opts }))
  }

  it('calls setPointerCapture on pointer down', () => {
    const { container } = renderMarker(healthyPlant)
    const marker = container.querySelector('.plant-marker')
    pointerDown(marker, { pointerId: 1 })
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('does not call onDragEnd when pointer is released without moving past the threshold', () => {
    const onDragEnd = vi.fn()
    const containerEl = document.createElement('div')
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    })
    const { container } = render(
      <PlantMarker
        plant={healthyPlant}
        onClick={vi.fn()}
        onDragEnd={onDragEnd}
        containerRef={{ current: containerEl }}
      />
    )
    const marker = container.querySelector('.plant-marker')
    pointerDown(marker, { clientX: 100, clientY: 100 })
    pointerMove(marker, { clientX: 103, clientY: 100 }) // 3px < 5px threshold
    pointerUp(marker)
    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('calls onDragEnd with plant and clamped position after a drag', async () => {
    const onDragEnd = vi.fn()
    const containerEl = document.createElement('div')
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    })
    const { container } = render(
      <PlantMarker
        plant={healthyPlant}
        onClick={vi.fn()}
        onDragEnd={onDragEnd}
        containerRef={{ current: containerEl }}
      />
    )
    const marker = container.querySelector('.plant-marker')
    act(() => pointerDown(marker, { clientX: 0, clientY: 0 }))
    // Flush state so dragPos is set before pointerUp handler reads it
    await act(async () => pointerMove(marker, { clientX: 50, clientY: 50 }))
    act(() => pointerUp(marker))
    expect(onDragEnd).toHaveBeenCalledWith(healthyPlant, 5, 5)
  })

  it('clamps drag position to the 2–98% range', async () => {
    const onDragEnd = vi.fn()
    const containerEl = document.createElement('div')
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    })
    const { container } = render(
      <PlantMarker
        plant={healthyPlant}
        onClick={vi.fn()}
        onDragEnd={onDragEnd}
        containerRef={{ current: containerEl }}
      />
    )
    const marker = container.querySelector('.plant-marker')
    act(() => pointerDown(marker, { clientX: 500, clientY: 500 }))
    await act(async () => pointerMove(marker, { clientX: -100, clientY: -100 }))
    act(() => pointerUp(marker))
    expect(onDragEnd).toHaveBeenCalledWith(healthyPlant, 2, 2)
  })

  it('does not fire onClick after a completed drag', () => {
    const onClick = vi.fn()
    const containerEl = document.createElement('div')
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    })
    const { container } = render(
      <PlantMarker
        plant={healthyPlant}
        onClick={onClick}
        onDragEnd={vi.fn()}
        containerRef={{ current: containerEl }}
      />
    )
    const marker = container.querySelector('.plant-marker')
    pointerDown(marker, { clientX: 0, clientY: 0 })
    pointerMove(marker, { clientX: 50, clientY: 50 })
    pointerUp(marker)
    fireEvent.click(marker) // synthetic click that follows pointerup
    expect(onClick).not.toHaveBeenCalled()
  })
})
