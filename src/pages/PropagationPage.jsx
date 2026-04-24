import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Form, Modal, Row, Col, Table } from 'react-bootstrap'
import { propagationApi } from '../api/plants.js'
import { usePlantContext } from '../context/PlantContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'

const METHODS = ['seed', 'cutting', 'division', 'layering', 'grafting']

const METHOD_LABEL = {
  seed: 'Seed',
  cutting: 'Cutting',
  division: 'Division',
  layering: 'Layering',
  grafting: 'Grafting',
}

const STATUS_COLUMNS = {
  starting: { label: 'Starting', statuses: ['sown', 'rooted'], icon: 'sun', color: 'warning' },
  growing:  { label: 'Growing',  statuses: ['germinated'],       icon: 'trending-up', color: 'success' },
  ready:    { label: 'Ready',    statuses: ['ready'],             icon: 'check-circle', color: 'primary' },
  done:     { label: 'Done',     statuses: ['transplanted', 'failed'], icon: 'archive', color: 'secondary' },
}

function StatsPanel({ isGuest }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isGuest) { setLoading(false); return }
    propagationApi.stats()
      .then(data => { setStats(data); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [isGuest])

  if (isGuest) return (
    <div className="panel panel-icon">
      <div className="panel-container"><div className="panel-content">
        <EmptyState icon="bar-chart-2" title="Sign in to see propagation stats" description="Track your success rates across species, methods, and seasons." actions={[{ label: 'Sign in', icon: 'log-in', href: '/login' }]} />
      </div></div>
    </div>
  )

  if (loading) return <div className="text-center py-5 text-muted"><div className="spinner-border spinner-border-sm me-2" />Loading…</div>
  if (error) return <div className="alert alert-danger">{error}</div>
  if (!stats) return null

  const noData = !stats.successRateByMethod?.length && !stats.topMothers?.length

  if (noData) return (
    <div className="panel panel-icon">
      <div className="panel-container"><div className="panel-content">
        <EmptyState icon="bar-chart-2" title="No completed propagations yet" description="Stats appear once batches are marked as transplanted or failed." />
      </div></div>
    </div>
  )

  return (
    <div>
      <Row className="g-3 mb-3">
        {stats.successRateByMethod?.map(row => (
          <Col key={row.method} xs={6} md={3}>
            <div className="panel panel-icon">
              <div className="panel-container"><div className="panel-content text-center py-3">
                <div className="tx-title fs-4 fw-bold">{row.rate}%</div>
                <div className="tx-muted text-capitalize">{row.method}</div>
                <div className="tx-muted" style={{ fontSize: 11 }}>{row.succeeded}/{row.total} survived</div>
              </div></div>
            </div>
          </Col>
        ))}
      </Row>

      {stats.topMothers?.length > 0 && (
        <div className="panel panel-icon mb-3">
          <div className="panel-hdr"><h2>Top producing plants</h2></div>
          <div className="panel-container"><div className="panel-content p-0">
            <Table size="sm" className="mb-0" responsive>
              <thead><tr><th>Plant</th><th>Species</th><th className="text-end">Cuttings</th><th className="text-end">Survival</th></tr></thead>
              <tbody>
                {stats.topMothers.map(m => (
                  <tr key={m.plantId}>
                    <td>{m.name || '—'}</td>
                    <td className="tx-muted">{m.species || '—'}</td>
                    <td className="text-end">{m.childrenCount}</td>
                    <td className="text-end">
                      <Badge bg={m.survivalRate >= 70 ? 'success' : m.survivalRate >= 40 ? 'warning' : 'danger'}>{m.survivalRate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div></div>
        </div>
      )}

      {stats.successRateBySpecies?.length > 0 && (
        <div className="panel panel-icon">
          <div className="panel-hdr"><h2>By species</h2></div>
          <div className="panel-container"><div className="panel-content p-0">
            <Table size="sm" className="mb-0" responsive>
              <thead><tr><th>Species</th><th className="text-end">Total</th><th className="text-end">Survival rate</th></tr></thead>
              <tbody>
                {stats.successRateBySpecies.map(row => (
                  <tr key={row.species}>
                    <td>{row.species}</td>
                    <td className="text-end">{row.total}</td>
                    <td className="text-end">
                      <Badge bg={row.rate >= 70 ? 'success' : row.rate >= 40 ? 'warning' : 'danger'}>{row.rate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div></div>
        </div>
      )}
    </div>
  )
}

const STATUS_NEXT = {
  sown:       'germinated',
  germinated: 'ready',
  rooted:     'ready',
  ready:      null,
}

const STATUS_LABEL = {
  sown:        'Sown',
  germinated:  'Germinated',
  rooted:      'Rooting',
  ready:       'Ready to transplant',
  transplanted: 'Transplanted',
  failed:      'Failed',
}

function methodColor(method) {
  return { seed: 'success', cutting: 'info', division: 'primary', layering: 'warning', grafting: 'danger' }[method] || 'secondary'
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function PropagationCard({ prop, onAdvance, onFail, onPromote, onDelete, plants }) {
  const days = daysSince(prop.startDate)
  const isOverdue = prop.expectedDays && days > prop.expectedDays && !['transplanted', 'failed'].includes(prop.status)
  const nextStatus = STATUS_NEXT[prop.status]
  const isDone = ['transplanted', 'failed'].includes(prop.status)
  const parentPlant = prop.parentPlantId && plants ? plants.find(p => p.id === prop.parentPlantId) : null

  return (
    <div className={`panel panel-icon mb-3 ${isOverdue ? 'border-warning border-opacity-50' : ''}`}>
      <div className="panel-container">
        <div className="panel-content py-2 px-3">
          <div className="d-flex align-items-start justify-content-between gap-2">
            <div className="min-w-0 flex-grow-1">
              <div className="tx-title text-truncate">{prop.species}</div>
              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                <Badge bg={methodColor(prop.method)} className="fs-xs">{METHOD_LABEL[prop.method]}</Badge>
                <span className="tx-muted">{days}d ago</span>
                {prop.batchSize > 1 && <span className="tx-muted">× {prop.batchSize}</span>}
                {prop.source && <span className="tx-muted text-truncate">{prop.source}</span>}
                {parentPlant && (
                  <span className="tx-muted">
                    <svg className="sa-icon me-1" style={{ width: 11, height: 11 }}><use href="/icons/sprite.svg#git-branch" /></svg>
                    from <strong>{parentPlant.name}</strong>
                  </span>
                )}
              </div>
              {isOverdue && (
                <div className="text-warning fs-xs mt-1">
                  <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#alert-triangle" /></svg>
                  {days - prop.expectedDays}d past expected date
                </div>
              )}
              {prop.notes && <div className="tx-muted mt-1 text-truncate">{prop.notes}</div>}
            </div>
            <div className="d-flex flex-column gap-1 align-items-end flex-shrink-0">
              <Badge bg={STATUS_COLUMNS.done.statuses.includes(prop.status) ? 'secondary' : 'light'} text="dark" className="fs-xs">
                {STATUS_LABEL[prop.status] || prop.status}
              </Badge>
            </div>
          </div>

          {!isDone && (
            <div className="d-flex gap-2 mt-2 flex-wrap">
              {nextStatus && (
                <Button size="sm" variant="outline-success" onClick={() => onAdvance(prop.id, nextStatus)}>
                  Mark {STATUS_LABEL[nextStatus] || nextStatus}
                </Button>
              )}
              {prop.status === 'ready' && (
                <Button size="sm" variant="success" onClick={() => onPromote(prop)}>
                  <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#arrow-up-right" /></svg>
                  Promote to plant
                </Button>
              )}
              <Button size="sm" variant="outline-danger" onClick={() => onFail(prop.id)}>
                Mark failed
              </Button>
            </div>
          )}

          {isDone && (
            <div className="d-flex gap-2 mt-2">
              <Button size="sm" variant="outline-secondary" onClick={() => onDelete(prop.id)}>
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddBatchModal({ show, onHide, onSave }) {
  const [form, setForm] = useState({
    species: '', method: 'seed', source: '', startDate: new Date().toISOString().slice(0, 10),
    batchSize: 1, expectedDays: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.species.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      setForm({ species: '', method: 'seed', source: '', startDate: new Date().toISOString().slice(0, 10), batchSize: 1, expectedDays: '', notes: '' })
      onHide()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="tx-title">New propagation batch</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label className="tx-muted fw-600">Species *</Form.Label>
          <Form.Control value={form.species} onChange={e => set('species', e.target.value)} placeholder="e.g. Basil, Monstera deliciosa" />
        </Form.Group>
        <Row className="mb-3">
          <Col xs={6}>
            <Form.Label className="tx-muted fw-600">Method</Form.Label>
            <Form.Select value={form.method} onChange={e => set('method', e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </Form.Select>
          </Col>
          <Col xs={6}>
            <Form.Label className="tx-muted fw-600">Batch size</Form.Label>
            <Form.Control type="number" min={1} value={form.batchSize} onChange={e => set('batchSize', parseInt(e.target.value) || 1)} />
          </Col>
        </Row>
        <Row className="mb-3">
          <Col xs={6}>
            <Form.Label className="tx-muted fw-600">Start date</Form.Label>
            <Form.Control type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          </Col>
          <Col xs={6}>
            <Form.Label className="tx-muted fw-600">Expected days</Form.Label>
            <Form.Control type="number" min={1} placeholder="e.g. 14" value={form.expectedDays} onChange={e => set('expectedDays', e.target.value)} />
          </Col>
        </Row>
        <Form.Group className="mb-3">
          <Form.Label className="tx-muted fw-600">Source</Form.Label>
          <Form.Control placeholder="Seed packet brand or parent plant" value={form.source} onChange={e => set('source', e.target.value)} />
        </Form.Group>
        <Form.Group>
          <Form.Label className="tx-muted fw-600">Notes</Form.Label>
          <Form.Control as="textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !form.species.trim()}>
          {saving ? 'Adding…' : 'Add batch'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function PromoteModal({ prop, onHide, onPromote }) {
  const [name, setName] = useState(prop?.species || '')
  const [count, setCount] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (prop) setName(prop.species); }, [prop])

  const handle = async () => {
    setSaving(true)
    try {
      await onPromote(prop.id, { name, count })
      onHide()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={!!prop} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="tx-title">Promote to plant</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="tx-muted">This will create {count > 1 ? `${count} plant records` : 'a plant record'} and mark the batch as transplanted.</p>
        <Form.Group className="mb-3">
          <Form.Label className="tx-muted fw-600">Plant name</Form.Label>
          <Form.Control value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kitchen Basil" />
        </Form.Group>
        {prop?.batchSize > 1 && (
          <Form.Group>
            <Form.Label className="tx-muted fw-600">How many to promote (of {prop.batchSize})</Form.Label>
            <Form.Control type="number" min={1} max={prop.batchSize} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} />
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="success" onClick={handle} disabled={saving || !name.trim()}>
          {saving ? 'Promoting…' : 'Promote'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default function PropagationPage() {
  const { isGuest, reloadPlants, plants } = usePlantContext()
  const [propagations, setPropagations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [promotingProp, setPromotingProp] = useState(null)
  const [column, setColumn] = useState('starting')

  const reload = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await propagationApi.list()
      setPropagations(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isGuest])

  useEffect(() => { reload() }, [reload])

  const handleAdd = useCallback(async (form) => {
    const data = await propagationApi.create({
      ...form,
      batchSize: Number(form.batchSize) || 1,
      expectedDays: form.expectedDays ? Number(form.expectedDays) : null,
    })
    setPropagations(prev => [data, ...prev])
  }, [])

  const handleAdvance = useCallback(async (id, newStatus) => {
    const updated = await propagationApi.update(id, { status: newStatus })
    setPropagations(prev => prev.map(p => p.id === id ? updated : p))
  }, [])

  const handleFail = useCallback(async (id) => {
    const updated = await propagationApi.update(id, { status: 'failed' })
    setPropagations(prev => prev.map(p => p.id === id ? updated : p))
  }, [])

  const handlePromote = useCallback(async (id, data) => {
    await propagationApi.promote(id, data)
    await reload()
    reloadPlants()
  }, [reload, reloadPlants])

  const handleDelete = useCallback(async (id) => {
    await propagationApi.delete(id)
    setPropagations(prev => prev.filter(p => p.id !== id))
  }, [])

  const visibleProps = propagations.filter(p => {
    const col = STATUS_COLUMNS[column]
    return col ? col.statuses.includes(p.status) : true
  })

  const columnCount = (key) => propagations.filter(p => STATUS_COLUMNS[key]?.statuses.includes(p.status)).length

  return (
    <div className="content-wrapper">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="subheader-title mb-0">Propagation</h1>
          <p className="tx-muted mb-0">{propagations.filter(p => !['transplanted','failed'].includes(p.status)).length} active batch{propagations.filter(p => !['transplanted','failed'].includes(p.status)).length !== 1 ? 'es' : ''}</p>
        </div>
        {!isGuest && (
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus" /></svg>
            New batch
          </Button>
        )}
      </div>

      {error && <ErrorAlert error={error} context="propagations" onRetry={reload} />}

      {/* Column filter tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {Object.entries(STATUS_COLUMNS).map(([key, col]) => {
          const count = columnCount(key)
          return (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${column === key ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setColumn(key)}
            >
              <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href={`/icons/sprite.svg#${col.icon}`} /></svg>
              {col.label}
              {count > 0 && <Badge bg={column === key ? 'light' : col.color} text={column === key ? 'dark' : undefined} className="ms-1">{count}</Badge>}
            </button>
          )
        })}
        <button
          type="button"
          className={`btn btn-sm ${column === 'stats' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setColumn('stats')}
        >
          <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#bar-chart-2" /></svg>
          Stats
        </button>
      </div>

      {column === 'stats' ? (
        <StatsPanel isGuest={isGuest} />
      ) : loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" />
          Loading…
        </div>
      ) : isGuest ? (
        <div className="panel panel-icon">
          <div className="panel-container"><div className="panel-content">
            <EmptyState
              icon="git-branch"
              title="Sign in to track propagation"
              description="Track seeds, cuttings, and divisions through every stage — from sowing to transplanting."
              actions={[{ label: 'Sign in', icon: 'log-in', href: '/login' }]}
            />
          </div></div>
        </div>
      ) : visibleProps.length === 0 ? (
        <div className="panel panel-icon">
          <div className="panel-container"><div className="panel-content">
            <EmptyState
              icon={STATUS_COLUMNS[column]?.icon || 'git-branch'}
              title={`No ${STATUS_COLUMNS[column]?.label.toLowerCase() || ''} batches`}
              description={column === 'starting' ? 'Start tracking by adding a new seed or cutting batch.' : `Move batches here by advancing their status.`}
              actions={column === 'starting' ? [{ label: 'Add a batch', icon: 'plus', onClick: () => setShowAdd(true) }] : []}
            />
          </div></div>
        </div>
      ) : (
        <div>
          {visibleProps.map(prop => (
            <PropagationCard
              key={prop.id}
              prop={prop}
              onAdvance={handleAdvance}
              onFail={handleFail}
              onPromote={setPromotingProp}
              onDelete={handleDelete}
              plants={plants}
            />
          ))}
        </div>
      )}

      <AddBatchModal show={showAdd} onHide={() => setShowAdd(false)} onSave={handleAdd} />
      <PromoteModal prop={promotingProp} onHide={() => setPromotingProp(null)} onPromote={handlePromote} />
    </div>
  )
}
