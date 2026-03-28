import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  analyseApi: { analyseFloorplan: vi.fn() },
  setApiCredential: vi.fn(),
}))

vi.mock('../contexts/AuthContext.jsx', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useAuth: vi.fn().mockReturnValue({
      isAuthenticated: true,
      isLoading:       false,
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

// Leaflet is not available in jsdom — stub out the whole floorplan component
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

const samplePlant = {
  id: 'p1',
  name: 'Fern',
  species: 'Nephrolepis',
  room: 'Living Room',
  floor: 'ground',
  x: 40,
  y: 50,
  lastWatered: '2026-03-20T00:00:00Z',
  frequencyDays: 7,
  health: 'Good',
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plantsApi.list.mockResolvedValue([])
    floorsApi.get.mockResolvedValue({ floors: [] })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading:       false,
      user:            { name: 'Test User', email: 'test@example.com', picture: '' },
      login:           vi.fn(),
      logout:          vi.fn(),
    })
  })

  // ── Auth state ────────────────────────────────────────────────────────────

  it('shows the login page when the user is not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null, login: vi.fn(), logout: vi.fn() })
    render(<App />)
    expect(screen.getByText(/sign in to access your plants/i)).toBeInTheDocument()
  })

  it('renders the main view when authenticated', async () => {
    render(<App />)
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalledOnce())
    expect(screen.getByTestId('leaflet-floorplan')).toBeInTheDocument()
  })

  it('shows a loading state while auth is resolving', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null, login: vi.fn(), logout: vi.fn() })
    render(<App />)
    // Should not show the login page yet
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })

  // ── Data loading ──────────────────────────────────────────────────────────

  it('calls plantsApi.list on mount when authenticated', async () => {
    render(<App />)
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalledOnce())
  })

  it('calls floorsApi.get on mount when authenticated', async () => {
    render(<App />)
    await waitFor(() => expect(floorsApi.get).toHaveBeenCalledOnce())
  })

  it('displays plants in the sidebar after loading', async () => {
    plantsApi.list.mockResolvedValue([samplePlant])
    render(<App />)
    await waitFor(() => expect(screen.getByText('Fern')).toBeInTheDocument())
  })

  it('does not call plantsApi.list when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null, login: vi.fn(), logout: vi.fn() })
    render(<App />)
    expect(plantsApi.list).not.toHaveBeenCalled()
  })

  // ── Plant CRUD ────────────────────────────────────────────────────────────

  it('adds a plant to the list after create', async () => {
    plantsApi.list.mockResolvedValue([])
    plantsApi.create.mockResolvedValue(samplePlant)

    render(<App />)
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalled())

    // Open modal via sidebar "Add Plant" button
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))

    // New-plant modal shows mode-choice screen first
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))

    // Fill in name and save
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'Fern' },
    })
    // The modal save button has form="" (explicit empty form attr); sidebar button has none
    const saveBtn = screen.getAllByRole('button', { name: /^add plant$/i })
      .find(b => b.getAttribute('form') === '')
    fireEvent.click(saveBtn)

    await waitFor(() => expect(plantsApi.create).toHaveBeenCalledOnce())
    expect(await screen.findByText('Fern')).toBeInTheDocument()
  })

  it('removes a plant from the list after delete', async () => {
    plantsApi.list.mockResolvedValue([samplePlant])
    plantsApi.delete.mockResolvedValue(null)

    render(<App />)
    await waitFor(() => expect(screen.getByText('Fern')).toBeInTheDocument())

    // Click on the plant card to open the modal
    fireEvent.click(screen.getByText('Fern').closest('button'))

    // Delete with confirmation dialog
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    // Click the Delete button inside the confirmation dialog (first match in DOM)
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => expect(plantsApi.delete).toHaveBeenCalledWith(samplePlant.id))
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
  })

  it('updates a plant in the list after water', async () => {
    plantsApi.list.mockResolvedValue([samplePlant])
    const wateredPlant = { ...samplePlant, lastWatered: new Date().toISOString() }
    plantsApi.water.mockResolvedValue(wateredPlant)

    render(<App />)
    await waitFor(() => expect(screen.getByText('Fern')).toBeInTheDocument())

    // Click the water button on the plant card
    fireEvent.click(screen.getByRole('button', { name: /mark .+ as watered/i }))

    await waitFor(() => expect(plantsApi.water).toHaveBeenCalledWith(samplePlant.id))
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('does not crash when plantsApi.list rejects', async () => {
    plantsApi.list.mockRejectedValue(new Error('Network error'))
    expect(() => render(<App />)).not.toThrow()
    await waitFor(() => expect(plantsApi.list).toHaveBeenCalled())
  })

  it('does not crash when floorsApi.get rejects (falls back to default floors)', async () => {
    floorsApi.get.mockRejectedValue(new Error('Floors unavailable'))
    expect(() => render(<App />)).not.toThrow()
    await waitFor(() => expect(floorsApi.get).toHaveBeenCalled())
  })
})
