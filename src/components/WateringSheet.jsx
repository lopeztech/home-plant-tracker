import React, { useState } from 'react'
import { Modal, Button, Form, Badge, Spinner, Row, Col } from 'react-bootstrap'

const METHODS = [
  { value: 'top',        label: 'Top water' },
  { value: 'bottom',     label: 'Bottom' },
  { value: 'mist',       label: 'Mist' },
  { value: 'soak',       label: 'Soak' },
  { value: 'drip',       label: 'Drip' },
  { value: 'irrigation', label: 'Irrigation' },
]

const SOIL_STATES = [
  { value: 'dry',   label: 'Dry',   variant: 'danger' },
  { value: 'moist', label: 'Moist', variant: 'warning' },
  { value: 'wet',   label: 'Wet',   variant: 'info' },
  { value: 'soggy', label: 'Soggy', variant: 'primary' },
]

export default function WateringSheet({ plant, show, onHide, onLog }) {
  const [volumeMl, setVolumeMl]     = useState('')
  const [method, setMethod]         = useState('')
  const [soilBefore, setSoilBefore] = useState('')
  const [drained, setDrained]       = useState(null)
  const [logging, setLogging]       = useState(false)

  const handleLog = async () => {
    setLogging(true)
    try {
      const metadata = {
        ...(volumeMl !== ''   && { volumeMl: Number(volumeMl) }),
        ...(method            && { method }),
        ...(soilBefore        && { soilBefore }),
        ...(drained !== null  && { drainedCleanly: drained }),
      }
      await onLog(plant.id, metadata)
      setVolumeMl(''); setMethod(''); setSoilBefore(''); setDrained(null)
      onHide()
    } finally { setLogging(false) }
  }

  const showDrained = method && method !== 'mist' && method !== 'irrigation'

  return (
    <Modal show={show} onHide={onHide} centered size="sm" className="watering-sheet">
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fs-sm fw-semibold">
          <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#droplet"></use></svg>
          Water {plant?.name || 'plant'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-2">
        {/* Volume */}
        <Form.Group className="mb-3">
          <Form.Label className="fs-xs text-muted mb-1">Volume (ml) — optional</Form.Label>
          <Form.Control
            type="number" min="0" step="50" placeholder="e.g. 250"
            value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)}
            size="sm"
          />
        </Form.Group>

        {/* Method */}
        <Form.Group className="mb-3">
          <Form.Label className="fs-xs text-muted mb-1">Method — optional</Form.Label>
          <div className="d-flex flex-wrap gap-1">
            {METHODS.map((m) => (
              <Badge
                key={m.value}
                role="button"
                bg={method === m.value ? 'primary' : 'light'}
                text={method === m.value ? 'white' : 'dark'}
                className="fw-normal py-1 px-2"
                style={{ cursor: 'pointer' }}
                onClick={() => setMethod(method === m.value ? '' : m.value)}
              >
                {m.label}
              </Badge>
            ))}
          </div>
        </Form.Group>

        {/* Soil before */}
        <Form.Group className="mb-3">
          <Form.Label className="fs-xs text-muted mb-1">Soil was… — optional</Form.Label>
          <div className="d-flex flex-wrap gap-1">
            {SOIL_STATES.map((s) => (
              <Badge
                key={s.value}
                role="button"
                bg={soilBefore === s.value ? s.variant : 'light'}
                text={soilBefore === s.value ? 'white' : 'dark'}
                className="fw-normal py-1 px-2"
                style={{ cursor: 'pointer' }}
                onClick={() => setSoilBefore(soilBefore === s.value ? '' : s.value)}
              >
                {s.label}
              </Badge>
            ))}
          </div>
        </Form.Group>

        {/* Drained cleanly */}
        {showDrained && (
          <Form.Group className="mb-3">
            <Form.Label className="fs-xs text-muted mb-1">Drained cleanly?</Form.Label>
            <div className="d-flex gap-2">
              {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(({ v, label }) => (
                <Badge
                  key={label}
                  role="button"
                  bg={drained === v ? 'success' : 'light'}
                  text={drained === v ? 'white' : 'dark'}
                  className="fw-normal py-1 px-2"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDrained(drained === v ? null : v)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="link" size="sm" className="text-muted" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleLog} disabled={logging} className="flex-grow-1">
          {logging ? <Spinner size="sm" className="me-1" /> : null}
          Log watering
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
