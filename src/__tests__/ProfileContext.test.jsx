import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  setApiCredential: vi.fn(),
  profileApi: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

let authState = { isAuthenticated: true, isGuest: false }
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }) => children,
}))

import { ProfileProvider, useProfile } from '../context/ProfileContext.jsx'
import { profileApi } from '../api/plants.js'

function Consumer() {
  const p = useProfile()
  return (
    <div>
      <span data-testid="type">{p.accountType}</span>
      <span data-testid="loading">{String(p.loading)}</span>
      <span data-testid="error">{p.error || 'none'}</span>
      <button onClick={async () => { try { await p.setAccountType('landscaper') } catch { /* swallow for tests */ } }}>landscaper</button>
      <button onClick={async () => { try { await p.setAccountType('both') } catch { /* swallow for tests */ } }}>both</button>
    </div>
  )
}

function renderProvider() {
  return render(<ProfileProvider><Consumer /></ProfileProvider>)
}

describe('ProfileContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState = { isAuthenticated: true, isGuest: false }
  })

  it('loads accountType on mount', async () => {
    profileApi.get.mockResolvedValue({ accountType: 'landscaper' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('landscaper'))
    expect(profileApi.get).toHaveBeenCalledOnce()
  })

  it('defaults to household when route returns garbage', async () => {
    profileApi.get.mockResolvedValue({ accountType: 'wizard' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('type')).toHaveTextContent('household')
  })

  it('defaults to household and surfaces error when route fails', async () => {
    profileApi.get.mockRejectedValue(new Error('gateway 404'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('type')).toHaveTextContent('household')
    expect(screen.getByTestId('error')).toHaveTextContent('gateway 404')
  })

  it('skips network call when guest, exposes default', async () => {
    authState = { isAuthenticated: true, isGuest: true }
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('type')).toHaveTextContent('household')
    expect(profileApi.get).not.toHaveBeenCalled()
  })

  it('persists via PUT and updates state optimistically', async () => {
    profileApi.get.mockResolvedValue({ accountType: 'household' })
    profileApi.set.mockResolvedValue({ accountType: 'landscaper' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('household'))
    await act(async () => { screen.getByText('landscaper').click() })
    await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('landscaper'))
    expect(profileApi.set).toHaveBeenCalledWith('landscaper')
  })

  it('rolls back on PUT failure', async () => {
    profileApi.get.mockResolvedValue({ accountType: 'household' })
    profileApi.set.mockRejectedValue(new Error('500'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('household'))
    await act(async () => {
      try { screen.getByText('both').click() } catch { /* swallowed */ }
    })
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('500'))
    expect(screen.getByTestId('type')).toHaveTextContent('household')
  })
})
