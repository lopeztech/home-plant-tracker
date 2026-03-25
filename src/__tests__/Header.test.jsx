import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Header from '../components/Header.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
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
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.getByText('Plant Tracker')).toBeInTheDocument()
  })

  it('does not show upload button or user info when not authenticated', () => {
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.queryByText(/upload floorplan/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows upload button, user name and sign out when authenticated', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.getByText(/upload floorplan/i)).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByTitle('Sign out')).toBeInTheDocument()
  })

  it('renders the user profile picture', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    const img = screen.getByAltText('Jane Smith')
    expect(img).toHaveAttribute('src', mockUser.picture)
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls logout when the sign out button is clicked', () => {
    const logout = vi.fn()
    useAuth.mockReturnValue({ user: mockUser, logout })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    fireEvent.click(screen.getByTitle('Sign out'))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('calls onFloorplanUpload with the selected file', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onUpload = vi.fn()
    render(<Header onFloorplanUpload={onUpload} isAnalysingFloorplan={false} />)
    const input = document.querySelector('input[type="file"]')
    const file = new File(['data'], 'floor.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onUpload).toHaveBeenCalledWith(file)
  })

  it('does not call onFloorplanUpload when no file is selected', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onUpload = vi.fn()
    render(<Header onFloorplanUpload={onUpload} isAnalysingFloorplan={false} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [] } })
    expect(onUpload).not.toHaveBeenCalled()
  })

  // ── Loading / error states ────────────────────────────────────────────────

  it('disables the upload button while analysing', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={true} />)
    // The upload button contains the icon + span; find by its disabled state
    const buttons = screen.getAllByRole('button')
    const uploadBtn = buttons.find(b => b.disabled)
    expect(uploadBtn).toBeDefined()
    expect(uploadBtn).toBeDisabled()
  })

  it('shows "Analysing…" text while analysing', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={true} />)
    expect(screen.getByText('Analysing…')).toBeInTheDocument()
  })

  it('renders without crashing when optional props are omitted', () => {
    // isAnalysingFloorplan and onFloorplanUpload are not passed — should not throw
    expect(() => render(<Header />)).not.toThrow()
  })
})
