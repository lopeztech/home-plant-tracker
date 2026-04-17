import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../utils/watering.js', () => ({
  getSeason: vi.fn((lat) => {
    if (lat == null) return null
    return 'spring'
  }),
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
  days: [],
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

  it('uses a solid background for indoor floors by default', () => {
    const { container } = render(
      <HouseWeatherFrame weather={baseWeather}>
        <div data-testid="child">c</div>
      </HouseWeatherFrame>,
    )
    const houseCol = container.querySelector('[data-testid="child"]').parentElement
    expect(houseCol.style.background).not.toBe('transparent')
    expect(houseCol.style.background).toBeTruthy()
  })

  it('uses a transparent background when isOutdoor is true', () => {
    const { container } = render(
      <HouseWeatherFrame weather={baseWeather} isOutdoor>
        <div data-testid="child">c</div>
      </HouseWeatherFrame>,
    )
    const houseCol = container.querySelector('[data-testid="child"]').parentElement
    expect(houseCol.style.background).toBe('transparent')
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
    expect(container.querySelectorAll('.position-absolute').length).toBeGreaterThan(5)
  })

  it('handles an unknown sky value by falling back to sunny', () => {
    const weather = {
      ...baseWeather,
      current: { ...baseWeather.current, condition: { sky: 'acid-rain', label: '?', emoji: '?' } },
    }
    render(
      <HouseWeatherFrame weather={weather}>
        <div data-testid="child">c</div>
      </HouseWeatherFrame>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
