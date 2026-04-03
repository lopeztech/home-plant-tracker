import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PlantProvider } from '../context/PlantContext.jsx'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Onboarding from '../components/Onboarding.jsx'

function Loader() {
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

  if (isLoading) return <Loader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <PlantProvider>
      <div className="app-wrap">
        <Topbar />
        <Sidebar />
        <main className="app-body">
          <div className="app-content">
            <Suspense fallback={<Loader />}>
              <Outlet />
            </Suspense>
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
          </footer>
        </main>
        <Onboarding />
      </div>
    </PlantProvider>
  )
}
