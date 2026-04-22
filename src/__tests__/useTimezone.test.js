import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimezone, TIMEZONE_GROUPS } from '../hooks/useTimezone.js'

describe('useTimezone', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to the browser IANA timezone when no preference is stored', () => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { result } = renderHook(() => useTimezone())
    expect(result.current.timezone).toBe(browserTz)
  })

  it('reads a previously stored timezone from localStorage', () => {
    localStorage.setItem('plantTracker_timezone', 'Europe/Berlin')
    const { result } = renderHook(() => useTimezone())
    expect(result.current.timezone).toBe('Europe/Berlin')
  })

  it('setTimezone updates the state and persists to localStorage', () => {
    const { result } = renderHook(() => useTimezone())
    act(() => {
      result.current.setTimezone('Asia/Tokyo')
    })
    expect(result.current.timezone).toBe('Asia/Tokyo')
    expect(localStorage.getItem('plantTracker_timezone')).toBe('Asia/Tokyo')
  })
})

describe('TIMEZONE_GROUPS', () => {
  it('includes a UTC group', () => {
    const utcGroup = TIMEZONE_GROUPS.find((g) => g.label === 'UTC')
    expect(utcGroup).toBeDefined()
    expect(utcGroup.zones).toContain('UTC')
  })

  it('includes common timezones in each region', () => {
    const labels = TIMEZONE_GROUPS.map((g) => g.label)
    expect(labels).toContain('Americas')
    expect(labels).toContain('Europe')
    expect(labels).toContain('Asia')
    expect(labels).toContain('Pacific')
  })

  it('every zone string is non-empty', () => {
    for (const group of TIMEZONE_GROUPS) {
      for (const tz of group.zones) {
        expect(tz.length).toBeGreaterThan(0)
      }
    }
  })
})
