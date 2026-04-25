import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi } from 'vitest'

const startTour = vi.fn()
const openWhatsNew = vi.fn()

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { name: 'Tester', email: 't@t.t' }, logout: vi.fn() }),
}))
vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: () => ({ navMinified: false, toggleSetting: vi.fn() }),
}))
vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({ weather: null, location: null, plants: [], floors: [] }),
}))
vi.mock('../context/HelpContext.jsx', () => ({
  useHelp: () => ({ open: vi.fn() }),
}))
vi.mock('../context/SubscriptionContext.jsx', () => ({
  useSubscription: () => ({ canAccess: () => true, billingEnabled: false }),
}))
vi.mock('../context/TourContext.jsx', () => ({
  useTour: () => ({ startTour, openWhatsNew }),
  TOURS: [
    { id: 'setup',     label: 'First-time setup' },
    { id: 'floorplan', label: 'Using the floorplan' },
  ],
}))

import Sidebar from '../layouts/components/Sidebar.jsx'

describe('Sidebar tour menu', () => {
  it('expands the tour submenu and starts the chosen tour', () => {
    const { container } = render(
      <MemoryRouter><Sidebar /></MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /Take a tour/i })
    fireEvent.click(toggle)

    // The submenu must carry `.active` so Smart Admin's nav stylesheet
    // (which sets `display: none` on bare nested ULs in `.primary-nav`)
    // actually shows it. Without the class users see nothing.
    const submenu = container.querySelector('ul.list-unstyled.ps-4')
    expect(submenu).not.toBeNull()
    expect(submenu.classList.contains('active')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /First-time setup/i }))
    expect(startTour).toHaveBeenCalledWith('setup')
  })

  it('opens the What\'s new modal from its sidebar entry', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /What's new/i }))
    expect(openWhatsNew).toHaveBeenCalled()
  })
})
