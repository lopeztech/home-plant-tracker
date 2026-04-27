// Derive growing-season start and end dates from frost dates returned by /climate/lookup.
// Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label: string } or null if no frost data.
export function getGrowingSeason(climate, year = new Date().getFullYear()) {
  if (!climate) return null
  const { lastFrostMonthDay, firstFrostMonthDay } = climate
  if (!lastFrostMonthDay && !firstFrostMonthDay) return null

  const start = lastFrostMonthDay  ? `${year}-${lastFrostMonthDay}`  : `${year}-01-01`
  const end   = firstFrostMonthDay ? `${year}-${firstFrostMonthDay}` : `${year}-12-31`

  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  const label = `Growing season ~${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`
  return { start, end, label }
}

// Return a human-readable description of a Köppen code.
export function koppenLabel(code) {
  if (!code) return null
  const first = code[0]
  switch (first) {
    case 'A': return 'Tropical'
    case 'B': return code[1] === 'S' ? 'Semi-arid' : 'Arid'
    case 'C': return 'Temperate'
    case 'D': return 'Continental'
    case 'E': return 'Polar/Arctic'
    default:  return code
  }
}
