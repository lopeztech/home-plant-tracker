import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const changeThemeMock = vi.fn()
const logoutMock = vi.fn()

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

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ logout: logoutMock }),
}))

vi.mock('../context/HelpContext.jsx', () => ({
  useHelp: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false, articleId: null }),
}))

vi.mock('../api/plants.js', () => ({
  accountApi: {
    exportData: vi.fn().mockResolvedValue({ plants: [], floors: [], exportedAt: '2024-01-01', userId: 'u1' }),
    deleteAccount: vi.fn().mockResolvedValue(null),
  },
  exportApi: {
    downloadPlants: vi.fn().mockResolvedValue(undefined),
    downloadWateringHistory: vi.fn().mockResolvedValue(undefined),
    downloadCareSchedule: vi.fn().mockResolvedValue(undefined),
  },
  apiKeysApi: {
    list: vi.fn().mockResolvedValue({ keys: [] }),
    create: vi.fn(),
    revoke: vi.fn(),
  },
}))

// LeafletFloorplan touches canvas APIs not available in jsdom
vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: () => <div data-testid="leaflet-floorplan" />,
}))

import SettingsPage from '../pages/SettingsPage.jsx'
import { accountApi, apiKeysApi } from '../api/plants.js'

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
    expect(screen.getByText(/Delete account/i)).toBeInTheDocument()
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

describe('SettingsPage Data tab', () => {
  beforeEach(() => {
    logoutMock.mockClear()
    accountApi.exportData.mockClear()
    accountApi.deleteAccount.mockClear()
  })

  it('shows export and delete account sections', () => {
    renderAt('/settings/data')
    expect(screen.getByText(/Data export/i)).toBeInTheDocument()
    expect(screen.getByText(/Delete account/i)).toBeInTheDocument()
  })

  it('calls exportData and triggers download on export button click', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    const clickMock = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const el = origCreate('a')
        el.click = clickMock
        return el
      }
      return origCreate(tag)
    })

    renderAt('/settings/data')
    fireEvent.click(screen.getByRole('button', { name: /all data \(json\)/i }))

    await waitFor(() => expect(accountApi.exportData).toHaveBeenCalledTimes(1))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickMock).toHaveBeenCalledTimes(1)

    vi.restoreAllMocks()
  })

  it('shows delete confirmation UI when Delete my account is clicked', () => {
    renderAt('/settings/data')
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    expect(screen.getByPlaceholderText(/Type DELETE to confirm/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete account$/i })).toBeDisabled()
  })

  it('enables the confirm button only when DELETE is typed', () => {
    renderAt('/settings/data')
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    const input = screen.getByPlaceholderText(/Type DELETE to confirm/i)
    fireEvent.change(input, { target: { value: 'delete' } })
    expect(screen.getByRole('button', { name: /^delete account$/i })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(screen.getByRole('button', { name: /^delete account$/i })).not.toBeDisabled()
  })

  it('calls deleteAccount and logout on confirm', async () => {
    renderAt('/settings/data')
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    fireEvent.change(screen.getByPlaceholderText(/Type DELETE to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /^delete account$/i }))

    await waitFor(() => expect(accountApi.deleteAccount).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1))
  })

  it('hides the confirmation and resets state on cancel', () => {
    renderAt('/settings/data')
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }))
    expect(screen.getByPlaceholderText(/Type DELETE to confirm/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/Type DELETE to confirm/i)).toBeNull()
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument()
  })
})

describe('SettingsPage API Keys tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiKeysApi.list.mockResolvedValue({ keys: [] })
  })

  it('shows the API Keys tab in navigation', () => {
    renderAt('/settings/api-keys')
    expect(screen.getByText('API Keys')).toBeInTheDocument()
  })

  it('renders the Public REST API section', async () => {
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByText(/Public REST API/)).toBeInTheDocument())
  })

  it('shows no-keys message when list is empty', async () => {
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('no-keys-message')).toBeInTheDocument())
    expect(screen.getByText(/No API keys yet/)).toBeInTheDocument()
  })

  it('displays existing active keys in table', async () => {
    apiKeysApi.list.mockResolvedValue({
      keys: [
        { id: 'k1', name: 'Home Assistant', key: 'pt_live_hass...', prefix: 'pt_live_hass', createdAt: '2026-04-01T00:00:00Z', lastUsedAt: null, revokedAt: null },
      ],
    })
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('api-keys-table')).toBeInTheDocument())
    expect(screen.getByText('Home Assistant')).toBeInTheDocument()
    expect(screen.getByText('pt_live_hass...')).toBeInTheDocument()
  })

  it('shows create key button and name input', async () => {
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('create-key-btn')).toBeInTheDocument())
    expect(screen.getByTestId('new-key-name-input')).toBeInTheDocument()
  })

  it('create key button is disabled when name input is empty', async () => {
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('create-key-btn')).toBeDisabled())
  })

  it('calls apiKeysApi.create with the entered name', async () => {
    apiKeysApi.create.mockResolvedValue({ id: 'new-k', key: 'pt_live_newkeyxxx', name: 'My App', prefix: 'pt_live_newk', createdAt: '2026-04-23T00:00:00Z' })
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('new-key-name-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('new-key-name-input'), { target: { value: 'My App' } })
    fireEvent.click(screen.getByTestId('create-key-btn'))
    await waitFor(() => expect(apiKeysApi.create).toHaveBeenCalledWith('My App'))
  })

  it('shows the new plaintext key banner after creation', async () => {
    apiKeysApi.create.mockResolvedValue({ id: 'new-k', key: 'pt_live_secret123', name: 'My App', prefix: 'pt_live_secr', createdAt: '2026-04-23T00:00:00Z' })
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('new-key-name-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('new-key-name-input'), { target: { value: 'My App' } })
    fireEvent.click(screen.getByTestId('create-key-btn'))
    await waitFor(() => expect(screen.getByTestId('new-key-banner')).toBeInTheDocument())
    expect(screen.getByTestId('new-key-value')).toHaveTextContent('pt_live_secret123')
  })

  it('shows revoke button for each key and calls apiKeysApi.revoke', async () => {
    apiKeysApi.list.mockResolvedValue({
      keys: [{ id: 'k1', name: 'HA', key: 'pt_live_ha...', prefix: 'pt_live_ha', createdAt: '2026-04-01T00:00:00Z', lastUsedAt: null }],
    })
    apiKeysApi.revoke.mockResolvedValue({ revoked: true })
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('revoke-key-k1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('revoke-key-k1'))
    await waitFor(() => expect(apiKeysApi.revoke).toHaveBeenCalledWith('k1'))
  })

  it('removes key from list after successful revoke', async () => {
    apiKeysApi.list.mockResolvedValue({
      keys: [{ id: 'k1', name: 'HA', key: 'pt_live_ha...', prefix: 'pt_live_ha', createdAt: '2026-04-01T00:00:00Z', lastUsedAt: null }],
    })
    apiKeysApi.revoke.mockResolvedValue({ revoked: true })
    renderAt('/settings/api-keys')
    await waitFor(() => expect(screen.getByTestId('revoke-key-k1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('revoke-key-k1'))
    await waitFor(() => expect(screen.queryByTestId('revoke-key-k1')).not.toBeInTheDocument())
  })
})
