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
  it('returns empty object for no plants', () => {
    expect(calculateReorganisedPositions([], ROOMS)).toEqual({})
  })

  it('returns empty object for no rooms', () => {
    const plants = [makePlant('p1', 'Kitchen')]
    expect(calculateReorganisedPositions(plants, [])).toEqual({})
  })

  it('returns empty object for null inputs', () => {
    expect(calculateReorganisedPositions(null, null)).toEqual({})
  })

  it('places a single plant in the center of its room', () => {
    const plants = [makePlant('p1', 'Kitchen')]
    const result = calculateReorganisedPositions(plants, ROOMS)

    expect(result.p1).toBeDefined()
    expect(result.p1.room).toBe('Kitchen')
    // Single plant: cols=1, rows=1, spacingX=0, spacingY=0
    // offsetX = 0 + pad + 0 = pad, offsetY = 0 + pad + 0 = pad
    // So plant is at (pad, pad) — center of the room for 1 item
    expect(result.p1.x).toBeGreaterThanOrEqual(0)
    expect(result.p1.x).toBeLessThanOrEqual(50)
    expect(result.p1.y).toBeGreaterThanOrEqual(0)
    expect(result.p1.y).toBeLessThanOrEqual(50)
  })

  it('distributes multiple plants in a grid within their room', () => {
    const plants = [
      makePlant('p1', 'Kitchen', 50, 50),
      makePlant('p2', 'Kitchen', 50, 50),
      makePlant('p3', 'Kitchen', 50, 50),
      makePlant('p4', 'Kitchen', 50, 50),
    ]
    const result = calculateReorganisedPositions(plants, ROOMS)

    // 4 plants = 2x2 grid
    expect(Object.keys(result)).toHaveLength(4)

    // All should be within Kitchen bounds (0-50, 0-50)
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      expect(result[id].room).toBe('Kitchen')
      expect(result[id].x).toBeGreaterThanOrEqual(0)
      expect(result[id].x).toBeLessThanOrEqual(50)
      expect(result[id].y).toBeGreaterThanOrEqual(0)
      expect(result[id].y).toBeLessThanOrEqual(50)
    }

    // All positions should be unique (no overlaps)
    const positions = Object.values(result).map((p) => `${p.x},${p.y}`)
    expect(new Set(positions).size).toBe(4)
  })

  it('places plants from different rooms within their respective room bounds', () => {
    const plants = [
      makePlant('p1', 'Kitchen'),
      makePlant('p2', 'Kitchen'),
      makePlant('p3', 'Bedroom'),
    ]
    const result = calculateReorganisedPositions(plants, ROOMS)

    expect(result.p1.room).toBe('Kitchen')
    expect(result.p1.x).toBeLessThan(50)
    expect(result.p2.room).toBe('Kitchen')
    expect(result.p2.x).toBeLessThan(50)

    expect(result.p3.room).toBe('Bedroom')
    expect(result.p3.x).toBeGreaterThanOrEqual(50)
  })

  it('assigns unassigned plants to the first visible room', () => {
    const plants = [makePlant('p1', 'Nonexistent Room')]
    const result = calculateReorganisedPositions(plants, ROOMS)

    expect(result.p1).toBeDefined()
    expect(result.p1.room).toBe('Kitchen') // first visible room
  })

  it('skips hidden rooms and does not place plants there', () => {
    const rooms = [
      { name: 'Kitchen', x: 0, y: 0, width: 50, height: 50, hidden: true },
      { name: 'Bedroom', x: 50, y: 0, width: 50, height: 50 },
    ]
    const plants = [makePlant('p1', 'Kitchen')]
    const result = calculateReorganisedPositions(plants, rooms)

    // Kitchen is hidden, so p1 is "unassigned" → placed in Bedroom (first visible)
    expect(result.p1.room).toBe('Bedroom')
  })

  it('handles a single plant in a small room', () => {
    const rooms = [{ name: 'Closet', x: 10, y: 10, width: 5, height: 5 }]
    const plants = [makePlant('p1', 'Closet')]
    const result = calculateReorganisedPositions(plants, rooms)

    expect(result.p1.room).toBe('Closet')
    expect(result.p1.x).toBeGreaterThanOrEqual(10)
    expect(result.p1.x).toBeLessThanOrEqual(15)
    expect(result.p1.y).toBeGreaterThanOrEqual(10)
    expect(result.p1.y).toBeLessThanOrEqual(15)
  })

  it('evenly spaces 3 plants in a 2x2 grid', () => {
    const rooms = [{ name: 'Room', x: 0, y: 0, width: 100, height: 100 }]
    const plants = [
      makePlant('p1', 'Room'),
      makePlant('p2', 'Room'),
      makePlant('p3', 'Room'),
    ]
    const result = calculateReorganisedPositions(plants, rooms)

    // 3 plants → ceil(sqrt(3))=2 cols, ceil(3/2)=2 rows
    // p1 at (col 0, row 0), p2 at (col 1, row 0), p3 at (col 0, row 1)
    expect(result.p1.x).toBeLessThan(result.p2.x)
    expect(result.p1.y).toBeLessThan(result.p3.y)
    expect(result.p3.x).toBeLessThan(result.p2.x)
  })
})
