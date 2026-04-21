import { useState } from 'react'
import { Button, Row, Col, Badge, Alert, ToggleButton, ToggleButtonGroup } from 'react-bootstrap'
import { Link } from 'react-router'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import { billingApi } from '../api/plants.js'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'

const TIERS = [
  {
    id:       'free',
    name:     'Free',
    monthly:  0,
    annual:   0,
    blurb:    'For hobbyists just getting started.',
    features: [
      'Up to 10 plants',
      '5 AI plant analyses per month',
      '50 MB photo storage',
      'Basic care scores',
      'Weather-aware watering',
    ],
  },
  {
    id:        'home_pro',
    name:      'Home Pro',
    monthly:   5,
    annual:   50, // 2 months free
    highlighted: true,
    blurb:     'For serious home growers with a real collection.',
    features: [
      'Unlimited plants',
      'Unlimited AI analyses',
      '2 GB photo storage',
      'Full ML Insights dashboard',
      'Email + push notifications',
      'CSV data export',
    ],
  },
  {
    id:       'landscaper_pro',
    name:     'Landscaper Pro',
    monthly:  15,
    annual:  150,
    blurb:    'For professionals managing gardens for multiple clients.',
    features: [
      'Everything in Home Pro',
      'Unlimited properties',
      'Up to 10 team members',
      'PDF client care reports',
      'White-label client portal',
      'Priority chat support',
    ],
  },
]

export default function PricingPage() {
  const { tier, billingEnabled } = useSubscription()
  const { isAuthenticated } = useAuth()
  const toast = useToast()
  const [interval, setInterval] = useState('month')
  const [busy, setBusy] = useState(null)

  const start = async (targetTier) => {
    if (!isAuthenticated) {
      toast.info('Sign in to subscribe')
      return
    }
    if (!billingEnabled) {
      toast.info('Subscription billing is not yet activated on this deployment')
      return
    }
    setBusy(targetTier)
    try {
      const { url } = await billingApi.createCheckoutSession(targetTier, interval === 'month' ? 'month' : 'year')
      window.location.assign(url)
    } catch (err) {
      toast.error(err.message || 'Failed to start checkout')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="content-wrapper">
      <div className="text-center mb-4">
        <h1 className="subheader-title">Plans & pricing</h1>
        <p className="text-muted">Pick the plan that fits your collection.</p>
        <ToggleButtonGroup type="radio" name="interval" value={interval} onChange={setInterval} className="mt-2">
          <ToggleButton id="bill-m" value="month" variant="outline-secondary">Monthly</ToggleButton>
          <ToggleButton id="bill-y" value="year"  variant="outline-secondary">Annual · 2 months free</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {!billingEnabled && (
        <Alert variant="info" className="text-center">
          Subscription billing is not yet activated — you can browse plans but checkout is disabled.
        </Alert>
      )}

      <Row className="g-3">
        {TIERS.map((t) => {
          const price = interval === 'year' ? t.annual : t.monthly
          const priceLabel = price === 0 ? 'Free' : `$${price} /${interval}`
          const isCurrent = tier === t.id
          return (
            <Col key={t.id} md={4}>
              <div className={`card h-100 ${t.highlighted ? 'border-primary' : ''}`}>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-between">
                    <h2 className="h4 mb-0">{t.name}</h2>
                    {t.highlighted && <Badge bg="primary">Most popular</Badge>}
                  </div>
                  <div className="fs-2 fw-700 mt-2">{priceLabel}</div>
                  <p className="text-muted">{t.blurb}</p>
                  <ul className="list-unstyled flex-grow-1 fs-sm">
                    {t.features.map((f, i) => (
                      <li key={i} className="mb-1">
                        <svg className="sa-icon me-1 text-success" style={{ width: 14, height: 14 }} aria-hidden="true">
                          <use href="/icons/sprite.svg#check"></use>
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline-secondary" disabled>Current plan</Button>
                  ) : t.id === 'free' ? (
                    <Button as={Link} to="/" variant="outline-secondary">Continue on Free</Button>
                  ) : (
                    <Button
                      variant={t.highlighted ? 'primary' : 'outline-primary'}
                      onClick={() => start(t.id)}
                      disabled={busy === t.id || !billingEnabled}
                    >
                      {busy === t.id ? 'Opening checkout…' : `Choose ${t.name}`}
                    </Button>
                  )}
                </div>
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
