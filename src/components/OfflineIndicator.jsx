import { useEffect, useState } from 'react'
import { usePlantContext } from '../context/PlantContext.jsx'

/**
 * Shows three things when relevant, and nothing otherwise:
 * - "Offline" chip when navigator.onLine is false
 * - "N pending" chip when the offline queue has unsynced mutations
 * - "Install app" button when the browser fires beforeinstallprompt
 */
export default function OfflineIndicator() {
  const { isOnline, pendingSyncCount } = usePlantContext()
  const [installEvent, setInstallEvent] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    const installed = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const promptInstall = async () => {
    if (!installEvent) return
    installEvent.prompt()
    try { await installEvent.userChoice } catch { /* ignore */ }
    setInstallEvent(null)
  }

  if (isOnline && pendingSyncCount === 0 && !installEvent) return null

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 px-3 pb-2">
      {!isOnline && (
        <span className="badge bg-warning text-dark" title="You are offline. Changes will sync when you reconnect.">
          <svg className="sa-icon me-1" style={{ width: 12, height: 12 }} aria-hidden="true">
            <use href="/icons/sprite.svg#wifi-off"></use>
          </svg>
          Offline
        </span>
      )}
      {pendingSyncCount > 0 && (
        <span className="badge bg-info text-dark" title="Queued changes waiting to sync">
          {pendingSyncCount} pending sync
        </span>
      )}
      {installEvent && (
        <button type="button" className="btn btn-sm btn-outline-light py-0 px-2" onClick={promptInstall}>
          Install app
        </button>
      )}
    </div>
  )
}
