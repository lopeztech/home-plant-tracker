import { useState, useRef, useEffect } from 'react'
import { Dropdown } from 'react-bootstrap'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useLayoutContext } from '../../context/LayoutContext.jsx'
import { usePlantContext } from '../../context/PlantContext.jsx'

export default function Topbar() {
  const { user, logout } = useAuth()
  const { changeTheme, theme, showBackdrop, hideBackdrop } = useLayoutContext()
  const { weather, tempUnit } = usePlantContext()

  const toggleMobileMenu = () => {
    const isOpen = document.documentElement.classList.toggle('app-mobile-menu-open')
    if (isOpen) showBackdrop()
    else hideBackdrop()
  }

  const toggleSidenav = () => {
    const html = document.documentElement
    html.classList.toggle('set-nav-minified')
  }

  return (
    <header className="app-header">
      <div className="d-flex flex-grow-1 w-100 me-auto align-items-center">
        {/* Logo (mobile) */}
        <div className="d-flex align-items-center app-logo">
          <svg className="sa-icon sa-icon-2x text-primary me-2">
            <use href="/icons/sprite.svg#feather"></use>
          </svg>
          <span className="fw-500 hidden-mobile">Plant Tracker</span>
        </div>

        {/* Mobile menu toggle */}
        <button type="button" className="btn btn-system d-md-none" onClick={toggleMobileMenu} aria-label="Toggle menu">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>

        {/* Desktop sidenav toggle */}
        <button type="button" className="btn btn-system hidden-mobile" onClick={toggleSidenav} aria-label="Toggle sidebar">
          <svg className="sa-icon sa-icon-2x">
            <use href="/icons/sprite.svg#menu"></use>
          </svg>
        </button>

        {/* Weather widget */}
        {weather && (
          <div className="d-flex align-items-center gap-2 ms-3 hidden-mobile">
            <span className="fs-4">{weather.current.condition.emoji}</span>
            <span className="fw-500">{weather.current.temp}°{tempUnit.unit === 'fahrenheit' ? 'F' : 'C'}</span>
          </div>
        )}
      </div>

      {/* Theme toggler */}
      <button
        type="button"
        className="btn btn-system hidden-mobile"
        onClick={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        <svg className="sa-icon sa-icon-2x">
          <use href={`/icons/sprite.svg#${theme === 'dark' ? 'sun' : 'moon'}`}></use>
        </svg>
      </button>

      {/* User profile dropdown */}
      {user && (
        <Dropdown align="end">
          <Dropdown.Toggle as="button" className="btn btn-system d-flex align-items-center gap-2" id="profile-dropdown">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="rounded-circle"
                width={28}
                height={28}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                style={{ width: 28, height: 28, fontSize: '0.75rem' }}
              >
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <span className="hidden-mobile fw-500">{user.name}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu className="dropdown-menu-animated">
            <Dropdown.Header>{user.email}</Dropdown.Header>
            <Dropdown.Divider />
            <Dropdown.Item onClick={logout}>
              <svg className="sa-icon me-2">
                <use href="/icons/sprite.svg#log-out"></use>
              </svg>
              Sign out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      )}
    </header>
  )
}
