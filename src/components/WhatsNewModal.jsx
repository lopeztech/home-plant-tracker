import { Modal, Badge } from 'react-bootstrap'
import changelog from '../data/changelog.json'
import { useTour } from '../context/TourContext.jsx'

const TYPE_VARIANTS = {
  new:      'success',
  improved: 'primary',
  fixed:    'warning',
}

export default function WhatsNewModal() {
  const { showWhatsNew, closeWhatsNew } = useTour()

  return (
    <Modal show={showWhatsNew} onHide={closeWhatsNew} centered scrollable>
      <Modal.Header closeButton className="border-bottom-0 pb-0">
        <Modal.Title className="fs-base fw-600 d-flex align-items-center gap-2">
          <svg className="sa-icon text-primary" aria-hidden="true">
            <use href="/icons/sprite.svg#sparkles"></use>
          </svg>
          What&apos;s new
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {changelog.map((release) => (
          <div key={release.version} className="mb-4">
            <div className="d-flex align-items-baseline gap-2 mb-2">
              <span className="fw-600 fs-sm">v{release.version}</span>
              <span className="text-muted fs-xs">{release.date}</span>
            </div>
            <ul className="list-unstyled mb-0 ps-1">
              {release.entries.map((entry, i) => (
                <li key={i} className="d-flex align-items-start gap-2 mb-2">
                  <Badge
                    bg={TYPE_VARIANTS[entry.type] || 'secondary'}
                    className="mt-1 flex-shrink-0 text-capitalize"
                    style={{ fontSize: '0.6rem', fontWeight: 600, minWidth: 52 }}
                  >
                    {entry.type}
                  </Badge>
                  <span className="fs-sm">{entry.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer className="border-top-0 pt-0">
        <button className="btn btn-primary btn-sm" onClick={closeWhatsNew}>
          Got it
        </button>
      </Modal.Footer>
    </Modal>
  )
}
