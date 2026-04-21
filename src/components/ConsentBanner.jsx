import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Button } from 'react-bootstrap'

const STORAGE_KEY = 'plant_tracker_consent'

export function useConsent() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return stored ? JSON.parse(stored) : null
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, ai: true, decidedAt: new Date().toISOString() }))
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: false, ai: false, decidedAt: new Date().toISOString() }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1060,
        background: 'var(--bs-body-bg)',
        borderTop: '1px solid var(--bs-border-color)',
        padding: '1rem 1.5rem',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
      }}
    >
      <div className="d-flex flex-wrap align-items-center gap-3" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="flex-grow-1">
          <strong>We value your privacy.</strong>{' '}
          <span className="text-muted fs-sm">
            We use essential cookies to keep you signed in. With your consent we also enable optional
            analytics and AI features. See our{' '}
            <Link to="/privacy">Privacy Policy</Link> for details.
          </span>
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          <Button variant="outline-secondary" size="sm" onClick={decline}>
            Essential only
          </Button>
          <Button variant="primary" size="sm" onClick={accept}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  )
}
