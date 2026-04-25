import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  setApiCredential: vi.fn(),
  householdsApi: {
    list: vi.fn(),
    current: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    switch: vi.fn(),
    invite: vi.fn(),
    join: vi.fn(),
    removeMember: vi.fn(),
    setRole: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ isAuthenticated: true, isGuest: false }),
  AuthProvider: ({ children }) => children,
}))

import { HouseholdProvider, useHousehold } from '../context/HouseholdContext.jsx'
import { householdsApi } from '../api/plants.js'

function Consumer() {
  const h = useHousehold()
  return (
    <div>
      <span data-testid="active">{h.activeHouseholdId || 'none'}</span>
      <span data-testid="role">{h.activeRole || 'none'}</span>
      <span data-testid="canEdit">{String(h.canEdit)}</span>
      <span data-testid="canOwn">{String(h.canOwn)}</span>
      <span data-testid="count">{h.households.length}</span>
      <button onClick={() => h.switchTo('h2')}>switch</button>
      <button onClick={h.refresh}>refresh</button>
    </div>
  )
}

function renderProvider() {
  return render(<HouseholdProvider><Consumer /></HouseholdProvider>)
}

describe('HouseholdContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads households on mount and exposes active role', async () => {
    householdsApi.list.mockResolvedValue({
      activeHouseholdId: 'h1',
      households: [
        { id: 'h1', name: 'Main', role: 'owner', isActive: true, memberCount: 2 },
        { id: 'h2', name: 'Holiday', role: 'editor', isActive: false, memberCount: 1 },
      ],
    })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(screen.getByTestId('active')).toHaveTextContent('h1')
    expect(screen.getByTestId('role')).toHaveTextContent('owner')
    expect(screen.getByTestId('canEdit')).toHaveTextContent('true')
    expect(screen.getByTestId('canOwn')).toHaveTextContent('true')
  })

  it('viewer role denies edit and own', async () => {
    householdsApi.list.mockResolvedValue({
      activeHouseholdId: 'h1',
      households: [{ id: 'h1', name: 'Shared', role: 'viewer', isActive: true, memberCount: 3 }],
    })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('viewer'))
    expect(screen.getByTestId('canEdit')).toHaveTextContent('false')
    expect(screen.getByTestId('canOwn')).toHaveTextContent('false')
  })

  it('editor role allows edit but not own', async () => {
    householdsApi.list.mockResolvedValue({
      activeHouseholdId: 'h1',
      households: [{ id: 'h1', name: 'Shared', role: 'editor', isActive: true, memberCount: 2 }],
    })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('editor'))
    expect(screen.getByTestId('canEdit')).toHaveTextContent('true')
    expect(screen.getByTestId('canOwn')).toHaveTextContent('false')
  })

  it('switchTo calls householdsApi.switch and refreshes', async () => {
    householdsApi.list.mockResolvedValue({
      activeHouseholdId: 'h1',
      households: [
        { id: 'h1', name: 'Main', role: 'owner', isActive: true, memberCount: 1 },
        { id: 'h2', name: 'Holiday', role: 'owner', isActive: false, memberCount: 1 },
      ],
    })
    householdsApi.switch.mockResolvedValue({ id: 'h2', name: 'Holiday', role: 'owner' })

    renderProvider()
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))

    householdsApi.list.mockResolvedValue({
      activeHouseholdId: 'h2',
      households: [
        { id: 'h1', name: 'Main', role: 'owner', isActive: false, memberCount: 1 },
        { id: 'h2', name: 'Holiday', role: 'owner', isActive: true, memberCount: 1 },
      ],
    })

    await act(async () => { screen.getByText('switch').click() })
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('h2'))
    expect(householdsApi.switch).toHaveBeenCalledWith('h2')
  })
})
