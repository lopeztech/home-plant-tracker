import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import SidebarMenu from './SidebarMenu.jsx'
import { menuItems } from './menuData.js'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return menuItems
    const q = search.toLowerCase()
    return menuItems.filter((item) => item.isTitle || item.label.toLowerCase().includes(q))
  }, [search])

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

      {/* Filter input */}
      <form className="app-menu-filter-container px-4" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          className="form-control"
          placeholder="Filter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        {search && (
          <div className="badge bg-secondary btn" title="Clear filter" onClick={() => setSearch('')}>
            {filtered.filter((i) => !i.isTitle).length}
          </div>
        )}
      </form>

      {/* Navigation */}
      <div className="primary-nav flex-grow-1 overflow-auto">
        <div className="scrollbar">
          <SidebarMenu items={filtered} />
        </div>
      </div>

      {/* Footer: sign out + collapse */}
      <div className="nav-footer d-flex align-items-center justify-content-between px-3 py-2">
        <button type="button" className="btn btn-sm text-white-50" onClick={logout} title="Sign out">
          <svg className="sa-icon me-1"><use href="/icons/sprite.svg#log-out"></use></svg>
          <span className="fs-xs">Sign out</span>
        </button>
        <button type="button" className="btn btn-sm text-white-50" onClick={toggleSidenav} title="Collapse sidebar">
          <svg className="sa-icon"><use href="/icons/sprite.svg#chevrons-left"></use></svg>
        </button>
      </div>
    </aside>
  )
}
