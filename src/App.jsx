import { useRoutes } from 'react-router'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { LayoutProvider } from './context/LayoutContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { routes } from './routes/index.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'

function AppRoutes() {
  return useRoutes(routes)
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <LayoutProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </LayoutProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
