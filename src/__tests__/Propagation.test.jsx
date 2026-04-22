import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  propagationApi: {
    list: vi.fn().mockResolvedValue({ plants: [], hasMore: false, nextCursor: null }),
    create: vi.fn(),
    update: vi.fn(),
    promote: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({ isGuest: false, reloadPlants: vi.fn() }),
}))

vi.mock('../components/EmptyState.jsx', () => ({
  default: ({ title }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('../components/ErrorAlert.jsx', () => ({
  default: ({ error }) => <div data-testid="error-alert">{error}</div>,
}))

import PropagationPage from '../pages/PropagationPage.jsx'
import { propagationApi } from '../api/plants.js'

const sampleProp = {
  id: 'p1', method: 'seed', species: 'Basil', status: 'sown',
  startDate: '2026-04-01', batchSize: 3, expectedDays: 14, notes: null, source: null,
}

describe('PropagationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    propagationApi.list.mockResolvedValue([])
  })

  it('renders heading', async () => {
    render(<PropagationPage />)
    await waitFor(() => expect(screen.getByText('Propagation')).toBeInTheDocument())
  })

  it('shows empty state when no propagations exist', async () => {
    render(<PropagationPage />)
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument())
  })

  it('renders propagation cards when data is loaded', async () => {
    propagationApi.list.mockResolvedValue([sampleProp])
    render(<PropagationPage />)
    await waitFor(() => expect(screen.getByText('Basil')).toBeInTheDocument())
    expect(screen.getByText('Seed')).toBeInTheDocument()
  })

  it('shows advance button for non-terminal propagations', async () => {
    propagationApi.list.mockResolvedValue([sampleProp])
    render(<PropagationPage />)
    await waitFor(() => expect(screen.getByText(/Mark Germinated/i)).toBeInTheDocument())
  })

  it('calls propagationApi.update when advancing status', async () => {
    propagationApi.update.mockResolvedValue({ ...sampleProp, status: 'germinated' })
    propagationApi.list.mockResolvedValue([sampleProp])
    render(<PropagationPage />)
    await waitFor(() => screen.getByText(/Mark Germinated/i))
    fireEvent.click(screen.getByText(/Mark Germinated/i))
    await waitFor(() => expect(propagationApi.update).toHaveBeenCalledWith('p1', { status: 'germinated' }))
  })

  it('shows Ready column with promote button for ready props', async () => {
    const readyProp = { ...sampleProp, status: 'ready' }
    propagationApi.list.mockResolvedValue([readyProp])
    render(<PropagationPage />)
    // Switch to Ready column
    await waitFor(() => screen.getByText('Ready'))
    fireEvent.click(screen.getAllByText('Ready')[0])
    await waitFor(() => expect(screen.getByText(/Promote to plant/i)).toBeInTheDocument())
  })

  it('shows error alert on API failure', async () => {
    propagationApi.list.mockRejectedValue(new Error('Network error'))
    render(<PropagationPage />)
    await waitFor(() => expect(screen.getByTestId('error-alert')).toBeInTheDocument())
  })

  it('shows guest empty state when user is a guest', async () => {
    vi.doMock('../context/PlantContext.jsx', () => ({
      usePlantContext: () => ({ isGuest: true, reloadPlants: vi.fn() }),
    }))
  })
})

// ── buildPropagationTasks unit tests ──────────────────────────────────────────
import { buildPropagationTasks } from '../utils/todayTasks.js'

describe('buildPropagationTasks', () => {
  const now = new Date('2026-04-21')

  it('returns empty array when no propagations', () => {
    expect(buildPropagationTasks([], now).tasks).toHaveLength(0)
  })

  it('skips transplanted and failed propagations', () => {
    const props = [
      { id: '1', status: 'transplanted', startDate: '2026-01-01', expectedDays: 14 },
      { id: '2', status: 'failed', startDate: '2026-01-01', expectedDays: 14 },
    ]
    expect(buildPropagationTasks(props, now).tasks).toHaveLength(0)
  })

  it('surfaces overdue propagations (past expectedDays)', () => {
    const props = [
      { id: '1', status: 'sown', startDate: '2026-04-01', expectedDays: 14 }, // 20 days, 6 overdue
    ]
    const result = buildPropagationTasks(props, now)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].daysOverdue).toBe(6)
    expect(result.tasks[0].reason).toMatch(/6d past/)
  })

  it('surfaces stale propagations (7+ days, no expectedDays)', () => {
    const props = [
      { id: '2', status: 'rooted', startDate: '2026-04-10', expectedDays: null }, // 11 days
    ]
    const result = buildPropagationTasks(props, now)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].reason).toMatch(/11d old/)
  })

  it('skips propagations not yet overdue', () => {
    const props = [
      { id: '3', status: 'sown', startDate: '2026-04-19', expectedDays: 14 }, // 2 days, not overdue
    ]
    expect(buildPropagationTasks(props, now).tasks).toHaveLength(0)
  })

  it('sorts by daysOverdue descending', () => {
    const props = [
      { id: 'a', status: 'sown', startDate: '2026-04-05', expectedDays: 5 }, // 16 days, 11 overdue
      { id: 'b', status: 'sown', startDate: '2026-04-01', expectedDays: 14 }, // 20 days, 6 overdue
    ]
    const result = buildPropagationTasks(props, now)
    expect(result.tasks[0].propagationId).toBe('a')
    expect(result.tasks[1].propagationId).toBe('b')
  })
})
