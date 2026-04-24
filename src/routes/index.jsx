import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router'
import MainLayout from '../layouts/MainLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'

const LoginPage = lazy(() => import('../pages/LoginPage.jsx'))
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'))
const TodayPage = lazy(() => import('../pages/TodayPage.jsx'))
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage.jsx'))
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'))
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'))
const ForecastPage = lazy(() => import('../pages/ForecastPage.jsx'))
const InsightsPage = lazy(() => import('../pages/InsightsPage.jsx'))
const BulkUploadPage = lazy(() => import('../pages/BulkUploadPage.jsx'))
const BillingPage = lazy(() => import('../pages/BillingPage.jsx'))
const PricingPage = lazy(() => import('../pages/PricingPage.jsx'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage.jsx'))
const TermsPage = lazy(() => import('../pages/TermsPage.jsx'))
const ScanPage = lazy(() => import('../pages/ScanPage.jsx'))
const PropagationPage = lazy(() => import('../pages/PropagationPage.jsx'))
const PortalPage = lazy(() => import('../pages/PortalPage.jsx'))
const SitPage = lazy(() => import('../pages/SitPage.jsx'))

export const routes = [
  { path: '/privacy', element: <Suspense fallback={null}><PrivacyPage /></Suspense> },
  { path: '/terms', element: <Suspense fallback={null}><TermsPage /></Suspense> },
  { path: '/scan/:shortCode', element: <Suspense fallback={null}><ScanPage /></Suspense> },
  { path: '/portal/:token', element: <Suspense fallback={null}><PortalPage /></Suspense> },
  { path: '/sit/:token', element: <Suspense fallback={null}><SitPage /></Suspense> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    element: <MainLayout />,
    children: [
      { index: true, element: <DashboardPage />, handle: { breadcrumb: 'Garden' } },
      { path: 'today', element: <TodayPage />, handle: { breadcrumb: 'Today' } },
      { path: 'propagation', element: <PropagationPage />, handle: { breadcrumb: 'Propagation' } },
      { path: 'plants', element: <Navigate to="/?view=list" replace /> },
      { path: 'analytics', element: <AnalyticsPage />, handle: { breadcrumb: 'Analytics' } },
      { path: 'calendar', element: <CalendarPage />, handle: { breadcrumb: 'Care Calendar' } },
      { path: 'forecast', element: <ForecastPage />, handle: { breadcrumb: 'Forecast' } },
      { path: 'insights', element: <InsightsPage />, handle: { breadcrumb: 'ML Insights' } },
      { path: 'bulk-upload', element: <BulkUploadPage />, handle: { breadcrumb: 'Bulk Upload' } },
      { path: 'settings', element: <Navigate to="/settings/property" replace /> },
      { path: 'settings/billing', element: <BillingPage /> },
      { path: 'settings/:tab', element: <SettingsPage />, handle: { breadcrumb: 'Settings' } },
      { path: 'pricing', element: <PricingPage />, handle: { breadcrumb: 'Pricing' } },
    ],
  },
]
