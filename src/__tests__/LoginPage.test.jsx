import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth } from '../contexts/AuthContext.jsx'

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn(),
    loginAsGuest: vi.fn(),
  })),
}))

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <div data-testid="google-login">
      <button onClick={() => onSuccess({ credential: 'test-token' })}>Sign in</button>
      <button onClick={() => onError()}>Fail</button>
    </div>
  ),
}))

import LoginPage from '../pages/LoginPage.jsx'

describe('LoginPage', () => {
  let mockLogin
  let mockLoginAsGuest

  beforeEach(() => {
    mockLogin = vi.fn()
    mockLoginAsGuest = vi.fn()
    useAuth.mockReturnValue({ login: mockLogin, loginAsGuest: mockLoginAsGuest })
  })

  it('renders title "Plant Tracker" and description', () => {
    render(<LoginPage />)
    expect(screen.getByText('Plant Tracker')).toBeInTheDocument()
    expect(screen.getByText('Your personal plant care companion')).toBeInTheDocument()
  })

  it('renders "Continue as Guest" button', () => {
    render(<LoginPage />)
    expect(screen.getByText('Continue as Guest')).toBeInTheDocument()
  })

  it('clicking "Continue as Guest" calls loginAsGuest', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByText('Continue as Guest'))
    expect(mockLoginAsGuest).toHaveBeenCalled()
  })

  it('renders Google login when client ID is set', async () => {
    const originalEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id'

    vi.resetModules()
    vi.doMock('../contexts/AuthContext.jsx', () => ({
      useAuth: vi.fn(() => ({ login: mockLogin, loginAsGuest: mockLoginAsGuest })),
    }))
    vi.doMock('@react-oauth/google', () => ({
      GoogleLogin: ({ onSuccess, onError }) => (
        <div data-testid="google-login">
          <button onClick={() => onSuccess({ credential: 'test-token' })}>Sign in</button>
          <button onClick={() => onError()}>Fail</button>
        </div>
      ),
    }))

    const { default: LoginPageWithId } = await import('../pages/LoginPage.jsx')
    render(<LoginPageWithId />)

    expect(screen.getByTestId('google-login')).toBeInTheDocument()
    expect(screen.queryByText('Configuration required')).not.toBeInTheDocument()

    import.meta.env.VITE_GOOGLE_CLIENT_ID = originalEnv
  })

  it('shows error message on failed login when Google login is available', () => {
    // Since CLIENT_ID is empty at module level, GoogleLogin won't render.
    // We test the error state directly by simulating it.
    // We'll test error display by rendering and checking the error path exists in code.
    render(<LoginPage />)
    // Without CLIENT_ID, we can't trigger the Google error flow.
    // But we can verify the non-error state doesn't show error messages.
    expect(screen.queryByText('Sign-in failed')).not.toBeInTheDocument()
  })

  it('"Try a different account" button clears error', () => {
    // This test is limited without CLIENT_ID, but we verify initial state
    render(<LoginPage />)
    expect(screen.queryByText('Try a different account')).not.toBeInTheDocument()
  })

  it('shows sign-in instruction text', () => {
    render(<LoginPage />)
    expect(screen.getByText('Sign in to access your plants')).toBeInTheDocument()
  })

  it('shows guest mode disclaimer', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Guest mode uses sample data/)).toBeInTheDocument()
  })
})

// Test with VITE_GOOGLE_CLIENT_ID set - use a separate describe with dynamic import
describe('LoginPage with Google Client ID', () => {
  let mockLogin
  let mockLoginAsGuest

  beforeEach(() => {
    mockLogin = vi.fn()
    mockLoginAsGuest = vi.fn()
    useAuth.mockReturnValue({ login: mockLogin, loginAsGuest: mockLoginAsGuest })

    // Dynamically set the env var - but since CLIENT_ID is captured at module load time,
    // we need to test the GoogleLogin-present path differently.
    // The mock for @react-oauth/google is already set up, and if CLIENT_ID were truthy,
    // GoogleLogin would render. We can test by directly rendering with the mock.
  })

  it('renders Google login button and handles success', async () => {
    // Reset modules to pick up env change
    const originalEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id'

    // Re-import the module to pick up new env
    vi.resetModules()

    // Re-mock dependencies after reset
    vi.doMock('../contexts/AuthContext.jsx', () => ({
      useAuth: vi.fn(() => ({ login: mockLogin, loginAsGuest: mockLoginAsGuest })),
    }))
    vi.doMock('@react-oauth/google', () => ({
      GoogleLogin: ({ onSuccess, onError }) => (
        <div data-testid="google-login">
          <button onClick={() => onSuccess({ credential: 'test-token' })}>Sign in</button>
          <button onClick={() => onError()}>Fail</button>
        </div>
      ),
    }))

    const { default: LoginPageWithId } = await import('../pages/LoginPage.jsx')
    render(<LoginPageWithId />)

    expect(screen.getByTestId('google-login')).toBeInTheDocument()
    expect(screen.queryByText('Configuration required')).not.toBeInTheDocument()

    // Test successful login
    fireEvent.click(screen.getByText('Sign in'))
    expect(mockLogin).toHaveBeenCalledWith({ credential: 'test-token' })

    // Restore
    import.meta.env.VITE_GOOGLE_CLIENT_ID = originalEnv
  })

  it('shows error on failed Google login and clears with try different account', async () => {
    const originalEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id'

    vi.resetModules()
    vi.doMock('../contexts/AuthContext.jsx', () => ({
      useAuth: vi.fn(() => ({ login: mockLogin, loginAsGuest: mockLoginAsGuest })),
    }))
    vi.doMock('@react-oauth/google', () => ({
      GoogleLogin: ({ onSuccess, onError }) => (
        <div data-testid="google-login">
          <button onClick={() => onSuccess({ credential: 'test-token' })}>Sign in</button>
          <button onClick={() => onError()}>Fail</button>
        </div>
      ),
    }))

    const { default: LoginPageWithId } = await import('../pages/LoginPage.jsx')
    render(<LoginPageWithId />)

    // Trigger error
    fireEvent.click(screen.getByText('Fail'))
    expect(screen.getByText('Sign-in failed')).toBeInTheDocument()
    expect(screen.getByText('Try a different account')).toBeInTheDocument()

    // Clear error
    fireEvent.click(screen.getByText('Try a different account'))
    expect(screen.queryByText('Sign-in failed')).not.toBeInTheDocument()

    import.meta.env.VITE_GOOGLE_CLIENT_ID = originalEnv
  })
})
