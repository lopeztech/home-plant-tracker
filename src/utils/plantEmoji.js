// Emoji chosen for a plant marker. A per-plant `emoji` override wins over the
// species-regex fallback so users can customise unusual plants.

export const PLANT_EMOJI_OPTIONS = [
  '🪴', '🌱', '🌿', '🍃', '🌳', '🌲', '🌴', '🌵',
  '🌸', '🌺', '🌻', '🌼', '🌷', '💐', '🥀', '🌹',
  '🍀', '🍁', '🍂', '🌾', '🎋', '🎍',
]

export function getPlantEmoji(plant) {
  if (plant?.emoji) return plant.emoji
  const species = (plant?.species || '').toLowerCase()
  if (/cactus|succulent|aloe/i.test(species)) return '🌵'
  if (/tree|palm|fig|olive|eucalyptus/i.test(species)) return '🌳'
  if (/herb|basil|mint|rosemary/i.test(species)) return '🌿'
  if (/vine|ivy|pothos|philodendron|monstera/i.test(species)) return '🍃'
  if (/flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/i.test(species)) return '🌸'
  if (/grass|hedge|shrub/i.test(species)) return '🌲'
  return '🪴'
}
