import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PlantProvider } from '../context/PlantContext.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth()
  if (isLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-border" role="status"><span className="visually-hidden">Loading…</span></div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login?returnTo=/app" replace />
  return <Outlet />
}

export default function DesktopConservatoryLayout() {
  return (
    <PlantProvider>
      <ErrorBoundary context="Conservatory desktop">
        <div style={{ height: '100dvh', overflow: 'hidden' }}>
          <Suspense fallback={null}>
            <AuthGate />
          </Suspense>
        </div>
      </ErrorBoundary>
    </PlantProvider>
  )
}
