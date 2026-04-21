import { usePlantContext } from '../context/PlantContext.jsx'

/**
 * Full-width connectivity banner pinned above the page content. Complements
 * the topbar `OfflineIndicator` chip by giving a dedicated, screen-reader-
 * announced recovery message when the browser is offline.
 */
export default function OfflineBanner() {
  const { isOnline, pendingSyncCount } = usePlantContext()

  if (isOnline) return null

  return (
    <div
      className="alert alert-warning bg-warning bg-opacity-10 border-warning border-opacity-25 rounded-0 mb-0 py-2 px-3 d-flex align-items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <svg className="sa-icon" style={{ width: 16, height: 16 }} aria-hidden="true">
        <use href="/icons/sprite.svg#wifi-off"></use>
      </svg>
      <span className="fs-sm">
        <strong>You're offline.</strong>{' '}
        Changes you make are saved on this device
        {pendingSyncCount > 0 && ` (${pendingSyncCount} queued)`}{' '}
        and will sync automatically when you reconnect.
      </span>
    </div>
  )
}
