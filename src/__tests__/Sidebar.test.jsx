import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi, afterEach } from 'vitest'

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
vi.mock('../context/PropertyContext.jsx', () => ({
  useProperty: () => ({ properties: [], activePropertyId: 'primary', switchTo: vi.fn() }),
}))
let profileAccountType = 'household'
let profileFeatureOverrides = {}
vi.mock('../context/ProfileContext.jsx', () => ({
  useProfile: () => ({ accountType: profileAccountType, featureOverrides: profileFeatureOverrides }),
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

describe('Sidebar persona filter', () => {
  it('hides the Pro section for household persona', () => {
    profileAccountType = 'household'
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Today/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Visits$/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Properties$/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Branding$/i })).toBeNull()
  })

  it('shows the Pro section for landscaper persona', () => {
    profileAccountType = 'landscaper'
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /^Visits$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Properties$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Branding$/i })).toBeInTheDocument()
  })

  it('shows the Pro section for both persona', () => {
    profileAccountType = 'both'
    profileFeatureOverrides = {}
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /^Visits$/i })).toBeInTheDocument()
    // Universal items still visible
    expect(screen.getByRole('link', { name: /Today/i })).toBeInTheDocument()
  })
})

describe('Sidebar feature-flag overrides', () => {
  it("admin override 'hidden' removes a normally-visible item", () => {
    profileAccountType = 'household'
    profileFeatureOverrides = { propagation: 'hidden' }
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: /Propagation/i })).toBeNull()
    // Other universal items unaffected
    expect(screen.getByRole('link', { name: /Today/i })).toBeInTheDocument()
  })

  it("admin override 'both' shows a normally-landscaper-only item to households", () => {
    profileAccountType = 'household'
    // The Pro section itself is landscaper-only; force it open and force a child visible.
    profileFeatureOverrides = { pro: 'both', branding: 'both' }
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /^Branding$/i })).toBeInTheDocument()
  })

  afterEach(() => {
    profileFeatureOverrides = {}
  })
})
