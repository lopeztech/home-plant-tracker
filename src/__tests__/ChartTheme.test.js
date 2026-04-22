import { describe, it, expect } from 'vitest'
import {
  OKABE_ITO,
  HEALTH_COLORS,
  getApexTheme,
  getApexAxisDefaults,
  heatmapColor,
  categoricalColor,
  divergingColor,
} from '../charts/theme.js'

describe('OKABE_ITO palette', () => {
  it('has 7 entries', () => {
    expect(OKABE_ITO).toHaveLength(7)
  })

  it('contains hex color strings', () => {
    OKABE_ITO.forEach((c) => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/))
  })
})

describe('HEALTH_COLORS', () => {
  it('maps all four health states', () => {
    expect(HEALTH_COLORS.Excellent).toBeTruthy()
    expect(HEALTH_COLORS.Good).toBeTruthy()
    expect(HEALTH_COLORS.Fair).toBeTruthy()
    expect(HEALTH_COLORS.Poor).toBeTruthy()
  })
})

describe('getApexTheme', () => {
  it('returns dark mode when mode is dark', () => {
    const t = getApexTheme('dark')
    expect(t.mode).toBe('dark')
  })

  it('returns light mode by default', () => {
    const t = getApexTheme('light')
    expect(t.mode).toBe('light')
  })
})

describe('getApexAxisDefaults', () => {
  it('returns tooltip theme dark when mode is dark', () => {
    const d = getApexAxisDefaults('dark')
    expect(d.tooltip.theme).toBe('dark')
  })

  it('returns tooltip theme light for light mode', () => {
    const d = getApexAxisDefaults('light')
    expect(d.tooltip.theme).toBe('light')
  })

  it('includes xaxis and yaxis label styles', () => {
    const d = getApexAxisDefaults('light')
    expect(d.xaxis.labels.style.colors).toBeTruthy()
    expect(d.yaxis.labels.style.colors).toBeTruthy()
  })
})

describe('heatmapColor', () => {
  it('returns css variable for count 0', () => {
    expect(heatmapColor(0)).toContain('var(')
  })

  it('returns a hex color for count > 0', () => {
    expect(heatmapColor(1)).toMatch(/^#/)
    expect(heatmapColor(3)).toMatch(/^#/)
  })

  it('max count returns the darkest stop', () => {
    const maxColor = heatmapColor(100, 100)
    const twoColor = heatmapColor(1, 100)
    expect(maxColor).not.toBe(twoColor)
  })
})

describe('categoricalColor', () => {
  it('returns first palette color at index 0', () => {
    expect(categoricalColor(0)).toBe(OKABE_ITO[0])
  })

  it('wraps around for index >= 7', () => {
    expect(categoricalColor(7)).toBe(OKABE_ITO[0])
  })
})

describe('divergingColor', () => {
  it('returns positive color for positive values above threshold', () => {
    expect(divergingColor(2)).toMatch(/^#/)
  })

  it('returns negative color for negative values below threshold', () => {
    const neg = divergingColor(-2)
    const pos = divergingColor(2)
    expect(neg).not.toBe(pos)
  })

  it('returns neutral color near zero', () => {
    expect(divergingColor(0)).toMatch(/^#/)
  })
})
