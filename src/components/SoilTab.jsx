import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Form, Row, Col, Spinner } from 'react-bootstrap'
import { soilApi } from '../api/plants.js'

const SOURCE_LABEL = { strip: 'Test strip', probe: 'Probe', lab: 'Lab report', visual: 'Visual' }
const AMENDMENT_KINDS = ['compost', 'lime', 'sulphur', 'gypsum', 'biochar', 'fertiliser', 'other']
const AMENDMENT_LABEL = { compost: 'Compost', lime: 'Lime', sulphur: 'Sulphur', gypsum: 'Gypsum', biochar: 'Biochar', fertiliser: 'Fertiliser', other: 'Other' }

function phColor(ph) {
  if (ph == null) return 'secondary'
  if (ph < 5.5) return 'danger'
  if (ph > 7.5) return 'warning'
  return 'success'
}

function InsightBanner({ plantId }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    soilApi.insight(plantId)
      .then(setInsight)
      .catch(() => setInsight(null))
      .finally(() => setLoading(false))
  }, [plantId])

  if (loading) return null
  if (!insight || insight.verdict === 'unknown') return null

  const variant = insight.verdict === 'ideal' ? 'success' : insight.severity === 'high' ? 'danger' : 'warning'
  return (
    <div className={`alert alert-${variant} py-2 mb-3`} role="status">
      <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#info" /></svg>
      {insight.rationale}
      {insight.recommendedAmendment && (
        <span className="ms-2">
          <Badge bg={variant} className="fs-xs">Apply {AMENDMENT_LABEL[insight.recommendedAmendment.kind] || insight.recommendedAmendment.kind}</Badge>
        </span>
      )}
    </div>
  )
}

function SoilTestForm({ plantId, onAdded }) {
  const [form, setForm] = useState({ source: 'strip', ph: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.ph && !form.notes) return
    setSaving(true)
    try {
      const data = { source: form.source, notes: form.notes || null }
      if (form.ph !== '') data.ph = parseFloat(form.ph)
      const created = await soilApi.createTest(plantId, data)
      onAdded(created)
      setForm({ source: 'strip', ph: '', notes: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded p-3 mb-3 bg-light bg-opacity-25">
      <h6 className="fw-500 mb-2">Log soil test</h6>
      <Row className="g-2 mb-2">
        <Col xs={6}>
          <Form.Label className="tx-muted" style={{ fontSize: 12 }}>Source</Form.Label>
          <Form.Select size="sm" value={form.source} onChange={e => set('source', e.target.value)}>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Form.Select>
        </Col>
        <Col xs={6}>
          <Form.Label className="tx-muted" style={{ fontSize: 12 }}>pH</Form.Label>
          <Form.Control size="sm" type="number" min="0" max="14" step="0.1" placeholder="e.g. 6.5" value={form.ph} onChange={e => set('ph', e.target.value)} />
        </Col>
      </Row>
      <Row className="g-2 mb-2">
        <Col xs={12}>
          <Form.Control size="sm" placeholder="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Col>
      </Row>
      <Button size="sm" variant="outline-primary" onClick={handleSave} disabled={saving || (!form.ph && !form.notes)}>
        {saving ? <Spinner size="sm" className="me-1" /> : null}
        Add test
      </Button>
    </div>
  )
}

function AmendmentForm({ plantId, onAdded }) {
  const [form, setForm] = useState({ kind: 'compost', qty: '', qtyUnit: 'g', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = { kind: form.kind, notes: form.notes || null }
      if (form.qty) { data.qty = parseFloat(form.qty); data.qtyUnit = form.qtyUnit }
      const created = await soilApi.createAmendment(plantId, data)
      onAdded(created)
      setForm({ kind: 'compost', qty: '', qtyUnit: 'g', notes: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded p-3 mb-3 bg-light bg-opacity-25">
      <h6 className="fw-500 mb-2">Log amendment</h6>
      <Row className="g-2 mb-2">
        <Col xs={6}>
          <Form.Label className="tx-muted" style={{ fontSize: 12 }}>Type</Form.Label>
          <Form.Select size="sm" value={form.kind} onChange={e => set('kind', e.target.value)}>
            {AMENDMENT_KINDS.map(k => <option key={k} value={k}>{AMENDMENT_LABEL[k]}</option>)}
          </Form.Select>
        </Col>
        <Col xs={3}>
          <Form.Label className="tx-muted" style={{ fontSize: 12 }}>Qty</Form.Label>
          <Form.Control size="sm" type="number" min="0" placeholder="e.g. 20" value={form.qty} onChange={e => set('qty', e.target.value)} />
        </Col>
        <Col xs={3}>
          <Form.Label className="tx-muted" style={{ fontSize: 12 }}>Unit</Form.Label>
          <Form.Select size="sm" value={form.qtyUnit} onChange={e => set('qtyUnit', e.target.value)}>
            {['g', 'kg', 'ml', 'L', 'oz', 'lb'].map(u => <option key={u}>{u}</option>)}
          </Form.Select>
        </Col>
      </Row>
      <Row className="g-2 mb-2">
        <Col xs={12}>
          <Form.Control size="sm" placeholder="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Col>
      </Row>
      <Button size="sm" variant="outline-success" onClick={handleSave} disabled={saving}>
        {saving ? <Spinner size="sm" className="me-1" /> : null}
        Add amendment
      </Button>
    </div>
  )
}

export default function SoilTab({ plantId }) {
  const [tests, setTests] = useState([])
  const [amendments, setAmendments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!plantId) return
    setLoading(true)
    try {
      const [t, a] = await Promise.all([soilApi.listTests(plantId), soilApi.listAmendments(plantId)])
      setTests(t)
      setAmendments(a)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => { load() }, [load])

  const handleTestAdded = (test) => setTests(prev => [test, ...prev])
  const handleAmendmentAdded = (amendment) => setAmendments(prev => [amendment, ...prev])

  const handleDeleteTest = async (id) => {
    try {
      await soilApi.deleteTest(plantId, id)
      setTests(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDeleteAmendment = async (id) => {
    try {
      await soilApi.deleteAmendment(plantId, id)
      setAmendments(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <div className="text-center py-4 text-muted"><Spinner size="sm" className="me-2" />Loading…</div>

  return (
    <div>
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      {tests.length > 0 && <InsightBanner plantId={plantId} />}

      <SoilTestForm plantId={plantId} onAdded={handleTestAdded} />

      {tests.length > 0 && (
        <div className="mb-4">
          <h6 className="fw-500 mb-2">Test history</h6>
          {tests.map(t => (
            <div key={t.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
              <Badge bg={phColor(t.ph)} className="flex-shrink-0">
                {t.ph != null ? `pH ${t.ph}` : 'No pH'}
              </Badge>
              <span className="tx-muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[t.source] || t.source}</span>
              <span className="tx-muted flex-grow-1" style={{ fontSize: 12 }}>{t.notes || ''}</span>
              <span className="tx-muted" style={{ fontSize: 11 }}>{t.recordedAt?.slice(0, 10)}</span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-danger"
                onClick={() => handleDeleteTest(t.id)}
                aria-label="Delete test"
              >
                <svg className="sa-icon" style={{ width: 13, height: 13 }}><use href="/icons/sprite.svg#trash-2" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <AmendmentForm plantId={plantId} onAdded={handleAmendmentAdded} />

      {amendments.length > 0 && (
        <div>
          <h6 className="fw-500 mb-2">Amendment history</h6>
          {amendments.map(a => (
            <div key={a.id} className="d-flex align-items-center gap-2 py-1 border-bottom">
              <Badge bg="info" className="flex-shrink-0 text-capitalize">{AMENDMENT_LABEL[a.kind] || a.kind}</Badge>
              {a.qty && <span className="tx-muted" style={{ fontSize: 12 }}>{a.qty} {a.qtyUnit}</span>}
              <span className="tx-muted flex-grow-1" style={{ fontSize: 12 }}>{a.notes || ''}</span>
              <span className="tx-muted" style={{ fontSize: 11 }}>{a.appliedAt?.slice(0, 10)}</span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-danger"
                onClick={() => handleDeleteAmendment(a.id)}
                aria-label="Delete amendment"
              >
                <svg className="sa-icon" style={{ width: 13, height: 13 }}><use href="/icons/sprite.svg#trash-2" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {tests.length === 0 && amendments.length === 0 && (
        <p className="tx-muted text-center py-3">
          No soil data yet — log your first test above.
        </p>
      )}
    </div>
  )
}
