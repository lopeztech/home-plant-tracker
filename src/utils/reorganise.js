/**
 * Calculate new positions for plants to distribute them evenly within their assigned rooms.
 *
 * @param {Array} plants - Plants on the current floor
 * @param {Array} rooms - Room definitions with { name, x, y, width, height, hidden }
 * @returns {Object} Map of plantId -> { x, y, room }
 */
export function calculateReorganisedPositions(plants, rooms) {
  if (!rooms?.length || !plants?.length) return {}

  // Build a lookup of room bounds (visible rooms only)
  const roomBounds = {}
  for (const room of rooms) {
    if (room.hidden) continue
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

  const updates = {}

  // For each room, lay plants out in a grid with padding
  for (const [roomName, roomPlants] of Object.entries(groups)) {
    layoutInBounds(roomPlants, roomBounds[roomName], roomName, updates)
  }

  // For unassigned plants, place in the first visible room
  if (unassigned.length > 0) {
    const firstRoom = rooms.find((r) => !r.hidden)
    if (firstRoom) {
      layoutInBounds(unassigned, firstRoom, firstRoom.name, updates)
    }
  }

  return updates
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
