import { useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useLayoutContext } from '../../context/LayoutContext.jsx'
import { usePlantContext } from '../../context/PlantContext.jsx'
import SidebarMenu from './SidebarMenu.jsx'
import WeatherStrip from '../../components/WeatherStrip.jsx'
import { menuItems } from './menuData.js'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { navMinified, toggleSetting } = useLayoutContext()
  const { weather, location } = usePlantContext()
  const navigate = useNavigate()

  const toggleSidenav = () => {
    toggleSetting('navMinified', !navMinified)
  }

  return (
    <aside className="app-sidebar d-flex flex-column">
      {/* Weather strip above everything */}
      <WeatherStrip weather={weather} location={location} onLocationClick={() => navigate('/settings')} />

      {/* Collapse toggle */}
      <div className="d-none d-md-flex align-items-center justify-content-end px-3 pt-1">
        <button type="button" className="btn btn-sm p-1 text-white-50" onClick={toggleSidenav} title="Collapse sidebar">
          <svg className="sa-icon" style={{ width: 16, height: 16 }}>
            <use href="/icons/sprite.svg#chevrons-left"></use>
          </svg>
        </button>
      </div>
      <div className="d-flex align-items-center gap-2 px-4 py-3" style={{ height: 'var(--app-header-height)' }}>
        {user && (
          <>
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="rounded-circle" width={36} height={36} referrerPolicy="no-referrer" />
            ) : (
              <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 36, height: 36, fontSize: '0.85rem' }}>
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="fw-500 text-truncate text-white">{user.name}</div>
              <div className="fs-xs text-white-50 text-truncate">{user.email}</div>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="primary-nav flex-grow-1 overflow-auto">
        <div className="scrollbar">
          <SidebarMenu items={menuItems} />
          {/* Sign out — below Settings */}
          <ul className="nav-menu d-flex flex-column">
            <li>
              <a onClick={logout} style={{ cursor: 'pointer' }}>
                <svg className="sa-icon">
                  <use href="/icons/sprite.svg#log-out"></use>
                </svg>
                <span className="nav-link-text">Sign Out</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

    </aside>
  )
}
