import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setAccountTypeMock = vi.fn().mockResolvedValue(undefined)
const saveFeatureOverridesMock = vi.fn().mockResolvedValue(undefined)
let profileCanEdit = true
let profileLoading = false
let profileFeatureOverrides = {}

vi.mock('../context/ProfileContext.jsx', () => ({
  useProfile: () => ({
    accountType: 'household',
    setAccountType: setAccountTypeMock,
    featureOverrides: profileFeatureOverrides,
    saveFeatureOverrides: saveFeatureOverridesMock,
    canEditFeatureFlags: profileCanEdit,
    loading: profileLoading,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isGuest: false, logout: vi.fn() }),
}))

vi.mock('../api/plants.js', () => ({
  apiKeysApi: {
    list: vi.fn().mockResolvedValue({ keys: [] }),
    create: vi.fn(),
    revoke: vi.fn(),
  },
}))

import AdminPage from '../pages/AdminPage.jsx'
import { apiKeysApi } from '../api/plants.js'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/:tab" element={<AdminPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings/:tab" element={<div data-testid="settings-stub" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminPage routing & gating', () => {
  beforeEach(() => {
    profileCanEdit = true
    profileLoading = false
    profileFeatureOverrides = {}
  })

  it('renders the Admin heading', () => {
    renderAt('/admin/features')
    expect(screen.getByRole('heading', { name: /^Admin$/i })).toBeInTheDocument()
  })

  it('renders the three tabs in navigation', () => {
    const { container } = renderAt('/admin/features')
    const labels = Array.from(container.querySelectorAll('.nav-link')).map((el) =>
      el.textContent.trim().toLowerCase(),
    )
    expect(labels.some((l) => l.includes('features'))).toBe(true)
    expect(labels.some((l) => l.includes('api keys'))).toBe(true)
    expect(labels.some((l) => l.includes('advanced'))).toBe(true)
  })

  it('redirects /admin (no tab) to /admin/features by default', () => {
    renderAt('/admin')
    // Default features tab content
    expect(screen.getByText(/Feature visibility/i)).toBeInTheDocument()
  })

  it('redirects unknown tab to default features tab', () => {
    renderAt('/admin/nonsense')
    expect(screen.getByText(/Feature visibility/i)).toBeInTheDocument()
  })

  it('redirects non-admins to /settings/property', () => {
    profileCanEdit = false
    renderAt('/admin/features')
    expect(screen.getByTestId('settings-stub')).toBeInTheDocument()
  })

  it('does not redirect while profile is still loading', () => {
    profileCanEdit = false
    profileLoading = true
    renderAt('/admin/features')
    // Renders the page (we can't decide yet)
    expect(screen.getByRole('heading', { name: /^Admin$/i })).toBeInTheDocument()
  })
})

describe('AdminPage Features tab', () => {
  beforeEach(() => {
    profileCanEdit = true
    profileFeatureOverrides = {}
    saveFeatureOverridesMock.mockClear()
  })

  it('renders the feature toggle table for admins', () => {
    renderAt('/admin/features')
    expect(screen.getByText(/Feature visibility/i)).toBeInTheDocument()
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
  })

  it('saves overrides via saveFeatureOverrides', async () => {
    renderAt('/admin/features')
    const branding = screen.getByLabelText(/Override for Branding/i)
    fireEvent.change(branding, { target: { value: 'household' } })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))
    await waitFor(() =>
      expect(saveFeatureOverridesMock).toHaveBeenCalledWith(
        expect.objectContaining({ branding: 'household' }),
      ),
    )
  })
})

describe('AdminPage API Keys tab', () => {
  beforeEach(() => {
    profileCanEdit = true
    vi.clearAllMocks()
    apiKeysApi.list.mockResolvedValue({ keys: [] })
  })

  it('renders the Public REST API section', async () => {
    renderAt('/admin/api-keys')
    await waitFor(() => expect(screen.getByText(/Public REST API/)).toBeInTheDocument())
  })

  it('shows no-keys message when list is empty', async () => {
    renderAt('/admin/api-keys')
    await waitFor(() => expect(screen.getByTestId('no-keys-message')).toBeInTheDocument())
  })

  it('displays existing active keys in the table', async () => {
    apiKeysApi.list.mockResolvedValue({
      keys: [
        {
          id: 'k1',
          name: 'Home Assistant',
          key: 'pt_live_hass...',
          prefix: 'pt_live_hass',
          createdAt: '2026-04-01T00:00:00Z',
          lastUsedAt: null,
          revokedAt: null,
        },
      ],
    })
    renderAt('/admin/api-keys')
    await waitFor(() => expect(screen.getByTestId('api-keys-table')).toBeInTheDocument())
    expect(screen.getByText('Home Assistant')).toBeInTheDocument()
  })

  it('creates a key with the entered name and shows the new-key banner', async () => {
    apiKeysApi.create.mockResolvedValue({
      id: 'new-k',
      key: 'pt_live_secret123',
      name: 'My App',
      prefix: 'pt_live_secr',
      createdAt: '2026-04-23T00:00:00Z',
    })
    renderAt('/admin/api-keys')
    await waitFor(() => expect(screen.getByTestId('new-key-name-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('new-key-name-input'), { target: { value: 'My App' } })
    fireEvent.click(screen.getByTestId('create-key-btn'))
    await waitFor(() => expect(apiKeysApi.create).toHaveBeenCalledWith('My App'))
    await waitFor(() => expect(screen.getByTestId('new-key-banner')).toBeInTheDocument())
    expect(screen.getByTestId('new-key-value')).toHaveTextContent('pt_live_secret123')
  })

  it('revokes a key and removes it from the list', async () => {
    apiKeysApi.list.mockResolvedValue({
      keys: [{ id: 'k1', name: 'HA', key: 'pt_live_ha...', prefix: 'pt_live_ha', createdAt: '2026-04-01T00:00:00Z', lastUsedAt: null }],
    })
    apiKeysApi.revoke.mockResolvedValue({ revoked: true })
    renderAt('/admin/api-keys')
    await waitFor(() => expect(screen.getByTestId('revoke-key-k1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('revoke-key-k1'))
    await waitFor(() => expect(apiKeysApi.revoke).toHaveBeenCalledWith('k1'))
    await waitFor(() => expect(screen.queryByTestId('revoke-key-k1')).not.toBeInTheDocument())
  })
})

describe('AdminPage Advanced tab', () => {
  beforeEach(() => {
    profileCanEdit = true
  })

  it('shows the About / version section at /admin/advanced', () => {
    renderAt('/admin/advanced')
    expect(screen.getByText(/^About$/i)).toBeInTheDocument()
    expect(screen.getByText(/0\.0\.0-test/i)).toBeInTheDocument()
  })
})
