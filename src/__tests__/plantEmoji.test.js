import { describe, it, expect } from 'vitest'
import { getPlantEmoji, PLANT_EMOJI_OPTIONS, PLANT_EMOJI_GROUPS } from '../utils/plantEmoji.js'

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

  it('picks citrus and orange emojis by species keyword', () => {
    expect(getPlantEmoji({ species: 'Meyer lemon' })).toBe('🍋')
    expect(getPlantEmoji({ species: 'Key lime' })).toBe('🍋')
    expect(getPlantEmoji({ species: 'Citrus aurantium' })).toBe('🍋')
    expect(getPlantEmoji({ species: 'Washington navel orange' })).toBe('🍊')
    expect(getPlantEmoji({ species: 'Mandarin' })).toBe('🍊')
    expect(getPlantEmoji({ species: 'Ruby grapefruit' })).toBe('🍊')
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

  it('exposes grouped emojis including a Citrus group with lemon and orange', () => {
    expect(Array.isArray(PLANT_EMOJI_GROUPS)).toBe(true)
    const labels = PLANT_EMOJI_GROUPS.map((g) => g.label)
    expect(labels).toContain('Citrus & Fruit')
    const citrus = PLANT_EMOJI_GROUPS.find((g) => g.label === 'Citrus & Fruit')
    expect(citrus.emojis).toContain('🍋')
    expect(citrus.emojis).toContain('🍊')
  })

  it('keeps PLANT_EMOJI_OPTIONS in sync with the groups', () => {
    const flattened = PLANT_EMOJI_GROUPS.flatMap((g) => g.emojis)
    expect(PLANT_EMOJI_OPTIONS).toEqual(flattened)
  })
})
