import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthProvider, useAuth } from '../contexts/AuthContext.jsx'

// Stub setApiCredential so we can spy on it
vi.mock('../api/plants.js', () => ({
  setApiCredential: vi.fn(),
}))

import { setApiCredential } from '../api/plants.js'

// Helper: build a minimal Google credential JWT with the given payload
function makeCredential(payload) {
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body    = btoa(JSON.stringify(payload)).replace(/=+$/, '')
  const sig     = 'fakesig'
  return `${header}.${body}.${sig}`
}

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="name">{auth.user?.name ?? 'null'}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authed">{String(auth.isAuthenticated)}</span>
      <span data-testid="isGuest">{String(auth.isGuest)}</span>
      <button onClick={() => auth.login({ credential: makeCredential({ name: 'Alice', email: 'a@b.com', picture: '', sub: '1' }) })}>
        login
      </button>
      <button onClick={auth.loginAsGuest}>guest</button>
      <button onClick={auth.logout}>logout</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with user = null and isAuthenticated = false', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('name')).toHaveTextContent('null')
  })

  it('sets isLoading to false after the effect runs', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
  })

  // ── Restore from localStorage ─────────────────────────────────────────────

  it('restores user from localStorage on mount', async () => {
    const stored = { name: 'Bob', email: 'bob@example.com', picture: '', sub: '99', credential: 'tok' }
    localStorage.setItem('plant_tracker_user', JSON.stringify(stored))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('name')).toHaveTextContent('Bob')
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
  })

  it('calls setApiCredential with the stored credential on restore', async () => {
    const stored = { name: 'Bob', email: 'b@c.com', picture: '', sub: '2', credential: 'stored-tok' }
    localStorage.setItem('plant_tracker_user', JSON.stringify(stored))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(setApiCredential).toHaveBeenCalledWith('stored-tok')
  })

  it('handles corrupt localStorage gracefully and stays logged out', async () => {
    localStorage.setItem('plant_tracker_user', 'not-valid-json{{')
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
  })

  it('removes corrupt localStorage entry', async () => {
    localStorage.setItem('plant_tracker_user', '{{bad}')
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(localStorage.getItem('plant_tracker_user')).toBeNull()
  })

  // ── Login ─────────────────────────────────────────────────────────────────

  it('sets user after login', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    act(() => {
      screen.getByText('login').click()
    })

    expect(screen.getByTestId('name')).toHaveTextContent('Alice')
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
  })

  it('persists user to localStorage after login', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    act(() => { screen.getByText('login').click() })

    const stored = JSON.parse(localStorage.getItem('plant_tracker_user'))
    expect(stored.name).toBe('Alice')
  })

  it('calls setApiCredential with the credential on login', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    act(() => { screen.getByText('login').click() })

    // setApiCredential called once on mount (null) then once on login
    const calls = setApiCredential.mock.calls
    const loginCall = calls.find(([arg]) => arg !== null)
    expect(loginCall).toBeTruthy()
  })

  // ── Logout ────────────────────────────────────────────────────────────────

  it('clears user after logout', async () => {
    const stored = { name: 'Bob', email: 'b@c.com', picture: '', sub: '3', credential: 'tok3' }
    localStorage.setItem('plant_tracker_user', JSON.stringify(stored))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))

    act(() => { screen.getByText('logout').click() })

    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('name')).toHaveTextContent('null')
  })

  it('removes localStorage entry on logout', async () => {
    const stored = { name: 'Bob', email: 'b@c.com', picture: '', sub: '3', credential: 'tok3' }
    localStorage.setItem('plant_tracker_user', JSON.stringify(stored))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))

    act(() => { screen.getByText('logout').click() })

    expect(localStorage.getItem('plant_tracker_user')).toBeNull()
  })

  it('calls setApiCredential(null) on logout', async () => {
    const stored = { name: 'Bob', email: 'b@c.com', picture: '', sub: '3', credential: 'tok3' }
    localStorage.setItem('plant_tracker_user', JSON.stringify(stored))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))

    vi.clearAllMocks()
    act(() => { screen.getByText('logout').click() })

    expect(setApiCredential).toHaveBeenCalledWith(null)
  })

  // ── Guest login ───────────────────────────────────────────────────────────

  it('sets user as guest after loginAsGuest', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    act(() => { screen.getByText('guest').click() })

    expect(screen.getByTestId('name')).toHaveTextContent('Guest')
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('isGuest')).toHaveTextContent('true')
  })

  it('persists guest user to localStorage', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    act(() => { screen.getByText('guest').click() })

    const stored = JSON.parse(localStorage.getItem('plant_tracker_user'))
    expect(stored.isGuest).toBe(true)
  })

  it('does not call setApiCredential on guest login', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    vi.clearAllMocks()

    act(() => { screen.getByText('guest').click() })

    expect(setApiCredential).not.toHaveBeenCalled()
  })

  it('restores guest user from localStorage without calling setApiCredential', async () => {
    const guest = { name: 'Guest', email: '', picture: null, sub: 'guest', isGuest: true }
    localStorage.setItem('plant_tracker_user', JSON.stringify(guest))

    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('isGuest')).toHaveTextContent('true')
    expect(setApiCredential).not.toHaveBeenCalled()
  })

  // ── useAuth outside provider ───────────────────────────────────────────────

  it('throws when useAuth is used outside AuthProvider', () => {
    const Bomb = () => { useAuth(); return null }
    expect(() => render(<Bomb />)).toThrow('useAuth must be used inside <AuthProvider>')
  })
})
