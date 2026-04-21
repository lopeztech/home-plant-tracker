import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router'
import BulkUploadPage from '../pages/BulkUploadPage.jsx'

// Mock PlantContext
const mockHandleBulkCreatePlants = vi.fn().mockResolvedValue([{ status: 'fulfilled', value: { id: 'p1' } }])
vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    floors: [
      { id: 'ground', name: 'Ground Floor', rooms: [{ name: 'Kitchen' }, { name: 'Living Room' }] },
      { id: 'first', name: 'First Floor', rooms: [{ name: 'Bedroom' }] },
    ],
    activeFloorId: 'ground',
    handleBulkCreatePlants: mockHandleBulkCreatePlants,
  }),
}))

// UpgradePrompt (rendered by BulkUploadPage) reads SubscriptionContext — stub it
// so we don't have to spin up the real provider for unit tests.
vi.mock('../context/SubscriptionContext.jsx', () => ({
  useSubscription: () => ({
    billingEnabled: false,
    tier: 'free',
    canAccess: () => true,
    isAtQuotaLimit: () => false,
    getQuotaRemaining: () => Infinity,
  }),
}))

// Mock API
vi.mock('../api/plants.js', () => ({
  analyseApi: {
    analyse: vi.fn().mockResolvedValue({
      species: 'Monstera deliciosa',
      health: 'Good',
      maturity: 'Mature',
      frequencyDays: 7,
      waterAmount: '200ml',
      waterMethod: 'jug',
    }),
  },
  imagesApi: {
    upload: vi.fn().mockResolvedValue('https://storage.example.com/plants/img.jpg'),
  },
}))

function createImageFile(name = 'plant.jpg') {
  return new File(['fake-image-data'], name, { type: 'image/jpeg' })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BulkUploadPage />
    </MemoryRouter>,
  )
}

describe('BulkUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:fake-url')
    global.URL.revokeObjectURL = vi.fn()
    // Mock crypto.randomUUID
    let counter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++counter}`)
  })

  it('renders the drop zone', () => {
    renderPage()
    expect(screen.getByText(/drop plant photos here/i)).toBeInTheDocument()
    expect(screen.getByText(/bulk upload plants/i)).toBeInTheDocument()
  })

  it('adds files via file input and triggers analysis', async () => {
    const { analyseApi } = await import('../api/plants.js')
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const file = createImageFile()

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    // Should show the summary bar
    await waitFor(() => expect(screen.getByText(/1 photo/)).toBeInTheDocument())

    // Analysis should have been called
    expect(analyseApi.analyse).toHaveBeenCalledWith(file)
  })

  it('shows ready badge after analysis completes', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const file = createImageFile()

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => expect(screen.getByText(/1 ready/)).toBeInTheDocument())
  })

  it('shows error badge when analysis fails', async () => {
    const { analyseApi } = await import('../api/plants.js')
    analyseApi.analyse.mockRejectedValueOnce(new Error('Gemini timeout'))

    renderPage()

    const input = document.querySelector('input[type="file"]')
    const file = createImageFile()

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => expect(screen.getByText(/1 error/)).toBeInTheDocument())
  })

  it('saves all ready plants when Save button is clicked', async () => {
    const { imagesApi } = await import('../api/plants.js')
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const file = createImageFile()

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => expect(screen.getByText(/1 ready/)).toBeInTheDocument())

    const saveBtn = screen.getByRole('button', { name: /save 1 plant$/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(imagesApi.upload).toHaveBeenCalledWith(file, 'plants')
      expect(mockHandleBulkCreatePlants).toHaveBeenCalled()
    })
  })

  it('handles multiple files', async () => {
    const { analyseApi } = await import('../api/plants.js')
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const files = [createImageFile('a.jpg'), createImageFile('b.jpg'), createImageFile('c.jpg')]

    await act(async () => {
      fireEvent.change(input, { target: { files } })
    })

    await waitFor(() => expect(screen.getByText(/3 photos/)).toBeInTheDocument())
    expect(analyseApi.analyse).toHaveBeenCalledTimes(3)
  })

  it('clears all entries when Clear All is clicked', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    await act(async () => {
      fireEvent.change(input, { target: { files: [createImageFile()] } })
    })

    await waitFor(() => expect(screen.getByText(/1 photo/)).toBeInTheDocument())

    const clearBtn = screen.getByRole('button', { name: /clear all/i })
    fireEvent.click(clearBtn)

    expect(screen.queryByText(/1 photo/)).not.toBeInTheDocument()
    expect(global.URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('filters out non-image files', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [textFile] } })
    })

    expect(screen.queryByText(/1 photo/)).not.toBeInTheDocument()
  })

  it('shows Add More button after initial upload', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    await act(async () => {
      fireEvent.change(input, { target: { files: [createImageFile()] } })
    })

    await waitFor(() => expect(screen.getByRole('button', { name: /add more/i })).toBeInTheDocument())
  })

  it('passes analysis recommendations and imageUrl in save data', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const file = createImageFile()

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await waitFor(() => expect(screen.getByText(/1 ready/)).toBeInTheDocument())

    const saveBtn = screen.getByRole('button', { name: /save 1 plant$/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => expect(mockHandleBulkCreatePlants).toHaveBeenCalledTimes(1))
    const [plants] = mockHandleBulkCreatePlants.mock.calls[0]
    expect(plants).toHaveLength(1)
    expect(plants[0]).toMatchObject({
      name: expect.stringContaining('Monstera'),
      species: 'Monstera deliciosa',
      imageUrl: 'https://storage.example.com/plants/img.jpg',
      floor: 'ground',
      room: 'Kitchen',
      recommendations: expect.any(Array),
    })
  })

  it('shows saved badge after successful save', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    await act(async () => {
      fireEvent.change(input, { target: { files: [createImageFile()] } })
    })
    await waitFor(() => expect(screen.getByText(/1 ready/)).toBeInTheDocument())

    const saveBtn = screen.getByRole('button', { name: /save 1 plant$/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => expect(screen.getByText(/1 saved/)).toBeInTheDocument())
  })

  it('saves multiple plants and all reach saved status', async () => {
    renderPage()

    const input = document.querySelector('input[type="file"]')
    const files = [createImageFile('a.jpg'), createImageFile('b.jpg'), createImageFile('c.jpg')]

    await act(async () => {
      fireEvent.change(input, { target: { files } })
    })
    await waitFor(() => expect(screen.getByText(/3 ready/)).toBeInTheDocument())

    const saveBtn = screen.getByRole('button', { name: /save 3 plants/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => expect(screen.getByText(/3 saved/)).toBeInTheDocument())
    expect(mockHandleBulkCreatePlants).toHaveBeenCalledTimes(3)
  })
})
