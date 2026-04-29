import { describe, it, expect } from 'vitest'
import { filterMenuByPersona } from '../layouts/components/menuData.js'

const SAMPLE = [
  {
    key: 'garden',
    label: 'Garden',
    isSection: true,
    children: [
      { key: 'today', label: 'Today' },
      { key: 'propagation', label: 'Propagation' },
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    isSection: true,
    personas: ['landscaper', 'both'],
    children: [
      { key: 'visits', label: 'Visits' },
      { key: 'branding', label: 'Branding' },
    ],
  },
  {
    key: 'manage',
    label: 'Manage',
    isSection: true,
    children: [
      { key: 'settings', label: 'Settings' },
    ],
  },
]

describe('filterMenuByPersona — static defaults', () => {
  it('hides landscaper-only sections from household persona', () => {
    const out = filterMenuByPersona(SAMPLE, 'household')
    expect(out.find((s) => s.key === 'pro')).toBeUndefined()
    expect(out.find((s) => s.key === 'garden')).toBeDefined()
  })

  it('shows landscaper-only sections to landscaper persona', () => {
    const out = filterMenuByPersona(SAMPLE, 'landscaper')
    expect(out.find((s) => s.key === 'pro')).toBeDefined()
  })

  it('shows landscaper-only sections to "both" persona', () => {
    const out = filterMenuByPersona(SAMPLE, 'both')
    expect(out.find((s) => s.key === 'pro')).toBeDefined()
  })

  it('back-compat: works with two args (no overrides)', () => {
    const out = filterMenuByPersona(SAMPLE, 'household')
    expect(out.find((s) => s.key === 'garden').children.map((c) => c.key)).toEqual(['today', 'propagation'])
  })
})

describe('filterMenuByPersona — admin overrides', () => {
  it("'hidden' override removes the item even when its persona would have shown it", () => {
    const out = filterMenuByPersona(SAMPLE, 'landscaper', { visits: 'hidden' })
    const pro = out.find((s) => s.key === 'pro')
    expect(pro).toBeDefined()
    expect(pro.children.map((c) => c.key)).toEqual(['branding'])
  })

  it("'household' override forces a landscaper-only item visible to households", () => {
    const out = filterMenuByPersona(SAMPLE, 'household', { branding: 'household' })
    // The 'pro' section is still gated by its own personas array.
    expect(out.find((s) => s.key === 'pro')).toBeUndefined()
    // But within an unfiltered tree, the per-item override applies. Check via persona='both'.
    const out2 = filterMenuByPersona(SAMPLE, 'both', { branding: 'household' })
    const pro2 = out2.find((s) => s.key === 'pro')
    expect(pro2.children.find((c) => c.key === 'branding')).toBeUndefined()
  })

  it("'both' override forces an item visible regardless of persona", () => {
    const out = filterMenuByPersona(SAMPLE, 'household', { visits: 'both', pro: 'both' })
    const pro = out.find((s) => s.key === 'pro')
    expect(pro).toBeDefined()
    expect(pro.children.find((c) => c.key === 'visits')).toBeDefined()
  })

  it('drops empty sections after children are filtered', () => {
    const out = filterMenuByPersona(SAMPLE, 'household', {
      pro: 'both', visits: 'hidden', branding: 'hidden',
    })
    expect(out.find((s) => s.key === 'pro')).toBeUndefined()
  })

  it('items without an entry in overrides fall back to static defaults', () => {
    const out = filterMenuByPersona(SAMPLE, 'household', { visits: 'household' })
    // 'today' has no override and no personas → still visible
    const garden = out.find((s) => s.key === 'garden')
    expect(garden.children.map((c) => c.key)).toEqual(['today', 'propagation'])
  })
})
