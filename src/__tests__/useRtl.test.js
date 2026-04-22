import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Control i18n language per test
let mockLanguage = 'en'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mockLanguage } }),
}))

import { useRtl, RTL_LANGS } from '../hooks/useRtl.js'

describe('RTL_LANGS', () => {
  it('includes Arabic and Hebrew', () => {
    expect(RTL_LANGS.has('ar')).toBe(true)
    expect(RTL_LANGS.has('he')).toBe(true)
  })

  it('does not include LTR languages', () => {
    expect(RTL_LANGS.has('en')).toBe(false)
    expect(RTL_LANGS.has('es')).toBe(false)
    expect(RTL_LANGS.has('fr')).toBe(false)
  })
})

describe('useRtl', () => {
  beforeEach(() => {
    mockLanguage = 'en'
    document.documentElement.dir = ''
    document.documentElement.lang = ''
    document.getElementById('bootstrap-rtl')?.remove()
  })

  afterEach(() => {
    document.getElementById('bootstrap-rtl')?.remove()
    document.documentElement.dir = ''
  })

  it('sets dir=ltr and lang for LTR language', () => {
    mockLanguage = 'en'
    renderHook(() => useRtl())
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
  })

  it('sets dir=rtl for Arabic', () => {
    mockLanguage = 'ar'
    renderHook(() => useRtl())
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('injects Bootstrap RTL link when RTL language is active', () => {
    mockLanguage = 'ar'
    renderHook(() => useRtl())
    const link = document.getElementById('bootstrap-rtl')
    expect(link).not.toBeNull()
    expect(link.href).toContain('bootstrap.rtl.min.css')
    expect(link.rel).toBe('stylesheet')
  })

  it('does not inject RTL link for LTR language', () => {
    mockLanguage = 'en'
    renderHook(() => useRtl())
    expect(document.getElementById('bootstrap-rtl')).toBeNull()
  })

  it('removes RTL link when switching from RTL to LTR', () => {
    mockLanguage = 'ar'
    const { rerender } = renderHook(() => useRtl())
    expect(document.getElementById('bootstrap-rtl')).not.toBeNull()

    mockLanguage = 'en'
    rerender()
    expect(document.getElementById('bootstrap-rtl')).toBeNull()
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('does not inject duplicate RTL links on multiple renders', () => {
    mockLanguage = 'ar'
    const { rerender } = renderHook(() => useRtl())
    rerender()
    rerender()
    expect(document.querySelectorAll('#bootstrap-rtl').length).toBe(1)
  })

  it('returns isRtl=true for Arabic', () => {
    mockLanguage = 'ar'
    const { result } = renderHook(() => useRtl())
    expect(result.current.isRtl).toBe(true)
  })

  it('returns isRtl=false for English', () => {
    mockLanguage = 'en'
    const { result } = renderHook(() => useRtl())
    expect(result.current.isRtl).toBe(false)
  })

  it('strips sub-tags from language code (e.g. ar-SA → ar)', () => {
    mockLanguage = 'ar-SA'
    renderHook(() => useRtl())
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })
})
