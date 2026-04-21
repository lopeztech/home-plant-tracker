import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-apexcharts', () => ({ default: () => <div data-testid="chart" /> }))
vi.mock('../components/HelpTooltip.jsx', () => ({ default: () => null }))
vi.mock('../context/PlantContext.jsx', () => ({
  usePlantContext: () => ({
    plants: [
      {
        id: 'p1', name: 'Monstera', species: 'Monstera deliciosa', room: 'Living Room',
        health: 'Poor', lastWatered: '2020-01-01', frequencyDays: 7, wateringLog: [],
        incidents: [],
      },
    ],
    floors: [], weather: null, isGuest: false,
  }),
}))
vi.mock('../context/LayoutContext.jsx', () => ({
  useLayoutContext: () => ({ theme: 'light' }),
}))

import AnalyticsPage from '../pages/AnalyticsPage.jsx'

describe('Typography token classes', () => {
  it('applies tx-muted to the Analytics page subtitle', () => {
    const { container } = render(<AnalyticsPage />)
    const subtitle = container.querySelector('p.tx-muted')
    expect(subtitle).not.toBeNull()
    expect(subtitle.textContent).toMatch(/plant/)
  })

  it('applies tx-title to at-risk plant names', () => {
    const { container } = render(<AnalyticsPage />)
    const titleSpan = container.querySelector('span.tx-title')
    expect(titleSpan).not.toBeNull()
    expect(titleSpan.textContent).toBe('Monstera')
  })

  it('applies tx-muted to at-risk metadata', () => {
    const { container } = render(<AnalyticsPage />)
    const mutedDivs = container.querySelectorAll('div.tx-muted')
    expect(mutedDivs.length).toBeGreaterThan(0)
  })

  it('does not use fw-700 Bootstrap class in Analytics page markup', () => {
    const { container } = render(<AnalyticsPage />)
    const fw700Elements = container.querySelectorAll('.fw-700')
    expect(fw700Elements.length).toBe(0)
  })
})
