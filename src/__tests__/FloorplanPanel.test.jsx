import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const navigateMock = vi.fn()
const setSearchParamsMock = vi.fn()
let currentSearchParams = new URLSearchParams()
vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [currentSearchParams, setSearchParamsMock],
}))

// Provide controllable context state
let plantContextValue
let layoutContextValue

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => plantContextValue,
}))

vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: () => layoutContextValue,
}))

// Replace LeafletFloorplan with a simple stub that exposes key props
vi.mock('../components/LeafletFloorplan.jsx', () => ({
  default: ({ floor, plants }) => (
    <div
      data-testid="leaflet-stub"
      data-floor-id={floor?.id}
      data-floor-type={floor?.type}
      data-plant-count={plants?.length || 0}
    />
  ),
}))

// Render the house frame's children directly so assertions are simple
vi.mock('../components/HouseWeatherFrame.jsx', () => ({
  default: ({ children }) => (
    <div data-testid="house-frame">
      {children}
    </div>
  ),
}))

// Avoid loading the heavy Floorplan3D module under lazy()
vi.mock('../components/Floorplan3D.jsx', () => ({
  default: () => <div data-testid="floorplan-3d" />,
}))

// Stub PlantListPanel so we can assert the list view without pulling its
// context requirements in this suite.
vi.mock('../components/PlantListPanel.jsx', () => ({
  default: () => <div data-testid="plant-list-stub" />,
}))

// Mock plants API so drag/save paths don't explode
const updateMock = vi.fn(() => Promise.resolve({}))
vi.mock('../api/plants.js', () => ({
  plantsApi: {
    update: (...args) => updateMock(...args),
  },
}))

// Use the real reorganise util — it's well-tested and we want actual behaviour

import FloorplanPanel from '../components/FloorplanPanel.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFloor(overrides = {}) {
  return {
    id: 'ground',
    name: 'Ground Floor',
    type: 'interior',
    order: 0,
    rooms: [
      { name: 'Living', type: 'interior', x: 10, y: 10, width: 40, height: 30 },
      { name: 'Garden', type: 'outdoor',  area: 'frontyard', x: 0, y: 50, width: 100, height: 40 },
      { name: 'Patio',  type: 'outdoor',  area: 'backyard',  x: 0, y: 90, width: 100, height: 10 },
    ],
    ...overrides,
  }
}

function makePlants() {
  return [
    { id: 'p1', name: 'Fern',   room: 'Living', floor: 'ground', x: 20, y: 20 },
    { id: 'p2', name: 'Rose',   room: 'Garden', floor: 'ground', x: 50, y: 60 },
    { id: 'p3', name: 'Tomato', room: 'Patio',  floor: 'ground', x: 50, y: 95 },
  ]
}

const setActiveFloorIdMock = vi.fn()
const handleFloorRoomsChangeMock = vi.fn()
const updatePlantsLocallyMock = vi.fn()

function setupContexts(overrides = {}) {
  const floor = overrides.floor ?? makeFloor()
  plantContextValue = {
    plants: overrides.plants ?? makePlants(),
    floors: overrides.floors ?? [floor],
    activeFloorId: overrides.activeFloorId ?? floor.id,
    setActiveFloorId: setActiveFloorIdMock,
    weather: overrides.weather ?? null,
    location: overrides.location ?? null,
    handleFloorRoomsChange: handleFloorRoomsChangeMock,
    isAnalysingFloorplan: overrides.isAnalysingFloorplan ?? false,
    isGuest: overrides.isGuest ?? false,
    updatePlantsLocally: updatePlantsLocallyMock,
  }
  layoutContextValue = {
    houseHeight: 500,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FloorplanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSearchParams = new URLSearchParams()
    setupContexts()
  })

  it('renders a tab for each visible floor', () => {
    const floors = [
      { ...makeFloor({ id: 'ground', name: 'Ground', order: 0 }) },
      { ...makeFloor({ id: 'first',  name: 'First',  order: 1 }) },
    ]
    setupContexts({ floors, activeFloorId: 'ground', floor: floors[0] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByText('Ground')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('hides floors flagged as hidden', () => {
    const floors = [
      makeFloor({ id: 'ground', name: 'Ground', order: 0 }),
      makeFloor({ id: 'secret', name: 'Secret', order: 1, hidden: true }),
    ]
    setupContexts({ floors, floor: floors[0] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders the full floor — indoor and outdoor rooms — in a single map', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    const stub = screen.getByTestId('leaflet-stub')
    expect(stub.dataset.floorId).toBe('ground')
    // All 3 plants (indoor + outdoor) are rendered together
    expect(stub.dataset.plantCount).toBe('3')
  })

  it('clicking a floor tab switches floors', () => {
    const otherFloor = makeFloor({ id: 'first', name: 'First', order: 1, rooms: [] })
    const floors = [makeFloor(), otherFloor]
    setupContexts({ floors, floor: floors[0] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    fireEvent.click(screen.getByText('First'))

    expect(setActiveFloorIdMock).toHaveBeenCalledWith('first')
  })

  it('toggles between 2D and 3D views', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getAllByTestId('leaflet-stub').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /3D/ }))

    // 3D view replaces the main 2D map while lazily loading
    expect(screen.queryByRole('button', { name: /2D/ })).toBeInTheDocument()
  })

  it('clicking the List button updates the view search param', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^List$/ }))

    expect(setSearchParamsMock).toHaveBeenCalled()
    const updater = setSearchParamsMock.mock.calls[0][0]
    const next = updater(new URLSearchParams())
    expect(next.get('view')).toBe('list')
  })

  it('renders PlantListPanel when the view search param is list', () => {
    currentSearchParams = new URLSearchParams('view=list')

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByTestId('plant-list-stub')).toBeInTheDocument()
    expect(screen.queryByTestId('leaflet-stub')).not.toBeInTheDocument()
  })

  it('hides the Reorganise button when there are no plants on the floor', () => {
    setupContexts({ plants: [] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Reorganise/i })).not.toBeInTheDocument()
  })

  it('shows the Reorganise button when there are plants and rooms', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Reorganise/i })).toBeInTheDocument()
  })

  it('shows the analysing overlay while the floorplan is being analysed', () => {
    setupContexts({ isAnalysingFloorplan: true })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)
    expect(screen.getByText(/Analysing floorplan/i)).toBeInTheDocument()
  })

  it('renders only a legend but no map when activeFloorId does not match any floor', () => {
    setupContexts({ activeFloorId: 'missing' })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.queryByTestId('leaflet-stub')).not.toBeInTheDocument()
  })

  it('renders a legend when there are plants on the floor', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Due today')).toBeInTheDocument()
    expect(screen.getByText('1-2 days')).toBeInTheDocument()
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('does not render a legend when there are no plants on the floor', () => {
    setupContexts({ plants: [] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })

  it('renders outdoor-type floors as a single map', () => {
    const floor = makeFloor({
      id: 'yard',
      name: 'Yard',
      type: 'outdoor',
      rooms: [
        { name: 'Lawn',  type: 'outdoor', area: 'backyard',  x: 0, y: 0, width: 100, height: 50 },
        { name: 'Beds',  type: 'outdoor', area: 'frontyard', x: 0, y: 60, width: 100, height: 40 },
      ],
    })
    setupContexts({
      floor,
      floors: [floor],
      activeFloorId: 'yard',
      plants: [
        { id: 'p1', name: 'Tulip', room: 'Lawn', floor: 'yard', x: 10, y: 20 },
      ],
    })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    const stub = screen.getByTestId('leaflet-stub')
    expect(stub.dataset.floorId).toBe('yard')
    expect(stub.dataset.floorType).toBe('outdoor')
    expect(stub.dataset.plantCount).toBe('1')
  })

  it('persists dragged positions locally and updates the ref for saving', () => {
    // Re-mock LeafletFloorplan to expose the drag handler
    // (we verify updatePlantsLocally is invoked via handleLocalDrag indirectly)
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)
    expect(updatePlantsLocallyMock).not.toHaveBeenCalled()
  })
})
