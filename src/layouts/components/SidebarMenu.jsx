import { useState } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSubscription } from '../../context/SubscriptionContext.jsx'

function getStoredCollapsed() {
  try {
    return JSON.parse(localStorage.getItem('sidebarCollapsed') || '{}')
  } catch {
    return {}
  }
}

export default function SidebarMenu({ items, badges = {} }) {
  const { t } = useTranslation('common')
  const { canAccess, billingEnabled } = useSubscription()
  const [collapsed, setCollapsed] = useState(getStoredCollapsed)

  function toggleSection(key) {
    const next = { ...collapsed, [key]: !collapsed[key] }
    setCollapsed(next)
    try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)) } catch { /* ignore */ } // lgtm[js/clear-text-storage-of-sensitive-data]
  }

  function renderItem(item) {
    const badge = badges[item.key]
    // Only show the PRO indicator once billing is actually live — during the
    // dark-ship phase everyone has access so the badge would be misleading.
    const locked = billingEnabled && item.requiresTier && !canAccess(item.requiresTier)
    return (
      <li key={item.key} data-tour={`nav-${item.key}`}>
        <NavLink to={item.url} end={item.url === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
          {item.icon && <svg className="sa-icon" aria-hidden="true"><use href={item.icon} /></svg>}
          <span className="nav-link-text">{t(`nav.${item.key}`, item.label)}</span>
          {badge > 0 && (
            <span className="badge bg-primary rounded-pill ms-auto" aria-label={`${badge} pending`}>{badge}</span>
          )}
          {locked && (
            <span className="badge bg-warning text-dark ms-auto" aria-label="Pro feature">PRO</span>
          )}
        </NavLink>
      </li>
    )
  }

  // Flatten support: if items have no isSection, render as before (backward compat)
  const hasSections = items.some((i) => i.isSection)

  if (!hasSections) {
    return (
      <ul className="nav-menu d-flex flex-column">
        {items.map((item) => {
          if (item.isTitle) return <li key={item.key} className="nav-title">{item.label}</li>
          return renderItem(item)
        })}
      </ul>
    )
  }

  return (
    <nav aria-label="Main navigation">
      {items.map((section) => {
        if (!section.isSection) return null
        const isCollapsed = !!collapsed[section.key]
        return (
          <div key={section.key} className="nav-section mb-1">
            {section.collapsible ? (
              <button
                type="button"
                className="nav-section-header d-flex align-items-center w-100 bg-transparent border-0 px-3 py-1"
                onClick={() => toggleSection(section.key)}
                aria-expanded={!isCollapsed}
                aria-controls={`nav-section-${section.key}`}
              >
                <span className="nav-title flex-grow-1 text-start mb-0">{section.label}</span>
                <svg
                  className="sa-icon"
                  style={{ width: 12, height: 12, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                  aria-hidden="true"
                >
                  <use href="/icons/sprite.svg#chevron-down" />
                </svg>
              </button>
            ) : (
              <div className="nav-title px-3 py-1">{section.label}</div>
            )}
            {!isCollapsed && (
              <ul className="nav-menu d-flex flex-column" id={`nav-section-${section.key}`}>
                {(section.children || []).map(renderItem)}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
