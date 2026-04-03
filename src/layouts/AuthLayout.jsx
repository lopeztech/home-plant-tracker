import { Outlet, Navigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}
