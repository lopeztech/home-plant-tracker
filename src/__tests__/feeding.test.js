import { describe, it, expect } from 'vitest'
import {
  getFeedingStatus,
  getNextFeedDate,
  getBaseFeedFrequencyDays,
} from '../utils/feeding.js'

const DAY = 24 * 60 * 60 * 1000

// Northern hemisphere latitude for predictable season lookup.
const NH = { location: { lat: 51.5 } } // London-ish
const SH = { location: { lat: -33.8 } } // Sydney-ish

describe('getBaseFeedFrequencyDays', () => {
  it('uses the fertiliser.frequencyDays override when provided', () => {
    expect(getBaseFeedFrequencyDays({ fertiliser: { frequencyDays: 21 } })).toBe(21)
  })

  it('defaults to ~14 days for a pot with no extra context', () => {
    const v = getBaseFeedFrequencyDays({ plantedIn: 'pot' })
    expect(v).toBeGreaterThanOrEqual(7)
    expect(v).toBeLessThanOrEqual(14)
  })

  it('feeds in-ground plants less often than potted ones', () => {
    const pot    = getBaseFeedFrequencyDays({ plantedIn: 'pot',    name: 'Fern' })
    const bed    = getBaseFeedFrequencyDays({ plantedIn: 'garden-bed', name: 'Fern' })
    const ground = getBaseFeedFrequencyDays({ plantedIn: 'ground', name: 'Fern' })
    expect(bed).toBeGreaterThanOrEqual(pot)
    expect(ground).toBeGreaterThanOrEqual(bed)
  })

  it('feeds edible/hungry species more often than ornamental ones', () => {
    const tomato = getBaseFeedFrequencyDays({ plantedIn: 'pot', name: 'Tomato', species: 'Solanum lycopersicum' })
    const fern   = getBaseFeedFrequencyDays({ plantedIn: 'pot', name: 'Fern',   species: 'Nephrolepis' })
    expect(tomato).toBeLessThan(fern)
  })
})

describe('getFeedingStatus — season awareness', () => {
  it('skips feeding in northern-hemisphere winter', () => {
    const now = new Date('2026-01-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', lastFertilised: '2025-12-01T00:00:00Z' }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(true)
    expect(status.season).toBe('winter')
    expect(status.reason).toMatch(/dormant/i)
  })

  it('does NOT skip when it is summer in the southern hemisphere in January', () => {
    const now = new Date('2026-01-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', lastFertilised: '2025-11-01T00:00:00Z' }
    const status = getFeedingStatus(plant, SH, now)
    expect(status.season).toBe('summer')
    expect(status.skip).toBe(false)
  })

  it('feeds roughly on baseline cadence in spring', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', lastFertilised: '2026-03-15T00:00:00Z' }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.season).toBe('spring')
    expect(status.skip).toBe(false)
    expect(status.daysUntil).toBeLessThanOrEqual(0)
  })
})

describe('getFeedingStatus — health / moisture overrides', () => {
  it('skips and halves dose advice when plant health is Poor', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Poor', lastFertilised: '2026-03-01T00:00:00Z' }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(true)
    expect(status.reason).toMatch(/half strength|feeding/i)
  })

  it('dilutes (does not skip) when health is Fair', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Fair', lastFertilised: '2026-03-01T00:00:00Z' }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(false)
    expect(status.dilutionAdjustment).toBeLessThan(1)
    expect(status.reason).toMatch(/half strength/i)
  })

  it('skips feeding when the latest moisture reading is 2 or below (bone-dry)', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = {
      plantedIn: 'pot', name: 'Fern', health: 'Good', lastFertilised: '2026-03-01T00:00:00Z',
      moistureLog: [{ date: '2026-04-14T00:00:00Z', reading: 2 }],
    }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(true)
    expect(status.reason).toMatch(/dry/i)
  })

  it('does NOT skip when the latest moisture reading is comfortable', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = {
      plantedIn: 'pot', name: 'Fern', health: 'Good', lastFertilised: '2026-03-01T00:00:00Z',
      moistureLog: [{ date: '2026-04-14T00:00:00Z', reading: 6 }],
    }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(false)
  })
})

describe('getFeedingStatus — cadence math', () => {
  it('returns daysUntil near zero for a never-fed plant', () => {
    const now = new Date('2026-04-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Good' }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.skip).toBe(false)
    expect(status.daysUntil).toBeLessThanOrEqual(0)
  })

  it('still shows as due when last fed was long enough ago', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Good', lastFertilised: new Date(now.getTime() - 40 * DAY).toISOString() }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.daysUntil).toBeLessThanOrEqual(0)
  })

  it('shows a future feeding day when last fed was recent', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Good', lastFertilised: new Date(now.getTime() - 3 * DAY).toISOString() }
    const status = getFeedingStatus(plant, NH, now)
    expect(status.daysUntil).toBeGreaterThan(0)
  })
})

describe('getNextFeedDate', () => {
  it('returns null during dormancy', () => {
    const now = new Date('2026-01-15T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', lastFertilised: '2025-12-01T00:00:00Z' }
    expect(getNextFeedDate(plant, NH, now)).toBeNull()
  })

  it('returns a Date during growing season', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plant = { plantedIn: 'pot', name: 'Fern', health: 'Good', lastFertilised: new Date(now.getTime() - 3 * DAY).toISOString() }
    const next = getNextFeedDate(plant, NH, now)
    expect(next).toBeInstanceOf(Date)
    expect(next.getTime()).toBeGreaterThan(now.getTime())
  })
})
