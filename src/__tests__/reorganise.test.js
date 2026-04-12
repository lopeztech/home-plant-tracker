import { describe, it, expect } from 'vitest'
import { calculateReorganisedPositions } from '../utils/reorganise.js'

const ROOMS = [
  { name: 'Kitchen', x: 0, y: 0, width: 50, height: 50 },
  { name: 'Bedroom', x: 50, y: 0, width: 50, height: 50 },
]

function makePlant(id, room, x = 50, y = 50) {
  return { id, name: `Plant ${id}`, room, x, y }
}

describe('calculateReorganisedPositions', () => {
  it('returns empty plantUpdates for no plants', () => {
    const { plantUpdates, expandedRooms } = calculateReorganisedPositions([], ROOMS)
    expect(plantUpdates).toEqual({})
    expect(expandedRooms).toBeNull()
  })

  it('returns empty plantUpdates for no rooms', () => {
    const plants = [makePlant('p1', 'Kitchen')]
    const { plantUpdates } = calculateReorganisedPositions(plants, [])
    expect(plantUpdates).toEqual({})
  })

  it('returns empty plantUpdates for null inputs', () => {
    const { plantUpdates } = calculateReorganisedPositions(null, null)
    expect(plantUpdates).toEqual({})
  })

  it('places a single plant in the center of its room without expanding', () => {
    const plants = [makePlant('p1', 'Kitchen')]
    const { plantUpdates, expandedRooms } = calculateReorganisedPositions(plants, ROOMS)

    expect(plantUpdates.p1).toBeDefined()
    expect(plantUpdates.p1.room).toBe('Kitchen')
    expect(plantUpdates.p1.x).toBeGreaterThanOrEqual(0)
    expect(plantUpdates.p1.x).toBeLessThanOrEqual(50)
    expect(plantUpdates.p1.y).toBeGreaterThanOrEqual(0)
    expect(plantUpdates.p1.y).toBeLessThanOrEqual(50)
    expect(expandedRooms).toBeNull()
  })

  it('distributes multiple plants in a grid within their room', () => {
    const plants = [
      makePlant('p1', 'Kitchen', 50, 50),
      makePlant('p2', 'Kitchen', 50, 50),
      makePlant('p3', 'Kitchen', 50, 50),
      makePlant('p4', 'Kitchen', 50, 50),
    ]
    const { plantUpdates } = calculateReorganisedPositions(plants, ROOMS)

    // 4 plants = 2x2 grid
    expect(Object.keys(plantUpdates)).toHaveLength(4)

    // All should be within Kitchen bounds (which may have been expanded)
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(plantUpdates[id].room).toBe('Kitchen')
    }

    // All positions should be unique (no overlaps)
    const positions = Object.values(plantUpdates).map((p) => `${p.x},${p.y}`)
    expect(new Set(positions).size).toBe(4)
  })

  it('places plants from different rooms within their respective rooms', () => {
    const plants = [
      makePlant('p1', 'Kitchen'),
      makePlant('p2', 'Kitchen'),
      makePlant('p3', 'Bedroom'),
    ]
    const { plantUpdates } = calculateReorganisedPositions(plants, ROOMS)

    expect(plantUpdates.p1.room).toBe('Kitchen')
    expect(plantUpdates.p2.room).toBe('Kitchen')
    expect(plantUpdates.p3.room).toBe('Bedroom')
  })

  it('assigns unassigned plants to the first visible room', () => {
    const plants = [makePlant('p1', 'Nonexistent Room')]
    const { plantUpdates } = calculateReorganisedPositions(plants, ROOMS)

    expect(plantUpdates.p1).toBeDefined()
    expect(plantUpdates.p1.room).toBe('Kitchen') // first visible room
  })

  it('skips hidden rooms and does not place plants there', () => {
    const rooms = [
      { name: 'Kitchen', x: 0, y: 0, width: 50, height: 50, hidden: true },
      { name: 'Bedroom', x: 50, y: 0, width: 50, height: 50 },
    ]
    const plants = [makePlant('p1', 'Kitchen')]
    const { plantUpdates } = calculateReorganisedPositions(plants, rooms)

    // Kitchen is hidden, so p1 is "unassigned" → placed in Bedroom (first visible)
    expect(plantUpdates.p1.room).toBe('Bedroom')
  })

  it('handles a single plant in a small room', () => {
    const rooms = [{ name: 'Closet', x: 10, y: 10, width: 5, height: 5 }]
    const plants = [makePlant('p1', 'Closet')]
    const { plantUpdates } = calculateReorganisedPositions(plants, rooms)

    expect(plantUpdates.p1.room).toBe('Closet')
  })

  it('evenly spaces 3 plants in a 2x2 grid', () => {
    const rooms = [{ name: 'Room', x: 0, y: 0, width: 100, height: 100 }]
    const plants = [
      makePlant('p1', 'Room'),
      makePlant('p2', 'Room'),
      makePlant('p3', 'Room'),
    ]
    const { plantUpdates } = calculateReorganisedPositions(plants, rooms)

    // 3 plants → ceil(sqrt(3))=2 cols, ceil(3/2)=2 rows
    // p1 at (col 0, row 0), p2 at (col 1, row 0), p3 at (col 0, row 1)
    expect(plantUpdates.p1.x).toBeLessThan(plantUpdates.p2.x)
    expect(plantUpdates.p1.y).toBeLessThan(plantUpdates.p3.y)
    expect(plantUpdates.p3.x).toBeLessThan(plantUpdates.p2.x)
  })

  // ── Room expansion tests ──────────────────────────────────────────────────

  it('expands rooms uniformly when a room is too small for its plants', () => {
    // Tiny room: 6x6, two plants need 2 cols × 1 row → 10 wide at MIN_CELL_SIZE=5
    const rooms = [
      { name: 'Tiny', x: 0, y: 0, width: 6, height: 6 },
      { name: 'Normal', x: 10, y: 0, width: 40, height: 40 },
    ]
    const plants = [
      makePlant('p1', 'Tiny'),
      makePlant('p2', 'Tiny'),
    ]
    const { plantUpdates, expandedRooms } = calculateReorganisedPositions(plants, rooms)

    // Rooms should have been expanded
    expect(expandedRooms).not.toBeNull()
    expect(expandedRooms).toHaveLength(2)

    // Both rooms should grow by the same scale factor
    const tinyExpanded = expandedRooms.find((r) => r.name === 'Tiny')
    const normalExpanded = expandedRooms.find((r) => r.name === 'Normal')
    const tinyScale = tinyExpanded.width / 6
    const normalScale = normalExpanded.width / 40
    expect(tinyScale).toBeCloseTo(normalScale, 1)

    // All plants should still be in their assigned room
    expect(plantUpdates.p1.room).toBe('Tiny')
    expect(plantUpdates.p2.room).toBe('Tiny')

    // Plant positions should be unique
    expect(plantUpdates.p1.x).not.toBe(plantUpdates.p2.x)
  })

  it('does not expand rooms when they are large enough', () => {
    const rooms = [{ name: 'Big', x: 0, y: 0, width: 100, height: 100 }]
    const plants = [
      makePlant('p1', 'Big'),
      makePlant('p2', 'Big'),
    ]
    const { expandedRooms } = calculateReorganisedPositions(plants, rooms)
    expect(expandedRooms).toBeNull()
  })

  it('expands all rooms even when only one room is too small', () => {
    const rooms = [
      { name: 'Small', x: 0, y: 0, width: 4, height: 4 },
      { name: 'Large', x: 20, y: 0, width: 60, height: 60 },
    ]
    const plants = [
      makePlant('p1', 'Small'),
      makePlant('p2', 'Small'),
      makePlant('p3', 'Small'),
      makePlant('p4', 'Small'),
      makePlant('p5', 'Large'),
    ]
    const { expandedRooms } = calculateReorganisedPositions(plants, rooms)

    expect(expandedRooms).not.toBeNull()

    // Both rooms should have expanded
    const small = expandedRooms.find((r) => r.name === 'Small')
    const large = expandedRooms.find((r) => r.name === 'Large')
    expect(small.width).toBeGreaterThan(4)
    expect(small.height).toBeGreaterThan(4)
    expect(large.width).toBeGreaterThan(60)
    expect(large.height).toBeGreaterThan(60)
  })

  it('preserves hidden rooms during expansion (scales them too)', () => {
    const rooms = [
      { name: 'Tiny', x: 0, y: 0, width: 4, height: 4 },
      { name: 'Hidden', x: 50, y: 50, width: 20, height: 20, hidden: true },
    ]
    const plants = [
      makePlant('p1', 'Tiny'),
      makePlant('p2', 'Tiny'),
      makePlant('p3', 'Tiny'),
      makePlant('p4', 'Tiny'),
    ]
    const { expandedRooms } = calculateReorganisedPositions(plants, rooms)

    expect(expandedRooms).not.toBeNull()
    const hidden = expandedRooms.find((r) => r.name === 'Hidden')
    expect(hidden.hidden).toBe(true)
    // Hidden room should also have been scaled
    expect(hidden.width).toBeGreaterThan(20)
  })

  it('plants fit inside their expanded room bounds', () => {
    // Very small room with many plants should trigger expansion
    const rooms = [{ name: 'Micro', x: 40, y: 40, width: 3, height: 3 }]
    const plants = Array.from({ length: 9 }, (_, i) => makePlant(`p${i}`, 'Micro'))
    const { plantUpdates, expandedRooms } = calculateReorganisedPositions(plants, rooms)

    expect(expandedRooms).not.toBeNull()
    const expanded = expandedRooms[0]

    // Every plant position should be inside the expanded bounds
    for (const update of Object.values(plantUpdates)) {
      expect(update.x).toBeGreaterThanOrEqual(expanded.x)
      expect(update.x).toBeLessThanOrEqual(expanded.x + expanded.width)
      expect(update.y).toBeGreaterThanOrEqual(expanded.y)
      expect(update.y).toBeLessThanOrEqual(expanded.y + expanded.height)
    }

    // All 9 positions should be unique
    const positions = Object.values(plantUpdates).map((p) => `${p.x},${p.y}`)
    expect(new Set(positions).size).toBe(9)
  })

  it('rooms scale from the centre so relative positions are preserved', () => {
    const rooms = [
      { name: 'Left', x: 0, y: 0, width: 4, height: 4 },
      { name: 'Right', x: 20, y: 0, width: 4, height: 4 },
    ]
    const plants = [
      makePlant('p1', 'Left'),
      makePlant('p2', 'Left'),
      makePlant('p3', 'Left'),
      makePlant('p4', 'Left'),
      makePlant('p5', 'Right'),
    ]
    const { expandedRooms } = calculateReorganisedPositions(plants, rooms)

    expect(expandedRooms).not.toBeNull()
    const left = expandedRooms.find((r) => r.name === 'Left')
    const right = expandedRooms.find((r) => r.name === 'Right')

    // Left room centre should still be to the left of Right room centre
    const leftCentre = left.x + left.width / 2
    const rightCentre = right.x + right.width / 2
    expect(leftCentre).toBeLessThan(rightCentre)
  })
})
