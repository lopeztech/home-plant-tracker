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

// ── Plant attribute modifiers ───────────────────────────────────────────────
// These adjust the effective watering interval based on plant/pot characteristics.
// Values > 1 mean the plant dries out faster → water sooner (divide interval).
// Values < 1 mean the plant retains moisture → water less often.

const POT_SIZE_MULTIPLIERS = {
  small:  1.2,   // small pots dry out ~20% faster
  medium: 1.0,   // baseline
  large:  0.9,   // large pots retain moisture ~10% longer
  xlarge: 0.85,  // very large pots retain ~15% longer
}

const SOIL_TYPE_MULTIPLIERS = {
  'standard':           1.0,
  'well-draining':      1.15,  // dries 15% faster → water sooner
  'moisture-retaining': 0.85,  // retains 15% more → water less
  'succulent-mix':      1.2,   // very fast draining → water sooner
  'orchid-mix':         1.2,   // bark dries quickly → water sooner
}

const SUN_EXPOSURE_MULTIPLIERS = {
  'full-sun': 1.15,  // full sun dries soil ~15% faster
  'part-sun': 1.0,   // baseline
  'shade':    0.85,   // shade retains moisture ~15% longer
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
 * Compute the combined plant-attribute multiplier from pot size, soil type,
 * and sun exposure. Returns a value > 1 if the plant dries faster (water sooner)
 * and < 1 if it retains moisture (water less often).
 */
export function getPlantAttributeMultiplier(plant) {
  const pot  = POT_SIZE_MULTIPLIERS[plant.potSize] ?? 1
  const soil = SOIL_TYPE_MULTIPLIERS[plant.soilType] ?? 1
  const sun  = SUN_EXPOSURE_MULTIPLIERS[plant.sunExposure] ?? 1
  return pot * soil * sun
}

/**
 * Returns weather-adjusted watering status for a plant.
 *
 * Adjustment layers (all applied to the base frequencyDays):
 *  1. Season:       latitude-based hemisphere detection
 *  2. Plant attrs:  pot size, soil type, sun exposure
 *  3. Temperature:  ≥30°C reduces interval by 1d, ≥35°C by 2d
 *  4. Humidity:     indoor plants in dry conditions (< 30%) water 1d sooner
 *  5. Rain:         outdoor + raining → skip; outdoor + forecast rain → advisory
 *
 * @param {object}      plant   - plant with lastWatered, frequencyDays, floor, room, potSize, soilType, sunExposure
 * @param {object|null} weather - from useWeather() (includes location.lat, current.humidity)
 * @param {Array}       floors  - array of floor objects from floorsApi
 * @returns {{ daysUntil: number, color: string, label: string, note: string|null, skippedRain: boolean, season: string|null, seasonNote: string|null }}
 */
export function getWateringStatus(plant, weather = null, floors = []) {
  const outdoor   = isOutdoor(plant, floors)
  const temp      = weather?.current?.temp ?? null
  const tempC     = temp !== null ? toC(temp, weather?.unit) : null
  const sky       = weather?.current?.condition?.sky
  const raining   = sky === 'rainy' || sky === 'stormy'
  const humidity  = weather?.current?.humidity ?? null

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

  // Layer 1: Season
  const base = plant.frequencyDays ?? 7
  let effective = base / seasonMultiplier

  // Layer 2: Plant attributes (pot size, soil type, sun exposure)
  const attrMultiplier = getPlantAttributeMultiplier(plant)
  effective = effective / attrMultiplier

  // Round and clamp
  effective = Math.max(1, Math.round(effective))

  // Layer 3: Temperature
  if (tempC !== null) {
    if (tempC >= 35) effective = Math.max(1, effective - 2)
    else if (tempC >= 30) effective = Math.max(1, effective - 1)
  }

  // Layer 4: Indoor humidity — dry indoor air makes soil dry faster
  if (!outdoor && humidity !== null && humidity < 30) {
    effective = Math.max(1, effective - 1)
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

  // Note priority: heat > dry air > rain forecast > seasonal
  let note = heatNote(tempC)
  if (!note && !outdoor && humidity !== null && humidity < 30) {
    note = 'Dry air — watering sooner'
  }
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
 * Returns a weather- and plant-adjusted water amount recommendation.
 *
 * Adjustment layers on the water amount multiplier:
 *  1. Season:       summer +30%, winter -30%, etc.
 *  2. Plant attrs:  pot size, soil type, sun exposure
 *  3. Temperature:  ≥30°C +25%, ≥35°C +50%, ≤10°C -25%
 *  4. Humidity:     ≥80% -25%, <30% (indoor) +15%
 *  5. Rain:         outdoor + raining → skip
 *
 * @param {object}      plant   - plant with waterAmount, floor, room, potSize, soilType, sunExposure
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

  if (outdoor && raining) {
    return { amount: 'Skip', adjusted: true, reason: 'Raining — no watering needed', multiplier: 0 }
  }

  // Layer 1: Seasonal multiplier
  const lat = weather?.location?.lat ?? null
  const season = getSeason(lat)
  let multiplier = season ? SEASONAL_MULTIPLIERS[season] : 1
  let reason = season && multiplier !== 1
    ? SEASON_NOTES[season]
    : null

  // Layer 2: Plant attributes
  const attrMultiplier = getPlantAttributeMultiplier(plant)
  if (attrMultiplier !== 1) {
    multiplier *= attrMultiplier
    if (!reason) reason = 'Adjusted for pot/soil/light conditions'
  }

  // Layer 3: Temperature (overrides reason with more specific note)
  if (tempC !== null) {
    if (tempC >= 35) { multiplier *= 1.5; reason = 'Very hot — 50% more water' }
    else if (tempC >= 30) { multiplier *= 1.25; reason = 'Hot day — 25% more water' }
    else if (tempC <= 10) { multiplier *= 0.75; reason = 'Cold — 25% less water' }
  }

  // Layer 4: Humidity
  if (humidity !== null && humidity >= 80) {
    multiplier *= 0.75
    if (!reason) reason = 'High humidity — 25% less water'
  } else if (!outdoor && humidity !== null && humidity < 30) {
    multiplier *= 1.15
    if (!reason) reason = 'Dry air — 15% more water'
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

/**
 * Analyse watering history and suggest whether the base frequencyDays should change.
 * Returns null if insufficient data, otherwise a recommendation object.
 *
 * @param {object} plant - plant with wateringLog, frequencyDays, healthLog, health
 * @returns {{ suggestedDays: number, currentDays: number, reason: string, direction: 'increase'|'decrease'|'keep' } | null}
 */
export function getSuggestedFrequency(plant) {
  const log = (plant.wateringLog || []).sort((a, b) => new Date(a.date) - new Date(b.date))
  if (log.length < 5) return null

  const freq = plant.frequencyDays || 7

  // Calculate the user's actual watering cadence from recent history (last 8 entries)
  const recent = log.slice(-8)
  const gaps = []
  for (let i = 1; i < recent.length; i++) {
    gaps.push((new Date(recent[i].date) - new Date(recent[i - 1].date)) / 86400000)
  }
  const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length

  // Check health trend
  const healthLog = (plant.healthLog || []).sort((a, b) => new Date(a.date) - new Date(b.date))
  const RANK = { Excellent: 4, Good: 3, Fair: 2, Poor: 1 }
  const currentHealth = healthLog.length > 0 ? healthLog[healthLog.length - 1].health : plant.health
  const prevHealth = healthLog.length > 1 ? healthLog[healthLog.length - 2].health : null
  const healthImproving = prevHealth && (RANK[currentHealth] || 0) > (RANK[prevHealth] || 0)
  const healthDeclining = prevHealth && (RANK[currentHealth] || 0) < (RANK[prevHealth] || 0)

  // If the user consistently waters at a different cadence AND health is good/improving,
  // suggest adopting their actual cadence
  const adherence = meanGap / freq
  const roundedMean = Math.max(1, Math.round(meanGap))

  // User waters much more often than scheduled AND health is good → lower frequency makes sense
  if (adherence < 0.7 && !healthDeclining && roundedMean !== freq) {
    return {
      suggestedDays: roundedMean,
      currentDays: freq,
      reason: `You water every ~${roundedMean}d and the plant is ${healthImproving ? 'improving' : 'doing well'} — consider updating`,
      direction: 'decrease',
    }
  }

  // User waters much less often AND health is still OK → maybe can extend
  if (adherence > 1.4 && !healthDeclining && roundedMean !== freq) {
    return {
      suggestedDays: roundedMean,
      currentDays: freq,
      reason: `You water every ~${roundedMean}d and the plant is ${healthImproving ? 'improving' : 'doing well'} — consider updating`,
      direction: 'increase',
    }
  }

  // Health declining and user follows schedule → suggest adjustment
  if (healthDeclining && Math.abs(adherence - 1) < 0.3) {
    // Over-watered? (health declining, watering on schedule or more)
    if (adherence <= 1) {
      const suggested = Math.min(30, Math.round(freq * 1.3))
      return {
        suggestedDays: suggested,
        currentDays: freq,
        reason: `Health declined despite regular watering — try extending to ${suggested}d (possible over-watering)`,
        direction: 'increase',
      }
    }
    // Under-watered? (health declining, watering less than schedule)
    const suggested = Math.max(1, Math.round(freq * 0.7))
    return {
      suggestedDays: suggested,
      currentDays: freq,
      reason: `Health declined with infrequent watering — try every ${suggested}d`,
      direction: 'decrease',
    }
  }

  return null
}
