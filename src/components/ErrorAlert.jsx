import { Alert, Button } from 'react-bootstrap'
import { toFriendlyError } from '../utils/errorMessages.js'

const ICON_BY_KIND = {
  offline: 'wifi-off',
  auth: 'lock',
  permission: 'lock',
  quota: 'clock',
  transient: 'alert-triangle',
  input: 'alert-circle',
  unknown: 'alert-triangle',
}

const VARIANT_BY_KIND = {
  offline: 'warning',
  auth: 'warning',
  permission: 'warning',
  quota: 'info',
  transient: 'danger',
  input: 'danger',
  unknown: 'danger',
}

/**
 * Displays a `FriendlyError` (or raw error converted on the fly) with an
 * icon, recovery copy, and optional retry / secondary actions.
 *
 * Props:
 *   - error        required. Either a FriendlyError from `toFriendlyError()`
 *                  or any raw error-like value (string / Error).
 *   - context      string passed through to `toFriendlyError` when `error` is raw.
 *   - onRetry      if provided, renders a retry button labelled from the
 *                  friendly action.
 *   - onDismiss    if provided, renders the dismiss "×" control.
 *   - onReport     optional "Report this" CTA; receives the rawCode string.
 *   - className    bootstrap alert className override.
 *   - size         'sm' gives denser padding for inline slots.
 */
export default function ErrorAlert({ error, context, onRetry, onDismiss, onReport, className = '', size }) {
  if (!error) return null

  const friendly = error.kind && error.title ? error : toFriendlyError(error, { context })
  const icon = ICON_BY_KIND[friendly.kind] || ICON_BY_KIND.unknown
  const variant = VARIANT_BY_KIND[friendly.kind] || VARIANT_BY_KIND.unknown
  const denseClass = size === 'sm' ? 'py-2 fs-sm mb-2' : 'mb-3'

  return (
    <Alert
      variant={variant}
      className={`${denseClass} ${className}`}
      dismissible={Boolean(onDismiss)}
      onClose={onDismiss}
      role="alert"
    >
      <div className="d-flex gap-2 align-items-start">
        <svg
          className="sa-icon flex-shrink-0 mt-1"
          style={{ width: 18, height: 18 }}
          aria-hidden="true"
        >
          <use href={`/icons/sprite.svg#${icon}`}></use>
        </svg>
        <div className="flex-grow-1">
          <strong className="d-block">{friendly.title}</strong>
          <div className="fs-sm">{friendly.message}</div>
          {(onRetry || onReport) && (
            <div className="d-flex gap-2 mt-2 flex-wrap">
              {onRetry && friendly.isRetryable && (
                <Button
                  size="sm"
                  variant={variant === 'danger' ? 'outline-danger' : `outline-${variant}`}
                  onClick={onRetry}
                >
                  {friendly.action}
                </Button>
              )}
              {onReport && friendly.rawCode && (
                <Button
                  size="sm"
                  variant="link"
                  className="text-muted p-0"
                  onClick={() => onReport(friendly.rawCode)}
                >
                  Report this
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  )
}
