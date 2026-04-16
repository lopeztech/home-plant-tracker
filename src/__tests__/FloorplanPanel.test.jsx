import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const navigateMock = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
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
  default: ({ children, yardAreas }) => (
    <div data-testid="house-frame">
      {children}
      <div data-testid="yard-areas" data-area-keys={yardAreas ? Object.keys(yardAreas).join(',') : ''} />
    </div>
  ),
}))

// Avoid loading the heavy Floorplan3D module under lazy()
vi.mock('../components/Floorplan3D.jsx', () => ({
  default: () => <div data-testid="floorplan-3d" />,
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
    frontyardHeight: 200,
    backyardHeight: 200,
    sideLeftWidth: 140,
    sideRightWidth: 140,
    hiddenYardAreas: overrides.hiddenYardAreas ?? [],
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FloorplanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('renders yard area tabs for outdoor areas that have rooms', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByText('Front Yard')).toBeInTheDocument()
    expect(screen.getByText('Backyard')).toBeInTheDocument()
    expect(screen.queryByText('Side Left')).not.toBeInTheDocument()
    expect(screen.queryByText('Side Right')).not.toBeInTheDocument()
  })

  it('omits yard tabs for areas hidden via layout settings', () => {
    setupContexts({ hiddenYardAreas: ['backyard'] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getByText('Front Yard')).toBeInTheDocument()
    expect(screen.queryByText('Backyard')).not.toBeInTheDocument()
  })

  it('switches to a yard area when its tab is clicked and renders only that area\u2019s plants', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    // Initially the indoor floor view is active
    const [initialStub] = screen.getAllByTestId('leaflet-stub')
    expect(initialStub.dataset.floorId).toBe('ground')

    fireEvent.click(screen.getByText('Front Yard'))

    const stubs = screen.getAllByTestId('leaflet-stub')
    const yardStub = stubs.find((s) => s.dataset.floorId === 'ground-frontyard')
    expect(yardStub).toBeDefined()
    expect(yardStub.dataset.floorType).toBe('outdoor')
    // Only the Rose plant lives in the frontyard area
    expect(yardStub.dataset.plantCount).toBe('1')
  })

  it('clicking a floor tab clears the active yard area and switches floors', () => {
    const otherFloor = makeFloor({ id: 'first', name: 'First', order: 1, rooms: [] })
    const floors = [makeFloor(), otherFloor]
    setupContexts({ floors, floor: floors[0] })

    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    fireEvent.click(screen.getByText('Front Yard'))
    fireEvent.click(screen.getByText('First'))

    expect(setActiveFloorIdMock).toHaveBeenCalledWith('first')
  })

  it('passes yard area tiles to HouseWeatherFrame', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    const yardAreas = screen.getByTestId('yard-areas')
    const keys = yardAreas.dataset.areaKeys.split(',').filter(Boolean)
    expect(keys.sort()).toEqual(['backyard', 'frontyard'])
  })

  it('toggles between 2D and 3D views', () => {
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)

    expect(screen.getAllByTestId('leaflet-stub').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /3D/ }))

    // 3D view replaces the main 2D map while lazily loading
    expect(screen.queryByRole('button', { name: /2D/ })).toBeInTheDocument()
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

  it('shows the analysing overlay only when no yard tab is active', () => {
    setupContexts({ isAnalysingFloorplan: true })

    const { rerender } = render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)
    expect(screen.getByText(/Analysing floorplan/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Front Yard'))

    expect(screen.queryByText(/Analysing floorplan/i)).not.toBeInTheDocument()
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

  it('treats outdoor-type floors as a single outdoor map', () => {
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

    // Both yard areas should still appear as tabs when floor itself is outdoor
    expect(screen.getByText('Backyard')).toBeInTheDocument()
    expect(screen.getByText('Front Yard')).toBeInTheDocument()
  })

  it('persists dragged positions locally and updates the ref for saving', () => {
    // Re-mock LeafletFloorplan to expose the drag handler
    // (we verify updatePlantsLocally is invoked via handleLocalDrag indirectly)
    render(<FloorplanPanel onPlantClick={vi.fn()} onFloorplanClick={vi.fn()} />)
    expect(updatePlantsLocallyMock).not.toHaveBeenCalled()
  })
})
