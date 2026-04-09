// Plants in these room names are treated as outdoor for weather-aware watering
export const OUTDOOR_ROOMS = new Set(['Garden', 'Balcony', 'Outdoors', 'Patio', 'Terrace', 'Verandah', 'Veranda', 'Deck', 'Courtyard'])

export function isOutdoor(plant, floors = []) {
  const floor = floors.find(f => f.id === (plant.floor || 'ground'))
  // Check room-level type first (most specific)
  if (floor?.rooms?.length) {
    const room = floor.rooms.find(r => r.name === plant.room)
    if (room?.type === 'outdoor') return true
    if (room?.type === 'indoor') return false
  }
  // Fall back to floor-level type
  if (floor?.type === 'outdoor') return true
  // Fall back to room name heuristic
  return OUTDOOR_ROOMS.has(plant.room)
}

export function urgencyColor(days) {
  if (days < 0)  return '#ef4444'
  if (days === 0) return '#f97316'
  if (days <= 2)  return '#eab308'
  return '#22c55e'
}

export function urgencyLabel(days) {
  if (days < 0)  return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  return `${days}d`
}

// ── Season detection from latitude ──────────────────────────────────────────

/**
 * Determine the current season based on latitude (hemisphere) and date.
 * Northern hemisphere: Spring Mar-May, Summer Jun-Aug, Autumn Sep-Nov, Winter Dec-Feb
 * Southern hemisphere: seasons are reversed.
 */
export function getSeason(lat, date = new Date()) {
  if (lat == null) return null
  const month = date.getMonth() // 0-indexed
  const isNorth = lat >= 0

  if (isNorth) {
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'autumn'
    return 'winter'
  }
  // Southern hemisphere
  if (month >= 2 && month <= 4) return 'autumn'
  if (month >= 5 && month <= 7) return 'winter'
  if (month >= 8 && month <= 10) return 'spring'
  return 'summer'
}

// How much MORE water a plant needs per season (>1 = more water, <1 = less)
// multiplier > 1 → shorter interval (water more often)
// multiplier < 1 → longer interval (water less often)
export const SEASONAL_MULTIPLIERS = {
  spring: 1.0,
  summer: 1.3,
  autumn: 0.85,
  winter: 0.7,
}

const SEASON_NOTES = {
  spring: 'Spring — active growth, regular watering',
  summer: 'Summer — water ~30% more often',
  autumn: 'Autumn — slowing down, ~15% less water',
  winter: 'Winter — dormant, ~30% less water',
}

function toC(temp, unit) {
  return unit === 'fahrenheit' ? (temp - 32) * 5 / 9 : temp
}

function heatNote(tempC) {
  if (tempC >= 35) return 'Very hot — watering sooner'
  if (tempC >= 30) return 'Hot day — watering sooner'
  return null
}

/**
 * Returns weather-adjusted watering status for a plant.
 *
 * Rules:
 *  - Temp ≥ 30 °C → reduce effective frequency by 1 day (water sooner)
 *  - Temp ≥ 35 °C → reduce by 2 days
 *  - Outdoor plant + raining today → skip (rain waters it)
 *  - Outdoor plant + rain forecast within 3 days + due within 1 day → advisory note
 *
 * @param {object}      plant   - plant with lastWatered, frequencyDays, floor, room
 * @param {object|null} weather - from useWeather()
 * @param {Array}       floors  - array of floor objects from floorsApi
 * @returns {{ daysUntil: number, color: string, label: string, note: string|null, skippedRain: boolean }}
 */
export function getWateringStatus(plant, weather = null, floors = []) {
  const outdoor   = isOutdoor(plant, floors)
  const temp      = weather?.current?.temp ?? null
  const tempC     = temp !== null ? toC(temp, weather?.unit) : null
  const sky       = weather?.current?.condition?.sky
  const raining   = sky === 'rainy' || sky === 'stormy'

  // Detect season from latitude
  const lat = weather?.location?.lat ?? null
  const season = getSeason(lat)
  const seasonMultiplier = season ? SEASONAL_MULTIPLIERS[season] : 1
  const seasonNote = season && season !== 'spring' ? SEASON_NOTES[season] : null

  // Outdoor + actively raining → rain is doing the watering
  if (outdoor && raining) {
    return {
      daysUntil:   0,
      skippedRain: true,
      note:        'Raining — no need to water',
      color:       '#60a5fa', // blue
      label:       'Rain today',
      season,
      seasonNote,
    }
  }

  // Adjust frequency for season
  const base = plant.frequencyDays ?? 7
  // multiplier > 1 means plant needs more water → shorter interval
  let effective = Math.max(1, Math.round(base / seasonMultiplier))

  // Adjust further for heat (thresholds in °C)
  if (tempC !== null) {
    if (tempC >= 35) effective = Math.max(1, effective - 2)
    else if (tempC >= 30) effective = Math.max(1, effective - 1)
  }

  if (!plant.lastWatered) {
    return {
      daysUntil:   0,
      skippedRain: false,
      note:        heatNote(tempC) || seasonNote,
      color:       urgencyColor(0),
      label:       urgencyLabel(0),
      season,
      seasonNote,
    }
  }

  const last      = new Date(plant.lastWatered)
  const next      = new Date(last.getTime() + effective * 86400000)
  const daysUntil = Math.ceil((next - new Date()) / 86400000)

  // Note priority: heat > rain forecast > seasonal
  let note = heatNote(tempC)
  if (!note && outdoor && daysUntil <= 1 && weather?.days) {
    const hasUpcomingRain = weather.days.slice(0, 3).some(d => d.precipitation >= 2)
    if (hasUpcomingRain) note = 'Rain forecast — may skip'
  }
  if (!note) note = seasonNote

  return {
    daysUntil,
    skippedRain: false,
    note,
    color: urgencyColor(daysUntil),
    label: urgencyLabel(daysUntil),
    season,
    seasonNote,
  }
}

/**
 * Returns a weather-adjusted water amount recommendation.
 *
 * Takes the plant's base waterAmount (e.g. "250ml") and adjusts based on:
 *  - Hot days (≥30°C): +25-50% more water
 *  - Cold days (≤10°C): -25% less water
 *  - Rainy days (outdoor): skip or -50%
 *  - Humid conditions: -25%
 *
 * @param {object}      plant   - plant with waterAmount, floor, room
 * @param {object|null} weather - from useWeather()
 * @param {Array}       floors  - floor objects
 * @returns {{ amount: string, adjusted: boolean, reason: string|null, multiplier: number }}
 */
export function getAdjustedWaterAmount(plant, weather = null, floors = []) {
  const base = plant.waterAmount
  if (!base) return { amount: null, adjusted: false, reason: null, multiplier: 1 }

  const outdoor = isOutdoor(plant, floors)
  const temp = weather?.current?.temp ?? null
  const tempC = temp !== null ? toC(temp, weather?.unit) : null
  const sky = weather?.current?.condition?.sky
  const raining = sky === 'rainy' || sky === 'stormy'
  const humidity = weather?.current?.humidity ?? null

  // Start with seasonal multiplier
  const lat = weather?.location?.lat ?? null
  const season = getSeason(lat)
  let multiplier = season ? SEASONAL_MULTIPLIERS[season] : 1
  let reason = season && multiplier !== 1
    ? SEASON_NOTES[season]
    : null

  if (outdoor && raining) {
    return { amount: 'Skip', adjusted: true, reason: 'Raining — no watering needed', multiplier: 0 }
  }

  // Weather conditions override seasonal note (they stack on the multiplier)
  if (tempC !== null) {
    if (tempC >= 35) { multiplier *= 1.5; reason = 'Very hot — 50% more water' }
    else if (tempC >= 30) { multiplier *= 1.25; reason = 'Hot day — 25% more water' }
    else if (tempC <= 10) { multiplier *= 0.75; reason = 'Cold — 25% less water' }
  }

  if (!reason && humidity !== null && humidity >= 80) {
    multiplier *= 0.75
    reason = 'High humidity — 25% less water'
  }

  if (multiplier === 1) {
    return { amount: base, adjusted: false, reason: null, multiplier: 1 }
  }

  // Parse numeric amount and adjust
  const match = base.match(/^([\d.]+)\s*(.*)$/)
  if (!match) return { amount: base, adjusted: false, reason, multiplier }

  const num = parseFloat(match[1])
  const unit = match[2] || 'ml'
  const adjusted = Math.round(num * multiplier)

  return { amount: `${adjusted}${unit}`, adjusted: true, reason, multiplier }
}
