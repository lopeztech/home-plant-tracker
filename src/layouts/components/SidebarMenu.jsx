import { NavLink } from 'react-router'

export default function SidebarMenu({ items, badges = {} }) {
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
              <span className="nav-link-text">{item.label}</span>
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
