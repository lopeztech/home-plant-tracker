import { describe, it, expect } from 'vitest'
import { DURATION, EASE, SPRING, STAGGER_DELAY, variants } from '../motion/tokens.js'

describe('DURATION', () => {
  it('has fast, normal, slow entries in seconds', () => {
    expect(DURATION.fast).toBe(0.12)
    expect(DURATION.normal).toBe(0.2)
    expect(DURATION.slow).toBe(0.32)
  })

  it('is ordered fast < normal < slow', () => {
    expect(DURATION.fast).toBeLessThan(DURATION.normal)
    expect(DURATION.normal).toBeLessThan(DURATION.slow)
  })
})

describe('EASE', () => {
  it('has out and inOut cubic-bezier arrays', () => {
    expect(Array.isArray(EASE.out)).toBe(true)
    expect(EASE.out).toHaveLength(4)
    expect(Array.isArray(EASE.inOut)).toBe(true)
    expect(EASE.inOut).toHaveLength(4)
  })
})

describe('SPRING', () => {
  it('has type spring with stiffness and damping', () => {
    expect(SPRING.type).toBe('spring')
    expect(typeof SPRING.stiffness).toBe('number')
    expect(typeof SPRING.damping).toBe('number')
  })
})

describe('STAGGER_DELAY', () => {
  it('is a small positive number', () => {
    expect(STAGGER_DELAY).toBeGreaterThan(0)
    expect(STAGGER_DELAY).toBeLessThan(0.1)
  })
})

describe('variants', () => {
  const REQUIRED_VARIANTS = ['fadeIn', 'slideInRight', 'pageEnter', 'scaleUp', 'listItem']

  it.each(REQUIRED_VARIANTS)('%s has hidden and visible states', (name) => {
    expect(variants[name]).toBeDefined()
    expect(variants[name].hidden).toBeDefined()
    expect(variants[name].visible).toBeDefined()
  })

  it('fadeIn hidden has opacity 0', () => {
    expect(variants.fadeIn.hidden.opacity).toBe(0)
  })

  it('scaleUp hidden has scale 0.96', () => {
    expect(variants.scaleUp.hidden.scale).toBe(0.96)
  })

  it('slideInRight hidden has positive x offset', () => {
    expect(variants.slideInRight.hidden.x).toBeGreaterThan(0)
  })

  it('listItem hidden has positive y offset', () => {
    expect(variants.listItem.hidden.y).toBeGreaterThan(0)
  })

  it('pageEnter exit has negative x', () => {
    expect(variants.pageEnter.exit.x).toBeLessThan(0)
  })
})
