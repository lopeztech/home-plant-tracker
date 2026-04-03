import { describe, it, expect } from 'vitest'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'

// Helper: generate evenly spaced watering log entries
function makeLog(count, intervalDays, startDate = '2026-01-01') {
  const base = new Date(startDate)
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(base.getTime() + i * intervalDays * 86400000).toISOString(),
  }))
}

describe('analyseWateringPattern', () => {
  it('returns insufficient_data with fewer than 3 entries', () => {
    const result = analyseWateringPattern({ wateringLog: [{ date: '2026-01-01' }] })
    expect(result.pattern).toBe('insufficient_data')
    expect(result.confidence).toBe(0)
    expect(result.contributingFactors).toHaveLength(1)
  })

  it('returns insufficient_data when wateringLog is missing', () => {
    expect(analyseWateringPattern({}).pattern).toBe('insufficient_data')
  })

  it('returns insufficient_data with exactly 2 entries', () => {
    const result = analyseWateringPattern({ wateringLog: makeLog(2, 7) })
    expect(result.pattern).toBe('insufficient_data')
  })

  it('returns optimal when watering matches recommended frequency', () => {
    const result = analyseWateringPattern({ frequencyDays: 7, wateringLog: makeLog(5, 7) })
    expect(result.pattern).toBe('optimal')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.contributingFactors.some(f => f.includes('closely matches'))).toBe(true)
  })

  it('optimal pattern notes stable health when no decline', () => {
    const result = analyseWateringPattern({
      frequencyDays: 7,
      wateringLog: makeLog(5, 7),
      healthLog: [
        { health: 'Good' },
        { health: 'Excellent' },
      ],
    })
    expect(result.pattern).toBe('optimal')
    expect(result.contributingFactors.some(f => f.includes('stable or improving'))).toBe(true)
  })

  it('returns over_watered when watering far more often than recommended', () => {
    // Water every 2 days, recommended every 14 (adherence = 2/14 ≈ 0.14)
    const result = analyseWateringPattern({ frequencyDays: 14, wateringLog: makeLog(5, 2) })
    expect(result.pattern).toBe('over_watered')
    expect(result.confidence).toBe(0.5)
  })

  it('returns over_watered with higher confidence when health declined', () => {
    const result = analyseWateringPattern({
      frequencyDays: 14,
      wateringLog: makeLog(5, 2),
      healthLog: [
        { health: 'Excellent' },
        { health: 'Poor' },
      ],
    })
    expect(result.pattern).toBe('over_watered')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.contributingFactors.some(f => f.includes('Health'))).toBe(true)
  })

  it('returns under_watered when watering far less often than recommended', () => {
    // Water every 21 days, recommended every 7 (adherence = 21/7 = 3.0)
    const result = analyseWateringPattern({ frequencyDays: 7, wateringLog: makeLog(4, 21) })
    expect(result.pattern).toBe('under_watered')
    expect(result.confidence).toBe(0.5)
  })

  it('returns under_watered with higher confidence when health declined', () => {
    const result = analyseWateringPattern({
      frequencyDays: 7,
      wateringLog: makeLog(4, 21),
      healthLog: [
        { health: 'Good' },
        { health: 'Fair' },
      ],
    })
    expect(result.pattern).toBe('under_watered')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.contributingFactors.some(f => f.includes('Health'))).toBe(true)
  })

  it('returns inconsistent when watering gaps vary wildly', () => {
    const wateringLog = [
      { date: '2026-01-01T00:00:00.000Z' },
      { date: '2026-01-02T00:00:00.000Z' },  // 1 day gap
      { date: '2026-01-22T00:00:00.000Z' },  // 20 day gap
      { date: '2026-01-23T00:00:00.000Z' },  // 1 day gap
    ]
    const result = analyseWateringPattern({ frequencyDays: 7, wateringLog })
    expect(result.pattern).toBe('inconsistent')
    expect(result.contributingFactors.some(f => f.includes('variability'))).toBe(true)
    expect(result.contributingFactors.some(f => f.includes('Gaps range'))).toBe(true)
  })

  it('defaults frequencyDays to 7 when not provided', () => {
    const result = analyseWateringPattern({ wateringLog: makeLog(5, 7) })
    expect(result.pattern).toBe('optimal')
  })

  it('confidence is capped at 0.95', () => {
    // Very high cv → inconsistent with high confidence
    const wateringLog = [
      { date: '2026-01-01T00:00:00.000Z' },
      { date: '2026-01-02T00:00:00.000Z' },
      { date: '2026-04-01T00:00:00.000Z' },
      { date: '2026-04-02T00:00:00.000Z' },
    ]
    const result = analyseWateringPattern({ frequencyDays: 7, wateringLog })
    expect(result.confidence).toBeLessThanOrEqual(0.95)
  })
})

describe('getPatternMeta', () => {
  it('returns correct metadata for each known pattern', () => {
    expect(getPatternMeta('optimal').label).toBe('Optimal')
    expect(getPatternMeta('over_watered').label).toBe('Over-watered')
    expect(getPatternMeta('under_watered').label).toBe('Under-watered')
    expect(getPatternMeta('inconsistent').label).toBe('Inconsistent')
    expect(getPatternMeta('insufficient_data').label).toBe('No data')
  })

  it('each pattern has color and bgClass', () => {
    for (const p of ['optimal', 'over_watered', 'under_watered', 'inconsistent', 'insufficient_data']) {
      const meta = getPatternMeta(p)
      expect(meta.color).toBeTruthy()
      expect(meta.bgClass).toBeTruthy()
    }
  })

  it('returns insufficient_data meta for unknown pattern', () => {
    expect(getPatternMeta('unknown')).toEqual(getPatternMeta('insufficient_data'))
  })
})
