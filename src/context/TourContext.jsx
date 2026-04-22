import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import changelog from '../data/changelog.json'

const LATEST_VERSION = changelog[0]?.version || '0.0.0'
const LS_TOUR_PREFIX = 'plant-tracker-tour-done-'
const LS_WHATS_NEW = 'plant-tracker-whats-new-seen'
const LS_ONBOARDED = 'plant-tracker-onboarded'

export const TOURS = [
  { id: 'setup',       label: 'First-time setup' },
  { id: 'floorplan',   label: 'Using the floorplan' },
  { id: 'analytics',   label: 'Understanding Analytics' },
  { id: 'bulk-upload', label: 'Bulk import from photos' },
]

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [activeTour, setActiveTour] = useState(null)
  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    // Only auto-show for returning users who haven't seen the latest version
    const onboarded = localStorage.getItem(LS_ONBOARDED)
    if (!onboarded) return false
    const seen = localStorage.getItem(LS_WHATS_NEW)
    return !seen || seen < LATEST_VERSION
  })

  const isTourCompleted = useCallback((id) => {
    return !!localStorage.getItem(LS_TOUR_PREFIX + id)
  }, [])

  const startTour = useCallback((id) => {
    setActiveTour(id)
  }, [])

  const completeTour = useCallback((id) => {
    localStorage.setItem(LS_TOUR_PREFIX + id, '1')
    setActiveTour(null)
  }, [])

  const openWhatsNew = useCallback(() => {
    setShowWhatsNew(true)
  }, [])

  const closeWhatsNew = useCallback(() => {
    localStorage.setItem(LS_WHATS_NEW, LATEST_VERSION)
    setShowWhatsNew(false)
  }, [])

  const value = useMemo(() => ({
    activeTour,
    showWhatsNew,
    startTour,
    completeTour,
    isTourCompleted,
    openWhatsNew,
    closeWhatsNew,
    TOURS,
    LATEST_VERSION,
  }), [activeTour, showWhatsNew, startTour, completeTour, isTourCompleted, openWhatsNew, closeWhatsNew])

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside TourProvider')
  return ctx
}
