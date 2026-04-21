import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildWaterTasks,
  buildFeedTasks,
  getSnoozeUntil,
  setSnooze,
  clearSnooze,
  clampSnooze,
} from '../utils/todayTasks.js'

const DAY = 24 * 60 * 60 * 1000

function plant({ id, name, room = 'Living Room', lastWatered, frequencyDays = 7, floor = 'ground', ...rest }) {
  return { id, name, room, lastWatered, frequencyDays, floor, ...rest }
}

const indoorFloor = [{ id: 'ground', type: 'indoor', rooms: [{ name: 'Living Room', type: 'indoor' }, { name: 'Kitchen', type: 'indoor' }] }]
const outdoorFloor = [{ id: 'ground', type: 'indoor', rooms: [{ name: 'Living Room', type: 'indoor' }, { name: 'Garden', type: 'outdoor' }] }]

describe('buildWaterTasks', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('returns no tasks when every plant is not yet due', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const plants = [
      plant({ id: 'p1', name: 'Monstera', lastWatered: new Date(now.getTime() - 2 * DAY).toISOString() }),
      plant({ id: 'p2', name: 'Fern',     lastWatered: new Date(now.getTime() - 1 * DAY).toISOString() }),
    ]
    const { tasks, deferredByRain } = buildWaterTasks(plants, null, indoorFloor, now)
    expect(tasks).toEqual([])
    expect(deferredByRain).toBe(0)
  })

  it('flags overdue plants and sorts most-overdue first', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const plants = [
      plant({ id: 'p1', name: 'A', lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),  // 1d overdue
      plant({ id: 'p2', name: 'B', lastWatered: new Date(now.getTime() - 14 * DAY).toISOString() }), // 7d overdue
      plant({ id: 'p3', name: 'C', lastWatered: new Date(now.getTime() - 10 * DAY).toISOString() }), // 3d overdue
    ]
    const { tasks } = buildWaterTasks(plants, null, indoorFloor, now)
    expect(tasks.map((t) => t.plantId)).toEqual(['p2', 'p3', 'p1'])
    expect(tasks[0].daysUntil).toBeLessThan(tasks[1].daysUntil)
  })

  it('breaks ties by room then name', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const due = new Date(now.getTime() - 8 * DAY).toISOString()
    const plants = [
      plant({ id: 'p1', name: 'Zinnia',    room: 'Kitchen',    lastWatered: due }),
      plant({ id: 'p2', name: 'Acorus',    room: 'Kitchen',    lastWatered: due }),
      plant({ id: 'p3', name: 'Aloe',      room: 'Living Room', lastWatered: due }),
    ]
    const { tasks } = buildWaterTasks(plants, null, indoorFloor, now)
    expect(tasks.map((t) => t.plantId)).toEqual(['p2', 'p1', 'p3'])
  })

  it('auto-defers outdoor plants when it is currently raining', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const plants = [
      plant({ id: 'outside', name: 'Tomato', room: 'Garden', lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),
      plant({ id: 'inside',  name: 'Monstera', room: 'Living Room', lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),
    ]
    const weather = { current: { condition: { sky: 'rainy' } }, location: { lat: 51.5 } }
    const { tasks, deferredByRain } = buildWaterTasks(plants, weather, outdoorFloor, now)
    expect(tasks.map((t) => t.plantId)).toEqual(['inside'])
    expect(deferredByRain).toBe(1)
  })

  it('excludes plants with an active snooze', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const plants = [
      plant({ id: 'p1', name: 'Snoozed', lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),
      plant({ id: 'p2', name: 'Active',  lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),
    ]
    // Snooze p1 for 2 days
    setSnooze('p1', new Date(now.getTime() + 2 * DAY))
    const { tasks } = buildWaterTasks(plants, null, indoorFloor, now)
    expect(tasks.map((t) => t.plantId)).toEqual(['p2'])
  })

  it('re-surfaces a plant once its snooze has expired', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    const plants = [
      plant({ id: 'p1', name: 'Wake Up', lastWatered: new Date(now.getTime() - 8 * DAY).toISOString() }),
    ]
    setSnooze('p1', new Date(now.getTime() - 1 * DAY))
    const { tasks } = buildWaterTasks(plants, null, indoorFloor, now)
    expect(tasks.map((t) => t.plantId)).toEqual(['p1'])
  })

  it('clearSnooze removes an entry', () => {
    const now = new Date('2026-04-21T09:00:00Z')
    setSnooze('p1', new Date(now.getTime() + 2 * DAY))
    expect(getSnoozeUntil('p1', now)).toBeTruthy()
    clearSnooze('p1')
    expect(getSnoozeUntil('p1', now)).toBeNull()
  })

  it('ignores empty plant list', () => {
    const { tasks, deferredByRain } = buildWaterTasks([], null, indoorFloor)
    expect(tasks).toEqual([])
    expect(deferredByRain).toBe(0)
  })
})

describe('buildFeedTasks', () => {
  const NH = { location: { lat: 51.5 } }

  it('skips fertilise tasks during winter dormancy', () => {
    const now = new Date('2026-01-15T00:00:00Z')
    const plants = [{ id: 'p1', name: 'Fern', plantedIn: 'pot', lastFertilised: '2025-12-01T00:00:00Z' }]
    const { tasks } = buildFeedTasks(plants, NH, now)
    expect(tasks).toEqual([])
  })

  it('surfaces overdue-fertilising plants sorted most-overdue first', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plants = [
      { id: 'p1', name: 'A', plantedIn: 'pot', health: 'Good', lastFertilised: new Date(now.getTime() - 20 * DAY).toISOString() },
      { id: 'p2', name: 'B', plantedIn: 'pot', health: 'Good', lastFertilised: new Date(now.getTime() - 60 * DAY).toISOString() },
    ]
    const { tasks } = buildFeedTasks(plants, NH, now)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0].plantId).toBe('p2')
  })

  it('surfaces never-fed plants with a helpful reason', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plants = [{ id: 'p1', name: 'Fern', plantedIn: 'pot', health: 'Good' }]
    const { tasks } = buildFeedTasks(plants, NH, now)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].reason).toMatch(/never fed/i)
  })

  it('excludes plants that are not yet due', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    const plants = [
      { id: 'p1', name: 'Recently Fed', plantedIn: 'pot', health: 'Good', lastFertilised: new Date(now.getTime() - 2 * DAY).toISOString() },
    ]
    const { tasks } = buildFeedTasks(plants, NH, now)
    expect(tasks).toEqual([])
  })
})

describe('clampSnooze', () => {
  it('clamps a snooze that would delay past the next natural due date', () => {
    const p = plant({ id: 'p', name: 'X', lastWatered: '2026-04-14T00:00:00Z', frequencyDays: 7 })
    // Natural next-due = 2026-04-21. Request snooze to 2026-04-30 → should clamp back to 2026-04-21.
    const clamped = clampSnooze(p, new Date('2026-04-30T00:00:00Z'))
    expect(clamped.toISOString().slice(0, 10)).toBe('2026-04-21')
  })

  it('preserves a snooze that is earlier than the next due date', () => {
    const p = plant({ id: 'p', name: 'X', lastWatered: '2026-04-14T00:00:00Z', frequencyDays: 14 })
    const req = new Date('2026-04-17T00:00:00Z')
    const clamped = clampSnooze(p, req)
    expect(clamped.getTime()).toBe(req.getTime())
  })

  it('falls back to the requested date when lastWatered is missing', () => {
    const p = plant({ id: 'p', name: 'X', lastWatered: null })
    const req = new Date('2026-04-30T00:00:00Z')
    const clamped = clampSnooze(p, req)
    expect(clamped.getTime()).toBe(req.getTime())
  })
})
