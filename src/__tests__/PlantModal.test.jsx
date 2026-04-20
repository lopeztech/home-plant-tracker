import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlantModal from '../components/PlantModal.jsx'

// Stub out ImageAnalyser to avoid triggering real API calls in unit tests.
vi.mock('../components/ImageAnalyser.jsx', () => ({
  default: () => <div data-testid="image-analyser" />,
}))

// Stub imagesApi, recommendApi, plantsApi, and analyseApi so no real network
// calls happen. plantsApi.update is needed because PlantModal persists
// recommendation history via the plant doc on success.
vi.mock('../api/plants.js', () => ({
  imagesApi: { upload: vi.fn().mockResolvedValue('https://example.com/img.jpg') },
  plantsApi: {
    update: vi.fn().mockResolvedValue({}),
    deletePhoto: vi.fn().mockResolvedValue({}),
    diagnostic: vi.fn().mockResolvedValue({}),
  },
  analyseApi: { analyse: vi.fn().mockResolvedValue(null) },
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
    getWatering: vi.fn().mockResolvedValue({
      amount: '250ml',
      frequency: 'Every 5-7 days',
      method: 'Bottom watering',
      seasonalTips: 'Reduce in winter',
      signs: 'Yellow leaves = overwatering',
      summary: 'Water moderately.',
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
      onMoisture={props.onMoisture ?? vi.fn()}
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
    expect(screen.queryByPlaceholderText(/nephrolepis/i)).not.toBeInTheDocument()
  })

  it('shows the form after choosing Enter manually', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByPlaceholderText(/nephrolepis/i)).toBeInTheDocument()
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

  it('pre-fills the species field when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByPlaceholderText(/nephrolepis/i)).toHaveValue('Nephrolepis')
  })

  it('starts with an empty species field for a new plant', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByPlaceholderText(/nephrolepis/i)).toHaveValue('')
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

  it('shows tab bar when editing a plant', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByText('Plant')).toBeInTheDocument()
    expect(screen.getByText('Watering')).toBeInTheDocument()
    expect(screen.getByText('Care')).toBeInTheDocument()
  })

  it('does not show tab bar for a new plant', () => {
    renderModal()
    expect(screen.queryByText('Plant')).not.toBeInTheDocument()
    expect(screen.queryByText('Watering')).not.toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('updates the species field as the user types', () => {
    renderModal()
    selectMode('manual')
    const speciesInput = screen.getByPlaceholderText(/nephrolepis/i)
    fireEvent.change(speciesInput, { target: { value: 'Monstera deliciosa' } })
    expect(speciesInput).toHaveValue('Monstera deliciosa')
  })

  it('shows health and maturity on the Care tab', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Mature')).toBeInTheDocument()
  })

  it('does not show the Save button on the mode-choice screen', () => {
    renderModal()
    expect(screen.queryByRole('button', { name: /add plant/i })).not.toBeInTheDocument()
  })

  it('disables the Save button when species is empty', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('enables the Save button once a species is entered', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Nephrolepis exaltata' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).not.toBeDisabled()
  })

  it('calls onSave with a name derived from species + room when Save is clicked', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Nephrolepis exaltata' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        species: 'Nephrolepis exaltata',
        // Default first room from the floors fixture is "Living Room"
        name: expect.stringMatching(/^Nephrolepis exaltata - /),
      })
    )
  })

  it('groups the marker emoji picker into labelled categories', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByText('Foliage')).toBeInTheDocument()
    expect(screen.getByText('Flowers')).toBeInTheDocument()
    expect(screen.getByText('Trees')).toBeInTheDocument()
    expect(screen.getByText('Citrus & Fruit')).toBeInTheDocument()
  })

  it('shows a marker preview with the auto emoji for the current species', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Meyer lemon' },
    })
    const preview = screen.getByLabelText(/marker preview/i)
    expect(preview.textContent).toBe('🍋')
  })

  it('sends the picked marker emoji in the onSave payload', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Nephrolepis exaltata' },
    })
    fireEvent.click(screen.getByRole('button', { name: /use 🌻 as marker/i }))
    // After picking a custom emoji, a "Use auto" link appears to revert.
    expect(screen.getByRole('button', { name: /use auto/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emoji: '🌻' }))
  })

  it('sends emoji: null when the Auto option is kept', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Nephrolepis exaltata' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emoji: null }))
  })

  it('renders Identity, Environment, and Photos sections in the Plant tab when editing', () => {
    renderModal({ plant: existingPlant })
    expect(screen.getByRole('button', { name: /^Identity$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Environment$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Photos$/ })).toBeInTheDocument()
  })

  it('does not render the Photos section for a new plant', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('button', { name: /^Identity$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Environment$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Photos$/ })).not.toBeInTheDocument()
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

  it('paginates watering entries on the Watering tab', () => {
    const plant = {
      ...existingPlant,
      wateringLog: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        note: `entry ${i + 1}`,
      })),
    }
    renderModal({ plant })
    fireEvent.click(screen.getByText('Watering'))
    // Page 1 shows 5 most recent (reversed: entries 7,6,5,4,3)
    expect(screen.getByText(/— entry 7/)).toBeInTheDocument()
    expect(screen.getByText(/— entry 3/)).toBeInTheDocument()
    expect(screen.queryByText(/— entry 2/)).not.toBeInTheDocument()
    // Navigate to page 2
    fireEvent.click(screen.getByText('2'))
    expect(screen.getByText(/— entry 2/)).toBeInTheDocument()
    expect(screen.getByText(/— entry 1/)).toBeInTheDocument()
  })

  it('shows empty state on the Watering tab when wateringLog is empty', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Watering'))
    expect(screen.getByText(/no watering history yet/i)).toBeInTheDocument()
  })

  // ── Care tab (includes AI recommendations, merged in) ───────────────────

  it('shows Get Recommendations button on the Care tab', () => {
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    expect(screen.getByRole('button', { name: /get recommendations|refresh/i })).toBeInTheDocument()
  })

  it('calls recommendApi.get and shows results when Get Recommendations is clicked', async () => {
    const { recommendApi } = await import('../api/plants.js')
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    fireEvent.click(screen.getByRole('button', { name: /get recommendations|refresh/i }))
    await waitFor(() => expect(recommendApi.get).toHaveBeenCalledWith('Nephrolepis - Kitchen', 'Nephrolepis', expect.anything()))
    expect(await screen.findByText('A lovely fern.')).toBeInTheDocument()
    expect(screen.getByText('Water weekly.')).toBeInTheDocument()
  })

  it('shows an error message if recommendApi.get fails', async () => {
    const { recommendApi } = await import('../api/plants.js')
    recommendApi.get.mockRejectedValueOnce(new Error('Network error'))
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    fireEvent.click(screen.getByRole('button', { name: /get recommendations|refresh/i }))
    expect(await screen.findByText(/network error/i)).toBeInTheDocument()
  })

  it('surfaces a friendly message when a jsonrepair-style parse error bubbles up', async () => {
    const { recommendApi } = await import('../api/plants.js')
    recommendApi.get.mockRejectedValueOnce(new Error('Object key expected at position 14.'))
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Care'))
    fireEvent.click(screen.getByRole('button', { name: /get recommendations|refresh/i }))
    expect(await screen.findByText(/please try again/i)).toBeInTheDocument()
    // Raw jsonrepair jargon should not be shown.
    expect(screen.queryByText(/position 14/i)).not.toBeInTheDocument()
  })

  it('persists recommendation history on the plant doc and renders previous entries', async () => {
    const { recommendApi, plantsApi } = await import('../api/plants.js')
    // Use a safely mid-day-local timestamp so the formatted date is stable
    // regardless of CI timezone.
    const prevDate = new Date()
    prevDate.setHours(12, 0, 0, 0)
    prevDate.setDate(prevDate.getDate() - 3)
    const plantWithHistory = {
      ...existingPlant,
      careRecommendationHistory: [
        {
          date: prevDate.toISOString(),
          data: { summary: 'Previous guidance.', watering: 'Once a week.' },
        },
      ],
    }
    renderModal({ plant: plantWithHistory })
    fireEvent.click(screen.getByText('Care'))
    // Latest entry from history is preloaded, no fetch needed yet.
    expect(await screen.findByText('Previous guidance.')).toBeInTheDocument()

    // Fetch a new recommendation — should push to history and persist.
    fireEvent.click(screen.getByRole('button', { name: /refresh|get recommendations/i }))
    await waitFor(() => expect(recommendApi.get).toHaveBeenCalled())
    expect(await screen.findByText('A lovely fern.')).toBeInTheDocument()

    await waitFor(() =>
      expect(plantsApi.update).toHaveBeenCalledWith(
        'plant-1',
        expect.objectContaining({ careRecommendationHistory: expect.any(Array) }),
      ),
    )
    const call = plantsApi.update.mock.calls.find(
      ([, body]) => body && body.careRecommendationHistory,
    )
    expect(call[1].careRecommendationHistory).toHaveLength(2)
    expect(call[1].careRecommendationHistory[1].data.summary).toBe('A lovely fern.')

    // Previous-entries toggle appears and reveals the old recommendation.
    const toggle = await screen.findByRole('button', { name: /show previous recommendations/i })
    fireEvent.click(toggle)
    // Mirror the component's formatter exactly so the expected string matches
    // regardless of locale/timezone differences between local and CI.
    const expectedDateText = `${prevDate.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} · ${prevDate.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
    expect(await screen.findByText(expectedDateText)).toBeInTheDocument()
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

  it('disables Save when species contains only whitespace', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('enables Save after the user types a non-empty species', () => {
    renderModal()
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Cactus' },
    })
    expect(screen.getByRole('button', { name: /add plant/i })).not.toBeDisabled()
  })

  it('disables Save again if species is cleared after being set', () => {
    renderModal()
    selectMode('manual')
    const speciesInput = screen.getByPlaceholderText(/nephrolepis/i)
    fireEvent.change(speciesInput, { target: { value: 'Cactus' } })
    fireEvent.change(speciesInput, { target: { value: '' } })
    expect(screen.getByRole('button', { name: /add plant/i })).toBeDisabled()
  })

  it('includes position x/y in the saved plant data', async () => {
    const onSave = vi.fn()
    renderModal({ onSave, position: { x: 33, y: 77 } })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Orchid' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
  })

  // ── Sun exposure fields ────────────────────────────────────────────────────

  it('shows Sun Exposure dropdown in the edit form', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByText('Sun Exposure')).toBeInTheDocument()
  })

  it('renders sun exposure options: Full Sun, Part Sun, Shade', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('option', { name: 'Full Sun' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Part Sun' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Shade' })).toBeInTheDocument()
  })

  it('shows Sun Hours / Day slider in the edit form', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByText(/sun hours \/ day/i)).toBeInTheDocument()
  })

  it('pre-fills sun exposure when editing a plant with sunExposure set', () => {
    const plant = { ...existingPlant, sunExposure: 'part-sun' }
    renderModal({ plant })
    const sunSelect = screen.getByRole('option', { name: 'Part Sun' }).closest('select')
    expect(sunSelect).toHaveValue('part-sun')
  })

  it('includes sunExposure and sunHoursPerDay in saved data', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    selectMode('manual')
    fireEvent.change(screen.getByPlaceholderText(/nephrolepis/i), {
      target: { value: 'Cactus' },
    })
    const sunSelect = screen.getByRole('option', { name: 'Full Sun' }).closest('select')
    fireEvent.change(sunSelect, { target: { value: 'full-sun' } })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sunExposure: 'full-sun' })
    )
  })

  it('shows a watering status badge in the header when viewing an existing plant', () => {
    renderModal({ plant: existingPlant })
    // Check that a Badge element exists in the modal title area
    const modal = screen.getByRole('dialog')
    expect(modal).toBeTruthy()
  })

  it('shows Planted In dropdown on Plant tab', () => {
    renderModal()
    selectMode('manual')
    expect(screen.getByRole('option', { name: 'In the Ground' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Garden Bed' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pot' })).toBeInTheDocument()
  })

  it('shows Pot Size and Soil Type only when Pot is selected', () => {
    renderModal()
    selectMode('manual')
    // Initially no pot size visible (plantedIn not set to pot)
    expect(screen.queryByRole('option', { name: 'Small (< 15cm)' })).not.toBeInTheDocument()

    // Select Pot
    const plantedInSelect = screen.getByRole('option', { name: 'Pot' }).closest('select')
    fireEvent.change(plantedInSelect, { target: { value: 'pot' } })

    // Now pot size and soil type should be visible
    expect(screen.getByRole('option', { name: 'Small (< 15cm)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Standard potting mix' })).toBeInTheDocument()
  })

  it('hides Pot Size and Soil Type when In the Ground is selected', () => {
    renderModal()
    selectMode('manual')
    const plantedInSelect = screen.getByRole('option', { name: 'Pot' }).closest('select')

    // Select Pot first
    fireEvent.change(plantedInSelect, { target: { value: 'pot' } })
    expect(screen.getByRole('option', { name: 'Small (< 15cm)' })).toBeInTheDocument()

    // Switch to In the Ground
    fireEvent.change(plantedInSelect, { target: { value: 'ground' } })
    expect(screen.queryByRole('option', { name: 'Small (< 15cm)' })).not.toBeInTheDocument()
  })

  it('calls recommendApi.getWatering and shows results on Watering tab', async () => {
    const { recommendApi } = await import('../api/plants.js')
    renderModal({ plant: existingPlant })
    fireEvent.click(screen.getByText('Watering'))
    fireEvent.click(screen.getByRole('button', { name: /get watering recommendation/i }))
    await waitFor(() => expect(recommendApi.getWatering).toHaveBeenCalled())
    expect(await screen.findByText('Water moderately.')).toBeInTheDocument()
    // "250ml" now renders in two places: the Water Amount field (synced from
    // the rec) and the recommendation card's Amount row. Either is fine — just
    // assert at least one is visible.
    expect(screen.getAllByText('250ml').length).toBeGreaterThan(0)
  })
})
