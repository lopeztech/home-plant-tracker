import { Outlet, Navigate, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search)
    const returnTo = params.get('returnTo')
    return <Navigate to={returnTo || '/today'} replace />
  }

  return <Outlet />
}
