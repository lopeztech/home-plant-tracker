import { useState } from 'react'
import { Button, ProgressBar, Alert, Row, Col } from 'react-bootstrap'
import { Link } from 'react-router'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import { billingApi } from '../api/plants.js'
import { useToast } from '../components/Toast.jsx'

const TIER_LABEL = {
  free:           'Free',
  home_pro:       'Home Pro',
  landscaper_pro: 'Landscaper Pro',
}

function Quota({ label, used, limit, unit }) {
  const pct = limit === Infinity || limit === null ? 0 : Math.min(100, (used / limit) * 100)
  const limitLabel = limit === Infinity || limit === null ? 'Unlimited' : `${limit}${unit ? ` ${unit}` : ''}`
  const usedLabel = `${Math.round(used)}${unit ? ` ${unit}` : ''}`
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between fs-sm">
        <span>{label}</span>
        <span className="text-muted">{usedLabel} / {limitLabel}</span>
      </div>
      {limit !== Infinity && limit !== null && (
        <ProgressBar now={pct} variant={pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'primary'} className="mt-1" style={{ height: 6 }} />
      )}
    </div>
  )
}

export default function BillingPage() {
  const { billingEnabled, tier, status, currentPeriodEnd, cancelAtPeriodEnd, quotas, usage, refresh } = useSubscription()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const manage = async () => {
    setBusy(true)
    try {
      const { url } = await billingApi.createPortalSession()
      window.location.assign(url)
    } catch (err) {
      toast.error(err.message || 'Failed to open billing portal')
    } finally {
      setBusy(false)
    }
  }

  const upgrade = async (targetTier) => {
    setBusy(true)
    try {
      const { url } = await billingApi.createCheckoutSession(targetTier, 'month')
      window.location.assign(url)
    } catch (err) {
      toast.error(err.message || 'Failed to start checkout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-4">Billing & plan</h1>

      {!billingEnabled && (
        <Alert variant="info">
          Subscription billing is not yet activated on this deployment. Your plan shows <strong>Free</strong>
          {' '}and limits are not enforced. See <Link to="/pricing">the pricing page</Link> for what's coming.
        </Alert>
      )}

      <Row>
        <Col md={6} className="mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Current plan</h2>
              <div className="fs-3 fw-600">{TIER_LABEL[tier] || tier}</div>
              <div className="text-muted fs-sm mb-3">Status: {status}</div>
              {currentPeriodEnd && (
                <div className="fs-sm">
                  {cancelAtPeriodEnd ? 'Ends' : 'Renews'} {new Date(currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
              <div className="d-flex gap-2 mt-3">
                {tier === 'free' && billingEnabled && (
                  <>
                    <Button variant="primary" onClick={() => upgrade('home_pro')} disabled={busy}>Upgrade to Home Pro</Button>
                    <Button variant="outline-primary" onClick={() => upgrade('landscaper_pro')} disabled={busy}>Landscaper Pro</Button>
                  </>
                )}
                {tier !== 'free' && billingEnabled && (
                  <Button variant="outline-primary" onClick={manage} disabled={busy}>Manage subscription</Button>
                )}
                <Button as={Link} to="/pricing" variant="outline-secondary">See all plans</Button>
              </div>
            </div>
          </div>
        </Col>
        <Col md={6} className="mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">Usage</h2>
              <Quota label="Plants" used={usage.plants} limit={quotas.plants} />
              <Quota label="AI analyses this month" used={usage.ai_analyses} limit={quotas.ai_analyses} />
              <Quota label="Photo storage" used={usage.photo_storage_mb} limit={quotas.photo_storage_mb} unit="MB" />
              <Button variant="link" size="sm" onClick={refresh} className="p-0">Refresh</Button>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}
