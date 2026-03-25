import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloorNav from '../components/FloorNav.jsx'

const floors = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior' },
  { id: 'first',  name: 'First Floor',  order: 1, type: 'interior' },
  { id: 'garden', name: 'Garden',       order: -1, type: 'outdoor' },
]

describe('FloorNav', () => {
  // ── Initial render state ──────────────────────────────────────────────────

  it('renders a button for every floor', () => {
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={vi.fn()} />)
    expect(screen.getByText('Ground Floor')).toBeInTheDocument()
    expect(screen.getByText('First Floor')).toBeInTheDocument()
    expect(screen.getByText('Garden')).toBeInTheDocument()
  })

  it('marks the active floor button with the active class', () => {
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={vi.fn()} />)
    const groundBtn = screen.getByTitle('Ground Floor')
    expect(groundBtn).toHaveClass('floor-nav-item-active')
  })

  it('does not mark inactive floors as active', () => {
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={vi.fn()} />)
    expect(screen.getByTitle('First Floor')).not.toHaveClass('floor-nav-item-active')
    expect(screen.getByTitle('Garden')).not.toHaveClass('floor-nav-item-active')
  })

  it('applies the outdoor class to outdoor-type floors', () => {
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={vi.fn()} />)
    expect(screen.getByTitle('Garden')).toHaveClass('floor-nav-item-outdoor')
  })

  it('sorts floors so higher-order floors appear first', () => {
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    const names = buttons.map(b => b.title)
    // First Floor (order 1) > Ground Floor (order 0) > Garden (order -1)
    expect(names).toEqual(['First Floor', 'Ground Floor', 'Garden'])
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onChange with the floor id when a floor button is clicked', () => {
    const onChange = vi.fn()
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={onChange} />)
    fireEvent.click(screen.getByTitle('First Floor'))
    expect(onChange).toHaveBeenCalledWith('first')
  })

  it('calls onChange when the active floor is clicked again', () => {
    const onChange = vi.fn()
    render(<FloorNav floors={floors} activeFloorId="ground" onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Ground Floor'))
    expect(onChange).toHaveBeenCalledWith('ground')
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when given an empty floors array', () => {
    expect(() =>
      render(<FloorNav floors={[]} activeFloorId="ground" onChange={vi.fn()} />)
    ).not.toThrow()
  })

  it('renders without crashing when activeFloorId does not match any floor', () => {
    expect(() =>
      render(<FloorNav floors={floors} activeFloorId="nonexistent" onChange={vi.fn()} />)
    ).not.toThrow()
    // No floor should be marked active
    floors.forEach(f => {
      expect(screen.getByTitle(f.name)).not.toHaveClass('floor-nav-item-active')
    })
  })
})
