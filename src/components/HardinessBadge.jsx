import { useState, useEffect } from 'react'
import { climateApi } from '../api/plants.js'

const VERDICT_META = {
  hardy:      { icon: '🟢', label: 'Hardy here',          cls: 'text-success' },
  tender:     { icon: '🟡', label: 'Overwinter indoors',  cls: 'text-warning' },
  unsuitable: { icon: '🔴', label: 'Unsuitable outdoors', cls: 'text-danger'  },
}

// Renders a small badge showing outdoor hardiness for a plant at the user's location.
// location = { lat, lon } from PlantContext weather.location or settings.
export default function HardinessBadge({ plant, location }) {
  const [compat, setCompat]   = useState(plant?.compatibility ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const species = plant?.species || plant?.name

  useEffect(() => {
    if (!species || !location?.lat || !location?.lon) return
    if (compat) {
      // Already loaded — re-fetch only if location changed more than 0.5°
      const locStamp = `${location.lat.toFixed(1)},${location.lon.toFixed(1)}`
      if (compat.locationStamp === locStamp) return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    climateApi
      .plantCompatibility(species, location.lat, location.lon, plant?.id)
      .then(data => { if (!cancelled) setCompat(data) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [species, location?.lat, location?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!species || !location?.lat) return null
  if (loading) return <span className="badge bg-secondary bg-opacity-25 text-muted fs-xs">Checking climate…</span>
  if (error) return null

  const meta = VERDICT_META[compat?.verdict]
  if (!meta) return null

  return (
    <span
      className={`badge bg-opacity-10 d-inline-flex align-items-center gap-1 fs-xs ${meta.cls}`}
      style={{ background: 'currentColor' }}
      title={compat.overwinterAdvice || meta.label}
      data-testid="hardiness-badge"
    >
      {meta.icon} {meta.label}
    </span>
  )
}
