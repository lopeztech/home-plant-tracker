import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../api/plants.js', () => ({
  plantsApi: {
    list:   vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    water:  vi.fn(),
  },
  floorsApi: {
    get:  vi.fn().mockResolvedValue({ floors: [] }),
    save: vi.fn().mockResolvedValue({ floors: [] }),
  },
  imagesApi:  { upload: vi.fn() },
  analyseApi: { analyseFloorplan: vi.fn(), analyse: vi.fn() },
  setApiCredential: vi.fn(),
  recommendApi: { get: vi.fn() },
}))

vi.mock('../contexts/AuthContext.jsx', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useAuth: vi.fn().mockReturnValue({
      isAuthenticated: true,
      isLoading:       false,
      isGuest:         false,
      user:            { name: 'Test User', email: 'test@example.com', picture: '' },
      login:           vi.fn(),
      logout:          vi.fn(),
    }),
    AuthProvider: ({ children }) => <>{children}</>,
  }
})

vi.mock('../hooks/useWeather.js', () => ({
  useWeather: () => ({ weather: null, loading: false, locationDenied: false }),
}))

vi.mock('../hooks/useTempUnit.js', () => ({
  useTempUnit: () => ({ unit: 'celsius', toggle: vi.fn() }),
}))

// Leaflet is not available in jsdom
vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: () => <div data-testid="leaflet-floorplan" />,
}))

vi.mock('../components/ImageAnalyser.jsx', () => ({
  default: () => <div data-testid="image-analyser" />,
}))

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => <>{children}</>,
  GoogleLogin: () => <button>Sign in with Google</button>,
}))

import App from '../App.jsx'
import { plantsApi, floorsApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

const samplePlant = {
  id: 'p1',
  name: 'Fern',
  species: 'Nephrolepis',
  room: 'Living Room',
  floor: 'ground',
  x: 40, y: 50,
  lastWatered: '2026-03-20T00:00:00Z',
  frequencyDays: 7,
  health: 'Good',
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Skip onboarding modal so dashboard content is visible
    localStorage.setItem('plant-tracker-onboarded', '1')
    plantsApi.list.mockResolvedValue([])
    floorsApi.get.mockResolvedValue({ floors: [] })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading:       false,
      isGuest:         false,
      user:            { name: 'Test User', email: 'test@example.com', picture: '' },
      login:           vi.fn(),
      logout:          vi.fn(),
    })
  })

  it('redirects to login page when the user is not authenticated', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isGuest: false, user: null, login: vi.fn(), logout: vi.fn() })
    renderApp()
    await waitFor(() => expect(screen.getByText(/sign in to access your plants/i)).toBeInTheDocument())
  })

  it('renders the dashboard when authenticated', async () => {
    renderApp()
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalledOnce())
    expect(screen.getByTestId('leaflet-floorplan')).toBeInTheDocument()
  })

  it('shows a loading spinner while auth is resolving', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, isGuest: false, user: null, login: vi.fn(), logout: vi.fn() })
    renderApp()
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument()
  })

  it('calls plantsApi.list on mount when authenticated', async () => {
    renderApp()
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalledOnce())
  })

  it('calls floorsApi.get on mount when authenticated', async () => {
    renderApp()
    await waitFor(() => expect(floorsApi.get).toHaveBeenCalledOnce())
  })

  it('displays plants in the list after loading', async () => {
    plantsApi.list.mockResolvedValue([samplePlant])
    renderApp()
    await waitFor(() => expect(screen.getByText('Fern')).toBeInTheDocument())
  })

  it('does not call plantsApi.list when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isGuest: false, user: null, login: vi.fn(), logout: vi.fn() })
    renderApp()
    expect(plantsApi.list).not.toHaveBeenCalled()
  })

  it('does not crash when plantsApi.list rejects', async () => {
    plantsApi.list.mockRejectedValue(new Error('Network error'))
    expect(() => renderApp()).not.toThrow()
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalled())
  })

  it('does not crash when floorsApi.get rejects', async () => {
    floorsApi.get.mockRejectedValue(new Error('Floors unavailable'))
    expect(() => renderApp()).not.toThrow()
    await waitFor(() => expect(floorsApi.get).toHaveBeenCalled())
  })

  it('shows guest mode banner when user is a guest', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true, isGuest: true, isLoading: false,
      user: { name: 'Guest', isGuest: true }, login: vi.fn(), logout: vi.fn(),
    })
    renderApp()
    await waitFor(() => expect(screen.getByText(/guest mode/i)).toBeInTheDocument())
  })

  it('does not call plantsApi.list in guest mode', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true, isGuest: true, isLoading: false,
      user: { name: 'Guest', isGuest: true }, login: vi.fn(), logout: vi.fn(),
    })
    renderApp()
    await waitFor(() => expect(screen.getByText(/guest mode/i)).toBeInTheDocument())
    expect(plantsApi.list).not.toHaveBeenCalled()
  })
})
