import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Leaflet ──────────────────────────────────────────────────────────────
// Leaflet relies on real DOM measurement APIs absent from jsdom.
// We mock the module so the component can mount and we can assert on the calls.

const mockOn = vi.fn()
const mockOff = vi.fn()
const mockRemove = vi.fn()
const mockFitBounds = vi.fn()
const mockGetContainer = vi.fn(() => ({ style: {} }))
const mockClearLayers = vi.fn()
const mockAddTo = vi.fn(function () { return this })
const mockBindTooltip = vi.fn(function () { return this })
const mockSetBounds = vi.fn()
const mockSetLatLng = vi.fn()
const mockGetLatLng = vi.fn(() => ({ lat: 50, lng: 50 }))

function makeLayerGroup() {
  return { addTo: mockAddTo, clearLayers: mockClearLayers }
}

function makeMarker() {
  return {
    addTo: mockAddTo,
    on: mockOn,
    bindTooltip: mockBindTooltip,
    setLatLng: mockSetLatLng,
    getLatLng: mockGetLatLng,
  }
}

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      on: mockOn,
      off: mockOff,
      remove: mockRemove,
      fitBounds: mockFitBounds,
      getContainer: mockGetContainer,
    })),
    control: { zoom: vi.fn(() => ({ addTo: mockAddTo })) },
    CRS: { Simple: {} },
    latLng: vi.fn((lat, lng) => ({ lat, lng })),
    latLngBounds: vi.fn((a, b) => [a, b]),
    layerGroup: vi.fn(makeLayerGroup),
    marker: vi.fn(makeMarker),
    divIcon: vi.fn((opts) => opts),
    rectangle: vi.fn(() => ({
      addTo: mockAddTo,
      bindTooltip: mockBindTooltip,
      setBounds: mockSetBounds,
    })),
    imageOverlay: vi.fn(() => ({ addTo: mockAddTo })),
    DomEvent: { stopPropagation: vi.fn() },
  },
  __esModule: true,
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

// ── Mock watering utility ───────────────────────────────────────────────────
vi.mock('../utils/watering.js', () => ({
  getWateringStatus: vi.fn(() => ({
    color: '#4caf50',
    daysUntil: 3,
    label: 'Water in 3 days',
  })),
}))

import LeafletFloorplan from '../components/LeafletFloorplan.jsx'

// ── Test data ────────────────────────────────────────────────────────────────

const baseFloor = {
  id: 'ground',
  name: 'Ground Floor',
  type: 'interior',
  imageUrl: null,
  rooms: [
    { name: 'Living Room', type: 'interior', x: 10, y: 10, width: 40, height: 30 },
    { name: 'Kitchen',     type: 'interior', x: 55, y: 10, width: 30, height: 25 },
  ],
}

const allFloors = [baseFloor]

const plants = [
  { id: 'p1', name: 'Fern',    species: 'Nephrolepis', x: 25, y: 20, frequencyDays: 7 },
  { id: 'p2', name: 'Cactus',  species: 'Opuntia',     x: 60, y: 15, frequencyDays: 14 },
]

const weather = { temp: 22, humidity: 60, condition: 'clear' }

const defaultProps = {
  floor: baseFloor,
  floors: allFloors,
  plants,
  weather,
  onFloorplanClick: vi.fn(),
  onMarkerClick: vi.fn(),
  onMarkerDrag: vi.fn(),
  editMode: false,
  onRoomsChange: vi.fn(),
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LeafletFloorplan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<LeafletFloorplan {...defaultProps} />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('initialises a Leaflet map on mount', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} />)
    expect(L.map).toHaveBeenCalled()
    expect(mockFitBounds).toHaveBeenCalled()
  })

  it('creates layer groups for rooms, images, markers, and editing', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} />)
    // 4 layer groups: room, image, marker, edit
    expect(L.layerGroup).toHaveBeenCalledTimes(4)
  })

  it('renders room rectangles for each visible room', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} />)
    // 2 rooms in baseFloor
    expect(L.rectangle).toHaveBeenCalledTimes(2)
  })

  it('skips hidden rooms', async () => {
    const L = (await import('leaflet')).default
    const floorWithHidden = {
      ...baseFloor,
      rooms: [
        ...baseFloor.rooms,
        { name: 'Hidden', type: 'interior', x: 0, y: 0, width: 10, height: 10, hidden: true },
      ],
    }
    render(<LeafletFloorplan {...defaultProps} floor={floorWithHidden} />)
    // Still only 2 rectangles (hidden one skipped)
    expect(L.rectangle).toHaveBeenCalledTimes(2)
  })

  it('renders an image overlay when floor has an imageUrl', async () => {
    const L = (await import('leaflet')).default
    const floorWithImage = { ...baseFloor, imageUrl: 'https://example.com/plan.jpg' }
    render(<LeafletFloorplan {...defaultProps} floor={floorWithImage} />)
    expect(L.imageOverlay).toHaveBeenCalledWith(
      'https://example.com/plan.jpg',
      expect.anything(),
      expect.objectContaining({ opacity: 0.9 }),
    )
  })

  it('does not render image overlay when floor has no imageUrl', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} />)
    expect(L.imageOverlay).not.toHaveBeenCalled()
  })

  it('creates a marker for each plant', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} />)
    // 2 plants → 2 markers
    expect(L.marker).toHaveBeenCalledTimes(2)
  })

  it('binds tooltips to plant markers', () => {
    render(<LeafletFloorplan {...defaultProps} />)
    // Each marker gets bindTooltip called
    expect(mockBindTooltip).toHaveBeenCalled()
  })

  it('does not show the pending room modal by default', () => {
    render(<LeafletFloorplan {...defaultProps} />)
    expect(screen.queryByText('Name this zone')).not.toBeInTheDocument()
  })

  it('renders with empty plants array', async () => {
    const L = (await import('leaflet')).default
    render(<LeafletFloorplan {...defaultProps} plants={[]} />)
    // No plant markers created
    const markerCallsBeforeMount = L.marker.mock.calls.length
    expect(markerCallsBeforeMount).toBe(0)
  })

  it('renders with empty rooms array', async () => {
    const L = (await import('leaflet')).default
    const emptyFloor = { ...baseFloor, rooms: [] }
    render(<LeafletFloorplan {...defaultProps} floor={emptyFloor} />)
    expect(L.rectangle).not.toHaveBeenCalled()
  })

  it('cleans up the map on unmount', () => {
    const { unmount } = render(<LeafletFloorplan {...defaultProps} />)
    unmount()
    expect(mockRemove).toHaveBeenCalled()
  })
})
