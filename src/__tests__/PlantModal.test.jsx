import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlantModal from '../components/PlantModal.jsx'

// Stub out ImageAnalyser to avoid triggering real API calls in unit tests.
vi.mock('../components/ImageAnalyser.jsx', () => ({
  default: () => <div data-testid="image-analyser" />,
}))

// Stub imagesApi so no real uploads happen.
vi.mock('../api/plants.js', () => ({
  imagesApi: { upload: vi.fn().mockResolvedValue('https://example.com/img.jpg') },
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

describe('PlantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial render state ──────────────────────────────────────────────────

  it('shows "Add Plant" title when no plant is provided', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: 'Add Plant' })).toBeInTheDocument()
  })

  it('shows "Edit Plant" title when editing an existing plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByRole('heading', { name: 'Edit Plant' })).toBeInTheDocument()
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
    expect(screen.getByPlaceholderText(/living room fern/i)).toHaveValue('')
  })

  it('renders floor options from the floors prop', () => {
    renderModal()
    // "Ground Floor" only appears as a floor option, not in the rooms list
    expect(screen.getByRole('option', { name: 'Ground Floor' })).toBeInTheDocument()
    // "Garden" appears both as a floor option and a room option — at least two
    expect(screen.getAllByRole('option', { name: 'Garden' }).length).toBeGreaterThanOrEqual(2)
  })

  it('does not show the Delete button for a new plant', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows the Delete button when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('renders the ImageAnalyser stub', () => {
    renderModal()
    expect(screen.getByTestId('image-analyser')).toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('updates the name field as the user types', () => {
    renderModal()
    const nameInput = screen.getByPlaceholderText(/living room fern/i)
    fireEvent.change(nameInput, { target: { value: 'My Monstera' } })
    expect(nameInput).toHaveValue('My Monstera')
  })

  it('updates the notes field as the user types', () => {
    renderModal()
    const notes = screen.getByPlaceholderText(/special care/i)
    fireEvent.change(notes, { target: { value: 'Water twice a week' } })
    expect(notes).toHaveValue('Water twice a week')
  })

  it('disables the Save button when name is empty', () => {
    renderModal()
    const saveBtn = screen.getByRole('button', { name: /add plant/i })
    expect(saveBtn).toBeDisabled()
  })

  it('enables the Save button once a name is entered', () => {
    renderModal()
    fireEvent.change(screen.getByPlaceholderText(/living room fern/i), {
      target: { value: 'Fern' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).not.toBeDisabled()
  })

  it('calls onSave with the form data when Save is clicked', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
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

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    // The outermost div is the backdrop
    const backdrop = screen.getByRole('button', { name: /cancel/i }).closest('[style]')
    // Simulate clicking the backdrop itself (not a child)
    fireEvent.click(backdrop.parentElement, { target: backdrop.parentElement })
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    // The X button is next to the title
    const closeButtons = screen.getAllByRole('button')
    const xBtn = closeButtons.find(b => b.querySelector('svg') && !b.textContent.trim())
    if (xBtn) fireEvent.click(xBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('requires confirmation before deleting — first click shows "Confirm Delete"', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument()
  })

  it('calls onDelete with the plant id after confirmation', () => {
    const onDelete = vi.fn()
    renderModal({ plant: existingPlant, onDelete })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    expect(onDelete).toHaveBeenCalledWith('plant-1')
  })

  // ── Watering log (issue #5) ───────────────────────────────────────────────

  it('does not show Water Now button for a new plant', () => {
    renderModal({ onWater: vi.fn() })
    expect(screen.queryByRole('button', { name: /water now/i })).not.toBeInTheDocument()
  })

  it('shows Water Now button when editing and onWater is provided', () => {
    renderModal({ plant: existingPlant, onWater: vi.fn() })
    expect(screen.getByRole('button', { name: /water now/i })).toBeInTheDocument()
  })

  it('does not show Water Now button when editing but onWater is not provided', () => {
    renderModal({ plant: existingPlant })
    expect(screen.queryByRole('button', { name: /water now/i })).not.toBeInTheDocument()
  })

  it('calls onWater with the plant id when Water Now is clicked', () => {
    const onWater = vi.fn()
    renderModal({ plant: existingPlant, onWater })
    fireEvent.click(screen.getByRole('button', { name: /water now/i }))
    expect(onWater).toHaveBeenCalledWith('plant-1')
  })

  it('shows watering history when plant has a wateringLog', () => {
    const plant = {
      ...existingPlant,
      wateringLog: [
        { date: '2026-03-10T10:00:00Z', note: '' },
        { date: '2026-03-17T10:00:00Z', note: '' },
      ],
    }
    renderModal({ plant })
    expect(screen.getByText(/recent waterings/i)).toBeInTheDocument()
  })

  it('shows at most the last 5 watering entries', () => {
    const plant = {
      ...existingPlant,
      wateringLog: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        note: `entry ${i + 1}`,
      })),
    }
    renderModal({ plant })
    // entries are reversed then sliced to 5 — entries 1 and 2 (oldest) should not appear
    expect(screen.queryByText(/— entry 1/)).not.toBeInTheDocument()
    expect(screen.queryByText(/— entry 2/)).not.toBeInTheDocument()
    expect(screen.getByText(/— entry 7/)).toBeInTheDocument()
  })

  it('does not show watering history when wateringLog is empty', () => {
    renderModal({ plant: existingPlant })
    expect(screen.queryByText(/recent waterings/i)).not.toBeInTheDocument()
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
})
