import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { sitApi } from '../api/plants.js'

function getDaysUntilWatering(plant) {
  if (!plant.lastWatered || !plant.frequencyDays) return 0
  const next = new Date(plant.lastWatered).getTime() + plant.frequencyDays * 86400000
  return Math.ceil((next - Date.now()) / 86400000)
}

export default function SitPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [watering, setWatering] = useState({})
  const [watered, setWatered] = useState({})

  useEffect(() => {
    sitApi.getSitterView(token)
      .then(setData)
      .catch((e) => setError(e?.error || 'Session not found or expired'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleWater(plantId) {
    setWatering((prev) => ({ ...prev, [plantId]: true }))
    try {
      await sitApi.waterPlant(token, plantId)
      setWatered((prev) => ({ ...prev, [plantId]: true }))
      setData((prev) => ({
        ...prev,
        plants: prev.plants.map((p) =>
          p.id === plantId ? { ...p, lastWatered: new Date().toISOString() } : p
        ),
      }))
    } catch {
      // ignore
    } finally {
      setWatering((prev) => ({ ...prev, [plantId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center p-4">
          <div className="display-1">🌱</div>
          <h2 className="mt-3">Session not available</h2>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    )
  }

  const duePlants = (data?.plants || []).filter((p) => getDaysUntilWatering(p) <= 0)
  const otherPlants = (data?.plants || []).filter((p) => getDaysUntilWatering(p) > 0)

  return (
    <div className="min-vh-100 bg-body" style={{ maxWidth: 480, margin: '0 auto', padding: '1rem' }}>
      <div className="text-center mb-4">
        <div className="display-4">🌿</div>
        <h1 className="h4 mt-2">Plant Care</h1>
        {data?.sitterName && <p className="text-muted fs-sm">Hi {data.sitterName}!</p>}
        {data?.notes && (
          <div className="alert alert-info fs-sm text-start">{data.notes}</div>
        )}
      </div>

      {duePlants.length > 0 && (
        <div className="mb-4">
          <h2 className="h6 text-danger mb-3">Needs watering ({duePlants.length})</h2>
          {duePlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onWater={() => handleWater(plant.id)}
              watering={watering[plant.id]}
              watered={watered[plant.id]}
            />
          ))}
        </div>
      )}

      {otherPlants.length > 0 && (
        <div>
          <h2 className="h6 text-muted mb-3">All good ({otherPlants.length})</h2>
          {otherPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onWater={() => handleWater(plant.id)}
              watering={watering[plant.id]}
              watered={watered[plant.id]}
            />
          ))}
        </div>
      )}

      {data?.plants?.length === 0 && (
        <p className="text-center text-muted">No plants in this session.</p>
      )}

      <div className="text-center mt-4 text-muted fs-xs">
        Session expires {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : '—'}
      </div>
    </div>
  )
}

function PlantCard({ plant, onWater, watering, watered }) {
  const days = getDaysUntilWatering(plant)
  const isDue = days <= 0

  return (
    <div className={`card mb-2 ${isDue ? 'border-danger border-opacity-50' : ''}`}>
      <div className="card-body py-2 d-flex align-items-center gap-3">
        {plant.imageUrl ? (
          <img
            src={plant.imageUrl}
            alt={plant.name}
            className="rounded-circle"
            style={{ width: 44, height: 44, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white fs-5 flex-shrink-0"
            style={{ width: 44, height: 44, backgroundColor: isDue ? '#ef4444' : '#22c55e' }}
          >
            {plant.name?.charAt(0) || '?'}
          </div>
        )}
        <div className="flex-grow-1 min-w-0">
          <div className="fw-500 text-truncate">{plant.name}</div>
          {plant.species && <div className="text-muted fs-xs text-truncate">{plant.species}</div>}
          <div className={`fs-xs mt-0.5 ${isDue ? 'text-danger' : 'text-success'}`}>
            {isDue ? `${Math.abs(days)}d overdue` : `${days}d until watering`}
          </div>
        </div>
        <button
          type="button"
          className={`btn btn-sm ${watered ? 'btn-success' : isDue ? 'btn-danger' : 'btn-outline-success'}`}
          disabled={watering || watered}
          onClick={onWater}
          aria-label={`Water ${plant.name}`}
        >
          {watering ? (
            <span className="spinner-border spinner-border-sm" />
          ) : watered ? (
            '✓ Done'
          ) : (
            '💧 Water'
          )}
        </button>
      </div>
    </div>
  )
}
