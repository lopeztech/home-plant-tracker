import { useState } from 'react'
import { Row, Col, Button, Form, Alert } from 'react-bootstrap'
import { giftsApi } from '../api/plants.js'

const SKUS = [
  {
    months: 3,
    label: '3 Months',
    price: { usd: '$12', gbp: '£10', eur: '€12' },
    description: 'Give them a season of healthy plants.',
    highlight: false,
  },
  {
    months: 12,
    label: '1 Year',
    price: { usd: '$40', gbp: '£36', eur: '€40' },
    description: 'A full year of unlimited plants, AI care, and more.',
    highlight: true,
  },
]

const CURRENCY_OPTIONS = [
  { value: 'usd', label: 'USD ($)' },
  { value: 'gbp', label: 'GBP (£)' },
  { value: 'eur', label: 'EUR (€)' },
]

export default function GiftPage() {
  const [selected, setSelected] = useState(12)
  const [currency, setCurrency] = useState('usd')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleBuy = async () => {
    setBusy(true)
    setError(null)
    try {
      const { url } = await giftsApi.purchase(selected, {
        recipientEmail: recipientEmail.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        currency,
      })
      window.location.assign(url)
    } catch (err) {
      if (err.message === 'billing_disabled' || err.message?.includes('not configured')) {
        setError('Gift subscriptions are coming soon. Check back shortly!')
      } else {
        setError(err.message)
      }
      setBusy(false)
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 680 }}>
      <div className="text-center mb-5">
        <svg style={{ width: 56, height: 56, color: 'var(--bs-success)' }} aria-hidden="true">
          <use href="/icons/sprite.svg#gift" />
        </svg>
        <h1 className="display-6 fw-bold mt-3">Give the Gift of Greener Plants</h1>
        <p className="text-muted">
          Send a Home Pro gift subscription — they get unlimited plants, AI-powered care, and full
          ML insights.
        </p>
      </div>

      {error && <Alert variant="warning" onClose={() => setError(null)} dismissible>{error}</Alert>}

      <Row className="g-3 mb-4">
        {SKUS.map((sku) => (
          <Col key={sku.months} xs={12} sm={6}>
            <button
              type="button"
              onClick={() => setSelected(sku.months)}
              className={`card w-100 text-start border-2 p-0 ${
                selected === sku.months ? 'border-primary' : 'border-secondary'
              }`}
              style={{ background: 'none', cursor: 'pointer' }}
            >
              <div className="card-body">
                {sku.highlight && (
                  <span className="badge bg-primary mb-2">Best value</span>
                )}
                <h2 className="h5 mb-1">{sku.label}</h2>
                <div className="display-6 fw-bold text-primary mb-1">{sku.price[currency]}</div>
                <p className="text-muted small mb-0">{sku.description}</p>
              </div>
            </button>
          </Col>
        ))}
      </Row>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h6 mb-3">Recipient details (optional)</h2>
          <Form.Group className="mb-3">
            <Form.Label>Recipient name</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. Alex"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Recipient email</Form.Label>
            <Form.Control
              type="email"
              placeholder="their@email.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <Form.Text className="text-muted">
              If provided, only this email address can redeem the gift.
            </Form.Text>
          </Form.Group>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 mb-4">
        <Form.Select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ width: 130 }}
          aria-label="Currency"
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Form.Select>
        <Button variant="primary" size="lg" className="flex-grow-1" onClick={handleBuy} disabled={busy}>
          {busy ? 'Redirecting…' : `Buy gift — ${SKUS.find((s) => s.months === selected)?.price[currency]}`}
        </Button>
      </div>

      <p className="text-muted small text-center">
        After checkout you'll receive a gift code to share. The recipient redeems it at{' '}
        <strong>Settings → Billing → Redeem a gift</strong>.
      </p>
    </div>
  )
}
