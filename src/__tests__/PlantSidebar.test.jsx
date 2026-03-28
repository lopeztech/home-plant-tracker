import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlantSidebar from '../components/PlantSidebar.jsx'

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
    render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText(/no plants yet/i)).toBeInTheDocument()
  })

  it('shows the plant count in the header', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', -5)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText('2 plants')).toBeInTheDocument()
  })

  it('renders a card for each plant', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('sorts plants by urgency — overdue plants appear before healthy ones', () => {
    const healthy = makePlant('1', 'Healthy', -10)  // due in 10 days
    const overdue = makePlant('2', 'Overdue', 3)     // 3 days overdue
    render(<PlantSidebar plants={[healthy, overdue]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    const cards = screen.getAllByRole('button', { name: /overdue|healthy/i })
    // The overdue plant should appear first (higher urgency)
    expect(cards[0]).toHaveTextContent('Overdue')
    expect(cards[1]).toHaveTextContent('Healthy')
  })

  it('shows an "overdue" summary pill when there are overdue plants', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument()
  })

  it('shows a "today" summary pill when a plant is due today', () => {
    const plants = [makePlant('1', 'Fern', 0)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText(/1 today/i)).toBeInTheDocument()
  })

  it('renders the Add Plant button', () => {
    render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add plant/i })).toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onAddPlant when the Add Plant button is clicked', () => {
    const onAddPlant = vi.fn()
    render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} onAddPlant={onAddPlant} />)
    fireEvent.click(screen.getByRole('button', { name: /add plant/i }))
    expect(onAddPlant).toHaveBeenCalledOnce()
  })

  it('calls onPlantClick with the plant when a plant card is clicked', () => {
    const onPlantClick = vi.fn()
    const plant = makePlant('1', 'Fern', 3)
    render(<PlantSidebar plants={[plant]} onPlantClick={onPlantClick} onAddPlant={vi.fn()} />)
    fireEvent.click(screen.getByText('Fern').closest('button'))
    expect(onPlantClick).toHaveBeenCalledWith(plant)
  })

  // ── Water Now (issue #5) ──────────────────────────────────────────────────

  it('shows a water button on each card when onWater is provided', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} onWater={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /mark .+ as watered/i })).toHaveLength(2)
  })

  it('calls onWater with the plant id when the water button is clicked', () => {
    const onWater = vi.fn()
    const plant = makePlant('1', 'Fern', 3)
    render(<PlantSidebar plants={[plant]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} onWater={onWater} />)
    fireEvent.click(screen.getByRole('button', { name: /mark .+ as watered/i }))
    expect(onWater).toHaveBeenCalledWith(plant.id)
  })

  it('does not show water buttons when onWater is not provided', () => {
    const plant = makePlant('1', 'Fern', 3)
    render(<PlantSidebar plants={[plant]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /mark .+ as watered/i })).not.toBeInTheDocument()
  })

  // ── Search + filter (issue #6) ────────────────────────────────────────────

  it('shows a search input when there are plants', () => {
    render(<PlantSidebar plants={[makePlant('1', 'Fern', 3)]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search plants/i)).toBeInTheDocument()
  })

  it('does not show the search input when there are no plants', () => {
    render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.queryByPlaceholderText(/search plants/i)).not.toBeInTheDocument()
  })

  it('filters plants by name when a search term is typed', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'Fern' } })
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.queryByText('Cactus')).not.toBeInTheDocument()
  })

  it('filters plants by species (case-insensitive)', () => {
    const p1 = { ...makePlant('1', 'Plant A', 3), species: 'Nephrolepis' }
    const p2 = { ...makePlant('2', 'Plant B', 0), species: 'Mammillaria' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'nephrole' } })
    expect(screen.getByText('Plant A')).toBeInTheDocument()
    expect(screen.queryByText('Plant B')).not.toBeInTheDocument()
  })

  it('shows room filter chips when plants have multiple rooms', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Living Room' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kitchen' })).toBeInTheDocument()
  })

  it('does not show room chips when all plants are in one room', () => {
    const plants = [makePlant('1', 'Fern', 3), makePlant('2', 'Cactus', 0)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    // makePlant defaults room to 'Living Room' — only 1 unique room
    expect(screen.queryByRole('button', { name: 'Living Room' })).not.toBeInTheDocument()
  })

  it('filters plants to the selected room when a chip is clicked', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.queryByText('Fern')).not.toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('deselects the room filter when the active chip is clicked again', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('Cactus')).toBeInTheDocument()
  })

  it('updates summary counts to reflect the filtered subset', () => {
    const p1 = { ...makePlant('1', 'Overdue Plant', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Good Plant', -5), room: 'Kitchen' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.queryByText(/1 overdue/i)).not.toBeInTheDocument()
    expect(screen.getByText(/1 good/i)).toBeInTheDocument()
  })

  it('shows "No plants match" when no plants match the current search', () => {
    const plants = [makePlant('1', 'Fern', 3)]
    render(<PlantSidebar plants={plants} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search plants/i), { target: { value: 'xyz not found' } })
    expect(screen.getByText(/no plants match/i)).toBeInTheDocument()
  })

  it('shows filtered count in header when a filter is active', () => {
    const p1 = { ...makePlant('1', 'Fern', 3), room: 'Living Room' }
    const p2 = { ...makePlant('2', 'Cactus', 0), room: 'Kitchen' }
    render(<PlantSidebar plants={[p1, p2]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Kitchen' }))
    expect(screen.getByText(/1 \/ 2 plants/i)).toBeInTheDocument()
  })

  // ── Weather section ───────────────────────────────────────────────────────

  it('shows current conditions when weather is provided', () => {
    render(
      <PlantSidebar
        plants={[]}
        onPlantClick={vi.fn()}
        onAddPlant={vi.fn()}
        weather={mockWeather}
      />
    )
    // "Sunny" appears in both the current-conditions header and the forecast row
    expect(screen.getAllByText('Sunny').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('22°')).toBeInTheDocument()
  })

  it('shows a rain alert when rain is forecast and there are outdoor plants', () => {
    const outdoorPlant = { ...makePlant('1', 'Rose', 0), room: 'Garden' }
    render(
      <PlantSidebar
        plants={[outdoorPlant]}
        onPlantClick={vi.fn()}
        onAddPlant={vi.fn()}
        weather={mockWeather}
      />
    )
    expect(screen.getByText(/skip watering outdoor plants/i)).toBeInTheDocument()
  })

  it('shows "Enable location" prompt when location is denied', () => {
    render(
      <PlantSidebar
        plants={[]}
        onPlantClick={vi.fn()}
        onAddPlant={vi.fn()}
        locationDenied={true}
      />
    )
    expect(screen.getByText(/enable location/i)).toBeInTheDocument()
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when weather is not provided', () => {
    expect(() =>
      render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    ).not.toThrow()
  })

  it('renders without crashing when onAddPlant is not provided', () => {
    expect(() =>
      render(<PlantSidebar plants={[]} onPlantClick={vi.fn()} />)
    ).not.toThrow()
  })
})
