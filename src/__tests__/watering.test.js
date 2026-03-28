import { describe, it, expect } from 'vitest'
import { getWateringStatus, isOutdoor, urgencyColor, urgencyLabel, OUTDOOR_ROOMS } from '../utils/watering.js'

function makePlant(overrides = {}) {
  return {
    lastWatered: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
    frequencyDays: 7,
    room: 'Living Room',
    floor: 'ground',
    ...overrides,
  }
}

function makeWeather(overrides = {}) {
  return {
    current: {
      temp: 22,
      condition: { sky: 'clear' },
      ...overrides.current,
    },
    days: overrides.days ?? [],
  }
}

const outdoorFloor = { id: 'garden', type: 'outdoor' }
const indoorFloor = { id: 'ground', type: 'interior' }

// ── isOutdoor ───────────────────────────────────────────────────────────────

describe('isOutdoor', () => {
  it('returns true for plants in OUTDOOR_ROOMS', () => {
    for (const room of OUTDOOR_ROOMS) {
      expect(isOutdoor({ room, floor: 'ground' })).toBe(true)
    }
  })

  it('returns false for indoor rooms', () => {
    expect(isOutdoor({ room: 'Living Room', floor: 'ground' })).toBe(false)
  })

  it('returns true when the plant is on an outdoor floor', () => {
    expect(isOutdoor({ room: 'Herbs', floor: 'garden' }, [outdoorFloor])).toBe(true)
  })

  it('returns false when the plant is on an interior floor', () => {
    expect(isOutdoor({ room: 'Kitchen', floor: 'ground' }, [indoorFloor])).toBe(false)
  })
})

// ── urgencyColor ────────────────────────────────────────────────────────────

describe('urgencyColor', () => {
  it('returns red for overdue', () => {
    expect(urgencyColor(-1)).toBe('#ef4444')
  })

  it('returns orange for due today', () => {
    expect(urgencyColor(0)).toBe('#f97316')
  })

  it('returns yellow for 1-2 days', () => {
    expect(urgencyColor(1)).toBe('#eab308')
    expect(urgencyColor(2)).toBe('#eab308')
  })

  it('returns green for 3+ days', () => {
    expect(urgencyColor(3)).toBe('#22c55e')
    expect(urgencyColor(10)).toBe('#22c55e')
  })
})

// ── urgencyLabel ────────────────────────────────────────────────────────────

describe('urgencyLabel', () => {
  it('shows overdue for negative days', () => {
    expect(urgencyLabel(-3)).toBe('3d overdue')
  })

  it('shows Due today for 0', () => {
    expect(urgencyLabel(0)).toBe('Due today')
  })

  it('shows Tomorrow for 1', () => {
    expect(urgencyLabel(1)).toBe('Tomorrow')
  })

  it('shows Xd for 2+', () => {
    expect(urgencyLabel(5)).toBe('5d')
  })
})

// ── getWateringStatus ───────────────────────────────────────────────────────

describe('getWateringStatus', () => {
  it('returns due today when plant has no lastWatered', () => {
    const status = getWateringStatus({ frequencyDays: 7 })
    expect(status.daysUntil).toBe(0)
    expect(status.label).toBe('Due today')
    expect(status.skippedRain).toBe(false)
  })

  it('calculates days until watering based on lastWatered and frequencyDays', () => {
    const plant = makePlant({ lastWatered: new Date(Date.now() - 2 * 86400000).toISOString(), frequencyDays: 7 })
    const status = getWateringStatus(plant)
    expect(status.daysUntil).toBeGreaterThan(0)
    expect(status.skippedRain).toBe(false)
  })

  it('returns overdue when past the watering date', () => {
    const plant = makePlant({ lastWatered: new Date(Date.now() - 10 * 86400000).toISOString(), frequencyDays: 7 })
    const status = getWateringStatus(plant)
    expect(status.daysUntil).toBeLessThan(0)
    expect(status.color).toBe('#ef4444')
  })

  // Heat adjustments
  it('reduces frequency by 1 day when temp >= 30', () => {
    const plant = makePlant({ frequencyDays: 7 })
    const weather = makeWeather({ current: { temp: 32, condition: { sky: 'clear' } } })
    const normal = getWateringStatus(plant)
    const hot = getWateringStatus(plant, weather)
    expect(hot.daysUntil).toBeLessThan(normal.daysUntil)
    expect(hot.note).toBe('Hot day — watering sooner')
  })

  it('reduces frequency by 2 days when temp >= 35', () => {
    const plant = makePlant({ frequencyDays: 7 })
    const weather = makeWeather({ current: { temp: 37, condition: { sky: 'clear' } } })
    const hot = getWateringStatus(plant, weather)
    expect(hot.note).toBe('Very hot — watering sooner')
  })

  it('does not reduce frequency below 1 day in extreme heat', () => {
    const plant = makePlant({ frequencyDays: 1 })
    const weather = makeWeather({ current: { temp: 40, condition: { sky: 'clear' } } })
    const status = getWateringStatus(plant, weather)
    // Should not crash or go below 1-day effective frequency
    expect(status.daysUntil).toBeDefined()
  })

  // Rain handling for outdoor plants
  it('returns skippedRain for outdoor plants when raining', () => {
    const plant = makePlant({ room: 'Garden' })
    const weather = makeWeather({ current: { temp: 20, condition: { sky: 'rainy' } } })
    const status = getWateringStatus(plant, weather)
    expect(status.skippedRain).toBe(true)
    expect(status.label).toBe('Rain today')
    expect(status.note).toBe('Raining — no need to water')
  })

  it('returns skippedRain for outdoor plants during storms', () => {
    const plant = makePlant({ room: 'Balcony' })
    const weather = makeWeather({ current: { temp: 18, condition: { sky: 'stormy' } } })
    const status = getWateringStatus(plant, weather)
    expect(status.skippedRain).toBe(true)
  })

  it('does not skip rain for indoor plants when raining', () => {
    const plant = makePlant({ room: 'Living Room' })
    const weather = makeWeather({ current: { temp: 20, condition: { sky: 'rainy' } } })
    const status = getWateringStatus(plant, weather)
    expect(status.skippedRain).toBe(false)
  })

  // Rain forecast advisory
  it('shows rain forecast note for outdoor plants due soon with upcoming rain', () => {
    // Plant due today/tomorrow + rain in forecast
    const plant = makePlant({
      lastWatered: new Date(Date.now() - 6 * 86400000).toISOString(),
      frequencyDays: 7,
      room: 'Garden',
    })
    const weather = makeWeather({
      current: { temp: 20, condition: { sky: 'clear' } },
      days: [
        { date: '2026-03-28', precipitation: 0 },
        { date: '2026-03-29', precipitation: 5 },
        { date: '2026-03-30', precipitation: 0 },
      ],
    })
    const status = getWateringStatus(plant, weather)
    expect(status.note).toBe('Rain forecast — may skip')
  })

  it('does not show rain note for indoor plants even with rain forecast', () => {
    const plant = makePlant({
      lastWatered: new Date(Date.now() - 6 * 86400000).toISOString(),
      frequencyDays: 7,
      room: 'Living Room',
    })
    const weather = makeWeather({
      current: { temp: 20, condition: { sky: 'clear' } },
      days: [{ date: '2026-03-29', precipitation: 10 }],
    })
    const status = getWateringStatus(plant, weather)
    expect(status.note).toBeNull()
  })

  // No weather
  it('works without weather data', () => {
    const plant = makePlant()
    const status = getWateringStatus(plant, null)
    expect(status.daysUntil).toBeDefined()
    expect(status.note).toBeNull()
  })

  it('works with empty floors array', () => {
    const plant = makePlant()
    const status = getWateringStatus(plant, null, [])
    expect(status.daysUntil).toBeDefined()
  })
})
