import { getSeason } from './watering.js'

/**
 * Feeding schedule logic. Mirrors `src/utils/watering.js` in shape:
 * - Season multipliers (dormancy skips feeding entirely)
 * - plantedIn multipliers (pots feed more often than in-ground)
 * - Health override (dilute/skip when plant is stressed)
 * - Soil-moisture override (never fertilise into bone-dry soil)
 *
 * All values conservative — under-feeding is strictly less harmful than
 * over-feeding, so our schedule errs on the side of longer intervals.
 */

const DEFAULT_FEED_FREQUENCY_DAYS = 14

// Multiplier > 1 → shorter interval → feed more often.
// Multiplier < 1 → longer interval → feed less often.
// A multiplier of 0 skips feeding entirely (dormancy).
export const SEASON_FEED_MULTIPLIERS = {
  spring: 1.2,   // growth push — slightly more
  summer: 1.0,   // baseline
  autumn: 0.5,   // tapering off
  winter: 0,     // fully dormant — skip
}

export const PLANTED_IN_FEED_MULTIPLIERS = {
  pot:         1.0,   // baseline — regular schedule
  'garden-bed': 0.7,  // bed soil carries nutrition longer
  ground:      0.5,   // in-ground plants draw from deep soil
}

// Edible crops need heavier feeding regardless of pot/bed.
const EDIBLE_PATTERN = /(tomato|pepper|chilli|chili|eggplant|aubergine|cucumber|squash|pumpkin|zucchini|courgette|citrus|lemon|lime|orange|mandarin|strawberr|bean|pea|corn|melon|rose)/i

function isEdibleOrHungry(plant) {
  const hay = `${plant?.species ?? ''} ${plant?.name ?? ''}`
  return EDIBLE_PATTERN.test(hay)
}

function healthAdjustment(health) {
  if (!health) return { multiplier: 1, note: null, skip: false }
  const h = String(health).toLowerCase()
  if (h === 'poor' || h === 'bad') {
    return { multiplier: 0, skip: true, note: 'Plant health is poor — fix watering/light first, then resume feeding at half strength' }
  }
  if (h === 'fair' || h === 'ok') {
    return { multiplier: 0.8, skip: false, note: 'Dilute to half strength while the plant recovers' }
  }
  return { multiplier: 1, note: null, skip: false }
}

function latestMoistureReading(plant) {
  const log = plant?.moistureLog ?? []
  if (log.length === 0) return plant?.lastMoistureReading ?? null
  const last = log[log.length - 1]
  return typeof last?.reading === 'number' ? last.reading : null
}

function moistureAdjustment(plant) {
  const r = latestMoistureReading(plant)
  if (r === null) return { skip: false, note: null }
  if (r <= 2) return { skip: true, note: 'Soil is very dry — water thoroughly before feeding, fertiliser burns dry roots' }
  return { skip: false, note: null }
}

/**
 * Base cadence for a plant. Reflects plantedIn + edibility, before the
 * per-call season/health/moisture overrides.
 */
export function getBaseFeedFrequencyDays(plant) {
  if (plant?.fertiliser?.frequencyDays && plant.fertiliser.frequencyDays > 0) {
    return plant.fertiliser.frequencyDays
  }
  const plantedMultiplier = PLANTED_IN_FEED_MULTIPLIERS[plant?.plantedIn] ?? 1
  const edibleBoost = isEdibleOrHungry(plant) ? 1.5 : 1
  const effective = DEFAULT_FEED_FREQUENCY_DAYS / (plantedMultiplier * edibleBoost)
  return Math.max(7, Math.round(effective))
}

/**
 * Returns the feeding status for a plant. Shape mirrors watering.getWateringStatus.
 *
 * @returns {{
 *   daysUntil: number,
 *   skip: boolean,
 *   reason: string | null,
 *   dilutionAdjustment: number,  // 1 = full strength; 0.5 = half strength
 *   season: string | null,
 *   baseFrequencyDays: number,
 *   effectiveFrequencyDays: number,
 * }}
 */
export function getFeedingStatus(plant, weather = null, now = new Date()) {
  const lat = weather?.location?.lat ?? null
  const season = getSeason(lat, now)
  const baseFrequencyDays = getBaseFeedFrequencyDays(plant)

  // Dormant season → skip entirely
  if (season && SEASON_FEED_MULTIPLIERS[season] === 0) {
    return {
      daysUntil: Infinity,
      skip: true,
      reason: `Dormant season (${season}) — hold off feeding until spring`,
      dilutionAdjustment: 1,
      season,
      baseFrequencyDays,
      effectiveFrequencyDays: baseFrequencyDays,
    }
  }

  const moisture = moistureAdjustment(plant)
  if (moisture.skip) {
    return {
      daysUntil: 0,
      skip: true,
      reason: moisture.note,
      dilutionAdjustment: 1,
      season,
      baseFrequencyDays,
      effectiveFrequencyDays: baseFrequencyDays,
    }
  }

  const health = healthAdjustment(plant?.health)
  if (health.skip) {
    return {
      daysUntil: Infinity,
      skip: true,
      reason: health.note,
      dilutionAdjustment: 1,
      season,
      baseFrequencyDays,
      effectiveFrequencyDays: baseFrequencyDays,
    }
  }

  const seasonMultiplier = season ? SEASON_FEED_MULTIPLIERS[season] : 1
  const effective = Math.round(baseFrequencyDays / Math.max(0.1, seasonMultiplier))

  const lastFed = plant?.lastFertilised
    ? new Date(plant.lastFertilised)
    : (plant?.fertiliserLog?.length ? new Date(plant.fertiliserLog[plant.fertiliserLog.length - 1].date) : null)

  let daysUntil
  if (!lastFed || Number.isNaN(lastFed.getTime())) {
    daysUntil = 0
  } else {
    const ageDays = (now.getTime() - lastFed.getTime()) / (24 * 60 * 60 * 1000)
    daysUntil = Math.ceil(effective - ageDays)
  }

  return {
    daysUntil,
    skip: false,
    reason: health.note,
    dilutionAdjustment: health.multiplier,
    season,
    baseFrequencyDays,
    effectiveFrequencyDays: effective,
  }
}

/**
 * Next predicted feeding date for the calendar. Returns null if dormant/skipped.
 */
export function getNextFeedDate(plant, weather = null, now = new Date()) {
  const status = getFeedingStatus(plant, weather, now)
  if (status.skip || !Number.isFinite(status.daysUntil)) return null
  return new Date(now.getTime() + status.daysUntil * 24 * 60 * 60 * 1000)
}
