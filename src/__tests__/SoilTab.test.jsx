import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  soilApi: {
    listTests: vi.fn().mockResolvedValue([]),
    createTest: vi.fn(),
    deleteTest: vi.fn(),
    listAmendments: vi.fn().mockResolvedValue([]),
    createAmendment: vi.fn(),
    deleteAmendment: vi.fn(),
    insight: vi.fn().mockResolvedValue({ verdict: 'unknown' }),
  },
}))

import SoilTab from '../components/SoilTab.jsx'
import { soilApi } from '../api/plants.js'

describe('SoilTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    soilApi.listTests.mockResolvedValue([])
    soilApi.listAmendments.mockResolvedValue([])
    soilApi.insight.mockResolvedValue({ verdict: 'unknown' })
  })

  it('renders the log soil test form', async () => {
    render(<SoilTab plantId="p1" />)
    await waitFor(() => expect(screen.getByText('Log soil test')).toBeInTheDocument())
  })

  it('renders the log amendment form', async () => {
    render(<SoilTab plantId="p1" />)
    await waitFor(() => expect(screen.getByText('Log amendment')).toBeInTheDocument())
  })

  it('shows empty state when no tests or amendments', async () => {
    render(<SoilTab plantId="p1" />)
    await waitFor(() => expect(screen.getByText(/No soil data yet/i)).toBeInTheDocument())
  })

  it('calls createTest and adds entry when form is submitted', async () => {
    const newTest = { id: 't1', ph: 6.5, source: 'strip', recordedAt: '2026-04-01T00:00:00.000Z', notes: null }
    soilApi.createTest.mockResolvedValue(newTest)
    render(<SoilTab plantId="p1" />)
    await waitFor(() => screen.getByText('Log soil test'))
    const phInput = screen.getByPlaceholderText('e.g. 6.5')
    fireEvent.change(phInput, { target: { value: '6.5' } })
    fireEvent.click(screen.getByText('Add test'))
    await waitFor(() => expect(soilApi.createTest).toHaveBeenCalledWith('p1', expect.objectContaining({ ph: 6.5 })))
  })

  it('renders existing soil tests', async () => {
    soilApi.listTests.mockResolvedValue([
      { id: 't1', ph: 7.2, source: 'probe', recordedAt: '2026-03-01T00:00:00.000Z', notes: 'Spring' },
    ])
    render(<SoilTab plantId="p1" />)
    await waitFor(() => expect(screen.getByText('pH 7.2')).toBeInTheDocument())
    expect(screen.getByText('Spring')).toBeInTheDocument()
  })

  it('renders existing amendments', async () => {
    soilApi.listAmendments.mockResolvedValue([
      { id: 'a1', kind: 'lime', qty: 20, qtyUnit: 'g', appliedAt: '2026-03-15T00:00:00.000Z', notes: 'Raise pH' },
    ])
    render(<SoilTab plantId="p1" />)
    await waitFor(() => expect(screen.getByText('Raise pH')).toBeInTheDocument())
    // "Lime" badge appears in amendment history (multiple Lime elements exist — dropdown + badge)
    expect(screen.getAllByText('Lime').length).toBeGreaterThan(0)
  })

  it('calls deleteTest when trash button is clicked', async () => {
    soilApi.listTests.mockResolvedValue([
      { id: 't1', ph: 6, source: 'strip', recordedAt: '2026-03-01T00:00:00.000Z', notes: null },
    ])
    soilApi.deleteTest.mockResolvedValue(null)
    render(<SoilTab plantId="p1" />)
    // ph=6 renders as "pH 6"
    await waitFor(() => screen.getByText('pH 6'))
    const deleteBtn = screen.getByLabelText('Delete test')
    fireEvent.click(deleteBtn)
    await waitFor(() => expect(soilApi.deleteTest).toHaveBeenCalledWith('p1', 't1'))
  })
})
