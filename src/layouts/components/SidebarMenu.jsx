import { NavLink } from 'react-router'

export default function SidebarMenu({ items }) {
  return (
    <ul className="nav-menu d-flex flex-column">
      {items.map((item) => {
        if (item.isTitle) {
          return (
            <li key={item.key} className="nav-title">{item.label}</li>
          )
        }
        return (
          <li key={item.key}>
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
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}
