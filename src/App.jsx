import { useRoutes } from 'react-router'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { LayoutProvider } from './context/LayoutContext.jsx'
import { SubscriptionProvider } from './context/SubscriptionContext.jsx'
import { HouseholdProvider } from './context/HouseholdContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
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
          <SubscriptionProvider>
            <HouseholdProvider>
              <ToastProvider>
                <AppRoutes />
                <ConsentBanner />
              </ToastProvider>
            </HouseholdProvider>
          </SubscriptionProvider>
        </LayoutProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
