import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PlantProvider } from '../context/PlantContext.jsx'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'

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
  const { isAuthenticated, isLoading } = useAuth()

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
          <footer className="app-footer">
            <div className="app-footer-content flex-grow-1">
              Plant Tracker &copy; {new Date().getFullYear()}
            </div>
          </footer>
        </main>
      </div>
    </PlantProvider>
  )
}
