import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Modal, Form, Row, Col } from 'react-bootstrap'
import { visitsApi } from '../api/plants.js'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import UpgradePrompt from '../components/UpgradePrompt.jsx'

const STATUS_BADGE = {
  scheduled:   'primary',
  in_progress: 'warning',
  completed:   'success',
  cancelled:   'secondary',
  no_show:     'danger',
}

function VisitModal({ visit, onSave, onClose }) {
  const [form, setForm] = useState(
    visit
      ? { ...visit }
      : { title: '', propertyId: '', scheduledStart: '', scheduledEnd: '', estimatedDurationMinutes: 60, notes: '', assignedTo: '' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const result = visit
        ? await visitsApi.update(visit.id, form)
        : await visitsApi.create(form)
      onSave(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{visit ? 'Edit Visit' : 'Schedule Visit'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
        <Row className="g-3">
          <Col md={8}>
            <Form.Group>
              <Form.Label>Title</Form.Label>
              <Form.Control value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Property Visit" />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Property ID</Form.Label>
              <Form.Control value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Start</Form.Label>
              <Form.Control type="datetime-local" value={form.scheduledStart?.slice(0, 16) || ''} onChange={(e) => set('scheduledStart', new Date(e.target.value).toISOString())} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>End (optional)</Form.Label>
              <Form.Control type="datetime-local" value={form.scheduledEnd?.slice(0, 16) || ''} onChange={(e) => set('scheduledEnd', e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Duration (min)</Form.Label>
              <Form.Control type="number" min={15} max={480} value={form.estimatedDurationMinutes} onChange={(e) => set('estimatedDurationMinutes', Number(e.target.value))} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Assigned to (UID)</Form.Label>
              <Form.Control value={form.assignedTo || ''} onChange={(e) => set('assignedTo', e.target.value)} placeholder="Leave blank for yourself" />
            </Form.Group>
          </Col>
          <Col xs={12}>
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : visit ? 'Save Changes' : 'Schedule Visit'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function VisitRow({ visit, onRefresh }) {
  const [busy, setBusy] = useState(false)

  async function action(fn) {
    setBusy(true)
    try { await fn(); await onRefresh() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  const fmt = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'

  return (
    <tr>
      <td>
        <div className="fw-semibold">{visit.title || 'Visit'}</div>
        <small className="text-muted">{visit.propertyId}</small>
      </td>
      <td>{fmt(visit.scheduledStart)}</td>
      <td>
        <Badge bg={STATUS_BADGE[visit.status] || 'secondary'} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
          {visit.status?.replace('_', ' ')}
        </Badge>
      </td>
      <td>
        <div className="d-flex gap-1 flex-wrap">
          {visit.status === 'scheduled' && (
            <Button size="sm" variant="outline-success" disabled={busy} onClick={() => action(() => visitsApi.checkIn(visit.id))}>
              Check In
            </Button>
          )}
          {visit.status === 'in_progress' && <>
            <Button size="sm" variant="outline-primary" disabled={busy} onClick={() => action(() => visitsApi.checkOut(visit.id))}>
              Check Out
            </Button>
            <Button size="sm" variant="success" disabled={busy} onClick={() => action(() => visitsApi.complete(visit.id))}>
              Complete
            </Button>
          </>}
          {visit.status === 'scheduled' && (
            <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => action(() => visitsApi.cancel(visit.id))}>
              Cancel
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function VisitsPage() {
  const { canAccess } = useSubscription()
  const [visitList, setVisitList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('upcoming')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter === 'upcoming') params.from = new Date().toISOString()
      else if (filter === 'completed') params.status = 'completed'
      const data = await visitsApi.list(params)
      setVisitList(data.visits || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  if (!canAccess('landscaper_pro')) {
    return (
      <div className="container-fluid py-4">
        <UpgradePrompt id="visit_scheduling" feature="landscaper_pro" />
      </div>
    )
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Visit Schedule</h4>
          <p className="text-muted mb-0 small">Plan and track property visits for your team.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#icon-plus" /></svg>
          Schedule Visit
        </Button>
      </div>

      <div className="d-flex gap-2 mb-3">
        {['upcoming', 'completed', 'all'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'outline-secondary'}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" />Loading visits…
        </div>
      ) : visitList.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No visits yet"
          description="Schedule your first property visit to get started."
          actions={[{ label: 'Schedule Visit', icon: 'plus', onClick: () => setShowModal(true) }]}
        />
      ) : (
        <div className="panel">
          <div className="panel-container">
            <div className="panel-content p-0">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Visit</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visitList.map((v) => (
                    <VisitRow key={v.id} visit={v} onRefresh={load} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <VisitModal
          onSave={() => { setShowModal(false); load() }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
