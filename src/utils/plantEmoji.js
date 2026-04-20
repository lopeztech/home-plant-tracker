// Emoji chosen for a plant marker. A per-plant `emoji` override wins over the
// species-regex fallback so users can customise unusual plants.

export const PLANT_EMOJI_GROUPS = [
  { label: 'Foliage',   emojis: ['🪴', '🌱', '🌿', '🍃', '🍀'] },
  { label: 'Flowers',   emojis: ['🌸', '🌺', '🌻', '🌼', '🌷', '💐', '🥀', '🌹'] },
  { label: 'Trees',     emojis: ['🌳', '🌲', '🌴', '🎋', '🎍'] },
  { label: 'Citrus & Fruit', emojis: ['🍋', '🍊'] },
  { label: 'Desert',    emojis: ['🌵'] },
  { label: 'Seasonal',  emojis: ['🍁', '🍂', '🌾'] },
]

// Flat list kept for convenience (e.g. tests, iteration).
export const PLANT_EMOJI_OPTIONS = PLANT_EMOJI_GROUPS.flatMap((g) => g.emojis)

export function getPlantEmoji(plant) {
  if (plant?.emoji) return plant.emoji
  const species = (plant?.species || '').toLowerCase()
  if (/cactus|succulent|aloe/i.test(species)) return '🌵'
  if (/lemon|lime|citrus/i.test(species)) return '🍋'
  if (/orange|mandarin|tangerine|kumquat|grapefruit/i.test(species)) return '🍊'
  if (/tree|palm|fig|olive|eucalyptus/i.test(species)) return '🌳'
  if (/herb|basil|mint|rosemary/i.test(species)) return '🌿'
  if (/vine|ivy|pothos|philodendron|monstera/i.test(species)) return '🍃'
  if (/flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/i.test(species)) return '🌸'
  if (/grass|hedge|shrub/i.test(species)) return '🌲'
  return '🪴'
}
