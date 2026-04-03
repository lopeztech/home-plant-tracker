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

  it('renders the app title', () => {
    render(<Header />)
    expect(screen.getByText('Plant Tracker')).toBeInTheDocument()
  })

  it('does not show buttons when not authenticated', () => {
    render(<Header />)
    expect(screen.queryByRole('button', { name: /analytics/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument()
  })

  it('shows analytics button and profile picture when authenticated', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header />)
    expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument()
    expect(screen.getByAltText('Jane Smith')).toBeInTheDocument()
  })

  it('shows user menu with settings and sign out when profile picture is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onOpenSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('calls onOpenSettings from the user menu', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenSettings = vi.fn()
    render(<Header onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
    fireEvent.click(screen.getByText('Settings'))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('calls logout from the user menu', () => {
    const logout = vi.fn()
    useAuth.mockReturnValue({ user: mockUser, logout })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
    fireEvent.click(screen.getByText('Sign out'))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('closes menu when clicking outside', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onOpenSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
    expect(screen.getByText('Settings')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('calls onOpenAnalytics when analytics button is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenAnalytics = vi.fn()
    render(<Header onOpenAnalytics={onOpenAnalytics} />)
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onOpenAnalytics).toHaveBeenCalledOnce()
  })

  it('renders without crashing when optional props are omitted', () => {
    expect(() => render(<Header />)).not.toThrow()
  })
})
