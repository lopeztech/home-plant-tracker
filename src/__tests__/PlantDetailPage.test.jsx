import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

let plantContextValue

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => plantContextValue,
}))

// PlantModal pulls in heavyweight modules (charts, image upload, sub-tabs).
// Stub it for a focused page-level test.
vi.mock('../components/PlantModal.jsx', () => ({
  default: ({ embedded, plant }) => (
    <div data-testid="plant-modal" data-embedded={String(embedded)} data-plant-id={plant?.id} />
  ),
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
})
