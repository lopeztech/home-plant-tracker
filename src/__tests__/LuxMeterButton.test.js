import { describe, it, expect } from 'vitest'
import { luxVerdict, formatLux } from '../components/LuxMeterButton.jsx'

describe('formatLux', () => {
  it('shows raw lux under 1000', () => {
    expect(formatLux(200)).toBe('200 lux')
    expect(formatLux(999)).toBe('999 lux')
  })

  it('shows k suffix above 1000', () => {
    expect(formatLux(1000)).toBe('1.0k lux')
    expect(formatLux(3500)).toBe('3.5k lux')
  })

  it('shows rounded k above 10000', () => {
    expect(formatLux(15000)).toBe('15k lux')
    expect(formatLux(50000)).toBe('50k lux')
  })
})

describe('luxVerdict', () => {
  it('returns null for unknown sunExposure', () => {
    expect(luxVerdict(1000, null)).toBeNull()
    expect(luxVerdict(1000, 'unknown-value')).toBeNull()
  })

  it('full-sun: bright reading → success', () => {
    const v = luxVerdict(20000, 'full-sun')
    expect(v.color).toBe('success')
  })

  it('full-sun: dim reading → danger', () => {
    const v = luxVerdict(300, 'full-sun')
    expect(v.color).toBe('danger')
    expect(v.text).toMatch(/too dark/i)
  })

  it('part-sun: adequate reading → warning', () => {
    const v = luxVerdict(1500, 'part-sun')
    expect(v.color).toBe('warning')
  })

  it('part-sun: ideal reading → success', () => {
    const v = luxVerdict(5000, 'part-sun')
    expect(v.color).toBe('success')
  })

  it('shade: ideal lux → success', () => {
    const v = luxVerdict(600, 'shade')
    expect(v.color).toBe('success')
  })

  it('shade: adequate lux → warning', () => {
    const v = luxVerdict(300, 'shade')
    expect(v.color).toBe('warning')
  })

  it('shade: below minimum → danger', () => {
    const v = luxVerdict(20, 'shade')
    expect(v.color).toBe('danger')
  })
})
