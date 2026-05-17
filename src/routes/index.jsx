import { Suspense } from 'react'
import { Navigate } from 'react-router'
import App from '../App.jsx'
import MainLayout from '../layouts/MainLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'
import { lazyWithRetry } from '../utils/lazyWithRetry.js'

const LoginPage = lazyWithRetry(() => import('../pages/LoginPage.jsx'))
const DashboardPage = lazyWithRetry(() => import('../pages/DashboardPage.jsx'))
const PlantDetailPage = lazyWithRetry(() => import('../pages/PlantDetailPage.jsx'))
const TodayPage = lazyWithRetry(() => import('../pages/TodayPage.jsx'))
const AnalyticsPage = lazyWithRetry(() => import('../pages/AnalyticsPage.jsx'))
const CalendarPage = lazyWithRetry(() => import('../pages/CalendarPage.jsx'))
const SettingsPage = lazyWithRetry(() => import('../pages/SettingsPage.jsx'))
const AdminPage = lazyWithRetry(() => import('../pages/AdminPage.jsx'))
const ForecastPage = lazyWithRetry(() => import('../pages/ForecastPage.jsx'))
const InsightsPage = lazyWithRetry(() => import('../pages/InsightsPage.jsx'))
const BulkUploadPage = lazyWithRetry(() => import('../pages/BulkUploadPage.jsx'))
const BillingPage = lazyWithRetry(() => import('../pages/BillingPage.jsx'))
const PricingPage = lazyWithRetry(() => import('../pages/PricingPage.jsx'))
const PrivacyPage = lazyWithRetry(() => import('../pages/PrivacyPage.jsx'))
const TermsPage = lazyWithRetry(() => import('../pages/TermsPage.jsx'))
const ScanPage = lazyWithRetry(() => import('../pages/ScanPage.jsx'))
const PropagationPage = lazyWithRetry(() => import('../pages/PropagationPage.jsx'))
const VisitsPage = lazyWithRetry(() => import('../pages/VisitsPage.jsx'))
const TemplatesPage = lazyWithRetry(() => import('../pages/TemplatesPage.jsx'))
const MaterialsPage = lazyWithRetry(() => import('../pages/MaterialsPage.jsx'))
const PortalPage = lazyWithRetry(() => import('../pages/PortalPage.jsx'))
const SitPage = lazyWithRetry(() => import('../pages/SitPage.jsx'))
const RebatesPage = lazyWithRetry(() => import('../pages/RebatesPage.jsx'))
const GiftPage = lazyWithRetry(() => import('../pages/GiftPage.jsx'))
const CommunityPage = lazyWithRetry(() => import('../pages/CommunityPage.jsx'))
const CommunityGuidelinesPage = lazyWithRetry(() => import('../pages/CommunityGuidelinesPage.jsx'))

export const routes = [
  {
    element: <App />,
    children: [
      { path: '/privacy', element: <Suspense fallback={null}><PrivacyPage /></Suspense> },
      { path: '/gift', element: <Suspense fallback={null}><GiftPage /></Suspense> },
      { path: '/terms', element: <Suspense fallback={null}><TermsPage /></Suspense> },
      { path: '/scan/:shortCode', element: <Suspense fallback={null}><ScanPage /></Suspense> },
      { path: '/portal/:token', element: <Suspense fallback={null}><PortalPage /></Suspense> },
      { path: '/sit/:token', element: <Suspense fallback={null}><SitPage /></Suspense> },
      { path: '/community-guidelines', element: <Suspense fallback={null}><CommunityGuidelinesPage /></Suspense> },
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
          { path: 'plants/:id', element: <PlantDetailPage />, handle: { breadcrumb: 'Plant' } },
          { path: 'analytics', element: <AnalyticsPage />, handle: { breadcrumb: 'Analytics' } },
          { path: 'calendar', element: <CalendarPage />, handle: { breadcrumb: 'Care Calendar' } },
          { path: 'visits', element: <VisitsPage />, handle: { breadcrumb: 'Visit Schedule' } },
          { path: 'templates', element: <Suspense fallback={null}><TemplatesPage /></Suspense>, handle: { breadcrumb: 'Templates' } },
          { path: 'materials', element: <Suspense fallback={null}><MaterialsPage /></Suspense>, handle: { breadcrumb: 'Materials' } },
          { path: 'forecast', element: <ForecastPage />, handle: { breadcrumb: 'Forecast' } },
          { path: 'insights', element: <InsightsPage />, handle: { breadcrumb: 'ML Insights' } },
          { path: 'bulk-upload', element: <BulkUploadPage />, handle: { breadcrumb: 'Bulk Upload' } },
          { path: 'settings', element: <Navigate to="/settings/property" replace /> },
          { path: 'settings/billing', element: <BillingPage /> },
          { path: 'settings/:tab', element: <SettingsPage />, handle: { breadcrumb: 'Settings' } },
          { path: 'admin', element: <Navigate to="/admin/features" replace /> },
          { path: 'admin/:tab', element: <AdminPage />, handle: { breadcrumb: 'Admin' } },
          { path: 'pricing', element: <PricingPage />, handle: { breadcrumb: 'Pricing' } },
          { path: 'rebates', element: <Suspense fallback={null}><RebatesPage /></Suspense>, handle: { breadcrumb: 'Rebates & Grants' } },
          { path: 'community', element: <Suspense fallback={null}><CommunityPage /></Suspense>, handle: { breadcrumb: 'Community' } },
        ],
      },
    ],
  },
]
