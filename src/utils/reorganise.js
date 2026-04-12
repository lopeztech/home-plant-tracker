// Minimum spacing between plants in percentage units.
// Plant markers are 32px; in a 500px-tall viewport, that's ~6.4%.
// 5% gives comfortable spacing without excessive expansion.
const MIN_CELL_SIZE = 5

/**
 * Calculate new positions for plants to distribute them evenly within their
 * assigned rooms. If any room is too small for its plants at MIN_CELL_SIZE
 * spacing, ALL rooms are scaled up uniformly from the floor centre so the
 * layout stays proportional.
 *
 * @param {Array} plants - Plants on the current floor
 * @param {Array} rooms  - Room definitions with { name, x, y, width, height, hidden }
 * @returns {{ plantUpdates: Object, expandedRooms: Array|null }}
 *   plantUpdates: Map of plantId → { x, y, room }
 *   expandedRooms: The full rooms array with updated bounds, or null if no
 *                  expansion was needed.
 */
export function calculateReorganisedPositions(plants, rooms) {
  if (!rooms?.length || !plants?.length) return { plantUpdates: {}, expandedRooms: null }

  // Visible rooms only
  const visibleRooms = rooms.filter((r) => !r.hidden)
  const roomBounds = {}
  for (const room of visibleRooms) {
    roomBounds[room.name] = room
  }

  // Group plants by room
  const groups = {}
  const unassigned = []
  for (const plant of plants) {
    const room = plant.room
    if (room && roomBounds[room]) {
      if (!groups[room]) groups[room] = []
      groups[room].push(plant)
    } else {
      unassigned.push(plant)
    }
  }

  // Also group unassigned into the first visible room for scale calculation
  if (unassigned.length > 0 && visibleRooms.length > 0) {
    const firstName = visibleRooms[0].name
    if (!groups[firstName]) groups[firstName] = []
    groups[firstName].push(...unassigned)
  }

  // ── Determine if expansion is needed ──────────────────────────────────────
  let maxScale = 1
  for (const [roomName, roomPlants] of Object.entries(groups)) {
    const bounds = roomBounds[roomName]
    if (!bounds || roomPlants.length === 0) continue

    const count = roomPlants.length
    const cols = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / cols)

    const neededW = cols * MIN_CELL_SIZE
    const neededH = rows * MIN_CELL_SIZE

    const pad = Math.min(2, bounds.width * 0.08, bounds.height * 0.08)
    const availW = bounds.width - pad * 2
    const availH = bounds.height - pad * 2

    const scaleX = neededW > availW ? neededW / availW : 1
    const scaleY = neededH > availH ? neededH / availH : 1
    maxScale = Math.max(maxScale, scaleX, scaleY)
  }

  // ── Apply uniform expansion to ALL rooms if needed ────────────────────────
  let workingRooms = rooms
  let expandedRooms = null

  if (maxScale > 1) {
    // Find centre of bounding box of all visible rooms
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of visibleRooms) {
      minX = Math.min(minX, room.x)
      minY = Math.min(minY, room.y)
      maxX = Math.max(maxX, room.x + room.width)
      maxY = Math.max(maxY, room.y + room.height)
    }
    const centreX = (minX + maxX) / 2
    const centreY = (minY + maxY) / 2

    // Scale every room (including hidden ones) from the centre
    expandedRooms = rooms.map((room) => {
      const roomCX = room.x + room.width / 2
      const roomCY = room.y + room.height / 2
      const newCX = centreX + (roomCX - centreX) * maxScale
      const newCY = centreY + (roomCY - centreY) * maxScale
      const newW = room.width * maxScale
      const newH = room.height * maxScale
      return {
        ...room,
        x: Math.round((newCX - newW / 2) * 10) / 10,
        y: Math.round((newCY - newH / 2) * 10) / 10,
        width: Math.round(newW * 10) / 10,
        height: Math.round(newH * 10) / 10,
      }
    })
    workingRooms = expandedRooms

    // Rebuild bounds lookup from expanded rooms
    for (const room of workingRooms) {
      if (room.hidden) continue
      roomBounds[room.name] = room
    }
  }

  // ── Lay out plants in (possibly expanded) rooms ───────────────────────────
  const plantUpdates = {}
  for (const [roomName, roomPlants] of Object.entries(groups)) {
    layoutInBounds(roomPlants, roomBounds[roomName], roomName, plantUpdates)
  }

  return { plantUpdates, expandedRooms }
}

function layoutInBounds(plants, bounds, roomName, updates) {
  const count = plants.length
  if (count === 0) return

  const pad = Math.min(2, bounds.width * 0.08, bounds.height * 0.08)
  const innerW = bounds.width - pad * 2
  const innerH = bounds.height - pad * 2

  // Calculate grid dimensions — prefer wider grids
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  const spacingX = cols > 1 ? innerW / cols : 0
  const spacingY = rows > 1 ? innerH / rows : 0
  const offsetX = bounds.x + pad + spacingX / 2
  const offsetY = bounds.y + pad + spacingY / 2

  plants.forEach((plant, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = Math.round((offsetX + col * spacingX) * 10) / 10
    const y = Math.round((offsetY + row * spacingY) * 10) / 10
    updates[plant.id] = { x, y, room: roomName }
  })
}
