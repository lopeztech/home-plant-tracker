import { NavLink } from 'react-router'
import Nav from 'react-bootstrap/Nav'
import { menuItems } from './menuData.js'

const navItems = menuItems.filter((item) => !item.isTitle && item.url)

export default function NavigationTabs() {
  return (
    <div className="nav-tabs-bar d-flex align-items-center px-3 py-2 border-bottom bg-body">
      <Nav variant="pills" className="gap-1 flex-nowrap overflow-auto">
        {navItems.map((item) => (
          <Nav.Item key={item.key}>
            <NavLink
              to={item.url}
              end={item.url === '/'}
              className={({ isActive }) =>
                `nav-link nav-tab py-1 px-2${isActive ? ' active' : ''}`
              }
            >
              <span className="d-inline-flex align-items-center gap-1">
                {item.icon && (
                  <svg className="sa-icon" style={{ width: 14, height: 14 }}>
                    <use href={item.icon}></use>
                  </svg>
                )}
                {item.label}
              </span>
            </NavLink>
          </Nav.Item>
        ))}
      </Nav>
    </div>
  )
}
