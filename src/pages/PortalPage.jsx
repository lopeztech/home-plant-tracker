import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Badge, Spinner } from 'react-bootstrap'
import { portalApi } from '../api/plants.js'

/**
 * Read-only client portal — accessible without authentication via a signed token.
 * Route: /portal/:token
 *
 * Displays plant health, last watered, and overall garden status for a property
 * owner whose landscaper has shared this link.
 */
export default function PortalPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    portalApi.getData(token)
      .then((res) => {
        if (res.error) throw new Error(res.error)
        setData(res)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="success" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-5 text-center">
        <svg style={{ width: 48, height: 48 }} className="text-danger mb-3"><use href="/icons/sprite.svg#alert-circle" /></svg>
        <h2 className="h5">Portal unavailable</h2>
        <p className="text-muted">{error}</p>
        <p className="text-muted fs-sm">This link may have expired or been revoked. Contact your landscaper for a new link.</p>
      </div>
    )
  }

  const { label, plants = [], branding } = data

  const healthBg = (h) => {
    if (h === 'Excellent' || h === 'Good') return 'success'
    if (h === 'Fair') return 'warning'
    return 'danger'
  }

  const overduePlants = plants.filter((p) => {
    if (!p.lastWatered || !p.frequencyDays) return false
    const next = new Date(p.lastWatered).getTime() + p.frequencyDays * 86400000
    return next < Date.now()
  })

  return (
    <div className="container-fluid p-0">
      {/* Header */}
      <div className="bg-success text-white py-4 px-3 px-md-5">
        {branding?.logoUrl && (
          <img src={branding.logoUrl} alt="Logo" style={{ height: 40, marginBottom: 8, borderRadius: 4 }} />
        )}
        <h1 className="h4 mb-0">{branding?.businessName || label}</h1>
        <p className="mb-0 opacity-75 fs-sm">Garden care portal · {plants.length} plants tracked</p>
      </div>

      <div className="container py-4">
        {/* Summary cards */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card text-center py-3">
              <div className="h3 fw-700 mb-0">{plants.length}</div>
              <small className="text-muted">Plants</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center py-3">
              <div className="h3 fw-700 mb-0 text-success">{plants.filter((p) => p.health === 'Excellent' || p.health === 'Good').length}</div>
              <small className="text-muted">Healthy</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center py-3">
              <div className="h3 fw-700 mb-0 text-warning">{plants.filter((p) => p.health === 'Fair').length}</div>
              <small className="text-muted">Needs attention</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card text-center py-3">
              <div className="h3 fw-700 mb-0 text-danger">{overduePlants.length}</div>
              <small className="text-muted">Overdue watering</small>
            </div>
          </div>
        </div>

        {/* Plant list */}
        <h2 className="h6 text-muted text-uppercase fw-600 mb-3">Your Plants</h2>
        <div className="row g-3">
          {plants.map((plant) => {
            const overdue = overduePlants.some((p) => p.id === plant.id)
            return (
              <div key={plant.id} className="col-12 col-md-6 col-lg-4">
                <div className="card h-100">
                  {plant.imageUrl && (
                    <img src={plant.imageUrl} alt={plant.name} className="card-img-top" style={{ height: 140, objectFit: 'cover' }} />
                  )}
                  <div className="card-body">
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                      <h3 className="h6 mb-0 fw-600">{plant.name}</h3>
                      {plant.health && (
                        <Badge bg={healthBg(plant.health)} className="flex-shrink-0">{plant.health}</Badge>
                      )}
                    </div>
                    {plant.species && <p className="text-muted fst-italic fs-sm mb-1">{plant.species}</p>}
                    {plant.room && <p className="text-muted fs-xs mb-1">📍 {plant.room}</p>}
                    {plant.lastWatered && (
                      <p className={`fs-xs mb-0 ${overdue ? 'text-danger fw-500' : 'text-muted'}`}>
                        💧 Last watered {new Date(plant.lastWatered).toLocaleDateString()}
                        {overdue && ' — overdue'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {plants.length === 0 && (
          <div className="text-center py-5 text-muted">
            <p>No plants in this garden yet.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-5 pt-3 border-top">
          {!branding?.businessName && (
            <p className="text-muted fs-sm">
              Powered by{' '}
              <a href="/" className="text-success fw-500">Home Plant Tracker</a>
              {' '}— track your own plants for free
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
