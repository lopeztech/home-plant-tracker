import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PlantProvider } from '../context/PlantContext.jsx'
import { HelpProvider } from '../context/HelpContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Onboarding from '../components/Onboarding.jsx'
import WeatherAlertBanner from '../components/WeatherAlertBanner.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import OfflineBanner from '../components/OfflineBanner.jsx'
import HelpDrawer from '../components/HelpDrawer.jsx'
import { SkeletonRect, SkeletonText } from '../components/Skeleton.jsx'

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

  if (isLoading) return <AuthLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <PlantProvider>
      <HelpProvider>
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
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
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
          <HelpDrawer />
        </div>
      </HelpProvider>
    </PlantProvider>
  )
}
