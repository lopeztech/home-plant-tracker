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

  // Outdoor + actively raining → rain is doing the watering
  if (outdoor && raining) {
    return {
      daysUntil:   0,
      skippedRain: true,
      note:        'Raining — no need to water',
      color:       '#60a5fa', // blue
      label:       'Rain today',
    }
  }

  // Adjust frequency for heat (thresholds in °C)
  const base = plant.frequencyDays ?? 7
  let effective = base
  if (tempC !== null) {
    if (tempC >= 35) effective = Math.max(1, base - 2)
    else if (tempC >= 30) effective = Math.max(1, base - 1)
  }

  if (!plant.lastWatered) {
    return {
      daysUntil:   0,
      skippedRain: false,
      note:        heatNote(tempC),
      color:       urgencyColor(0),
      label:       urgencyLabel(0),
    }
  }

  const last      = new Date(plant.lastWatered)
  const next      = new Date(last.getTime() + effective * 86400000)
  const daysUntil = Math.ceil((next - new Date()) / 86400000)

  // Note: heat adjustment or upcoming-rain advisory for outdoor plants
  let note = heatNote(tempC)
  if (!note && outdoor && daysUntil <= 1 && weather?.days) {
    const hasUpcomingRain = weather.days.slice(0, 3).some(d => d.precipitation >= 2)
    if (hasUpcomingRain) note = 'Rain forecast — may skip'
  }

  return {
    daysUntil,
    skippedRain: false,
    note,
    color: urgencyColor(daysUntil),
    label: urgencyLabel(daysUntil),
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

  let multiplier = 1
  let reason = null

  if (outdoor && raining) {
    return { amount: 'Skip', adjusted: true, reason: 'Raining — no watering needed', multiplier: 0 }
  }

  if (tempC !== null) {
    if (tempC >= 35) { multiplier = 1.5; reason = 'Very hot — 50% more water' }
    else if (tempC >= 30) { multiplier = 1.25; reason = 'Hot day — 25% more water' }
    else if (tempC <= 10) { multiplier = 0.75; reason = 'Cold — 25% less water' }
  }

  if (!reason && humidity !== null && humidity >= 80) {
    multiplier = 0.75
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
