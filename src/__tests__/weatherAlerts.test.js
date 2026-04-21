import { describe, it, expect } from 'vitest'
import { buildWeatherAlerts } from '../utils/weatherAlerts.js'

const now = new Date('2026-04-21T09:00:00Z')

const outdoorFloors = [{
  id: 'ground',
  type: 'indoor',
  rooms: [
    { name: 'Living Room', type: 'indoor' },
    { name: 'Garden', type: 'outdoor' },
    { name: 'Patio', type: 'outdoor' },
  ],
}]

function plant(over = {}) {
  return {
    id: over.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    name: over.name ?? 'Plant',
    room: over.room ?? 'Garden',
    floor: 'ground',
    plantedIn: over.plantedIn ?? 'pot',
    ...over,
  }
}

function weather({ days, unit = 'celsius' } = {}) {
  return { unit, current: {}, days }
}

// Helper to quickly make a daily forecast
function day(date, { minTemp = 15, maxTemp = 22, precipitation = 0, code = 0 } = {}) {
  return { date, code, condition: {}, minTemp, maxTemp, precipitation }
}

describe('buildWeatherAlerts — frost', () => {
  it('fires for outdoor potted plants when tonight min ≤ 2°C', () => {
    const plants = [
      plant({ id: 'outside', name: 'Meyer Lemon', room: 'Patio', plantedIn: 'pot' }),
      plant({ id: 'inside',  name: 'Monstera',    room: 'Living Room', plantedIn: 'pot' }),
    ]
    const w = weather({ days: [day('2026-04-21', { minTemp: 1, maxTemp: 6 })] })
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(1)
    const a = alerts[0]
    expect(a.type).toBe('frost')
    expect(a.plants.map((p) => p.id)).toEqual(['outside'])
    expect(a.plants[0].action).toMatch(/Bring Meyer Lemon.*indoors/i)
  })

  it('does not fire for indoor plants', () => {
    const plants = [plant({ room: 'Living Room', plantedIn: 'pot' })]
    const w = weather({ days: [day('2026-04-21', { minTemp: -2 })] })
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(0)
  })

  it('uses -2°C threshold for in-ground plants (root insulation)', () => {
    const tender = plant({ id: 'bed', room: 'Garden', plantedIn: 'ground' })
    const w = weather({ days: [day('2026-04-21', { minTemp: 0 })] })
    const { alerts } = buildWeatherAlerts([tender], w, outdoorFloors, now)
    expect(alerts).toHaveLength(0) // 0°C is above -2°C threshold for in-ground
  })

  it('fires for in-ground plants when forecast ≤ -2°C and advises mulching not moving', () => {
    const bed = plant({ id: 'bed', room: 'Garden', plantedIn: 'ground', name: 'Tomato' })
    const w = weather({ days: [day('2026-04-21', { minTemp: -3 })] })
    const { alerts } = buildWeatherAlerts([bed], w, outdoorFloors, now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].plants[0].action).toMatch(/mulch/i)
  })

  it('respects explicit plant.frostHardiness override', () => {
    const hardy = plant({ id: 'olive', name: 'Olive', room: 'Patio', plantedIn: 'pot', frostHardiness: -8 })
    const w = weather({ days: [day('2026-04-21', { minTemp: -3 })] })
    const { alerts } = buildWeatherAlerts([hardy], w, outdoorFloors, now)
    expect(alerts).toHaveLength(0) // -8°C threshold, -3°C forecast = safe
  })

  it('marks severity as critical when forecast is ≤ -2°C', () => {
    const plants = [plant({ id: 'p', room: 'Patio', plantedIn: 'pot' })]
    const w = weather({ days: [day('2026-04-21', { minTemp: -5 })] })
    const { alerts, criticalCount } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts[0].severity).toBe('critical')
    expect(criticalCount).toBe(1)
  })
})

describe('buildWeatherAlerts — heatwave', () => {
  it('fires on 2+ consecutive days at/above 32°C', () => {
    const plants = [plant({ id: 'tom', room: 'Garden', plantedIn: 'ground' })]
    const w = weather({ days: [
      day('2026-04-21', { maxTemp: 34 }),
      day('2026-04-22', { maxTemp: 33 }),
    ]})
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('heatwave')
  })

  it('does not fire on a single hot day', () => {
    const plants = [plant({ room: 'Garden', plantedIn: 'ground' })]
    const w = weather({ days: [
      day('2026-04-21', { maxTemp: 36 }),
      day('2026-04-22', { maxTemp: 25 }),
    ]})
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(0)
  })

  it('escalates severity above 38°C', () => {
    const plants = [plant({ room: 'Patio', plantedIn: 'pot' })]
    const w = weather({ days: [
      day('2026-04-21', { maxTemp: 40 }),
      day('2026-04-22', { maxTemp: 39 }),
    ]})
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts[0].severity).toBe('critical')
  })
})

describe('buildWeatherAlerts — heavy rain', () => {
  it('fires for outdoor potted plants when today ≥ 25mm', () => {
    const plants = [
      plant({ id: 'pot1', room: 'Patio', plantedIn: 'pot', name: 'Basil' }),
      plant({ id: 'bed',  room: 'Garden', plantedIn: 'ground' }),
    ]
    const w = weather({ days: [day('2026-04-21', { precipitation: 40 })] })
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('heavy-rain')
    // in-ground plants are not affected by drainage concerns
    expect(alerts[0].plants.map((p) => p.id)).toEqual(['pot1'])
  })

  it('does not fire when precipitation is below threshold', () => {
    const plants = [plant({ room: 'Patio', plantedIn: 'pot' })]
    const w = weather({ days: [day('2026-04-21', { precipitation: 10 })] })
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts).toHaveLength(0)
  })
})

describe('buildWeatherAlerts — drought', () => {
  it('fires when 10+ days of zero rain are forecast and user has in-ground plants', () => {
    const plants = [plant({ id: 'bed', room: 'Garden', plantedIn: 'ground', name: 'Rose' })]
    const days = Array.from({ length: 10 }, (_, i) => day(`2026-04-${21 + i}`, { precipitation: 0 }))
    const { alerts } = buildWeatherAlerts(plants, weather({ days }), outdoorFloors, now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('drought')
  })

  it('does not fire if any day in the window has rain', () => {
    const plants = [plant({ plantedIn: 'ground' })]
    const days = Array.from({ length: 10 }, (_, i) => day(`2026-04-${21 + i}`, { precipitation: i === 5 ? 3 : 0 }))
    const { alerts } = buildWeatherAlerts(plants, weather({ days }), outdoorFloors, now)
    expect(alerts).toHaveLength(0)
  })

  it('does not fire if the user has no in-ground or garden-bed plants', () => {
    const plants = [plant({ plantedIn: 'pot', room: 'Patio' })]
    const days = Array.from({ length: 10 }, (_, i) => day(`2026-04-${21 + i}`, { precipitation: 0 }))
    const { alerts } = buildWeatherAlerts(plants, weather({ days }), outdoorFloors, now)
    expect(alerts).toHaveLength(0)
  })
})

describe('buildWeatherAlerts — empty paths', () => {
  it('returns no alerts when weather is missing', () => {
    const plants = [plant({ room: 'Garden', plantedIn: 'pot' })]
    expect(buildWeatherAlerts(plants, null, outdoorFloors, now).alerts).toEqual([])
  })

  it('returns no alerts when plants list is empty', () => {
    const w = weather({ days: [day('2026-04-21', { minTemp: -5 })] })
    expect(buildWeatherAlerts([], w, outdoorFloors, now).alerts).toEqual([])
  })

  it('handles Fahrenheit temperatures for frost detection', () => {
    const plants = [plant({ id: 'p', room: 'Patio', plantedIn: 'pot' })]
    const w = weather({ unit: 'fahrenheit', days: [day('2026-04-21', { minTemp: 30 })] }) // 30°F ≈ -1°C
    const { alerts } = buildWeatherAlerts(plants, w, outdoorFloors, now)
    expect(alerts.find((a) => a.type === 'frost')).toBeTruthy()
  })
})
