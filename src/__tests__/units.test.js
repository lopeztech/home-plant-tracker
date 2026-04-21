import { describe, it, expect } from 'vitest'
import { formatLength, formatTemperatureC, POT_SIZES, unitSystemLabel } from '../utils/units.js'

describe('formatLength', () => {
  it('returns cm for metric', () => {
    expect(formatLength(30, 'metric')).toBe('30 cm')
  })

  it('converts to inches for imperial', () => {
    expect(formatLength(25.4, 'imperial')).toBe('10 in')
  })

  it('rounds to 1 decimal for non-integer inches', () => {
    expect(formatLength(15, 'imperial')).toBe('5.9 in')
  })

  it('defaults to metric when system is undefined', () => {
    expect(formatLength(10, undefined)).toBe('10 cm')
  })
})

describe('formatTemperatureC', () => {
  it('displays Celsius for celsius unit', () => {
    expect(formatTemperatureC(30, 'celsius')).toBe('30°C')
  })

  it('converts to Fahrenheit for fahrenheit unit', () => {
    expect(formatTemperatureC(0, 'fahrenheit')).toBe('32°F')
    expect(formatTemperatureC(100, 'fahrenheit')).toBe('212°F')
  })

  it('rounds to nearest integer', () => {
    expect(formatTemperatureC(36.6, 'celsius')).toBe('37°C')
    expect(formatTemperatureC(37, 'fahrenheit')).toBe('99°F')
  })

  it('handles the forecast thresholds (30°C = 86°F, 10°C = 50°F)', () => {
    expect(formatTemperatureC(30, 'fahrenheit')).toBe('86°F')
    expect(formatTemperatureC(10, 'fahrenheit')).toBe('50°F')
  })
})

describe('POT_SIZES', () => {
  it('metric sizes contain cm units', () => {
    expect(POT_SIZES.metric.every(s => s.label.includes('cm'))).toBe(true)
  })

  it('imperial sizes contain in units', () => {
    expect(POT_SIZES.imperial.every(s => s.label.includes('in'))).toBe(true)
  })

  it('both systems have the same value keys', () => {
    const metricValues = POT_SIZES.metric.map(s => s.value)
    const imperialValues = POT_SIZES.imperial.map(s => s.value)
    expect(metricValues).toEqual(imperialValues)
  })
})

describe('unitSystemLabel', () => {
  it('returns label for metric', () => {
    expect(unitSystemLabel('metric')).toContain('Metric')
  })

  it('returns label for imperial', () => {
    expect(unitSystemLabel('imperial')).toContain('Imperial')
  })
})
