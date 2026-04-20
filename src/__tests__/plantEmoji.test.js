import { describe, it, expect } from 'vitest'
import { getPlantEmoji, PLANT_EMOJI_OPTIONS } from '../utils/plantEmoji.js'

describe('getPlantEmoji', () => {
  it('prefers an explicit per-plant emoji override', () => {
    expect(getPlantEmoji({ species: 'Aloe vera', emoji: '🌻' })).toBe('🌻')
  })

  it('falls back to species regex when no override is set', () => {
    expect(getPlantEmoji({ species: 'Aloe vera' })).toBe('🌵')
    expect(getPlantEmoji({ species: 'Olive tree' })).toBe('🌳')
    expect(getPlantEmoji({ species: 'Basil' })).toBe('🌿')
    expect(getPlantEmoji({ species: 'Pothos' })).toBe('🍃')
    expect(getPlantEmoji({ species: 'Orchid' })).toBe('🌸')
    expect(getPlantEmoji({ species: 'Hedge' })).toBe('🌲')
  })

  it('returns the default potted plant emoji for unknown species', () => {
    expect(getPlantEmoji({ species: 'Nephrolepis exaltata' })).toBe('🪴')
  })

  it('handles missing plant/species defensively', () => {
    expect(getPlantEmoji(null)).toBe('🪴')
    expect(getPlantEmoji({})).toBe('🪴')
  })

  it('exposes a non-empty options list for the picker', () => {
    expect(Array.isArray(PLANT_EMOJI_OPTIONS)).toBe(true)
    expect(PLANT_EMOJI_OPTIONS.length).toBeGreaterThan(5)
  })
})
