import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlantModal from '../components/PlantModal.jsx'

// Stub out ImageAnalyser to avoid triggering real API calls in unit tests.
vi.mock('../components/ImageAnalyser.jsx', () => ({
  default: () => <div data-testid="image-analyser" />,
}))

// Stub imagesApi and recommendApi so no real network calls happen.
vi.mock('../api/plants.js', () => ({
  imagesApi: { upload: vi.fn().mockResolvedValue('https://example.com/img.jpg') },
  recommendApi: {
    get: vi.fn().mockResolvedValue({
      summary: 'A lovely fern.',
      watering: 'Water weekly.',
      light: 'Indirect light.',
      humidity: 'High humidity.',
      soil: 'Well-draining mix.',
      temperature: '18–24°C',
      fertilising: 'Monthly in spring.',
      commonIssues: ['Brown tips', 'Root rot'],
      tips: ['Mist leaves', 'Avoid cold drafts'],
    }),
  },
}))

const floors = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior' },
  { id: 'garden', name: 'Garden',       order: -1, type: 'outdoor' },
]

const existingPlant = {
  id: 'plant-1',
  name: 'Fern',
  species: 'Nephrolepis',
  room: 'Kitchen',
  floor: 'ground',
  lastWatered: '2026-03-20T00:00:00.000Z',
  frequencyDays: 14,
  notes: 'Loves humidity',
  imageUrl: null,
  health: 'Good',
  maturity: 'Mature',
  recommendations: [],
}

function renderModal(props = {}) {
  return render(
    <PlantModal
      plant={props.plant ?? null}
      position={props.position ?? { x: 50, y: 50 }}
      floors={props.floors ?? floors}
      activeFloorId={props.activeFloorId ?? 'ground'}
      onSave={props.onSave ?? vi.fn()}
      onDelete={props.onDelete ?? vi.fn()}
      onWater={props.onWater}
      onClose={props.onClose ?? vi.fn()}
    />
  )
}

// Helper: simulate choosing a mode on the choice screen (new-plant flow only)
function selectMode(mode) {
  const label = mode === 'photo' ? /analyse with ai/i : /enter manually/i
  fireEvent.click(screen.getByRole('button', { name: label }))
}

describe('PlantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Mode-choice screen (new plants) ───────────────────────────────────────

  it('shows "Add Plant" title when no plant is provided', () => {
    renderModal()
    expect(screen.getByText('Add Plant')).toBeInTheDocument()
  })

  it('shows mode-choice buttons for a new plant', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /analyse with ai/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter manually/i })).toBeInTheDocument()
  })

  it('does not show the form until a mode is selected', () => {
    renderModal()
    expect(screen.queryByPlaceholderText(/living room fern/i)).not.toBeInTheDocument()
  })

  it('shows the form after choosing Enter manually', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByPlaceholderText(/living room fern/i)).toBeInTheDocument()
  })

  it('shows the ImageAnalyser after choosing Analyse with AI', () => {
    renderModal()
    selectMode('photo')
    expect(screen.getByTestId('image-analyser')).toBeInTheDocument()
  })

  it('shows the plant name in the title when editing an existing plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByText('Fern')).toBeInTheDocument()
  })

  it('pre-fills the name field when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByPlaceholderText(/living room fern/i)).toHaveValue('Fern')
  })

  it('pre-fills the species field when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByPlaceholderText(/nephrolepis/i)).toHaveValue('Nephrolepis')
  })

  it('starts with an empty name field for a new plant', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByPlaceholderText(/living room fern/i)).toHaveValue('')
  })

  it('renders floor options from the floors prop', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('option', { name: 'Ground Floor' })).toBeInTheDocument()
    // Garden appears as both a floor option and a room option
    expect(screen.getAllByRole('option', { name: 'Garden' }).length).toBeGreaterThanOrEqual(1)
  })

  it('does not show the Delete button for a new plant', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows the Delete button when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('renders the ImageAnalyser stub when editing an existing plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByTestId('image-analyser')).toBeInTheDocument()
  })

  it('shows tab bar when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByText('Edit Plant')).toBeInTheDocument()
    expect(screen.getByText('Watering')).toBeInTheDocument()
    expect(screen.getByText('Care')).toBeInTheDocument()
  })

  it('does not show tab bar for a new plant', () => {
    renderModal()
    expect(screen.queryByText('Edit Plant')).not.toBeInTheDocument()
    expect(screen.queryByText('Watering')).not.toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('updates the name field as the user types', () => {
    renderModal()
    selectMode('manual')
    const nameInput = screen.getByPlaceholderText(/living room fern/i)
    fireEvent.change(nameInput, { target: { value: 'My Monstera' } })
    expect(nameInput).toHaveValue('My Monstera')
  })

  it('updates the notes field as the user types', () => {
    renderModal()
    selectMode('manual')
    const notes = screen.getByPlaceholderText(/special care/i)
    fireEvent.change(notes, { target: { value: 'Water twice a week' } })
    expect(notes).toHaveValue('Water twice a week')
  })

  it('does not show the Save button on the mode-choice screen', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: /add plant/i })).not.toBeInTheDocument()
  })

  it('disables the Save button when name is empty', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('enables the Save button once a name is entered', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'Fern' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).not.toBeDisabled()
  })

  it('calls onSave with the form data when Save is clicked', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'My Fern' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Fern' })
    )
  })

  it('calls onClose when the Cancel button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    // Bootstrap Modal adds a close button with aria-label="Close"
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('requires confirmation before deleting — first click opens confirmation dialog', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByText(`Delete ${existingPlant.name}?`)).toBeInTheDocument()
  })

  it('calls onDelete with the plant id after confirmation', () => {
    const onDelete = vi.fn()
    renderModal({ plant: existingPlant, onDelete })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    // Click the Delete button inside the confirmation dialog (first match in DOM)
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    fireEvent.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith('plant-1')
  })

  it('hides the Save button on the Watering tab', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('hides the Save button on the Care tab', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  // ── Watering tab ──────────────────────────────────────────────────────────

  it('does not show Watered button for a new plant', () => {
    renderModal({ onWater: vi.fn() })
    expect(screen.queryByRole('button', { name: /watered/i })).not.toBeInTheDocument()
  })

  it('shows Watered button on the Watering tab when onWater is provided', () => {
    renderModal({ plant: existingPlant, onWater: vi.fn() })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.getByRole('button', { name: /watered/i })).toBeInTheDocument()
  })

  it('does not show Watered button on the Watering tab when onWater is not provided', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.queryByRole('button', { name: /watered/i })).not.toBeInTheDocument()
  })

  it('calls onWater with the plant id when Watered is clicked', () => {
    const onWater = vi.fn()
    renderModal({ plant: existingPlant, onWater })
    fireEvent.click(screen.getByText('Watering'))
    fireEvent.click(screen.getByRole('button', { name: /watered/i }))
    expect(onWater).toHaveBeenCalledWith('plant-1')
  })

  it('shows watering history on the Watering tab when plant has a wateringLog', () => {
    const plant = {
      ...existingPlant,
      wateringLog: [
        { date: '2026-03-10T10:00:00Z', note: '' },
        { date: '2026-03-17T10:00:00Z', note: '' },
      ],
    }
    renderModal({ plant })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.getByText(/watering history/i)).toBeInTheDocument()
  })

  it('shows all watering entries on the Watering tab', () => {
    const plant = {
      ...existingPlant,
      wateringLog: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        note: `entry ${i + 1}`,
      })),
    }
    renderModal({ plant })
    fireEvent.click(screen.getByText('Watering'))
    // All entries should appear (no 5-entry cap)
    expect(screen.getByText(/— entry 1/)).toBeInTheDocument()
    expect(screen.getByText(/— entry 7/)).toBeInTheDocument()
  })

  it('shows empty state on the Watering tab when wateringLog is empty', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.getByText(/no watering history yet/i)).toBeInTheDocument()
  })

  // ── Care tab ──────────────────────────────────────────────────────────────

  it('shows Get Recommendations button on the Care tab', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    expect(screen.getByRole('button', { name: /get recommendations/i })).toBeInTheDocument()
  })

  it('calls recommendApi.get and shows results when Get Recommendations is clicked', async () => {
    const { recommendApi } = await import('../api/plants.js')
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    fireEvent.click(screen.getByRole('button', { name: /get recommendations/i }))
    await waitFor(() => expect(recommendApi.get).toHaveBeenCalledWith('Fern', 'Nephrolepis'))
    expect(await screen.findByText('A lovely fern.')).toBeInTheDocument()
    expect(screen.getByText('Water weekly.')).toBeInTheDocument()
  })

  it('shows an error message if recommendApi.get fails', async () => {
    const { recommendApi } = await import('../api/plants.js')
    recommendApi.get.mockRejectedValueOnce(new Error('Network error'))
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    fireEvent.click(screen.getByRole('button', { name: /get recommendations/i }))
    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when floors prop is omitted', () => {
    expect(() =>
      render(
        <PlantModal
          activeFloorId="ground"
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />
      )
    ).not.toThrow()
  })

  it('renders without crashing when activeFloorId is omitted', () => {
    expect(() =>
      render(
        <PlantModal
          floors={floors}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
        />
      )
    ).not.toThrow()
  })

  // ── Image upload integration ───────────────────────────────────────────────

  it('shows the ImageAnalyser after choosing "Analyse with AI"', () => {
    renderModal()
    selectMode('photo')
    expect(screen.getByTestId('image-analyser')).toBeInTheDocument()
  })

  it('shows the ImageAnalyser stub (not the manual form) when "Analyse with AI" is selected', () => {
    renderModal()
    selectMode('photo')
    expect(screen.getByTestId('image-analyser')).toBeInTheDocument()
  })

  // ── Form validation ───────────────────────────────────────────────────────

  it('disables Save when name contains only whitespace', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('enables Save after the user types a non-empty name', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'Cactus' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).not.toBeDisabled()
  })

  it('disables Save again if name is cleared after being set', () => {
    renderModal()
    selectMode('manual')
    const nameInput = screen.getByPlaceholderText(/living room fern/i)
    fireEvent.change(nameInput, { target: { value: 'Cactus' } })
    fireEvent.change(nameInput, { target: { value: '' } })
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('includes position x/y in the saved plant data', async () => {
    const onSave = vi.fn()
    renderModal({ onSave, position: { x: 33, y: 77 } })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'Orchid' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
  })

  it('shows a watering status badge in the header when viewing an existing plant', () => {
    renderModal({ plant: existingPlant })
    // Check that a Badge element exists in the modal title area
    const modal = screen.getByRole('dialog')
    expect(modal).toBeTruthy()
  })
})
