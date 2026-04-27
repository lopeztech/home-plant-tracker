import { useState, useEffect } from 'react'
import { Button } from 'react-bootstrap'
import { notificationsApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const DISMISSED_KEY = 'plantTracker_notifBannerDismissed'
const SHOWN_KEY = 'plantTracker_notifBannerFirstShown'
const SOFT_DELAY_DAYS = 7

export default function NotificationBanner() {
  const { isGuest } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isGuest) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const first = localStorage.getItem(SHOWN_KEY)
    if (!first) {
      localStorage.setItem(SHOWN_KEY, Date.now().toString())
      return
    }
    const daysSince = (Date.now() - Number(first)) / 86400000
    if (daysSince >= SOFT_DELAY_DAYS) setVisible(true)
  }, [isGuest])

  const handleEnable = async () => {
    setVisible(false)
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        if (!vapidKey) return
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        await notificationsApi.registerToken({ subscription: JSON.parse(JSON.stringify(sub)), deviceLabel: navigator.userAgent.slice(0, 60) })
        await notificationsApi.updatePreferences({ pushEnabled: true })
      } catch {}
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="alert alert-info d-flex align-items-center justify-content-between py-2 mb-3" role="status">
      <div className="fs-sm">
        <svg className="sa-icon me-2" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#bell"></use></svg>
        Get reminders when your plants need watering.
      </div>
      <div className="d-flex gap-2">
        <Button size="sm" variant="primary" onClick={handleEnable}>Enable</Button>
        <Button size="sm" variant="link" className="text-muted p-0 fs-xs" onClick={handleDismiss}>Not now</Button>
      </div>
    </div>
  )
}
