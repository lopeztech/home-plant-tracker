import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import WeatherStrip from '../components/WeatherStrip.jsx'

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

describe('WeatherStrip', () => {
  it('renders the current temperature with unit', () => {
    render(<WeatherStrip weather={baseWeather} />)
    expect(screen.getByText('22°C')).toBeInTheDocument()
  })

  it('uses fahrenheit unit symbol when weather.unit is fahrenheit', () => {
    render(<WeatherStrip weather={{ ...baseWeather, unit: 'fahrenheit' }} />)
    expect(screen.getByText('22°F')).toBeInTheDocument()
  })

  it('renders three forecast pills with max temps', () => {
    const { container } = render(<WeatherStrip weather={baseWeather} />)
    const text = container.textContent
    // .slice(1, 4) → days index 1, 2, 3 → max temps 22, 24, 26
    expect(text).toContain('24\u00B0')
    expect(text).toContain('26\u00B0')
  })

  it('returns null when weather is missing', () => {
    const { container } = render(<WeatherStrip weather={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('fires onLocationClick when the location button is clicked', () => {
    const onLocationClick = vi.fn()
    render(<WeatherStrip weather={baseWeather} location={{ name: 'London' }} onLocationClick={onLocationClick} />)
    fireEvent.click(screen.getByTitle('Location: London'))
    expect(onLocationClick).toHaveBeenCalled()
  })
})
