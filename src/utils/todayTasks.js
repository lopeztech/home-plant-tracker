import { getWateringStatus, isOutdoor } from './watering.js'

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
