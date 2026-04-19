// Derive a plant's display name from its species and room. We no longer ask
// the user for a name — short species (everything before the first paren or
// comma) plus the room makes a unique-enough label like "Monstera - Living
// Room" without forcing a typing chore.
export function derivePlantName({ species, room } = {}) {
  const short = (species || '').split('(')[0].split(',')[0].trim()
  if (short && room) return `${short} - ${room}`
  if (short) return short
  if (room) return `${room} plant`
  return 'New plant'
}
