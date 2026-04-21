import { useState, useEffect } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { useSubscription } from '../context/SubscriptionContext.jsx'

/**
 * Inline upgrade prompt that surfaces at natural gate boundaries.
 *
 * - `quota`: key from /billing/subscription usage block ("plants", "ai_analyses", "photo_storage_mb")
 *     — renders when usage is at or above the limit.
 * - `feature`: tier threshold ("home_pro" | "landscaper_pro") — renders when the user's
 *     current tier is below the threshold.
 *
 * Dismissed prompts stay hidden for 24 hours (localStorage).
 */
const DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000

function dismissKey(id) { return `plant-tracker-dismiss-${id}` }

function isDismissed(id) {
  try {
    const at = Number(globalThis.localStorage?.getItem(dismissKey(id)))
    if (!at) return false
    return Date.now() - at < DISMISS_WINDOW_MS
  } catch { return false }
}

export default function UpgradePrompt({ id, quota, feature, children, variant = 'info' }) {
  const sub = useSubscription()
  const [hidden, setHidden] = useState(() => isDismissed(id))
  useEffect(() => { setHidden(isDismissed(id)) }, [id])

  if (hidden) return null
  if (!sub.billingEnabled) return null

  let trigger = false
  if (quota && sub.isAtQuotaLimit(quota)) trigger = true
  if (feature && !sub.canAccess(feature)) trigger = true
  if (!trigger) return null

  const dismiss = () => {
    try { globalThis.localStorage?.setItem(dismissKey(id), String(Date.now())) } catch { /* ignore */ }
    setHidden(true)
  }

  return (
    <Alert variant={variant} dismissible onClose={dismiss} className="d-flex align-items-start gap-2">
      <svg className="sa-icon mt-1" style={{ width: 18, height: 18 }} aria-hidden="true">
        <use href="/icons/sprite.svg#zap"></use>
      </svg>
      <div className="flex-grow-1">
        <div className="fw-500">{children}</div>
        <div className="mt-2">
          <Button as={Link} to="/pricing" variant="primary" size="sm">See plans</Button>
        </div>
      </div>
    </Alert>
  )
}
