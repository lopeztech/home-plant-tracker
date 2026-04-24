import { Link, useLocation } from 'react-router'

// Static map — works with BrowserRouter (no data-router useMatches required).
// Keys are exact pathnames; the first segment is the Home ("Garden") crumb.
const PATH_LABELS = {
  '/today':                'Today',
  '/propagation':          'Propagation',
  '/analytics':            'Analytics',
  '/calendar':             'Care Calendar',
  '/forecast':             'Forecast',
  '/insights':             'ML Insights',
  '/bulk-upload':          'Bulk Upload',
  '/settings/property':    'Settings',
  '/settings/preferences': 'Settings',
  '/settings/floors':      'Settings',
  '/settings/data':        'Settings',
  '/settings/api-keys':    'Settings',
  '/settings/branding':    'Settings',
  '/settings/advanced':    'Settings',
  '/settings/billing':     'Billing',
  '/pricing':              'Pricing',
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const label = PATH_LABELS[pathname]
  if (!label) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-2 mt-1 px-3">
      <ol className="breadcrumb mb-0 fs-xs">
        <li className="breadcrumb-item">
          <Link to="/" className="text-decoration-none">Garden</Link>
        </li>
        <li className="breadcrumb-item active" aria-current="page">{label}</li>
      </ol>
    </nav>
  )
}
