import { Button } from 'react-bootstrap'
import { Link } from 'react-router'

/**
 * Reusable empty-state surface used anywhere we show "nothing to see yet".
 * Gives screen-reader / keyboard users a clear call-to-action instead of a
 * dead-end, and carries consistent Smart Admin styling.
 *
 * Actions: `{ label, to?, href?, onClick?, variant?, icon? }`
 * - `to`      — internal react-router link
 * - `href`    — external / anchor link
 * - `onClick` — imperative handler (button)
 * - `icon`    — sprite id rendered before the label
 */
export default function EmptyState({
  icon = 'feather',
  title,
  description,
  actions = [],
  children,
  compact = false,
  className = '',
}) {
  const padding = compact ? 'py-4' : 'py-5'

  return (
    <div
      className={`empty-state text-center ${padding} px-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className={`sa-icon ${compact ? 'sa-icon-2x' : 'sa-icon-5x'} text-muted mb-3`}
        aria-hidden="true"
      >
        <use href={`/icons/sprite.svg#${icon}`}></use>
      </svg>
      {title && <h5 className="fw-500 mb-2">{title}</h5>}
      {description && <p className="text-muted mb-3">{description}</p>}
      {actions.length > 0 && (
        <div className="d-flex flex-wrap gap-2 justify-content-center">
          {actions.map((action) => (
            <EmptyStateAction key={action.label} {...action} />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

function EmptyStateAction({ label, to, href, onClick, variant = 'primary', size = 'sm', icon, ariaLabel }) {
  const inner = (
    <>
      {icon && (
        <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true">
          <use href={`/icons/sprite.svg#${icon}`}></use>
        </svg>
      )}
      {label}
    </>
  )
  // Plain anchors keep their implicit role="link" — react-bootstrap's <Button as={Link}>
  // forces role="button" onto the anchor, which breaks screen-reader expectations.
  const linkClass = `btn btn-${variant} btn-${size}`

  if (to) {
    return (
      <Link to={to} className={linkClass} aria-label={ariaLabel}>
        {inner}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={linkClass} aria-label={ariaLabel}>
        {inner}
      </a>
    )
  }
  return (
    <Button variant={variant} size={size} onClick={onClick} aria-label={ariaLabel}>
      {inner}
    </Button>
  )
}
