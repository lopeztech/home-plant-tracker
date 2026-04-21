import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDate, formatTime, formatRelativeTime, formatNumber, getLocale, setLocale } from '../utils/format.js'

// Use a fixed locale for deterministic test output
beforeEach(() => {
  setLocale('en-US')
})

afterEach(() => {
  try { localStorage.removeItem('plantTracker_locale') } catch {}
})

describe('formatDate', () => {
  it('formats a date with en-US locale', () => {
    const result = formatDate('2026-04-21', { year: 'numeric', month: 'long', day: 'numeric' })
    expect(result).toContain('April')
    expect(result).toContain('2026')
  })

  it('formats with short month', () => {
    const result = formatDate('2026-04-21T12:00:00Z', { month: 'short', day: 'numeric' })
    expect(result).toMatch(/Apr/)
  })

  it('returns weekday name for weekday option', () => {
    const result = formatDate('2026-04-21T12:00:00', { weekday: 'long' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('falls back gracefully for invalid dates', () => {
    const result = formatDate('not-a-date', { year: 'numeric' })
    expect(typeof result).toBe('string')
  })
})

describe('formatTime', () => {
  it('returns a non-empty string', () => {
    const result = formatTime('2026-04-21T14:30:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('uses custom options when provided', () => {
    const result = formatTime('2026-04-21T14:30:00Z', { hour: '2-digit', minute: '2-digit', hour12: false })
    expect(result).toMatch(/\d{2}:\d{2}/)
  })
})

describe('formatRelativeTime', () => {
  it('returns "yesterday" for a date ~24h in the past', () => {
    const d = new Date(Date.now() - 25 * 3_600_000).toISOString()
    const result = formatRelativeTime(d)
    expect(result).toMatch(/yesterday|1 day ago/i)
  })

  it('returns a future string for a future date', () => {
    const d = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const result = formatRelativeTime(d)
    expect(result).toMatch(/day|tomorrow/i)
  })

  it('handles minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60_000).toISOString()
    const result = formatRelativeTime(d)
    expect(result).toMatch(/minute/i)
  })
})

describe('formatNumber', () => {
  it('formats integers without decimals', () => {
    setLocale('en-US')
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('formats decimals', () => {
    setLocale('en-US')
    expect(formatNumber(3.14, { minimumFractionDigits: 2 })).toBe('3.14')
  })

  it('uses locale-specific decimal separator for de-DE', () => {
    setLocale('de-DE')
    const result = formatNumber(3.14, { minimumFractionDigits: 2 })
    expect(result).toContain(',')
  })
})

describe('getLocale / setLocale', () => {
  it('setLocale persists and getLocale reads it', () => {
    setLocale('ja-JP')
    expect(getLocale()).toBe('ja-JP')
  })
})
