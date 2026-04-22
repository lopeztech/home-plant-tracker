import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChartFrame from '../components/ChartFrame.jsx'

describe('ChartFrame', () => {
  it('renders title', () => {
    render(<ChartFrame title="Test Chart"><div>chart</div></ChartFrame>)
    expect(screen.getByText('Test Chart')).toBeTruthy()
  })

  it('renders unit badge when unit is provided', () => {
    render(<ChartFrame title="T" unit="plants"><div /></ChartFrame>)
    expect(screen.getByText('plants')).toBeTruthy()
  })

  it('renders children when not loading or empty', () => {
    render(<ChartFrame title="T"><div data-testid="chart-content">chart</div></ChartFrame>)
    expect(screen.getByTestId('chart-content')).toBeTruthy()
  })

  it('renders skeleton when loading=true', () => {
    render(<ChartFrame title="T" loading><div data-testid="c">content</div></ChartFrame>)
    expect(screen.queryByTestId('c')).toBeNull()
  })

  it('renders empty state when empty=true', () => {
    render(<ChartFrame title="T" empty emptyText="Nothing here yet."><div>content</div></ChartFrame>)
    expect(screen.getByText('Nothing here yet.')).toBeTruthy()
    expect(screen.queryByText('content')).toBeNull()
  })

  it('uses default empty text when emptyText is not provided', () => {
    render(<ChartFrame title="T" empty><div>content</div></ChartFrame>)
    expect(screen.getByText(/No data yet/)).toBeTruthy()
  })

  it('renders help node in panel header', () => {
    render(
      <ChartFrame title="T" help={<span data-testid="help-node">Help</span>}>
        <div />
      </ChartFrame>
    )
    expect(screen.getByTestId('help-node')).toBeTruthy()
  })

  it('has aria-label from title for screen reader landmark', () => {
    const { container } = render(<ChartFrame title="My Chart"><div /></ChartFrame>)
    expect(container.querySelector('[aria-label="My Chart"]')).toBeTruthy()
  })
})
