import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

let plantContextValue
let lastPlantModalProps

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => plantContextValue,
}))

// PlantModal pulls in heavyweight modules (charts, image upload, sub-tabs).
// Stub it for a focused page-level test. Capture last-rendered props so we can
// drive the page → router → modal sync from the test.
vi.mock('../components/PlantModal.jsx', () => ({
  default: (props) => {
    lastPlantModalProps = props
    return (
      <div
        data-testid="plant-modal"
        data-embedded={String(props.embedded)}
        data-plant-id={props.plant?.id}
        data-initial-tab={props.initialTab}
      />
    )
  },
}))

import PlantDetailPage from '../pages/PlantDetailPage.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/plants/:id" element={<PlantDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  plantContextValue = {
    plants: [
      { id: 'p1', name: 'Orange Jasmine', species: 'Murraya paniculata' },
    ],
    plantsLoading: false,
    floors: [],
    activeFloorId: 'ground',
    weather: null,
    handleSavePlant: vi.fn(),
    handleDeletePlant: vi.fn(),
    handleWaterPlant: vi.fn(),
    handleMoisturePlant: vi.fn(),
  }
})

describe('PlantDetailPage', () => {
  it('renders header with back button and breadcrumb to Garden when plant is found', () => {
    renderAt('/plants/p1')
    expect(screen.getByRole('button', { name: /back to garden/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Garden' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Orange Jasmine')).toBeInTheDocument()
  })

  it('renders the embedded PlantModal for the matched plant', () => {
    renderAt('/plants/p1')
    const modal = screen.getByTestId('plant-modal')
    expect(modal).toHaveAttribute('data-embedded', 'true')
    expect(modal).toHaveAttribute('data-plant-id', 'p1')
  })

  it('renders a "not found" empty state when the plant id does not match', () => {
    renderAt('/plants/missing')
    expect(screen.getByText(/plant not found/i)).toBeInTheDocument()
    expect(screen.queryByTestId('plant-modal')).not.toBeInTheDocument()
  })

  it('seeds initialTab from the URL hash when present', () => {
    renderAt('/plants/p1#watering')
    expect(screen.getByTestId('plant-modal')).toHaveAttribute('data-initial-tab', 'watering')
  })

  it('falls back to the edit tab when the hash is unknown or absent', () => {
    renderAt('/plants/p1#bogus')
    expect(screen.getByTestId('plant-modal')).toHaveAttribute('data-initial-tab', 'edit')
  })

  it('attaches a beforeunload handler while dirty and removes it on save', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    renderAt('/plants/p1')
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function))

    act(() => { lastPlantModalProps.onDirtyChange(true) })
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    act(() => { lastPlantModalProps.onDirtyChange(false) })
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
