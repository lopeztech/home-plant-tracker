import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// PlantContext is the only external dep PlantListPanel relies on.
const handleWaterPlantMock = vi.fn()
const handleBatchWaterMock = vi.fn()

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    plants: [
      {
        id: 'p1',
        name: 'Monstera',
        species: 'Monstera deliciosa',
        room: 'Kitchen',
        floor: 'ground',
        frequencyDays: 7,
        lastWatered: new Date().toISOString(),
        health: 'Good',
      },
    ],
    floors: [{ id: 'ground', name: 'Ground', rooms: [{ name: 'Kitchen' }] }],
    activeFloorId: 'ground',
    weather: null,
    handleWaterPlant: handleWaterPlantMock,
    handleBatchWater: handleBatchWaterMock,
    plantsLoading: false,
  }),
}))

vi.mock('../api/plants.js', () => ({
  plantsApi: { recalculateFrequencies: vi.fn(), update: vi.fn() },
  recommendApi: { get: vi.fn(), getWatering: vi.fn() },
}))

import PlantListPanel from '../components/PlantListPanel.jsx'

describe('PlantListPanel accessibility', () => {
  it('exposes the per-plant water action as a labelled button', () => {
    render(<PlantListPanel onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    const waterBtn = screen.getByRole('button', { name: /^water monstera$/i })
    expect(waterBtn).toBeInTheDocument()
    // Must be a real <button>, not a span, so keyboard + screen readers work.
    expect(waterBtn.tagName).toBe('BUTTON')
  })

  it('clicking the water button invokes handleWaterPlant without triggering the row', () => {
    render(<PlantListPanel onPlantClick={vi.fn()} onAddPlant={vi.fn()} />)
    const waterBtn = screen.getByRole('button', { name: /^water monstera$/i })
    waterBtn.click()
    expect(handleWaterPlantMock).toHaveBeenCalledWith('p1')
  })
})
