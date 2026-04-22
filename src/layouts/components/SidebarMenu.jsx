import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function SidebarMenu({ items, badges = {} }) {
  const { t } = useTranslation('common')
  return (
    <ul className="nav-menu d-flex flex-column">
      {items.map((item) => {
        if (item.isTitle) {
          return (
            <li key={item.key} className="nav-title">{item.label}</li>
          )
        }
        const badge = badges[item.key]
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
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
