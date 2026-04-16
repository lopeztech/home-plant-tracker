import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/watering.js', () => ({
  getSeason: vi.fn((lat) => {
    if (lat == null) return null
    return 'spring'
  }),
}))

vi.mock('../components/SeasonBadge.jsx', () => ({
  default: ({ lat }) => (lat == null ? null : <span data-testid="season-badge">badge</span>),
}))

import HouseWeatherFrame from '../components/HouseWeatherFrame.jsx'

const baseWeather = {
  current: {
    temp: 22,
    isDay: true,
    condition: { sky: 'sunny', emoji: '\u2600\uFE0F', label: 'Sunny' },
  },
  location: { lat: 40 },
  unit: 'celsius',
  days: [
    { date: '2025-06-01', condition: { emoji: '\u2600\uFE0F' }, maxTemp: 25, minTemp: 15, precipitation: 0 },
    { date: '2025-06-02', condition: { emoji: '\u2601\uFE0F' }, maxTemp: 22, minTemp: 14, precipitation: 4 },
    { date: '2025-06-03', condition: { emoji: '\u2600\uFE0F' }, maxTemp: 24, minTemp: 16, precipitation: 1 },
    { date: '2025-06-04', condition: { emoji: '\u2600\uFE0F' }, maxTemp: 26, minTemp: 17, precipitation: 0 },
  ],
}

describe('HouseWeatherFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children inside the house column', () => {
    render(
      <HouseWeatherFrame weather={baseWeather}>
        <div data-testid="child">hello</div>
      </HouseWeatherFrame>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the weather pill with temperature, unit, and label', () => {
    render(
      <HouseWeatherFrame weather={baseWeather}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByText('22\u00B0C')).toBeInTheDocument()
    expect(screen.getByText('Sunny')).toBeInTheDocument()
  })

  it('uses fahrenheit unit symbol when weather.unit is fahrenheit', () => {
    const weather = { ...baseWeather, unit: 'fahrenheit' }
    render(
      <HouseWeatherFrame weather={weather}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByText('22\u00B0F')).toBeInTheDocument()
  })

  it('shows the three-day forecast row when 3+ days are provided', () => {
    render(
      <HouseWeatherFrame weather={baseWeather}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByText('Tmrw')).toBeInTheDocument()
    // Rainy day chip shows precipitation amount
    expect(screen.getByText('4mm')).toBeInTheDocument()
  })

  it('hides the forecast row when fewer than 3 days are provided', () => {
    const weather = { ...baseWeather, days: [baseWeather.days[0]] }
    render(
      <HouseWeatherFrame weather={weather}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.queryByText('Tmrw')).not.toBeInTheDocument()
  })

  it('renders nothing for the weather pill when weather is missing', () => {
    render(
      <HouseWeatherFrame weather={null}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.queryByTestId('season-badge')).not.toBeInTheDocument()
  })

  it('fires onLocationClick when the location label is clicked', () => {
    const onLocationClick = vi.fn()
    render(
      <HouseWeatherFrame weather={baseWeather} location={{ name: 'London' }} onLocationClick={onLocationClick}>
        <div />
      </HouseWeatherFrame>,
    )
    fireEvent.click(screen.getByText('London'))
    expect(onLocationClick).toHaveBeenCalled()
  })

  it('renders the front yard tile when provided', () => {
    render(
      <HouseWeatherFrame
        weather={baseWeather}
        yardAreas={{ frontyard: <div data-testid="fy">fy</div> }}
      >
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByTestId('fy')).toBeInTheDocument()
    expect(screen.getByText('Front Yard')).toBeInTheDocument()
  })

  it('renders backyard, side-left, and side-right tiles when provided', () => {
    render(
      <HouseWeatherFrame
        weather={baseWeather}
        yardAreas={{
          backyard: <div data-testid="by">by</div>,
          'side-left': <div data-testid="sl">sl</div>,
          'side-right': <div data-testid="sr">sr</div>,
        }}
      >
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByTestId('by')).toBeInTheDocument()
    expect(screen.getAllByTestId('sl').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('sr').length).toBeGreaterThan(0)
    expect(screen.getByText('Backyard')).toBeInTheDocument()
  })

  it('applies the night configuration when isDay is false', () => {
    const weather = {
      ...baseWeather,
      current: { ...baseWeather.current, isDay: false },
    }
    const { container } = render(
      <HouseWeatherFrame weather={weather}>
        <div />
      </HouseWeatherFrame>,
    )
    // Night variant renders ~15 stars; assert at least one star-shaped element exists
    expect(container.querySelectorAll('.position-absolute').length).toBeGreaterThan(5)
  })

  it('handles an unknown sky value by falling back to sunny', () => {
    const weather = {
      ...baseWeather,
      current: { ...baseWeather.current, condition: { sky: 'acid-rain', label: '?', emoji: '?' } },
    }
    render(
      <HouseWeatherFrame weather={weather}>
        <div />
      </HouseWeatherFrame>,
    )
    expect(screen.getByText('22\u00B0C')).toBeInTheDocument()
  })
})
