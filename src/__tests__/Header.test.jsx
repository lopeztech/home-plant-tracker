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
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.getByText('Plant Tracker')).toBeInTheDocument()
  })

  it('does not show buttons when not authenticated', () => {
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.queryByRole('button', { name: /upload floorplan/i })).not.toBeInTheDocument()
  })

  it('shows upload, calendar, and settings buttons when authenticated', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    expect(screen.getByRole('button', { name: /upload floorplan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /care schedule/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders the user profile picture', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} />)
    const img = screen.getByAltText('Jane Smith')
    expect(img).toHaveAttribute('src', mockUser.picture)
  })

  // ── User interactions ─────────────────────────────────────────────────────

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

  it('calls onOpenSettings when settings button is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenSettings = vi.fn()
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('calls onOpenCalendar when calendar button is clicked', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    const onOpenCalendar = vi.fn()
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={false} onOpenCalendar={onOpenCalendar} />)
    fireEvent.click(screen.getByRole('button', { name: /care schedule/i }))
    expect(onOpenCalendar).toHaveBeenCalledOnce()
  })

  // ── Loading / error states ────────────────────────────────────────────────

  it('disables the upload button while analysing', () => {
    useAuth.mockReturnValue({ user: mockUser, logout: vi.fn() })
    render(<Header onFloorplanUpload={vi.fn()} isAnalysingFloorplan={true} />)
    expect(screen.getByRole('button', { name: /upload floorplan/i })).toBeDisabled()
  })

  it('renders without crashing when optional props are omitted', () => {
    expect(() => render(<Header />)).not.toThrow()
  })
})
