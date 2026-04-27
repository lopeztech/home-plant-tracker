import { Outlet } from 'react-router'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { LayoutProvider } from './context/LayoutContext.jsx'
import { SubscriptionProvider } from './context/SubscriptionContext.jsx'
import { HouseholdProvider } from './context/HouseholdContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'

// Root layout for the data router. Hosts every cross-route provider so we can
// use React Router data-router features (useBlocker, loaders, actions, etc.)
// while keeping a single source of truth for app-wide context.
export default function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <LayoutProvider>
          <SubscriptionProvider>
            <HouseholdProvider>
              <ToastProvider>
                <Outlet />
                <ConsentBanner />
              </ToastProvider>
            </HouseholdProvider>
          </SubscriptionProvider>
        </LayoutProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
