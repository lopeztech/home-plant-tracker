import { useAuth } from '../../contexts/AuthContext.jsx'
import SidebarMenu from './SidebarMenu.jsx'
import { menuItems } from './menuData.js'

export default function Sidebar() {
  const { user, logout } = useAuth()

  const toggleSidenav = () => {
    document.documentElement.classList.toggle('set-nav-minified')
  }

  return (
    <aside className="app-sidebar d-flex flex-column">
      {/* Profile area */}
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

      {/* Footer: collapse toggle */}
      <div className="nav-footer d-flex align-items-center justify-content-end px-3 py-2">
        <button type="button" className="btn btn-sm text-white-50" onClick={toggleSidenav} title="Collapse sidebar">
          <svg className="sa-icon"><use href="/icons/sprite.svg#chevrons-left"></use></svg>
        </button>
      </div>
    </aside>
  )
}
