import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Header from '../components/Header.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../hooks/useTheme.js', () => ({
  useTheme: () => 'dark',
}))

const mockUser = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  picture: 'https://example.com/photo.jpg',
  sub: '1234567890',
}

describe('Header', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: null, logout: vi.fn() })
  })

  // ── Initial render state ──────────────────────────────────────────────────

  it('renders the app title', () => {
    render(<Header />)
    expect(screen.getByText('Plant Tracker')).toBeInTheDocument()
  })

  it('does not show buttons when not authenticated', () => {
    render(<Header />)
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
  })

  it('shows analytics and settings buttons when authenticated', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header />)
    expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders the user profile picture', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header />)
    const img = screen.getByAltText('Jane Smith')
    expect(img).toHaveAttribute('src', mockUser.picture)
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onOpenSettings when settings button is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenSettings = vi.fn()
    render(<Header onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('calls onOpenAnalytics when analytics button is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenAnalytics = vi.fn()
    render(<Header onOpenAnalytics={onOpenAnalytics} />)
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onOpenAnalytics).toHaveBeenCalledOnce()
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('renders without crashing when optional props are omitted', () => {
    expect(() => render(<Header />)).not.toThrow()
  })
})
