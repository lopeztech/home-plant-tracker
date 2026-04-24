import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSubscription } from '../../context/SubscriptionContext.jsx'

export default function SidebarMenu({ items, badges = {} }) {
  const { t } = useTranslation('common')
  const { canAccess, billingEnabled } = useSubscription()
  return (
    <ul className="nav-menu d-flex flex-column">
      {items.map((item) => {
        if (item.isTitle) {
          return (
            <li key={item.key} className="nav-title">{item.label}</li>
          )
        }
        const badge = badges[item.key]
        // Only show the PRO indicator once billing is actually live — during the
        // dark-ship phase everyone has access so the badge would be misleading.
        const locked = billingEnabled && item.requiresTier && !canAccess(item.requiresTier)
        return (
          <li key={item.key} data-tour={`nav-${item.key}`}>
            <NavLink
              to={item.url}
              end={item.url === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {item.icon && (
                <svg className="sa-icon">
                  <use href={item.icon}></use>
                </svg>
              )}
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
      })}
    </ul>
  )
}
