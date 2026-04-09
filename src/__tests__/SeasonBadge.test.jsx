import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SeasonBadge from '../components/SeasonBadge.jsx'

// Mock getSeason to control the output
vi.mock('../utils/watering.js', () => ({
  getSeason: vi.fn((lat) => {
    if (lat == null) return null
    return 'spring'
  }),
}))

describe('SeasonBadge', () => {
  it('renders nothing when lat is null', () => {
    const { container } = render(<SeasonBadge lat={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders season label when lat is provided', () => {
    render(<SeasonBadge lat={40} />)
    expect(screen.getByText('Spring')).toBeInTheDocument()
  })

  it('renders with animation container', () => {
    const { container } = render(<SeasonBadge lat={40} />)
    expect(container.querySelector('.season-badge')).toBeTruthy()
  })
})
