import { lazy } from 'react'
import MainLayout from '../layouts/MainLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'

const LoginPage = lazy(() => import('../pages/LoginPage.jsx'))
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'))
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage.jsx'))
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'))
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'))
const ForecastPage = lazy(() => import('../pages/ForecastPage.jsx'))
const InsightsPage = lazy(() => import('../pages/InsightsPage.jsx'))
const BulkUploadPage = lazy(() => import('../pages/BulkUploadPage.jsx'))

const mlInsightsEnabled = import.meta.env.VITE_ML_INSIGHTS_ENABLED === 'true'

export const routes = [
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'forecast', element: <ForecastPage /> },
      ...(mlInsightsEnabled ? [{ path: 'insights', element: <InsightsPage /> }] : []),
      { path: 'bulk-upload', element: <BulkUploadPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]
