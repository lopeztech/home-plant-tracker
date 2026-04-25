import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const changeThemeMock = vi.fn()
const logoutMock = vi.fn()

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    floors: [
      {
        id: 'ground',
        name: 'Ground Floor',
        type: 'indoor',
        order: 0,
        rooms: [
          { name: 'Living Room', type: 'indoor', x: 5, y: 5, width: 40, height: 40 },
        ],
      },
    ],
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
  brandingApi: {
    get: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue({}),
  },
  imagesApi: {
    upload: vi.fn().mockResolvedValue('https://storage.example.com/branding/logo.png'),
  },
}))

// LeafletFloorplan touches canvas APIs not available in jsdom
vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: () => <div data-testid="leaflet-floorplan" />,
}))

import SettingsPage from '../pages/SettingsPage.jsx'
import { accountApi, apiKeysApi, brandingApi, imagesApi } from '../api/plants.js'

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

  it('labels every Property-tab control for assistive tech', () => {
    renderAt('/settings/property')

    // Floor row controls
    expect(screen.getByRole('button', { name: /Show rooms in Ground Floor/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Floor name$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Toggle floor type/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete floor Ground Floor/i })).toBeInTheDocument()

    // Add-zone form controls
    expect(screen.getByRole('textbox', { name: /New zone name/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /New zone type/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Add zone$/i })).toBeInTheDocument()
  })

  it('reveals labelled room controls when a floor row is expanded', () => {
    renderAt('/settings/property')

    // Expand the Ground Floor row to render the inner room controls.
    fireEvent.click(screen.getByRole('button', { name: /Show rooms in Ground Floor/i }))

    expect(screen.getByRole('textbox', { name: /^Room name$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete room Living Room/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /New room name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Add room$/i })).toBeInTheDocument()
  })

  it('switches the confirm-delete UI when the floor delete button is clicked', () => {
    renderAt('/settings/property')

    fireEvent.click(screen.getByRole('button', { name: /Delete floor Ground Floor/i }))
    expect(screen.getByRole('button', { name: /Confirm delete Ground Floor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel delete/i })).toBeInTheDocument()

    // Confirming the delete removes the floor row.
    fireEvent.click(screen.getByRole('button', { name: /Confirm delete Ground Floor/i }))
    expect(screen.queryByRole('button', { name: /Delete floor Ground Floor/i })).not.toBeInTheDocument()
  })

  it('exercises the floor edit handlers (visibility, rename, type toggle)', () => {
    renderAt('/settings/property')

    // Floor visibility switch
    fireEvent.click(screen.getByRole('checkbox', { name: /Show floor Ground Floor/i }))
    // Floor rename
    const nameInput = screen.getByRole('textbox', { name: /^Floor name$/i })
    fireEvent.change(nameInput, { target: { value: 'New Ground Floor' } })
    // Floor type toggle
    fireEvent.click(screen.getByRole('button', { name: /Toggle floor type/i }))

    // Cancel-delete branch
    fireEvent.click(screen.getByRole('button', { name: /Delete floor/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cancel delete/i }))
    expect(screen.getByRole('button', { name: /Delete floor/i })).toBeInTheDocument()
  })

  it('exercises the room edit handlers inside an expanded floor', () => {
    renderAt('/settings/property')
    fireEvent.click(screen.getByRole('button', { name: /Show rooms in Ground Floor/i }))

    fireEvent.click(screen.getByRole('checkbox', { name: /Show room Living Room/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /^Room name$/i }), { target: { value: 'Lounge' } })

    // Toggling the room to outdoor reveals the yard-area select; exercise its
    // onChange so the new aria-label and handler line stay covered.
    fireEvent.click(screen.getByRole('button', { name: /Toggle room type/i }))
    const yardSelect = screen.getByRole('combobox', { name: /Yard area/i })
    fireEvent.change(yardSelect, { target: { value: 'backyard' } })

    // Add a new room and remove the existing one.
    const newRoom = screen.getByRole('textbox', { name: /New room name/i })
    fireEvent.change(newRoom, { target: { value: 'Den' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add room$/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /^Delete room /i })[0])
  })

  it('exercises the add-zone form handlers', () => {
    renderAt('/settings/property')

    fireEvent.change(screen.getByRole('textbox', { name: /New zone name/i }), { target: { value: 'Loft' } })
    fireEvent.change(screen.getByRole('combobox', { name: /New zone type/i }), { target: { value: 'outdoor' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add zone$/i }))

    // Once added, a new floor row must appear with its delete button.
    expect(screen.getByRole('button', { name: /Delete floor Loft/i })).toBeInTheDocument()
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

describe('SettingsPage Branding tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    brandingApi.get.mockResolvedValue({})
    brandingApi.save.mockResolvedValue({})
  })

  it('shows the Branding tab in navigation', () => {
    renderAt('/settings/branding')
    expect(screen.getAllByText('Branding').length).toBeGreaterThan(0)
  })

  it('renders business identity section', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByText(/Business Identity/i)).toBeInTheDocument())
  })

  it('associates the colour-picker input with its label', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-colour-picker')).toBeInTheDocument())

    // axe was failing on the picker because Form.Label / Form.Control were
    // not associated. Verify the input now exposes an accessible name and
    // the hex sibling input is independently labelled.
    const picker = screen.getByLabelText(/Primary brand colour/i, { selector: 'input[type="color"]' })
    expect(picker).toBeInTheDocument()
    expect(picker.getAttribute('id')).toBe('branding-colour-picker-input')
    expect(screen.getByRole('textbox', { name: /Primary brand colour hex value/i })).toBeInTheDocument()
  })

  it('renders logo upload section', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-upload-logo-btn')).toBeInTheDocument())
  })

  it('renders contact info section', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-contact-phone')).toBeInTheDocument())
    expect(screen.getByTestId('branding-contact-email')).toBeInTheDocument()
    expect(screen.getByTestId('branding-contact-website')).toBeInTheDocument()
  })

  it('loads existing branding data on mount', async () => {
    brandingApi.get.mockResolvedValue({
      businessName: 'Green Thumb Landscaping',
      brandColour: '#4a8c55',
      contactEmail: 'hi@greenthumb.com',
    })
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-business-name')).toHaveValue('Green Thumb Landscaping'))
    expect(screen.getByTestId('branding-colour-hex')).toHaveValue('#4a8c55')
    expect(screen.getByTestId('branding-contact-email')).toHaveValue('hi@greenthumb.com')
  })

  it('calls brandingApi.save with form data on save', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-business-name')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('branding-business-name'), { target: { value: 'Leaf & Co' } })
    fireEvent.change(screen.getByTestId('branding-contact-phone'), { target: { value: '+1 555 0001' } })
    fireEvent.click(screen.getByTestId('branding-save-btn'))
    await waitFor(() => expect(brandingApi.save).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Leaf & Co', contactPhone: '+1 555 0001' })
    ))
  })

  it('shows logo preview when branding has a logoUrl', async () => {
    brandingApi.get.mockResolvedValue({ logoUrl: 'https://storage.example.com/branding/logo.png' })
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-logo-preview')).toBeInTheDocument())
    expect(screen.getByTestId('branding-logo-preview')).toHaveAttribute('src', 'https://storage.example.com/branding/logo.png')
  })

  it('calls imagesApi.upload and brandingApi.save on logo file selection', async () => {
    renderAt('/settings/branding')
    await waitFor(() => expect(screen.getByTestId('branding-logo-input')).toBeInTheDocument())
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('branding-logo-input'), { target: { files: [file] } })
    await waitFor(() => expect(imagesApi.upload).toHaveBeenCalledWith(file, 'branding'))
    await waitFor(() => expect(brandingApi.save).toHaveBeenCalledWith({ logoUrl: 'https://storage.example.com/branding/logo.png' }))
  })
})
