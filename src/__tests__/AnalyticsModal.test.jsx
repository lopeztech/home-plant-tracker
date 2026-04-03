import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
}))

import AnalyticsPage from '../components/AnalyticsModal.jsx'

const mockPlants = [
  {
    id: '1', name: 'Fern', species: 'Boston Fern', health: 'Good', maturity: 'Mature', room: 'Living Room',
    lastWatered: new Date(Date.now() - 2 * 86400000).toISOString(), frequencyDays: 3,
    wateringLog: [
      { date: new Date(Date.now() - 2 * 86400000).toISOString(), note: '' },
      { date: new Date(Date.now() - 5 * 86400000).toISOString(), note: '' },
    ],
  },
  {
    id: '2', name: 'Cactus', species: 'Saguaro', health: 'Excellent', maturity: 'Young', room: 'Office',
    lastWatered: new Date(Date.now() - 1 * 86400000).toISOString(), frequencyDays: 14,
    wateringLog: [
      { date: new Date(Date.now() - 1 * 86400000).toISOString(), note: '' },
    ],
  },
  {
    id: '3', name: 'Rose', species: 'Tea Rose', health: 'Poor', maturity: 'Established', room: 'Garden',
    lastWatered: new Date(Date.now() - 20 * 86400000).toISOString(), frequencyDays: 5,
    wateringLog: [
      { date: new Date(Date.now() - 20 * 86400000).toISOString(), note: '' },
      { date: new Date(Date.now() - 25 * 86400000).toISOString(), note: '' },
    ],
  },
]

describe('AnalyticsPage', () => {
  it('renders with empty plants array showing "No plants yet"', () => {
    render(<AnalyticsPage plants={[]} />)
    expect(screen.getByText('No plants yet.')).toBeInTheDocument()
  })

  it('shows plant count in header', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText('3 plants')).toBeInTheDocument()
  })

  it('shows "1 plant" singular for single plant', () => {
    render(<AnalyticsPage plants={[mockPlants[0]]} />)
    expect(screen.getByText('1 plant')).toBeInTheDocument()
  })

  it('renders Overview tab with health distribution data', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText('Health Distribution')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText('Poor')).toBeInTheDocument()
  })

  it('renders At-Risk plants section with poor health plants', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText('At-Risk Plants')).toBeInTheDocument()
    expect(screen.getByText('Rose')).toBeInTheDocument()
    expect(screen.getByText('Poor health')).toBeInTheDocument()
  })

  it('renders "All plants are thriving!" when no at-risk plants', () => {
    const healthyPlants = [
      {
        id: '1', name: 'Fern', species: 'Boston Fern', health: 'Excellent',
        lastWatered: new Date(Date.now() - 1 * 86400000).toISOString(), frequencyDays: 7,
        wateringLog: [],
      },
    ]
    render(<AnalyticsPage plants={healthyPlants} />)
    expect(screen.getByText('All plants are thriving!')).toBeInTheDocument()
  })

  it('renders watering heatmap section', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText(/Watering Activity/)).toBeInTheDocument()
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('switches between Overview and Per Plant tabs', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText('Health Distribution')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Per Plant'))
    expect(screen.getByText('Select plant')).toBeInTheDocument()
    expect(screen.getByText('Consistency Score')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Overview'))
    expect(screen.getByText('Health Distribution')).toBeInTheDocument()
  })

  it('Per Plant tab renders plant selector with all plants', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    fireEvent.click(screen.getByText('Per Plant'))

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('Per Plant tab shows consistency score for plant with enough data', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    fireEvent.click(screen.getByText('Per Plant'))
    // Fern has 2 watering events so consistency score should display
    expect(screen.getByText('Consistency Score')).toBeInTheDocument()
    expect(screen.getByText('/ 100')).toBeInTheDocument()
  })

  it('Per Plant tab shows "No watering recorded" for plants without lastWatered', () => {
    const plantsNoWater = [
      { id: '1', name: 'Sad Plant', species: 'Unknown', health: 'Fair', wateringLog: [] },
    ]
    render(<AnalyticsPage plants={plantsNoWater} />)
    fireEvent.click(screen.getByText('Per Plant'))
    expect(screen.getByText('No watering recorded.')).toBeInTheDocument()
  })

  it('Per Plant tab shows "No plants yet." when plants is empty', () => {
    render(<AnalyticsPage plants={[]} />)
    fireEvent.click(screen.getByText('Per Plant'))
    // PerPlantTab renders "No plants yet." when no plant found
    expect(screen.getAllByText('No plants yet.').length).toBeGreaterThanOrEqual(1)
  })

  it('Per Plant tab allows switching selected plant', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    fireEvent.click(screen.getByText('Per Plant'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '3' } })
    // Rose has poor health and overdue, should show its data
    expect(screen.getByText('Last Watered')).toBeInTheDocument()
  })

  it('renders footer text', () => {
    render(<AnalyticsPage plants={mockPlants} />)
    expect(screen.getByText(/Analytics computed from watering and health log data/)).toBeInTheDocument()
  })
})
