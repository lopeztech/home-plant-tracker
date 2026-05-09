import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Badge, Button, Form } from 'react-bootstrap'
import { rebatesApi } from '../api/plants.js'
import EmptyState from '../components/EmptyState.jsx'
import { usePlantContext } from '../context/PlantContext.jsx'

const CATEGORY_ICONS = {
  water: 'droplet',
  'native-plant': 'leaf',
  compost: 'layers',
  energy: 'zap',
}

const CATEGORY_LABELS = {
  water: 'Water Saving',
  'native-plant': 'Native Plants',
  compost: 'Composting',
  energy: 'Energy',
}

function RebateCard({ rebate }) {
  const icon = CATEGORY_ICONS[rebate.category] || 'tag'
  const ctaUrl = rebate.affiliateUrl || rebate.applyUrl
  return (
    <div className="panel panel-icon h-100">
      <div className="panel-hdr">
        <h2>
          <svg className="sa-icon sa-icon-2x me-2" aria-hidden="true">
            <use href={`/icons/sprite.svg#${icon}`} />
          </svg>
          {rebate.name}
        </h2>
        <div className="panel-toolbar">
          <Badge bg="secondary" className="text-uppercase">
            {CATEGORY_LABELS[rebate.category] || rebate.category}
          </Badge>
        </div>
      </div>
      <div className="panel-container">
        <div className="panel-content">
          <p className="fw-semibold text-success mb-1">{rebate.amountFormula}</p>
          <p className="text-muted small mb-3">{rebate.description}</p>
          {rebate.validUntil && (
            <p className="text-muted small mb-3">
              Valid until {new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(rebate.validUntil + 'T12:00:00'))}
            </p>
          )}
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-primary"
          >
            Apply now
            <svg className="sa-icon ms-1" aria-hidden="true" style={{ width: 14, height: 14 }}>
              <use href="/icons/sprite.svg#external-link" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function RebatesPage() {
  const { location } = usePlantContext()
  const [rebates, setRebates] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    rebatesApi.categories().then((r) => setCategories(r.categories)).catch(() => {})
  }, [])

  const fetchRebates = useCallback(async (lat, lng) => {
    setLoading(true)
    setError(null)
    try {
      const r = await rebatesApi.matches(lat, lng)
      setRebates(r.rebates)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (location?.lat && location?.lng) {
      setCoords({ lat: location.lat, lng: location.lng })
      fetchRebates(location.lat, location.lng)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords: c }) => {
          setCoords({ lat: c.latitude, lng: c.longitude })
          fetchRebates(c.latitude, c.longitude)
        },
        () => setError('location_unavailable'),
      )
    } else {
      setError('location_unavailable')
    }
  }, [location, fetchRebates])

  const visible = activeCategory === 'all'
    ? rebates
    : rebates.filter((r) => r.category === activeCategory)

  return (
    <div className="content-wrapper">
      <div className="subheader">
        <h1 className="subheader-title">
          <svg className="sa-icon sa-icon-2x me-2" aria-hidden="true">
            <use href="/icons/sprite.svg#dollar-sign" />
          </svg>
          Rebates &amp; Grants
        </h1>
        <div className="subheader-block d-lg-flex align-items-center">
          <p className="text-muted small mb-0">
            Local water, composting, native-plant and energy rebates available in your area.
          </p>
        </div>
      </div>

      {error === 'location_unavailable' ? (
        <EmptyState
          icon="map-pin"
          title="Location unavailable"
          description="Enable location access or set your location in Settings to see rebates for your area."
        />
      ) : loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          {categories.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                variant={activeCategory === 'all' ? 'primary' : 'outline-secondary'}
                onClick={() => setActiveCategory('all')}
              >
                All ({rebates.length})
              </Button>
              {categories.map((cat) => {
                const count = rebates.filter((r) => r.category === cat.id).length
                if (count === 0) return null
                return (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={activeCategory === cat.id ? 'primary' : 'outline-secondary'}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label} ({count})
                  </Button>
                )
              })}
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState
              icon="dollar-sign"
              title="No rebates available in your area yet"
              description="Let us know if there's one we're missing."
              action={
                <a
                  href="mailto:hello@planttracker.app?subject=Rebate suggestion"
                  className="btn btn-outline-primary"
                >
                  Suggest a rebate
                </a>
              }
            />
          ) : (
            <Row className="g-3">
              {visible.map((r) => (
                <Col key={r.id} xs={12} md={6} xl={4}>
                  <RebateCard rebate={r} />
                </Col>
              ))}
            </Row>
          )}
        </>
      )}
    </div>
  )
}
