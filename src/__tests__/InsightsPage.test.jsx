import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-apexcharts', () => ({
  default: ({ type }) => <div data-testid="apex-chart" data-type={type} />,
}))

vi.mock('../components/UpgradePrompt.jsx', () => ({
  default: ({ children }) => <div data-testid="upgrade-prompt">{children}</div>,
}))

vi.mock('../components/EmptyState.jsx', () => ({
  default: ({ title }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('../components/Skeleton.jsx', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
  SkeletonRect: () => <div data-testid="skeleton-rect" />,
}))

vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: vi.fn(),
}))

vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: vi.fn(),
}))

vi.mock('../api/plants.js', () => ({
  plantsApi: {
    careScores: vi.fn(),
    wateringPattern: vi.fn(),
    healthPrediction: vi.fn(),
    anomaly: vi.fn(),
    wateringRecommendation: vi.fn(),
    seasonalAdjustment: vi.fn(),
    speciesCluster: vi.fn(),
  },
}))

import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import { plantsApi } from '../api/plants.js'
import InsightsPage from '../pages/InsightsPage.jsx'

const MOCK_CARE_SCORES = [
  {
    plantId: 'p1',
    name: 'Monstera',
    species: 'Monstera deliciosa',
    score: 82,
    grade: 'B',
    dimensions: { consistency: 80, timing: 85, healthOutcome: 80, responsiveness: 70 },
  },
  {
    plantId: 'p2',
    name: 'Snake Plant',
    species: 'Sansevieria',
    score: 42,
    grade: 'F',
    dimensions: { consistency: 40, timing: 40, healthOutcome: 50, responsiveness: 35 },
  },
]

const MOCK_ANOMALY_NORMAL = { isAnomaly: false, score: 0.1, flags: [], detectedAt: null }
const MOCK_ANOMALY_DETECTED = {
  isAnomaly: true,
  score: 0.9,
  flags: ['Longest gap was 25 days', 'High watering variability'],
  detectedAt: '2026-01-01T00:00:00.000Z',
}
const MOCK_SEASONAL = {
  season: 'winter',
  multiplier: 0.75,
  adjustedFrequencyDays: 11,
  note: 'Reduce watering in winter',
  source: 'heuristic',
}
const MOCK_CLUSTER = {
  clusterId: 'forgiving_foliage',
  clusterLabel: 'Forgiving Foliage',
  similarSpecies: ['pothos', 'philodendron', 'rubber plant'],
  clusterCareProfile: { avgFrequency: 8, droughtTolerance: 'medium', humidityNeed: 'medium' },
  source: 'default',
}

function buildPlants(count, wateringsEach) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Plant ${i}`,
    wateringLog: Array.from({ length: wateringsEach }, (_, j) => ({
      date: new Date(Date.now() - j * 86400000 * 7).toISOString(),
    })),
    fertiliserLog: [],
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  usePlantContext.mockReturnValue({ plants: buildPlants(5, 5) })
  useLayoutContext.mockReturnValue({ theme: 'light' })

  plantsApi.careScores.mockResolvedValue(MOCK_CARE_SCORES)
  plantsApi.wateringPattern.mockResolvedValue({ pattern: 'optimal', contributingFactors: ['Consistent schedule'] })
  plantsApi.healthPrediction.mockResolvedValue({ predictedHealth: 'good', trend: 'stable', keyRisks: [] })
  plantsApi.anomaly.mockResolvedValue(MOCK_ANOMALY_NORMAL)
  plantsApi.wateringRecommendation.mockResolvedValue({ recommendedFrequencyDays: 8, basis: 'Based on history', confidenceInterval: [7, 9] })
  plantsApi.seasonalAdjustment.mockResolvedValue(MOCK_SEASONAL)
  plantsApi.speciesCluster.mockResolvedValue(MOCK_CLUSTER)
})

describe('InsightsPage', () => {
  it('shows not-enough-data empty state when fewer than 3 plants', () => {
    usePlantContext.mockReturnValue({ plants: buildPlants(1, 3) })
    render(<InsightsPage />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
  })

  it('shows not-enough-data empty state when plants have fewer than 10 waterings total', () => {
    usePlantContext.mockReturnValue({ plants: buildPlants(4, 1) })
    render(<InsightsPage />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching care scores', () => {
    plantsApi.careScores.mockReturnValue(new Promise(() => {}))
    render(<InsightsPage />)
    expect(screen.getAllByTestId('skeleton-card').length).toBeGreaterThan(0)
  })

  it('renders collection overview with avg score and at-risk list after load', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Collection Health')).toBeInTheDocument())
    // Average of 82 and 42 = 62
    expect(screen.getByText('62')).toBeInTheDocument()
    // At-risk section renders plant name with score < 60 (multiple matches are fine here)
    expect(screen.getAllByText('Snake Plant').length).toBeGreaterThan(0)
  })

  it('renders plant score rows with grade badges', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getAllByText('Monstera').length).toBeGreaterThan(0))
    expect(screen.getAllByText('B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('F').length).toBeGreaterThan(0)
  })

  it('expanding a plant fetches and displays anomaly, seasonal, and cluster sections', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Monstera care score details'))

    await waitFor(() => expect(screen.getByTestId('anomaly-section')).toBeInTheDocument())
    expect(screen.getByTestId('seasonal-section')).toBeInTheDocument()
    expect(screen.getByTestId('cluster-section')).toBeInTheDocument()

    // Anomaly: normal
    expect(screen.getByText('Normal behaviour')).toBeInTheDocument()

    // Seasonal data
    expect(screen.getByText('winter')).toBeInTheDocument()
    expect(screen.getByText(/11/)).toBeInTheDocument()

    // Cluster data
    expect(screen.getByText('Forgiving Foliage')).toBeInTheDocument()
  })

  it('calls speciesCluster with the plant species name', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Monstera care score details'))
    await waitFor(() => expect(plantsApi.speciesCluster).toHaveBeenCalledWith('Monstera deliciosa'))
  })

  it('shows anomaly-detected badge and flags when isAnomaly is true', async () => {
    plantsApi.anomaly.mockResolvedValue(MOCK_ANOMALY_DETECTED)
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getAllByText('Snake Plant').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByLabelText('Snake Plant care score details'))

    await waitFor(() => expect(screen.getByTestId('anomaly-section')).toBeInTheDocument())
    // Flags appear in both the card section and the top banner, so use getAllByText
    expect(screen.getAllByText('⚠ Anomaly detected').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Longest gap was 25 days/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/High watering variability/).length).toBeGreaterThan(0)
  })

  it('shows anomaly alert banner when an expanded plant has isAnomaly true', async () => {
    plantsApi.anomaly.mockResolvedValue(MOCK_ANOMALY_DETECTED)
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Monstera care score details'))

    await waitFor(() => expect(screen.getByTestId('anomaly-alert-banner')).toBeInTheDocument())
    expect(screen.getByText(/Watering anomalies detected/)).toBeInTheDocument()
  })

  it('shows no-cluster message when species is missing', async () => {
    const scoresWithoutSpecies = [{ ...MOCK_CARE_SCORES[0], species: '' }]
    plantsApi.careScores.mockResolvedValue(scoresWithoutSpecies)
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Monstera care score details'))
    await waitFor(() => expect(screen.getByTestId('cluster-section')).toBeInTheDocument())
    expect(screen.getByText('Add a species to see cluster info.')).toBeInTheDocument()
  })

  it('renders seasonal note text', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Monstera care score details'))
    await waitFor(() => expect(screen.getByText('Reduce watering in winter')).toBeInTheDocument())
  })

  it('renders score dimensions in expanded view', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Monstera care score details'))
    await waitFor(() => expect(screen.getByText('Score Dimensions')).toBeInTheDocument())
    expect(screen.getByText('Consistency:')).toBeInTheDocument()
  })

  it('collapses expanded plant when clicked again', async () => {
    render(<InsightsPage />)
    await waitFor(() => expect(screen.getByText('Monstera')).toBeInTheDocument())

    const row = screen.getByLabelText('Monstera care score details')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('anomaly-section')).toBeInTheDocument())

    fireEvent.click(row)
    await waitFor(() => expect(screen.queryByTestId('anomaly-section')).not.toBeInTheDocument())
  })
})
