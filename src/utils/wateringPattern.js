/**
 * Heuristic watering pattern analysis.
 * Mirrors the backend analyseWateringPattern() logic so it works in guest mode.
 * Returns { pattern, confidence, contributingFactors[] }
 *   pattern: 'optimal' | 'over_watered' | 'under_watered' | 'inconsistent' | 'insufficient_data'
 */
export function analyseWateringPattern(plant) {
  const log = plant.wateringLog || []
  if (log.length < 3) {
    return { pattern: 'insufficient_data', confidence: 0, contributingFactors: ['Need at least 3 watering events for analysis'] }
  }

  const sorted = [...log].sort((a, b) => new Date(a.date) - new Date(b.date))
  const gaps = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000)
  }

  const freq = plant.frequencyDays || 7
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const std = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length)
  const adherence = mean / freq
  const cv = mean > 0 ? std / mean : 0

  const healthLog = plant.healthLog || []
  const healthDeclined = healthLog.length >= 2 &&
    ['Poor', 'Fair'].includes(healthLog[healthLog.length - 1]?.health) &&
    ['Excellent', 'Good'].includes(healthLog[0]?.health)

  const factors = []
  let pattern = 'optimal'
  let confidence = 0.7

  if (cv > 0.5) {
    pattern = 'inconsistent'
    confidence = Math.min(0.95, 0.6 + cv * 0.2)
    factors.push(`High watering variability (${std.toFixed(1)} day std dev)`)
    factors.push(`Gaps range from ${Math.min(...gaps).toFixed(0)} to ${Math.max(...gaps).toFixed(0)} days`)
  } else if (adherence < 0.6 && healthDeclined) {
    pattern = 'over_watered'
    confidence = Math.min(0.9, 0.5 + (1 - adherence) * 0.4)
    factors.push(`Watering every ${mean.toFixed(1)}d vs recommended ${freq}d`)
    factors.push('Health has declined since tracking began')
  } else if (adherence > 1.5 && healthDeclined) {
    pattern = 'under_watered'
    confidence = Math.min(0.9, 0.5 + (adherence - 1) * 0.3)
    factors.push(`Watering every ${mean.toFixed(1)}d vs recommended ${freq}d`)
    factors.push('Health has declined since tracking began')
  } else if (adherence < 0.6) {
    pattern = 'over_watered'
    confidence = 0.5
    factors.push(`Watering more often than recommended (every ${mean.toFixed(1)}d vs ${freq}d)`)
  } else if (adherence > 1.5) {
    pattern = 'under_watered'
    confidence = 0.5
    factors.push(`Watering less often than recommended (every ${mean.toFixed(1)}d vs ${freq}d)`)
  } else {
    confidence = Math.min(0.95, 0.6 + (1 - Math.abs(1 - adherence)) * 0.3)
    factors.push('Watering frequency closely matches recommendation')
    if (!healthDeclined) factors.push('Health has been stable or improving')
  }

  return { pattern, confidence: +confidence.toFixed(2), contributingFactors: factors }
}

const PATTERN_META = {
  optimal:            { label: 'Optimal',       color: '#10b981', bgClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50' },
  over_watered:       { label: 'Over-watered',  color: '#3b82f6', bgClass: 'bg-blue-950/60 text-blue-400 border-blue-900/50' },
  under_watered:      { label: 'Under-watered', color: '#f59e0b', bgClass: 'bg-amber-950/60 text-amber-400 border-amber-900/50' },
  inconsistent:       { label: 'Inconsistent',  color: '#ef4444', bgClass: 'bg-red-950/60 text-red-400 border-red-900/50' },
  insufficient_data:  { label: 'No data',       color: '#6b7280', bgClass: 'bg-gray-800/60 text-gray-400 border-gray-700/50' },
}

export function getPatternMeta(pattern) {
  return PATTERN_META[pattern] || PATTERN_META.insufficient_data
}
