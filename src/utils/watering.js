// Plants in these room names are treated as outdoor for weather-aware watering
export const OUTDOOR_ROOMS = new Set(['Garden', 'Balcony', 'Outdoors', 'Patio', 'Terrace'])

export function isOutdoor(plant, floors = []) {
  const floor = floors.find(f => f.id === (plant.floor || 'ground'))
  if (floor?.type === 'outdoor') return true
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

function heatNote(temp) {
  if (temp >= 35) return 'Very hot — watering sooner'
  if (temp >= 30) return 'Hot day — watering sooner'
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

  // Adjust frequency for heat
  const base = plant.frequencyDays ?? 7
  let effective = base
  if (temp !== null) {
    if (temp >= 35) effective = Math.max(1, base - 2)
    else if (temp >= 30) effective = Math.max(1, base - 1)
  }

  if (!plant.lastWatered) {
    return {
      daysUntil:   0,
      skippedRain: false,
      note:        heatNote(temp),
      color:       urgencyColor(0),
      label:       urgencyLabel(0),
    }
  }

  const last      = new Date(plant.lastWatered)
  const next      = new Date(last.getTime() + effective * 86400000)
  const daysUntil = Math.ceil((next - new Date()) / 86400000)

  // Note: heat adjustment or upcoming-rain advisory for outdoor plants
  let note = heatNote(temp)
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
