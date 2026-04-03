import { useState, useMemo } from 'react'
import SidebarMenu from './SidebarMenu.jsx'
import { menuItems } from './menuData.js'

export default function Sidebar() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return menuItems
    const q = search.toLowerCase()
    return menuItems.filter((item) => item.isTitle || item.label.toLowerCase().includes(q))
  }, [search])

  return (
    <aside className="app-sidebar d-flex flex-column">
      {/* Logo area */}
      <div className="d-flex align-items-center px-4 py-3" style={{ height: 'var(--app-header-height)' }}>
        <svg className="sa-icon sa-icon-2x text-primary me-2">
          <use href="/icons/sprite.svg#feather"></use>
        </svg>
        <span className="fw-500 fs-5">Plant Tracker</span>
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
          <div
            className="badge bg-secondary btn"
            title="Clear filter"
            onClick={() => setSearch('')}
          >
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

      {/* Footer */}
      <div className="nav-footer">
        <svg className="sa-icon sa-thin">
          <use href="/icons/sprite.svg#wifi"></use>
        </svg>
      </div>
    </aside>
  )
}
