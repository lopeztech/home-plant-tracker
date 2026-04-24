import { Link, useMatches } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'

export default function Breadcrumbs() {
  const matches = useMatches()
  const { plants } = usePlantContext()

  const crumbs = matches
    .filter((m) => m.handle?.breadcrumb)
    .map((m) => {
      let label = m.handle.breadcrumb
      if (typeof label === 'function') {
        label = label(m.params, { plants })
      }
      return { label, path: m.pathname }
    })

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-2 mt-1 px-3">
      <ol className="breadcrumb mb-0 fs-xs">
        {crumbs.map((crumb, i) => (
          <li
            key={crumb.path}
            className={`breadcrumb-item${i === crumbs.length - 1 ? ' active' : ''}`}
            aria-current={i === crumbs.length - 1 ? 'page' : undefined}
          >
            {i < crumbs.length - 1 ? (
              <Link to={crumb.path} className="text-decoration-none">{crumb.label}</Link>
            ) : (
              crumb.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
