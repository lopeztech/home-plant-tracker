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

// 3D shape descriptor per marker emoji. Drives what the plant "looks like"
// in the Garden's 3D view — leafy vs tree vs wheat vs cactus — so switching
// a plant's emoji updates its silhouette on the grid.
// shape: 'leafy' | 'cactus' | 'tree' | 'conifer' | 'palm' | 'bamboo' | 'wheat'
// flower (optional): { color, size?: 'big', shape?: 'cup', count?: number, fruit?: true }
const SHAPE_BY_EMOJI = {
  // Foliage
  '🪴': { shape: 'leafy', leafColor: '#48a148' },
  '🌱': { shape: 'leafy', leafColor: '#7cc47c', scale: 0.6 },
  '🌿': { shape: 'leafy', leafColor: '#5aa852' },
  '🍃': { shape: 'leafy', leafColor: '#3f8a3f' },
  '🍀': { shape: 'leafy', leafColor: '#4f9f4d' },
  // Flowers
  '🌸': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#f9a8d4' } },
  '🌺': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#dc2626' } },
  '🌻': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#eab308', size: 'big' } },
  '🌼': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#fde047' } },
  '🌷': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#ec4899', shape: 'cup' } },
  '💐': { shape: 'leafy', leafColor: '#48a148', flower: { color: '#ec4899', count: 3 } },
  '🥀': { shape: 'leafy', leafColor: '#8a6e3a', flower: { color: '#8a1818' } },
  '🌹': { shape: 'leafy', leafColor: '#2e7d32', flower: { color: '#b91c1c' } },
  // Trees
  '🌳': { shape: 'tree', leafColor: '#2e7d32' },
  '🌲': { shape: 'conifer', leafColor: '#1d4f2e' },
  '🌴': { shape: 'palm', leafColor: '#2e7d32' },
  '🎋': { shape: 'bamboo', leafColor: '#5aa852' },
  '🎍': { shape: 'conifer', leafColor: '#1d4f2e' },
  // Citrus & Fruit
  '🍋': { shape: 'leafy', leafColor: '#2e7d32', flower: { color: '#facc15', count: 3, fruit: true } },
  '🍊': { shape: 'leafy', leafColor: '#2e7d32', flower: { color: '#f97316', count: 3, fruit: true } },
  // Desert
  '🌵': { shape: 'cactus', leafColor: '#86b56c' },
  // Seasonal
  '🍁': { shape: 'leafy', leafColor: '#dc2626' },
  '🍂': { shape: 'leafy', leafColor: '#c2410c' },
  '🌾': { shape: 'wheat', leafColor: '#f59e0b' },
}

const DEFAULT_SHAPE = SHAPE_BY_EMOJI['🪴']

export function getPlantShape(plant) {
  const emoji = getPlantEmoji(plant)
  return SHAPE_BY_EMOJI[emoji] || DEFAULT_SHAPE
}
