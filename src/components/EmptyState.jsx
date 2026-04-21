import { Button } from 'react-bootstrap'
import { Link } from 'react-router'

export default function EmptyState({ icon = 'inbox', title, description, actions = [] }) {
  return (
    <div className="text-center py-5 px-3">
      <svg className="sa-icon sa-icon-5x text-muted mb-3" aria-hidden="true">
        <use href={`/icons/sprite.svg#${icon}`}></use>
      </svg>
      <h5 className="fw-500 mb-2">{title}</h5>
      {description && <p className="text-muted mb-3" style={{ maxWidth: 380, margin: '0 auto 1rem' }}>{description}</p>}
      {actions.length > 0 && (
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          {actions.map((action, i) =>
            action.href ? (
              <Button
                key={i}
                as={Link}
                to={action.href}
                variant={i === 0 ? 'primary' : 'outline-secondary'}
                size="sm"
              >
                {action.icon && (
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true">
                    <use href={`/icons/sprite.svg#${action.icon}`}></use>
                  </svg>
                )}
                {action.label}
              </Button>
            ) : (
              <Button
                key={i}
                variant={i === 0 ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={action.onClick}
              >
                {action.icon && (
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true">
                    <use href={`/icons/sprite.svg#${action.icon}`}></use>
                  </svg>
                )}
                {action.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
