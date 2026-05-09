import { useState, useEffect } from 'react'
import { Button, ProgressBar, Alert, Row, Col, Form, Badge } from 'react-bootstrap'
import { Link } from 'react-router'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { billingApi, giftsApi } from '../api/plants.js'
import { useToast } from '../components/Toast.jsx'
import { friendlyErrorMessage } from '../utils/errorMessages.js'

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

function GiftStatusBadge({ status }) {
  const map = { active: 'success', redeemed: 'secondary', expired: 'warning', refunded: 'danger' }
  return <Badge bg={map[status] || 'secondary'}>{status}</Badge>
}

export default function BillingPage() {
  const { billingEnabled, tier, status, currentPeriodEnd, cancelAtPeriodEnd, hasStripeCustomer, isTrial, quotas, usage, refresh } = useSubscription()
  const { isGuest } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemError, setRedeemError] = useState(null)
  const [sentGifts, setSentGifts] = useState(null)
  const [giftsLoading, setGiftsLoading] = useState(false)

  useEffect(() => {
    if (isGuest) { setSentGifts([]); return }
    setGiftsLoading(true)
    giftsApi.mine()
      .then((r) => setSentGifts(r.sent || []))
      .catch(() => setSentGifts([]))
      .finally(() => setGiftsLoading(false))
  }, [isGuest])

  const redeem = async (e) => {
    e.preventDefault()
    if (!redeemCode.trim()) return
    setRedeemBusy(true)
    setRedeemError(null)
    try {
      await giftsApi.redeem(redeemCode.trim())
      toast.success('Gift redeemed! Your plan has been upgraded.')
      setRedeemCode('')
      refresh()
    } catch (err) {
      const messages = {
        invalid_code: 'That code doesn\'t match any gift. Check for typos.',
        gift_already_redeemed: 'This gift has already been redeemed.',
        gift_expired: 'This gift code has expired.',
        gift_not_for_this_account: 'This gift was sent to a different email address.',
      }
      setRedeemError(messages[err.message] || friendlyErrorMessage(err, { context: 'redeeming gift' }))
    } finally {
      setRedeemBusy(false)
    }
  }

  const manage = async () => {
    setBusy(true)
    try {
      const { url } = await billingApi.createPortalSession()
      window.location.assign(url)
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { context: 'opening the billing portal' }))
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
      toast.error(friendlyErrorMessage(err, { context: 'starting checkout' }))
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
              <div className="d-flex gap-2 mt-3 flex-wrap">
                {tier === 'free' && billingEnabled && (
                  <>
                    <Button variant="primary" onClick={() => upgrade('home_pro')} disabled={busy}>Upgrade to Home Pro</Button>
                    <Button variant="outline-primary" onClick={() => upgrade('landscaper_pro')} disabled={busy}>Landscaper Pro</Button>
                  </>
                )}
                {tier !== 'free' && billingEnabled && hasStripeCustomer && (
                  <Button variant="outline-primary" onClick={manage} disabled={busy}>Manage subscription</Button>
                )}
                {tier !== 'free' && billingEnabled && !hasStripeCustomer && (
                  <Button variant="primary" onClick={() => upgrade(tier)} disabled={busy}>Add payment method</Button>
                )}
                <Button as={Link} to="/pricing" variant="outline-secondary">See all plans</Button>
              </div>
              {tier !== 'free' && billingEnabled && !hasStripeCustomer && (
                <div className="text-muted fs-sm mt-2">
                  {isTrial
                    ? 'You\'re on a free trial. Add a payment method to keep your plan active when the trial ends.'
                    : 'No payment method on file yet. Add one to manage billing through the Stripe portal.'}
                </div>
              )}
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

      <Row className="mt-2">
        <Col md={6} className="mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="h5 mb-1">Redeem a gift</h2>
              <p className="text-muted small mb-3">Enter the XXXX-XXXX-XXXX code from a gift.</p>
              {redeemError && <Alert variant="danger" className="py-2">{redeemError}</Alert>}
              <Form onSubmit={redeem} className="d-flex gap-2">
                <Form.Control
                  type="text"
                  placeholder="XXXX-XXXX-XXXX"
                  aria-label="Gift code"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  maxLength={14}
                />
                <Button type="submit" variant="primary" disabled={redeemBusy || !redeemCode.trim()}>
                  {redeemBusy ? '…' : 'Redeem'}
                </Button>
              </Form>
            </div>
          </div>
        </Col>
        <Col md={6} className="mb-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">Gifts sent</h2>
                <Button as={Link} to="/gift" size="sm" variant="outline-primary">Buy a gift</Button>
              </div>
              {giftsLoading ? (
                <div className="text-muted small">Loading…</div>
              ) : !sentGifts || sentGifts.length === 0 ? (
                <p className="text-muted small mb-0">No gifts sent yet.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {sentGifts.map((g) => (
                    <li key={g.id || g.giftId} className="d-flex justify-content-between align-items-center mb-2 fs-sm">
                      <span>
                        {g.recipientName || g.recipientEmail || 'Open gift'}{' '}
                        <span className="text-muted">({g.durationMonths}mo)</span>
                      </span>
                      <GiftStatusBadge status={g.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}
