import { getWateringStatus, isOutdoor } from './watering.js'
import { getFeedingStatus } from './feeding.js'

const SNOOZE_KEY = 'plant-tracker-watering-snooze'

function readSnoozeMap() {
  try {
    const raw = globalThis.localStorage?.getItem(SNOOZE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeSnoozeMap(map) {
  try { globalThis.localStorage?.setItem(SNOOZE_KEY, JSON.stringify(map)) } catch { /* ignore */ }
}

export function getSnoozeUntil(plantId, now = new Date()) {
  const map = readSnoozeMap()
  const until = map[plantId]
  if (!until) return null
  const d = new Date(until)
  if (Number.isNaN(d.getTime()) || d <= now) return null
  return d
}

export function setSnooze(plantId, untilDate) {
  const map = readSnoozeMap()
  map[plantId] = new Date(untilDate).toISOString()
  writeSnoozeMap(map)
}

export function clearSnooze(plantId) {
  const map = readSnoozeMap()
  delete map[plantId]
  writeSnoozeMap(map)
}

/**
 * Next due date = lastWatered + frequencyDays. If snoozing past this would
 * delay watering past the next natural due date, clamp to that date.
 * Acceptance: "Snooze respects rules (cannot snooze past next due date)".
 */
export function clampSnooze(plant, requestedUntil) {
  const last = plant?.lastWatered ? new Date(plant.lastWatered) : null
  const freq = plant?.frequencyDays ?? 7
  const requested = new Date(requestedUntil)
  if (!last) return requested
  const nextDue = new Date(last.getTime() + freq * 24 * 60 * 60 * 1000)
  return requested < nextDue ? requested : nextDue
}

/**
 * Build the list of "Water" tasks for today from the plant list. Skips:
 *  - Plants not yet due (daysUntil > 0)
 *  - Plants whose outdoor location got rain today (getWateringStatus.skippedRain)
 *  - Plants with an active snooze
 *
 * Sort: overdue-first (most negative daysUntil), ties broken by room then name.
 *
 * @returns {{ tasks: Array, deferredByRain: number }}
 */
export function buildWaterTasks(plants, weather, floors, now = new Date()) {
  let deferredByRain = 0
  const tasks = []
  for (const plant of plants || []) {
    const status = getWateringStatus(plant, weather, floors)
    if (status.skippedRain) {
      if (isOutdoor(plant, floors)) deferredByRain++
      continue
    }
    if (status.daysUntil > 0) continue
    if (getSnoozeUntil(plant.id, now)) continue
    tasks.push({
      plantId: plant.id,
      plant,
      action: 'water',
      daysUntil: status.daysUntil,
      reason: buildReason(status, plant),
      room: plant.room ?? '',
    })
  }
  tasks.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
    if (a.room !== b.room) return a.room.localeCompare(b.room)
    return (a.plant.name || '').localeCompare(b.plant.name || '')
  })
  return { tasks, deferredByRain }
}
function buildReason(status, plant) {
  if (status.daysUntil < 0) {
    const d = Math.abs(status.daysUntil)
    const noteFragment = status.note ? ` — ${status.note}` : ''
    return `${d} day${d === 1 ? '' : 's'} overdue${noteFragment}`
  }
  return status.note || `Due today (every ${plant.frequencyDays ?? 7} days)`
}

/**
 * Build the list of "Feed" tasks for today. Skips plants:
 *  - Whose feeding schedule is dormant/skipped (winter, poor health, dry soil)
 *  - That aren't yet due (daysUntil > 0)
 *  - That have never been fed AND have no fertiliser block configured → they
 *    just need an initial setup; we still surface them once so the user can
 *    start a schedule.
 */
export function buildFeedTasks(plants, weather, now = new Date()) {
  const tasks = []
  for (const plant of plants || []) {
    const status = getFeedingStatus(plant, weather, now)
    if (status.skip) continue
    if (status.daysUntil > 0) continue
    tasks.push({
      plantId: plant.id,
      plant,
      action: 'fertilise',
      daysUntil: status.daysUntil,
      reason: buildFeedReason(status, plant),
      room: plant.room ?? '',
    })
  }
  tasks.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
    if (a.room !== b.room) return a.room.localeCompare(b.room)
    return (a.plant.name || '').localeCompare(b.plant.name || '')
  })
  return { tasks }
}

/**
 * Build propagation attention tasks — batches that are overdue (past expectedDays)
 * or have been in sown/rooted status for ≥ 7 days with no expectedDays set.
 *
 * @param {Array} propagations
 * @param {Date} [now]
 * @returns {{ tasks: Array }}
 */
export function buildPropagationTasks(propagations, now = new Date()) {
  const tasks = []
  for (const prop of propagations || []) {
    if (['transplanted', 'failed'].includes(prop.status)) continue
    const days = Math.floor((now.getTime() - new Date(prop.startDate).getTime()) / 86400000)
    const isOverdue = prop.expectedDays && days > prop.expectedDays
    const isStale = !prop.expectedDays && days >= 7
    if (!isOverdue && !isStale) continue
    tasks.push({
      propagationId: prop.id,
      prop,
      daysElapsed: days,
      daysOverdue: prop.expectedDays ? days - prop.expectedDays : null,
      reason: isOverdue
        ? `${days - prop.expectedDays}d past expected date (${prop.expectedDays}d)`
        : `${days}d old — check for progress`,
    })
  }
  tasks.sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))
  return { tasks }
}

function buildFeedReason(status, plant) {
  const last = plant?.lastFertilised ? new Date(plant.lastFertilised) : null
  const neverFed = !last
  if (neverFed) return 'Never fed — start a feeding schedule'
  if (status.daysUntil < 0) {
    const d = Math.abs(status.daysUntil)
    return `${d} day${d === 1 ? '' : 's'} overdue feeding (every ${status.effectiveFrequencyDays}d this ${status.season || 'season'})`
  }
  return `Due today — every ${status.effectiveFrequencyDays}d this ${status.season || 'season'}`
}
