import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { describe, it, expect, vi } from 'vitest'

const changeThemeMock = vi.fn()

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    floors: [{ id: 'ground', name: 'Ground Floor', type: 'indoor', order: 0, rooms: [] }],
    handleSaveFloors: vi.fn().mockResolvedValue(undefined),
    handleFloorplanUpload: vi.fn(),
    isAnalysingFloorplan: false,
    isGuest: false,
    tempUnit: { unit: 'celsius', toggle: vi.fn() },
    location: null,
    setLocation: vi.fn(),
  }),
}))

vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: () => ({ theme: 'light', themeMode: 'light', changeTheme: changeThemeMock, changeThemeMode: changeThemeMock }),
}))

vi.mock('../context/HelpContext.jsx', () => ({
  useHelp: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false, articleId: null }),
}))

// LeafletFloorplan touches canvas APIs not available in jsdom
vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: () => <div data-testid="leaflet-floorplan" />,
}))

import SettingsPage from '../pages/SettingsPage.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/:tab" element={<SettingsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SettingsPage tabs', () => {
  it('shows the Property tab content at /settings/property', () => {
    renderAt('/settings/property')
    expect(screen.getByText(/Floors & Zones/i)).toBeInTheDocument()
  })

  it('shows the Preferences tab content at /settings/preferences', () => {
    renderAt('/settings/preferences')
    expect(screen.getByText(/Appearance/i)).toBeInTheDocument()
    expect(screen.getByText(/Location/i)).toBeInTheDocument()
  })

  it('shows the Data tab content at /settings/data', () => {
    renderAt('/settings/data')
    expect(screen.getByText(/Data export/i)).toBeInTheDocument()
  })

  it('shows the Advanced tab content at /settings/advanced', () => {
    renderAt('/settings/advanced')
    expect(screen.getByText(/About/i)).toBeInTheDocument()
    // Version string from mocked constant
    expect(screen.getByText(/0\.0\.0-test/i)).toBeInTheDocument()
  })

  it('renders navigation tabs for Property and Preferences', () => {
    const { container } = renderAt('/settings/property')
    // Nav.Link as={Link} renders as <a> elements in the nav
    const navLinks = container.querySelectorAll('.nav-link')
    const labels = Array.from(navLinks).map((el) => el.textContent.trim().toLowerCase())
    expect(labels.some((l) => l.includes('property'))).toBe(true)
    expect(labels.some((l) => l.includes('preferences'))).toBe(true)
  })

  it('marks the active tab with aria-current="page"', () => {
    const { container } = renderAt('/settings/preferences')
    const activeLinks = container.querySelectorAll('.nav-link[aria-current="page"]')
    expect(activeLinks.length).toBe(1)
    expect(activeLinks[0].textContent.toLowerCase()).toContain('preferences')
  })

  it('hides sections that do not match the search term', () => {
    renderAt('/settings/property')
    const search = screen.getByRole('textbox', { name: /search settings/i })
    fireEvent.change(search, { target: { value: 'floorplan' } })
    // "Floors & Zones" section title should be hidden — "Floorplan" section title visible
    expect(screen.queryByRole('heading', { name: /Floors & Zones/i })).toBeNull()
    // At minimum the Floorplan section title should be present
    expect(screen.getAllByText(/Floorplan/i).length).toBeGreaterThan(0)
  })

  it('shows all sections again when search is cleared', () => {
    renderAt('/settings/property')
    const search = screen.getByRole('textbox', { name: /search settings/i })
    fireEvent.change(search, { target: { value: 'xyz_no_match' } })
    expect(screen.queryByText(/Floors & Zones/i)).toBeNull()
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText(/Floors & Zones/i)).toBeInTheDocument()
  })
})
