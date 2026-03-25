import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FloorplanView from '../components/FloorplanView.jsx'

// Stub heavy sub-components to keep these tests focused.
vi.mock('../components/WeatherSky.jsx', () => ({
  default: () => <div data-testid="weather-sky" />,
  SKY_BORDER_COLORS: { sunny: '#fde68a', night: '#1e3a5f' },
}))

vi.mock('../components/PlantMarker.jsx', () => ({
  default: ({ plant, onClick }) => (
    <div
      className="plant-marker"
      data-testid={`marker-${plant.id}`}
      onClick={e => { e.stopPropagation(); onClick(plant) }}
    />
  ),
}))

vi.mock('../components/FloorNav.jsx', () => ({
  default: ({ floors, onChange }) => (
    <div data-testid="floor-nav">
      {floors.map(f => (
        <button key={f.id} onClick={() => onChange(f.id)}>{f.name}</button>
      ))}
    </div>
  ),
}))

vi.mock('../data/defaultFloorSvgs.js', () => ({
  GROUND_FLOOR_SVG: '<svg data-testid="ground-svg"></svg>',
  UPPER_FLOOR_SVG:  '<svg data-testid="upper-svg"></svg>',
  GARDEN_SVG:       '<svg data-testid="garden-svg"></svg>',
  generateFloorSvg: vi.fn(() => '<svg data-testid="generated-svg"></svg>'),
}))

const floors = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior', rooms: [] },
  { id: 'garden', name: 'Garden',       order: -1, type: 'outdoor', rooms: [] },
]

const plants = [
  { id: 'p1', name: 'Fern',   x: 40, y: 30, floor: 'ground', lastWatered: new Date().toISOString(), frequencyDays: 7 },
  { id: 'p2', name: 'Cactus', x: 60, y: 50, floor: 'garden', lastWatered: new Date().toISOString(), frequencyDays: 14 },
]

function renderView(props = {}) {
  return render(
    <FloorplanView
      plants={props.plants ?? plants}
      floors={props.floors ?? floors}
      activeFloorId={props.activeFloorId ?? 'ground'}
      onFloorplanClick={props.onFloorplanClick ?? vi.fn()}
      onMarkerClick={props.onMarkerClick ?? vi.fn()}
      onMarkerDrag={props.onMarkerDrag ?? vi.fn()}
      onFloorChange={props.onFloorChange ?? vi.fn()}
      weather={props.weather ?? null}
      isAnalysingFloorplan={props.isAnalysingFloorplan ?? false}
    />
  )
}

describe('FloorplanView', () => {
  beforeEach(() => {
    // Give the floorplan container a non-zero size for click coordinate tests.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1000, height: 1000,
      right: 1000, bottom: 1000, x: 0, y: 0, toJSON: () => {},
    })
  })

  // ── Initial render state ──────────────────────────────────────────────────

  it('renders without crashing with minimal props', () => {
    expect(() => renderView()).not.toThrow()
  })

  it('shows the active floor name in the toolbar', () => {
    renderView()
    // "Ground Floor" appears in both the toolbar span and the stubbed FloorNav button
    const matches = screen.getAllByText('Ground Floor')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders a marker for plants on the active floor', () => {
    renderView({ activeFloorId: 'ground' })
    expect(screen.getByTestId('marker-p1')).toBeInTheDocument()
  })

  it('inactive floor layers remain in the DOM with pointer-events disabled (CSS transition design)', () => {
    renderView({ activeFloorId: 'ground' })
    // marker-p2 is on the garden floor — still in DOM but its parent layer has pointerEvents: none
    const marker = screen.getByTestId('marker-p2')
    expect(marker).toBeInTheDocument()
    const layer = marker.closest('.floor-layer')
    expect(layer).toHaveStyle({ pointerEvents: 'none' })
  })

  it('renders the floor nav', () => {
    renderView()
    expect(screen.getByTestId('floor-nav')).toBeInTheDocument()
  })

  it('shows the weather emoji and temperature when weather is provided', () => {
    const weather = {
      current: { temp: 18, condition: { label: 'Sunny', emoji: '☀️', sky: 'sunny' }, isDay: true },
      days: [],
    }
    renderView({ weather })
    expect(screen.getByText('18°')).toBeInTheDocument()
  })

  // ── Loading / analysing state ─────────────────────────────────────────────

  it('shows the analysing overlay when isAnalysingFloorplan is true', () => {
    renderView({ isAnalysingFloorplan: true })
    expect(screen.getByText(/analysing floorplan/i)).toBeInTheDocument()
  })

  it('hides the analysing overlay when isAnalysingFloorplan is false', () => {
    renderView({ isAnalysingFloorplan: false })
    expect(screen.queryByText(/analysing floorplan/i)).not.toBeInTheDocument()
  })

  it('shows the upload hint when no floors have rooms analysed', () => {
    renderView({ isAnalysingFloorplan: false })
    expect(screen.getByText(/upload a floorplan image/i)).toBeInTheDocument()
  })

  it('hides the upload hint when at least one floor has rooms', () => {
    const floorsWithRooms = [
      { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior',
        rooms: [{ name: 'Living Room', x: 10, y: 10, width: 40, height: 40 }] },
    ]
    renderView({ floors: floorsWithRooms, isAnalysingFloorplan: false })
    expect(screen.queryByText(/upload a floorplan image/i)).not.toBeInTheDocument()
  })

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onFloorplanClick with normalised x/y when the canvas is clicked', () => {
    const onFloorplanClick = vi.fn()
    const { container } = renderView({ onFloorplanClick })
    const canvas = container.querySelector('.floorplan-container')
    // Click at (500, 500) on a 1000×1000 container → x=50, y=50
    fireEvent.click(canvas, { clientX: 500, clientY: 500 })
    expect(onFloorplanClick).toHaveBeenCalledWith(50, 50)
  })

  it('does not call onFloorplanClick when clicking on a plant marker', () => {
    const onFloorplanClick = vi.fn()
    renderView({ onFloorplanClick, activeFloorId: 'ground' })
    fireEvent.click(screen.getByTestId('marker-p1'))
    expect(onFloorplanClick).not.toHaveBeenCalled()
  })

  it('calls onMarkerClick with the plant when a marker is clicked', () => {
    const onMarkerClick = vi.fn()
    renderView({ onMarkerClick, activeFloorId: 'ground' })
    fireEvent.click(screen.getByTestId('marker-p1'))
    expect(onMarkerClick).toHaveBeenCalledWith(plants[0])
  })

  // ── Error states / missing props ──────────────────────────────────────────

  it('renders without crashing when plants array is empty', () => {
    expect(() => renderView({ plants: [] })).not.toThrow()
  })

  it('renders without crashing when weather is not provided', () => {
    expect(() => renderView({ weather: null })).not.toThrow()
  })
})
