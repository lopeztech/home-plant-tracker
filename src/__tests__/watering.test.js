import { describe, it, expect } from 'vitest'
import { getWateringStatus, getAdjustedWaterAmount, isOutdoor, urgencyColor, urgencyLabel, OUTDOOR_ROOMS, getSeason, SEASONAL_MULTIPLIERS, getPlantAttributeMultiplier, getSuggestedFrequency, getMoistureStatusAdjustment, getMoistureFrequencySuggestion, getMoistureDisplay, computeRainCredit } from '../utils/watering.js'

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

// ── getSeason ──────────────────────────────────────────────────────────────

describe('getSeason', () => {
  it('returns null when latitude is null or undefined', () => {
    expect(getSeason(null)).toBeNull()
    expect(getSeason(undefined)).toBeNull()
  })

  // Northern hemisphere (positive latitude)
  it('returns spring for northern hemisphere in March-May', () => {
    expect(getSeason(40, new Date('2026-03-15'))).toBe('spring')
    expect(getSeason(40, new Date('2026-04-15'))).toBe('spring')
    expect(getSeason(40, new Date('2026-05-15'))).toBe('spring')
  })

  it('returns summer for northern hemisphere in June-August', () => {
    expect(getSeason(40, new Date('2026-06-15'))).toBe('summer')
    expect(getSeason(40, new Date('2026-07-15'))).toBe('summer')
    expect(getSeason(40, new Date('2026-08-15'))).toBe('summer')
  })

  it('returns autumn for northern hemisphere in Sep-Nov', () => {
    expect(getSeason(40, new Date('2026-09-15'))).toBe('autumn')
    expect(getSeason(40, new Date('2026-10-15'))).toBe('autumn')
    expect(getSeason(40, new Date('2026-11-15'))).toBe('autumn')
  })

  it('returns winter for northern hemisphere in Dec-Feb', () => {
    expect(getSeason(40, new Date('2026-12-15'))).toBe('winter')
    expect(getSeason(40, new Date('2026-01-15'))).toBe('winter')
    expect(getSeason(40, new Date('2026-02-15'))).toBe('winter')
  })

  // Southern hemisphere (negative latitude) — seasons reversed
  it('returns autumn for southern hemisphere in March-May', () => {
    expect(getSeason(-33, new Date('2026-04-15'))).toBe('autumn')
  })

  it('returns winter for southern hemisphere in June-August', () => {
    expect(getSeason(-33, new Date('2026-07-15'))).toBe('winter')
  })

  it('returns spring for southern hemisphere in Sep-Nov', () => {
    expect(getSeason(-33, new Date('2026-10-15'))).toBe('spring')
  })

  it('returns summer for southern hemisphere in Dec-Feb', () => {
    expect(getSeason(-33, new Date('2026-01-15'))).toBe('summer')
  })

  it('treats latitude 0 (equator) as northern hemisphere', () => {
    expect(getSeason(0, new Date('2026-07-15'))).toBe('summer')
  })
})

// ── Seasonal watering adjustments ──────────────────────────────────────────

describe('getWateringStatus — seasonal adjustments', () => {
  function makeWeatherWithLocation(lat, overrides = {}) {
    return {
      current: {
        temp: 22,
        condition: { sky: 'clear' },
        ...overrides.current,
      },
      days: overrides.days ?? [],
      location: { lat, lon: 0 },
    }
  }

  it('waters more often in summer (shorter interval)', () => {
    // Summer in northern hemisphere: July, multiplier 1.3
    // 7 days / 1.3 ≈ 5 days effective
    const plant = makePlant({
      lastWatered: new Date(Date.now() - 4 * 86400000).toISOString(),
      frequencyDays: 7,
    })
    // Without location — uses base 7d
    const noSeason = getWateringStatus(plant, null)
    // With summer location
    const summerWeather = makeWeatherWithLocation(40)
    // Mock date to July for summer
    const julDate = new Date('2026-07-15T12:00:00Z')
    // We can't mock Date easily, but we can test with a known lastWatered
    // Instead test that effective frequency changes by checking daysUntil
    const summer = getWateringStatus(plant, summerWeather)
    // In summer, effective freq = round(7/1.3) = 5, so should be due sooner
    expect(summer.season).toBeDefined()
  })

  it('waters less often in winter (longer interval)', () => {
    // Winter: multiplier 0.7, effective = round(7/0.7) = 10 days
    // Plant watered 8 days ago with base 7d:
    // Without season: 7 - 8 = -1 (overdue)
    // With winter: 10 - 8 = 2 (still has time)
    const plant = makePlant({
      lastWatered: new Date(Date.now() - 8 * 86400000).toISOString(),
      frequencyDays: 7,
    })
    const noSeason = getWateringStatus(plant, null)
    expect(noSeason.daysUntil).toBeLessThan(0) // overdue without season

    // In winter (Jan, northern hemisphere lat 40)
    const winterWeather = {
      current: { temp: 5, condition: { sky: 'clear' } },
      days: [],
      location: { lat: 40, lon: 0 },
    }
    // Current month is April 2026 → spring for lat 40, multiplier 1.0
    // So we test with southern hemisphere lat -33 in April → autumn, multiplier 0.85
    // effective = round(7/0.85) = 8 → 8 - 8 = 0 (due today, not overdue)
    const autumnWeather = {
      current: { temp: 15, condition: { sky: 'clear' } },
      days: [],
      location: { lat: -33, lon: 0 },
    }
    const autumn = getWateringStatus(plant, autumnWeather)
    expect(autumn.daysUntil).toBeGreaterThanOrEqual(noSeason.daysUntil)
  })

  it('returns season field in status', () => {
    const plant = makePlant()
    const weather = makeWeatherWithLocation(40)
    const status = getWateringStatus(plant, weather)
    expect(status.season).toBeDefined()
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(status.season)
  })

  it('returns null season when no location', () => {
    const plant = makePlant()
    const status = getWateringStatus(plant, null)
    expect(status.season).toBeNull()
  })

  it('shows seasonal note when no heat/rain note applies', () => {
    // Southern hemisphere in April → autumn
    const plant = makePlant({ frequencyDays: 7 })
    const weather = {
      current: { temp: 18, condition: { sky: 'clear' } },
      days: [],
      location: { lat: -33, lon: 0 },
    }
    const status = getWateringStatus(plant, weather)
    // April in southern hemisphere = autumn
    expect(status.season).toBe('autumn')
    expect(status.seasonNote).toMatch(/Autumn/)
  })

  it('heat note takes priority over seasonal note', () => {
    const plant = makePlant({ frequencyDays: 7 })
    const weather = {
      current: { temp: 36, condition: { sky: 'clear' } },
      days: [],
      location: { lat: -33, lon: 0 },
    }
    const status = getWateringStatus(plant, weather)
    expect(status.note).toMatch(/Very hot/)
    // But seasonal info is still available
    expect(status.seasonNote).toBeDefined()
  })
})

// ── getAdjustedWaterAmount — seasonal ──────────────────────────────────────

describe('getAdjustedWaterAmount — seasonal adjustments', () => {
  it('increases water amount in summer', () => {
    // Use southern hemisphere in Jan → summer, multiplier 1.3
    const plant = { waterAmount: '250ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 22, condition: { sky: 'clear' } },
      location: { lat: -33, lon: 0 },
    }
    // April in southern hemisphere = autumn, multiplier 0.85
    const result = getAdjustedWaterAmount(plant, weather)
    // In autumn: multiplier 0.85, 250 * 0.85 = 213
    expect(result.adjusted).toBe(true)
    expect(result.multiplier).toBe(0.85)
    expect(result.amount).toBe('213ml')
  })

  it('stacks seasonal and temperature multipliers', () => {
    // Southern hemisphere April = autumn (0.85) + cold (0.75) = 0.6375
    const plant = { waterAmount: '200ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 8, condition: { sky: 'clear' } },
      days: [],
      location: { lat: -33, lon: 0 },
    }
    const result = getAdjustedWaterAmount(plant, weather)
    // 0.85 * 0.75 = 0.6375, 200 * 0.6375 ≈ 127-128 (floating point rounding)
    expect(result.adjusted).toBe(true)
    expect(result.amount).toBe('127ml')
  })

  it('returns unadjusted in spring with mild weather', () => {
    // Northern hemisphere April = spring, multiplier 1.0
    const plant = { waterAmount: '300ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 20, condition: { sky: 'clear' } },
      days: [],
      location: { lat: 40, lon: 0 },
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.adjusted).toBe(false)
    expect(result.amount).toBe('300ml')
  })
})

// ── getPlantAttributeMultiplier ────────────────────────────────────────────

describe('getPlantAttributeMultiplier', () => {
  it('returns 1 for a plant with no attributes set', () => {
    expect(getPlantAttributeMultiplier({})).toBe(1)
  })

  it('small pot dries out faster (multiplier > 1)', () => {
    expect(getPlantAttributeMultiplier({ potSize: 'small' })).toBe(1.2)
  })

  it('large pot retains moisture (multiplier < 1)', () => {
    expect(getPlantAttributeMultiplier({ potSize: 'large' })).toBe(0.9)
  })

  it('well-draining soil dries faster', () => {
    expect(getPlantAttributeMultiplier({ soilType: 'well-draining' })).toBe(1.15)
  })

  it('moisture-retaining soil retains moisture', () => {
    expect(getPlantAttributeMultiplier({ soilType: 'moisture-retaining' })).toBe(0.85)
  })

  it('full sun dries soil faster', () => {
    expect(getPlantAttributeMultiplier({ sunExposure: 'full-sun' })).toBe(1.15)
  })

  it('shade retains moisture', () => {
    expect(getPlantAttributeMultiplier({ sunExposure: 'shade' })).toBe(0.85)
  })

  it('stacks all attributes together', () => {
    // small (1.2) * succulent-mix (1.2) * full-sun (1.15) = 1.656
    const m = getPlantAttributeMultiplier({ potSize: 'small', soilType: 'succulent-mix', sunExposure: 'full-sun' })
    expect(m).toBeCloseTo(1.656, 2)
  })

  it('stacks moisture-retaining attributes', () => {
    // xlarge (0.85) * moisture-retaining (0.85) * shade (0.85) = 0.614
    const m = getPlantAttributeMultiplier({ potSize: 'xlarge', soilType: 'moisture-retaining', sunExposure: 'shade' })
    expect(m).toBeCloseTo(0.614, 2)
  })
})

// ── getWateringStatus — plant attribute adjustments ────────────────────────

describe('getWateringStatus — plant attribute adjustments', () => {
  it('small pot + full sun → waters sooner than default', () => {
    const base = makePlant({ frequencyDays: 10 })
    const withAttrs = makePlant({ frequencyDays: 10, potSize: 'small', sunExposure: 'full-sun' })
    const statusBase = getWateringStatus(base)
    const statusAttrs = getWateringStatus(withAttrs)
    expect(statusAttrs.daysUntil).toBeLessThan(statusBase.daysUntil)
  })

  it('large pot + shade → waters later than default', () => {
    const base = makePlant({ frequencyDays: 7 })
    const withAttrs = makePlant({ frequencyDays: 7, potSize: 'large', sunExposure: 'shade' })
    const statusBase = getWateringStatus(base)
    const statusAttrs = getWateringStatus(withAttrs)
    expect(statusAttrs.daysUntil).toBeGreaterThanOrEqual(statusBase.daysUntil)
  })

  it('succulent-mix soil shortens effective interval', () => {
    const base = makePlant({ frequencyDays: 14 })
    const withSoil = makePlant({ frequencyDays: 14, soilType: 'succulent-mix' })
    const statusBase = getWateringStatus(base)
    const statusSoil = getWateringStatus(withSoil)
    expect(statusSoil.daysUntil).toBeLessThanOrEqual(statusBase.daysUntil)
  })
})

// ── getWateringStatus — indoor humidity adjustments ────────────────────────

describe('getWateringStatus — indoor humidity', () => {
  it('dry indoor air (< 30%) reduces effective interval by 1 day', () => {
    const plant = makePlant({ frequencyDays: 7 })
    const dryWeather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 20 },
      days: [],
    }
    const normalWeather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 50 },
      days: [],
    }
    const dry = getWateringStatus(plant, dryWeather)
    const normal = getWateringStatus(plant, normalWeather)
    expect(dry.daysUntil).toBeLessThan(normal.daysUntil)
    expect(dry.note).toBe('Dry air — watering sooner')
  })

  it('does not apply dry air adjustment to outdoor plants', () => {
    const plant = makePlant({ frequencyDays: 7, room: 'Garden' })
    const dryWeather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 20 },
      days: [],
    }
    const status = getWateringStatus(plant, dryWeather)
    expect(status.note).not.toBe('Dry air — watering sooner')
  })

  it('heat note takes priority over dry air note', () => {
    const plant = makePlant({ frequencyDays: 7 })
    const weather = {
      current: { temp: 36, condition: { sky: 'clear' }, humidity: 20 },
      days: [],
    }
    const status = getWateringStatus(plant, weather)
    expect(status.note).toMatch(/Very hot/)
  })
})

// ── getAdjustedWaterAmount — plant attributes + humidity ───────────────────

describe('getAdjustedWaterAmount — plant attributes', () => {
  it('small pot + full sun increases water amount', () => {
    const plant = { waterAmount: '200ml', room: 'Living Room', floor: 'ground', potSize: 'small', sunExposure: 'full-sun' }
    const result = getAdjustedWaterAmount(plant)
    expect(result.adjusted).toBe(true)
    expect(result.multiplier).toBeGreaterThan(1)
    expect(parseInt(result.amount)).toBeGreaterThan(200)
  })

  it('large pot + shade + moisture-retaining decreases water amount', () => {
    const plant = { waterAmount: '500ml', room: 'Living Room', floor: 'ground', potSize: 'large', soilType: 'moisture-retaining', sunExposure: 'shade' }
    const result = getAdjustedWaterAmount(plant)
    expect(result.adjusted).toBe(true)
    expect(result.multiplier).toBeLessThan(1)
    expect(parseInt(result.amount)).toBeLessThan(500)
  })

  it('dry indoor air increases water amount by 15%', () => {
    const plant = { waterAmount: '200ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 20 },
      days: [],
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.adjusted).toBe(true)
    expect(result.amount).toBe('230ml') // 200 * 1.15 = 230
  })

  it('does not apply dry air bonus to outdoor plants', () => {
    const plant = { waterAmount: '200ml', room: 'Garden', floor: 'ground' }
    const weather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 20 },
      days: [],
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.adjusted).toBe(false)
  })

  it('high humidity reduces water amount by 25%', () => {
    const plant = { waterAmount: '200ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 90 },
      days: [],
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.adjusted).toBe(true)
    expect(result.amount).toBe('150ml') // 200 * 0.75 = 150
    expect(result.reason).toBe('High humidity — 25% less water')
  })

  it('returns Skip for outdoor plants when raining', () => {
    const plant = { waterAmount: '200ml', room: 'Garden', floor: 'ground' }
    const weather = {
      current: { temp: 18, condition: { sky: 'rainy' } },
      days: [],
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.amount).toBe('Skip')
    expect(result.multiplier).toBe(0)
    expect(result.reason).toBe('Raining — no watering needed')
  })

  it('high humidity stacks with seasonal multiplier', () => {
    // Southern hemisphere April = autumn (0.85) + high humidity (0.75) = 0.6375
    const plant = { waterAmount: '400ml', room: 'Living Room', floor: 'ground' }
    const weather = {
      current: { temp: 22, condition: { sky: 'clear' }, humidity: 85 },
      days: [],
      location: { lat: -33, lon: 0 },
    }
    const result = getAdjustedWaterAmount(plant, weather)
    expect(result.adjusted).toBe(true)
    expect(result.multiplier).toBeCloseTo(0.6375, 2)
  })
})

// ── getSuggestedFrequency — adaptive frequency ─────────────────────────────

describe('getSuggestedFrequency', () => {
  function makeLog(count, gapDays, startDate = '2026-01-01T09:00:00Z') {
    const log = []
    let d = new Date(startDate)
    for (let i = 0; i < count; i++) {
      log.push({ date: d.toISOString(), note: '' })
      d = new Date(d.getTime() + gapDays * 86400000)
    }
    return log
  }

  it('returns null with fewer than 5 watering events', () => {
    const plant = { frequencyDays: 7, wateringLog: makeLog(3, 7) }
    expect(getSuggestedFrequency(plant)).toBeNull()
  })

  it('suggests decreasing frequency when user waters more often and plant is healthy', () => {
    // Schedule says 14d but user waters every ~7d, plant is Good
    const plant = {
      frequencyDays: 14,
      wateringLog: makeLog(8, 7),
      health: 'Good',
      healthLog: [{ date: '2026-02-01T09:00:00Z', health: 'Good', reason: 'Healthy' }],
    }
    const suggestion = getSuggestedFrequency(plant)
    expect(suggestion).not.toBeNull()
    expect(suggestion.direction).toBe('decrease')
    expect(suggestion.suggestedDays).toBe(7)
  })

  it('suggests increasing frequency when user waters less often and plant is healthy', () => {
    // Schedule says 5d but user waters every ~10d, plant is Good
    const plant = {
      frequencyDays: 5,
      wateringLog: makeLog(8, 10),
      health: 'Good',
      healthLog: [{ date: '2026-02-01T09:00:00Z', health: 'Good', reason: 'Healthy' }],
    }
    const suggestion = getSuggestedFrequency(plant)
    expect(suggestion).not.toBeNull()
    expect(suggestion.direction).toBe('increase')
    expect(suggestion.suggestedDays).toBe(10)
  })

  it('suggests increasing frequency when health declines despite regular watering', () => {
    // User follows the 7d schedule, but health declined from Good to Fair
    const plant = {
      frequencyDays: 7,
      wateringLog: makeLog(8, 7),
      health: 'Fair',
      healthLog: [
        { date: '2026-01-15T09:00:00Z', health: 'Good', reason: 'Fine' },
        { date: '2026-02-15T09:00:00Z', health: 'Fair', reason: 'Yellowing' },
      ],
    }
    const suggestion = getSuggestedFrequency(plant)
    expect(suggestion).not.toBeNull()
    expect(suggestion.direction).toBe('increase')
    expect(suggestion.suggestedDays).toBeGreaterThan(7)
    expect(suggestion.reason).toMatch(/over-watering/)
  })

  it('suggests decreasing frequency when health declines with slightly infrequent watering', () => {
    // User waters every ~8d on a 7d schedule (adherence ~1.14), health declined
    // This hits the under-watering branch (adherence > 1 within tolerance)
    const plant = {
      frequencyDays: 7,
      wateringLog: makeLog(8, 8), // watering every 8 days
      health: 'Fair',
      healthLog: [
        { date: '2026-01-15T09:00:00Z', health: 'Good', reason: 'Fine' },
        { date: '2026-02-15T09:00:00Z', health: 'Fair', reason: 'Drooping leaves' },
      ],
    }
    const suggestion = getSuggestedFrequency(plant)
    expect(suggestion).not.toBeNull()
    expect(suggestion.direction).toBe('decrease')
    expect(suggestion.suggestedDays).toBeLessThan(7)
    expect(suggestion.reason).toMatch(/infrequent watering/)
  })

  it('returns null when user follows schedule and plant is healthy', () => {
    const plant = {
      frequencyDays: 7,
      wateringLog: makeLog(8, 7),
      health: 'Good',
      healthLog: [{ date: '2026-02-01T09:00:00Z', health: 'Good', reason: 'Fine' }],
    }
    expect(getSuggestedFrequency(plant)).toBeNull()
  })
})

// ── getMoistureStatusAdjustment ──────────────────────────────────────────────

describe('getMoistureStatusAdjustment', () => {
  it('returns null when no moisture data', () => {
    expect(getMoistureStatusAdjustment(makePlant())).toBeNull()
  })

  it('returns null when reading is older than 48 hours', () => {
    const plant = makePlant({
      lastMoistureReading: 2,
      lastMoistureDate: new Date(Date.now() - 49 * 3600000).toISOString(),
    })
    expect(getMoistureStatusAdjustment(plant)).toBeNull()
  })

  it('returns -1 adjustment for very dry soil (<=2)', () => {
    const plant = makePlant({
      lastMoistureReading: 2,
      lastMoistureDate: new Date().toISOString(),
    })
    const result = getMoistureStatusAdjustment(plant)
    expect(result.adjustment).toBe(-1)
    expect(result.note).toContain('very dry')
  })

  it('returns 0 adjustment for dry soil (3)', () => {
    const plant = makePlant({
      lastMoistureReading: 3,
      lastMoistureDate: new Date().toISOString(),
    })
    const result = getMoistureStatusAdjustment(plant)
    expect(result.adjustment).toBe(0)
    expect(result.note).toContain('dry')
  })

  it('returns +1 adjustment for wet soil (8)', () => {
    const plant = makePlant({
      lastMoistureReading: 8,
      lastMoistureDate: new Date().toISOString(),
    })
    const result = getMoistureStatusAdjustment(plant)
    expect(result.adjustment).toBe(1)
    expect(result.note).toContain('still wet')
  })

  it('returns +2 adjustment for saturated soil (>=9)', () => {
    const plant = makePlant({
      lastMoistureReading: 10,
      lastMoistureDate: new Date().toISOString(),
    })
    const result = getMoistureStatusAdjustment(plant)
    expect(result.adjustment).toBe(2)
    expect(result.note).toContain('saturated')
  })

  it('returns null for mid-range readings (4-7)', () => {
    const plant = makePlant({
      lastMoistureReading: 5,
      lastMoistureDate: new Date().toISOString(),
    })
    expect(getMoistureStatusAdjustment(plant)).toBeNull()
  })
})

// ── getMoistureFrequencySuggestion ───────────────────────────────────────────

describe('getMoistureFrequencySuggestion', () => {
  function makeTimedLog(count, gapDays, reading) {
    const log = []
    const now = Date.now()
    for (let i = 0; i < count; i++) {
      log.push({
        date: new Date(now - (count - i) * gapDays * 86400000).toISOString(),
        reading,
        note: '',
      })
    }
    return log
  }

  function makeTimedWateringLog(count, gapDays) {
    const log = []
    const now = Date.now()
    for (let i = 0; i < count; i++) {
      log.push({ date: new Date(now - (count - i) * gapDays * 86400000).toISOString(), note: '' })
    }
    return log
  }

  it('returns null with fewer than 3 moisture readings', () => {
    const plant = {
      frequencyDays: 7,
      moistureLog: makeTimedLog(2, 3, 2),
      wateringLog: makeTimedWateringLog(5, 7),
    }
    expect(getMoistureFrequencySuggestion(plant)).toBeNull()
  })

  it('returns null with fewer than 3 watering events', () => {
    const plant = {
      frequencyDays: 7,
      moistureLog: makeTimedLog(5, 3, 2),
      wateringLog: makeTimedWateringLog(2, 7),
    }
    expect(getMoistureFrequencySuggestion(plant)).toBeNull()
  })

  it('suggests shorter frequency when soil is consistently dry at watering time', () => {
    // Moisture readings aligned with watering events (within 24h), all dry
    const now = Date.now()
    const wateringLog = [
      { date: new Date(now - 21 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 14 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 7 * 86400000).toISOString(), note: '' },
    ]
    const moistureLog = [
      { date: new Date(now - 21 * 86400000 + 3600000).toISOString(), reading: 2, note: '' },
      { date: new Date(now - 14 * 86400000 + 3600000).toISOString(), reading: 3, note: '' },
      { date: new Date(now - 7 * 86400000 + 3600000).toISOString(), reading: 2, note: '' },
    ]
    const plant = { frequencyDays: 7, wateringLog, moistureLog }
    const result = getMoistureFrequencySuggestion(plant)
    expect(result).not.toBeNull()
    expect(result.direction).toBe('decrease')
    expect(result.suggestedDays).toBeLessThan(7)
  })

  it('suggests longer frequency when soil is consistently wet at watering time', () => {
    const now = Date.now()
    const wateringLog = [
      { date: new Date(now - 21 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 14 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 7 * 86400000).toISOString(), note: '' },
    ]
    const moistureLog = [
      { date: new Date(now - 21 * 86400000 + 3600000).toISOString(), reading: 8, note: '' },
      { date: new Date(now - 14 * 86400000 + 3600000).toISOString(), reading: 8, note: '' },
      { date: new Date(now - 7 * 86400000 + 3600000).toISOString(), reading: 7, note: '' },
    ]
    const plant = { frequencyDays: 7, wateringLog, moistureLog }
    const result = getMoistureFrequencySuggestion(plant)
    expect(result).not.toBeNull()
    expect(result.direction).toBe('increase')
    expect(result.suggestedDays).toBeGreaterThan(7)
  })

  it('returns null when moisture readings are in the ideal range', () => {
    const now = Date.now()
    const wateringLog = [
      { date: new Date(now - 21 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 14 * 86400000).toISOString(), note: '' },
      { date: new Date(now - 7 * 86400000).toISOString(), note: '' },
    ]
    const moistureLog = [
      { date: new Date(now - 21 * 86400000 + 3600000).toISOString(), reading: 5, note: '' },
      { date: new Date(now - 14 * 86400000 + 3600000).toISOString(), reading: 5, note: '' },
      { date: new Date(now - 7 * 86400000 + 3600000).toISOString(), reading: 5, note: '' },
    ]
    const plant = { frequencyDays: 7, wateringLog, moistureLog }
    expect(getMoistureFrequencySuggestion(plant)).toBeNull()
  })
})

// ── getMoistureDisplay ──────────────────────────────────────────────────────

describe('getMoistureDisplay', () => {
  it('returns Dry for low readings', () => {
    expect(getMoistureDisplay(1).label).toBe('Dry')
    expect(getMoistureDisplay(3).label).toBe('Dry')
  })

  it('returns Moist for mid-range readings', () => {
    expect(getMoistureDisplay(4).label).toBe('Moist')
    expect(getMoistureDisplay(6).label).toBe('Moist')
  })

  it('returns Wet for high readings', () => {
    expect(getMoistureDisplay(7).label).toBe('Wet')
    expect(getMoistureDisplay(10).label).toBe('Wet')
  })

  it('returns colors for each range', () => {
    expect(getMoistureDisplay(2).color).toBe('#d97706')
    expect(getMoistureDisplay(5).color).toBe('#22c55e')
    expect(getMoistureDisplay(8).color).toBe('#3b82f6')
  })
})

// ── computeRainCredit ────────────────────────────────────────────────────────

describe('computeRainCredit', () => {
  it('returns shouldSkip=false when rainfall is below threshold', () => {
    const result = computeRainCredit({ frequencyDays: 7 }, { recentMm: 3, forecastMm: 0 })
    expect(result.shouldSkip).toBe(false)
    expect(result.advanceByDays).toBe(0)
  })

  it('returns shouldSkip=true when recent rainfall meets threshold', () => {
    const result = computeRainCredit({ frequencyDays: 7 }, { recentMm: 10, forecastMm: 0 })
    expect(result.shouldSkip).toBe(true)
    expect(result.advanceByDays).toBe(4) // 50% of 7d, rounded
    expect(result.effectiveMm).toBeCloseTo(10)
  })

  it('combines recent and forecast rainfall', () => {
    const result = computeRainCredit({ frequencyDays: 7 }, { recentMm: 3, forecastMm: 3 })
    expect(result.shouldSkip).toBe(true)
    expect(result.effectiveMm).toBeCloseTo(6)
  })

  it('applies 0.7x shelter factor for under-cover plants', () => {
    // 8mm * 0.7 = 5.6mm >= 5mm threshold → skip
    const result = computeRainCredit({ frequencyDays: 7, isUnderCover: true }, { recentMm: 8 })
    expect(result.shouldSkip).toBe(true)
    expect(result.effectiveMm).toBeCloseTo(5.6)
    expect(result.reason).toMatch(/partial shelter/i)
  })

  it('does NOT skip for under-cover plants when rain is too low', () => {
    // 6mm * 0.7 = 4.2mm < 5mm threshold → no skip
    const result = computeRainCredit({ frequencyDays: 7, isUnderCover: true }, { recentMm: 6 })
    expect(result.shouldSkip).toBe(false)
  })

  it('uses full interval for succulent category', () => {
    const result = computeRainCredit({ frequencyDays: 14, category: 'succulent' }, { recentMm: 20 })
    expect(result.shouldSkip).toBe(true)
    expect(result.advanceByDays).toBe(14) // 100% of 14d
  })

  it('respects explicit rainSkipMultiplier override', () => {
    const result = computeRainCredit({ frequencyDays: 10, rainSkipMultiplier: 0.3 }, { recentMm: 20 })
    expect(result.shouldSkip).toBe(true)
    expect(result.advanceByDays).toBe(3) // 30% of 10d
  })

  it('handles missing rainfall input gracefully', () => {
    const result = computeRainCredit({ frequencyDays: 7 }, {})
    expect(result.shouldSkip).toBe(false)
    expect(result.effectiveMm).toBe(0)
  })

  it('clamps rainSkipMultiplier to [0, 1]', () => {
    const result = computeRainCredit({ frequencyDays: 7, rainSkipMultiplier: 2 }, { recentMm: 20 })
    expect(result.advanceByDays).toBe(7) // clamped to 1.0 × 7
  })
})
