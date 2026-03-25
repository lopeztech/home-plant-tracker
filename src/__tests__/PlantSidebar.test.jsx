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
