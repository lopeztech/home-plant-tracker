import { Suspense, useEffect } from 'react'
import { useRtl } from '../hooks/useRtl.js'
import { Outlet, Navigate, useLocation } from 'react-router'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PlantProvider } from '../context/PlantContext.jsx'
import { HelpProvider } from '../context/HelpContext.jsx'
import { CommandPaletteProvider, useCommandPalette } from '../context/CommandPaletteContext.jsx'
import { TourProvider } from '../context/TourContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Onboarding from '../components/Onboarding.jsx'
import FeatureTour from '../components/FeatureTour.jsx'
import WhatsNewModal from '../components/WhatsNewModal.jsx'
import WeatherAlertBanner from '../components/WeatherAlertBanner.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import OfflineBanner from '../components/OfflineBanner.jsx'
import HelpDrawer from '../components/HelpDrawer.jsx'
import CommandPalette from '../components/CommandPalette.jsx'
import { SkeletonRect, SkeletonText } from '../components/Skeleton.jsx'

function GlobalKeyboardShortcuts() {
  const { open } = useCommandPalette()
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])
  return null
}

function PageSkeleton() {
  return (
    <div className="p-4" aria-label="Loading page" aria-busy="true">
      <SkeletonRect height={28} width="40%" style={{ marginBottom: 24, borderRadius: 6 }} />
      <SkeletonRect height={160} style={{ marginBottom: 16, borderRadius: 8 }} />
      <SkeletonText lines={3} style={{ marginBottom: 16 }} />
      <SkeletonRect height={120} style={{ borderRadius: 8 }} />
    </div>
  )
}

function AuthLoader() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ height: '100%' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const { isAuthenticated, isLoading, isGuest, logout } = useAuth()
  const location = useLocation()
  useRtl()

  if (isLoading) return <AuthLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <MotionConfig reducedMotion="user">
    <PlantProvider>
      <TourProvider>
      <HelpProvider>
        <CommandPaletteProvider>
          <GlobalKeyboardShortcuts />
          <CommandPalette />
          <div className="app-wrap set-header-fixed">
            <Topbar />
            <Sidebar />
            <main className="app-body">
              <div className="app-content">
                <OfflineBanner />
              <div className="px-3 pt-3">
                <WeatherAlertBanner />
              </div>
              <ErrorBoundary context="this page">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Suspense fallback={<PageSkeleton />}>
                      <Outlet />
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </ErrorBoundary>
            </div>
            {isGuest && (
              <div className="alert alert-success bg-success bg-opacity-10 border-success border-opacity-25 text-center py-2 mb-0 rounded-0 fs-sm">
                You are browsing in guest mode with sample data. Changes are not saved.{' '}
                <button className="btn btn-link btn-sm p-0 text-success" onClick={logout}>Sign in</button>
              </div>
            )}
            <footer className="app-footer">
              <div className="app-footer-content flex-grow-1">
                Plant Tracker &copy; {new Date().getFullYear()}
              </div>
              <div className="app-footer-content">
                <a href="/privacy" className="text-muted fs-xs me-3">Privacy</a>
                <a href="/terms" className="text-muted fs-xs">Terms</a>
              </div>
            </footer>
          </main>
          <Onboarding />
          <FeatureTour />
          <WhatsNewModal />
          <HelpDrawer />
        </div>
        </CommandPaletteProvider>
      </HelpProvider>
      </TourProvider>
    </PlantProvider>
    </MotionConfig>
  )
}
