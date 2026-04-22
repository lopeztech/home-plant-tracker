import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  brandingApi: {
    get: vi.fn(),
    save: vi.fn(),
  },
  imagesApi: {
    upload: vi.fn(),
  },
  plantsApi: { list: vi.fn().mockResolvedValue([]) },
  floorsApi: { get: vi.fn().mockResolvedValue({ floors: [] }), save: vi.fn() },
  analyseApi: { analyseFloorplan: vi.fn(), analyse: vi.fn() },
  setApiCredential: vi.fn(),
  recommendApi: { get: vi.fn() },
}))

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    floors: [],
    handleSaveFloors: vi.fn(),
    handleFloorplanUpload: vi.fn(),
    isAnalysingFloorplan: false,
    tempUnit: null,
    isGuest: false,
    location: null,
    setLocation: vi.fn(),
  }),
}))

vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: () => ({ theme: 'light', changeTheme: vi.fn() }),
}))

vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: () => <div data-testid="leaflet-floorplan" />,
}))

const { brandingApi } = await import('../api/plants.js')

import SettingsPage from '../pages/SettingsPage.jsx'

describe('BrandingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    brandingApi.get.mockResolvedValue({
      businessName: '',
      primaryColor: '#2d5a1b',
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
      logoUrl: null,
    })
  })

  it('renders the Branding panel heading', async () => {
    render(<SettingsPage />)
    await waitFor(() => expect(screen.getByText('Branding')).toBeInTheDocument())
  })

  it('shows default branding values from API', async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Business name')).toHaveValue('')
      expect(screen.getByLabelText('Brand colour hex code')).toHaveValue('#2d5a1b')
    })
  })

  it('pre-fills saved businessName from API', async () => {
    brandingApi.get.mockResolvedValue({
      businessName: 'Green Thumb Gardens',
      primaryColor: '#006400',
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
      logoUrl: null,
    })
    render(<SettingsPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Business name')).toHaveValue('Green Thumb Gardens'),
    )
  })

  it('calls brandingApi.save on Save click', async () => {
    brandingApi.save.mockResolvedValue({
      businessName: 'Leaf Co',
      primaryColor: '#2d5a1b',
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
      logoUrl: null,
    })
    render(<SettingsPage />)
    await waitFor(() => screen.getByLabelText('Save branding settings'))
    const input = screen.getByLabelText('Business name')
    fireEvent.change(input, { target: { value: 'Leaf Co' } })
    fireEvent.click(screen.getByLabelText('Save branding settings'))
    await waitFor(() => expect(brandingApi.save).toHaveBeenCalled())
  })

  it('shows Saved! feedback after successful save', async () => {
    brandingApi.save.mockResolvedValue({
      businessName: '',
      primaryColor: '#2d5a1b',
      contactPhone: '',
      contactEmail: '',
      contactWebsite: '',
      logoUrl: null,
    })
    render(<SettingsPage />)
    await waitFor(() => screen.getByLabelText('Save branding settings'))
    fireEvent.click(screen.getByLabelText('Save branding settings'))
    await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument())
  })
})
