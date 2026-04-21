import { isOutdoor } from './watering.js'

/**
 * Weather-alert decisioning for outdoor plants.
 *
 * This is the "content + advice" layer, per issue #205. Push delivery and
 * quiet-hours are intentionally left to issue #162 — this module only
 * computes what's actionable and what to tell the user, without sending.
 *
 * Inputs:
 *  - plants[]    — from PlantContext
 *  - weather     — useWeather() result; we read weather.days[] (today onwards)
 *  - floors      — needed by isOutdoor()
 *  - now         — defaults to new Date() for predictable tests
 *
 * Output:
 *  {
 *    alerts: [
 *      { type, severity, day, summary, advice, plants: [{ id, name, room, action }] }
 *    ],
 *    criticalCount,
 *  }
 */

const DAY_MS = 24 * 60 * 60 * 1000

// Default hardiness for outdoor plants without an explicit frostHardiness field.
// Conservative: assume the plant is tender unless the user/AI says otherwise.
const DEFAULT_FROST_THRESHOLD_C = 2

// In-ground plants have root insulation; we only alert on severe frost.
const IN_GROUND_FROST_THRESHOLD_C = -2

// Heatwave: forecast max ≥ this for 2+ consecutive days.
const HEATWAVE_MAX_C = 32

// Heavy rain — waterlogging risk for pots.
const HEAVY_RAIN_MM = 25

// Drought break prediction: 0mm forecast for N+ days.
const DROUGHT_DAYS = 10

function toC(temp, unit) {
  return unit === 'fahrenheit' ? (temp - 32) * 5 / 9 : temp
}

function frostThreshold(plant) {
  if (typeof plant.frostHardiness === 'number') return plant.frostHardiness
  if (plant.plantedIn === 'ground') return IN_GROUND_FROST_THRESHOLD_C
  return DEFAULT_FROST_THRESHOLD_C
}

function roomLabel(plant) {
  return plant.room ? ` (${plant.room})` : ''
}

function upcomingDays(weather, now) {
  const days = weather?.days ?? []
  if (days.length === 0) return []
  // weather.days includes today; filter to ≥ today's date so we ignore stale data.
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return days
    .map((d) => ({ ...d, dateObj: new Date(d.date) }))
    .filter((d) => !Number.isNaN(d.dateObj.getTime()) && d.dateObj.getTime() >= today.getTime() - DAY_MS)
}

function outdoorPlants(plants, floors) {
  return (plants || []).filter((p) => isOutdoor(p, floors))
}

// ── Alert detectors ─────────────────────────────────────────────────────────

function detectFrost(plants, floors, days, unit) {
  if (days.length === 0) return null
  const tonight = days[0]
  const minC = toC(tonight.minTemp, unit)
  const affected = outdoorPlants(plants, floors)
    .filter((p) => minC <= frostThreshold(p))
  if (affected.length === 0) return null
  return {
    type: 'frost',
    severity: minC <= -2 ? 'critical' : 'high',
    day: tonight.date,
    summary: `Frost expected tonight (low ${tonight.minTemp}°)`,
    advice: 'Move tender plants indoors, or cover them with horticultural fleece before sunset. Water soil (not leaves) to release warmth overnight.',
    plants: affected.map((p) => ({
      id: p.id,
      name: p.name,
      room: p.room,
      action: p.plantedIn === 'ground'
        ? `Mulch heavily around ${p.name}${roomLabel(p)} — roots need insulation`
        : `Bring ${p.name}${roomLabel(p)} indoors before sunset`,
    })),
  }
}

function detectHeatwave(plants, floors, days, unit) {
  if (days.length < 2) return null
  // Look for 2+ consecutive days ≥ HEATWAVE_MAX_C starting within next 3 days.
  for (let i = 0; i < Math.min(days.length - 1, 3); i++) {
    const d1 = toC(days[i].maxTemp, unit)
    const d2 = toC(days[i + 1].maxTemp, unit)
    if (d1 >= HEATWAVE_MAX_C && d2 >= HEATWAVE_MAX_C) {
      const affected = outdoorPlants(plants, floors)
      if (affected.length === 0) return null
      return {
        type: 'heatwave',
        severity: d1 >= 38 ? 'critical' : 'high',
        day: days[i].date,
        summary: `Heatwave: ${days[i].maxTemp}°/${days[i + 1].maxTemp}° on consecutive days`,
        advice: 'Move pots out of full afternoon sun. Double watering for the duration. Consider shade cloth for vegetables and young plants.',
        plants: affected.map((p) => ({
          id: p.id,
          name: p.name,
          room: p.room,
          action: `Water ${p.name}${roomLabel(p)} deeply in the morning; move to afternoon shade if portable`,
        })),
      }
    }
  }
  return null
}

function detectHeavyRain(plants, floors, days) {
  if (days.length === 0) return null
  const d = days[0]
  if ((d.precipitation ?? 0) < HEAVY_RAIN_MM) return null
  const pots = outdoorPlants(plants, floors).filter((p) => p.plantedIn !== 'ground')
  if (pots.length === 0) return null
  return {
    type: 'heavy-rain',
    severity: 'medium',
    day: d.date,
    summary: `${d.precipitation}mm of rain expected today`,
    advice: 'Tip pots to drain excess water. Terracotta and plastic pots without drainage are at risk of root rot.',
    plants: pots.map((p) => ({
      id: p.id,
      name: p.name,
      room: p.room,
      action: `Check drainage on ${p.name}${roomLabel(p)}; tip to pour off excess`,
    })),
  }
}

function detectDrought(plants, floors, days) {
  // Need at least DROUGHT_DAYS of forecast to call it.
  if (days.length < DROUGHT_DAYS) return null
  const dryRun = days.slice(0, DROUGHT_DAYS).every((d) => (d.precipitation ?? 0) === 0)
  if (!dryRun) return null
  const inGround = outdoorPlants(plants, floors).filter((p) => p.plantedIn === 'ground' || p.plantedIn === 'garden-bed')
  if (inGround.length === 0) return null
  return {
    type: 'drought',
    severity: 'medium',
    day: days[0].date,
    summary: `${DROUGHT_DAYS}+ days with no rain forecast`,
    advice: 'In-ground and raised-bed plants depend on rain — plan a deep soak this week, and mulch to slow evaporation.',
    plants: inGround.map((p) => ({
      id: p.id,
      name: p.name,
      room: p.room,
      action: `Deep-water ${p.name}${roomLabel(p)} this week`,
    })),
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function buildWeatherAlerts(plants, weather, floors, now = new Date()) {
  const days = upcomingDays(weather, now)
  const unit = weather?.unit ?? 'celsius'
  const alerts = []
  const frost     = detectFrost(plants, floors, days, unit);     if (frost)     alerts.push(frost)
  const heatwave  = detectHeatwave(plants, floors, days, unit);  if (heatwave)  alerts.push(heatwave)
  const heavyRain = detectHeavyRain(plants, floors, days);       if (heavyRain) alerts.push(heavyRain)
  const drought   = detectDrought(plants, floors, days);         if (drought)   alerts.push(drought)
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  return { alerts, criticalCount }
}

export const ALERT_THRESHOLDS = {
  DEFAULT_FROST_THRESHOLD_C,
  IN_GROUND_FROST_THRESHOLD_C,
  HEATWAVE_MAX_C,
  HEAVY_RAIN_MM,
  DROUGHT_DAYS,
}
