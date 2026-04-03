import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlantSidebar from '../components/PlantSidebar.jsx'
import { ToastProvider } from '../components/Toast.jsx'

function renderSidebar(props) {
  return render(
    <ToastProvider>
      <PlantSidebar {...props} />
    </ToastProvider>
  )
}

// Helper: build a plant with a predictable watering status.
// daysOverdue > 0  → plant is overdue
// daysOverdue < 0  → plant is due in |daysOverdue| days (future)
// daysOverdue = 0  → due today
function makePlant(id, name, daysOverdue, frequencyDays = 7) {
  const lastWatered = new Date(
    Date.now() - (frequencyDays + daysOverdue) * 86400000
  ).toISOString()
  return { id, name, species: `Species ${id}`, room: 'Living Room', lastWatered, frequencyDays }
}

const mockWeather = {
  current: {
    temp: 22,
    condition: { label: 'Sunny', emoji: '☀️', sky: 'sunny' },
    isDay: true,
  },
  days: [
    { date: '2026-03-25', condition: { label: 'Sunny', emoji: '☀️' }, maxTemp: 25, minTemp: 15, precipitation: 0 },
    { date: '2026-03-26', condition: { label: 'Rainy', emoji: '🌧️' }, maxTemp: 18, minTemp: 12, precipitation: 5 },
    { date: '2026-03-27', condition: { label: 'Cloudy', emoji: '☁️' }, maxTemp: 20, minTemp: 13, precipitation: 0 },
    { date: '2026-03-28', condition: { label: 'Sunny', emoji: '☀️' }, maxTemp: 24, minTemp: 14, precipitation: 0 },
  ],
}

describe('PlantSidebar', () => {
  // ── Initial render state ──────────────────────────────────────────────────

  it('shows empty state message when there are no plants', () => {
    renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText(/no plants yet/i)).toBeInTheDocument()
  })

  it('shows the plant count in the header', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', -5)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText('2 plants')).toBeInTheDocument()
  })

  it('renders a card for each plant', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('sorts plants by urgency — overdue plants appear before healthy ones', () => {
    const healthy = makePlant('1', 'Healthy', -10)  // due in 10 days
    const overdue = makePlant('2', 'Overdue', 3)     // 3 days overdue
    renderSidebar({ plants: [healthy, overdue], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    const cards = screen.getAllByRole('button', { name: /overdue|healthy/i })
    // The overdue plant should appear first (higher urgency)
    expect(cards[0]).toHaveTextContent('Overdue')
    expect(cards[1]).toHaveTextContent('Healthy')
  })

  it('shows an "overdue" summary pill when there are overdue plants', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument()
  })

  it('shows a "today" summary pill when a plant is due today', () => {
    const plants = [makePlant('1', 'Fern', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText(/1 today/i)).toBeInTheDocument()
  })

  it('renders the Add Plant button', () => {
    renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByRole('button', { name: /add plant/i })).toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onAddPlant when the Add Plant button is clicked', () => {
    const onAddPlant = vi.fn()
    renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant })
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    expect(onAddPlant).toHaveBeenCalledOnce()
  })

  it('calls onPlantClick with the plant when a plant card is clicked', () => {
    const onPlantClick = vi.fn()
    const plant = makePlant('1', 'Fern', 3)
    renderSidebar({ plants: [plant], onPlantClick, onAddPlant: vi.fn() })
    fireEvent.click(screen.getByText('Fern').closest('button'))
    expect(onPlantClick).toHaveBeenCalledWith(plant)
  })

  // ── Water Now ─────────────────────────────────────────────────────────────

  it('shows a water button on each card when onWater is provided', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onWater: vi.fn() })
    expect(screen.getAllByRole('button', { name: /mark .+ as watered/i })).toHaveLength(2)
  })

  it('calls onWater with the plant id when the water button is clicked', () => {
    const onWater = vi.fn()
    const plant = makePlant('1', 'Fern', 3)
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn(), onWater })
    fireEvent.click(screen.getByRole('button', { name: /mark .+ as watered/i }))
    expect(onWater).toHaveBeenCalledWith(plant.id)
  })

  it('does not show water buttons when onWater is not provided', () => {
    const plant = makePlant('1', 'Fern', 3)
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.queryByRole('button', { name: /mark .+ as watered/i })).not.toBeInTheDocument()
  })

  // ── Search + filter ───────────────────────────────────────────────────────

  it('shows a search input when there are plants', () => {
    renderSidebar({ plants: [makePlant('1', 'Fern', 3)], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByPlaceholderText(/search plants/i)).toBeInTheDocument()
  })

  it('does not show the search input when there are no plants', () => {
    renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.queryByPlaceholderText(/search plants/i)).not.toBeInTheDocument()
  })

  it('filters plants by name when a search term is typed', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'Fern' } })
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.queryByText('Cactus')).not.toBeInTheDocument()
  })

  it('filters plants by species (case-insensitive)', () => {
    const p1 = { ...makePlant('1', 'Plant A', 3), species: 'Nephrolepis' }
    const p2 = { ...makePlant('2', 'Plant B', 0), species: 'Mammillaria' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'nephrole' } })
    expect(screen.getByText('Plant A')).toBeInTheDocument()
    expect(screen.queryByText('Plant B')).not.toBeInTheDocument()
  })

  it('shows room filter chips when plants have multiple rooms', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByRole('button', { name: 'Living Room' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kitchen' })).toBeInTheDocument()
  })

  it('does not show room chips when all plants are in one room', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    // makePlant defaults room to 'Living Room' — only 1 unique room
    expect(screen.queryByRole('button', { name: 'Living Room' })).not.toBeInTheDocument()
  })

  it('filters plants to the selected room when a chip is clicked', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('deselects the room filter when the active chip is clicked again', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('updates summary counts to reflect the filtered subset', () => {
    const p1 = { ...makePlant('1', 'Overdue Plant', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Good Plant', -5), room: 'Kitchen' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.queryByText(/1 overdue/i)).not.toBeInTheDocument()
    expect(screen.getByText(/1 good/i)).toBeInTheDocument()
  })

  it('shows "No plants match" when no plants match the current search', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'xyz not found' } })
    expect(screen.getByText(/no plants match/i)).toBeInTheDocument()
  })

  it('shows filtered count in header when a filter is active', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    renderSidebar({ plants: [p1, p2], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.getByText(/1 \/ 2 plants/i)).toBeInTheDocument()
  })

  // ── Weather (moved to Header) ──────────────────────────────────────────────

  it('renders without crashing when weather is provided', () => {
    expect(() => renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant: vi.fn(), weather: mockWeather })).not.toThrow()
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when weather is not provided', () => {
    expect(() =>
      renderSidebar({ plants: [], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    ).not.toThrow()
  })

  it('renders without crashing when onAddPlant is not provided', () => {
    expect(() =>
      renderSidebar({ plants: [], onPlantClick: vi.fn() })
    ).not.toThrow()
  })

  // ── Card design (Issue #87) ───────────────────────────────────────────────

  it('renders a colour bar on each plant card', () => {
    const plant = makePlant('1', 'Fern', 3)
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    const card = screen.getByText('Fern').closest('[style]')
    expect(card.style.borderTop).toContain('3px solid')
  })

  it('renders health badge on the card', () => {
    const plant = { ...makePlant('1', 'Fern', 3), health: 'Good' }
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  it('renders maturity badge on the card when maturity is set', () => {
    const plant = { ...makePlant('1', 'Fern', 3), maturity: 'Seedling' }
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.getByText('Seedling')).toBeInTheDocument()
  })

  it('does not render maturity badge when plant has no maturity', () => {
    const plant = makePlant('1', 'Fern', 3)
    renderSidebar({ plants: [plant], onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.queryByText(/seedling|young|mature|established/i)).not.toBeInTheDocument()
  })

  // ── Batch watering (Issue #92) ────────────────────────────────────────────

  it('shows a Select button when onBatchWater is provided', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument()
  })

  it('does not show Select button when onBatchWater is not provided', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn() })
    expect(screen.queryByRole('button', { name: /^select$/i })).not.toBeInTheDocument()
  })

  it('entering select mode shows batch action bar', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /water selected/i })).toBeInTheDocument()
  })

  it('clicking a card in select mode toggles selection instead of opening modal', () => {
    const onPlantClick = vi.fn()
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick, onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.click(screen.getByText('Fern').closest('button'))
    expect(onPlantClick).not.toHaveBeenCalled()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('Water Selected calls onBatchWater with selected plant IDs', async () => {
    const onBatchWater = vi.fn().mockResolvedValue(1)
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.click(screen.getByText('Fern').closest('button'))
    fireEvent.click(screen.getByRole('button', { name: /water selected/i }))
    await waitFor(() => expect(onBatchWater).toHaveBeenCalledWith(['1']))
  })

  it('Select All selects all filtered plants', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.click(screen.getByText('Select All'))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('Deselect All clears selection', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.click(screen.getByText('Fern').closest('button'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Deselect All'))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })

  it('exiting select mode clears selection', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onBatchWater: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    fireEvent.click(screen.getByText('Fern').closest('button'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
  })

  it('hides individual water buttons in select mode', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    renderSidebar({ plants, onPlantClick: vi.fn(), onAddPlant: vi.fn(), onWater: vi.fn(), onBatchWater: vi.fn() })
    expect(screen.getByRole('button', { name: /mark .+ as watered/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    expect(screen.queryByRole('button', { name: /mark .+ as watered/i })).not.toBeInTheDocument()
  })
})
