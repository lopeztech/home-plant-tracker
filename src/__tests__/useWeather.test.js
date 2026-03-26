import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCondition, useWeather } from '../hooks/useWeather.js'

// ── WMO getCondition ──────────────────────────────────────────────────────────

describe('getCondition', () => {
  it('returns clear-sky for code 0', () => {
    const c = getCondition(0)
    expect(c.label).toBe('Clear sky')
    expect(c.sky).toBe('sunny')
    expect(c.emoji).toBe('☀️')
  })

  it('returns rainy sky for drizzle codes (51, 53, 55)', () => {
    for (const code of [51, 53, 55]) {
      expect(getCondition(code).sky).toBe('rainy')
    }
  })

  it('returns stormy sky for heavy rain / thunderstorm (65, 82, 95, 99)', () => {
    for (const code of [65, 82, 95, 99]) {
      expect(getCondition(code).sky).toBe('stormy')
    }
  })

  it('returns snowy sky for snow codes (71, 73, 75, 77)', () => {
    for (const code of [71, 73, 75, 77]) {
      expect(getCondition(code).sky).toBe('snowy')
    }
  })

  it('falls back to code 0 (clear sky) for unknown codes', () => {
    expect(getCondition(999).sky).toBe('sunny')
  })
})

// ── useWeather hook ───────────────────────────────────────────────────────────

const RAW_WEATHER = {
  current_weather: {
    temperature: 18.7,
    weathercode: 2,
    is_day: 1,
  },
  daily: {
    time: ['2026-03-27', '2026-03-28', '2026-03-29'],
    weathercode: [2, 63, 0],
    temperature_2m_max: [20.1, 15.4, 22.9],
    temperature_2m_min: [10.2, 9.8, 11.0],
    precipitation_sum: [0, 5.2, 0],
  },
}

describe('useWeather', () => {
  let mockGetCurrentPosition

  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()

    // Default: geolocation succeeds at (51, -0.1)
    mockGetCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
    })

    // Default fetch: returns RAW_WEATHER
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(RAW_WEATHER),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Geolocation success ───────────────────────────────────────────────────

  it('fetches weather and sets state after geolocation success', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather).not.toBeNull()
    expect(result.current.weather.current.temp).toBe(19) // Math.round(18.7)
    expect(result.current.locationDenied).toBe(false)
  })

  it('maps WMO code 2 to partly-cloudy condition', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather.current.condition.sky).toBe('partly')
  })

  it('parses daily forecast precipitation correctly', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather.days[1].precipitation).toBe(5.2)
  })

  it('rounds temperatures to integers', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather.days[0].maxTemp).toBe(20)
    expect(result.current.weather.days[0].minTemp).toBe(10)
  })

  it('sets isDay correctly', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather.current.isDay).toBe(true)
  })

  // ── Geolocation denied ────────────────────────────────────────────────────

  it('sets locationDenied when geolocation is denied', async () => {
    mockGetCurrentPosition.mockImplementation((_, err) => err(new Error('denied')))

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.locationDenied).toBe(true)
    expect(result.current.weather).toBeNull()
  })

  it('does not fetch weather when geolocation is denied', async () => {
    mockGetCurrentPosition.mockImplementation((_, err) => err(new Error('denied')))

    renderHook(() => useWeather())
    await waitFor(() => true)

    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ── Cache hit ─────────────────────────────────────────────────────────────

  it('uses sessionStorage cache when fresh and within 1 km', async () => {
    const cachedWeather = { current: { temp: 20, condition: { sky: 'sunny' }, isDay: true }, days: [] }
    sessionStorage.setItem('plantTracker_weather', JSON.stringify({
      lat: 51,
      lon: -0.1,
      weather: cachedWeather,
      fetchedAt: Date.now() - 60000, // 1 minute ago — within 30-min TTL
    }))

    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Should use cache, not fetch
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.weather.current.temp).toBe(20)
  })

  it('fetches fresh data when cache is stale (> 30 min)', async () => {
    const cachedWeather = { current: { temp: 20, condition: { sky: 'sunny' }, isDay: true }, days: [] }
    sessionStorage.setItem('plantTracker_weather', JSON.stringify({
      lat: 51,
      lon: -0.1,
      weather: cachedWeather,
      fetchedAt: Date.now() - 31 * 60 * 1000, // 31 minutes ago
    }))

    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('fetches fresh data when location moved > 1 km from cached position', async () => {
    const cachedWeather = { current: { temp: 20, condition: { sky: 'sunny' }, isDay: true }, days: [] }
    sessionStorage.setItem('plantTracker_weather', JSON.stringify({
      lat: 51,
      lon: -0.1,
      weather: cachedWeather,
      fetchedAt: Date.now() - 60000,
    }))

    // New position is ~2km away
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51.02, longitude: -0.1 } })
    )

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledOnce()
  })

  // ── Network error ─────────────────────────────────────────────────────────

  it('sets loading=false and leaves weather null when fetch fails', async () => {
    mockGetCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 51, longitude: -0.1 } })
    )
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.weather).toBeNull()
  })
})
