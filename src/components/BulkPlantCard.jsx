import { useState } from 'react'
import { Card, Form, Badge, Spinner, Button, Row, Col, Collapse, InputGroup } from 'react-bootstrap'

const HEALTH_COLORS = { Excellent: 'success', Good: 'success', Fair: 'warning', Poor: 'danger' }
const MATURITY_COLORS = { Seedling: 'info', Young: 'info', Mature: 'primary', Established: 'primary' }

const HEALTH_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor']
const MATURITY_OPTIONS = ['Seedling', 'Young', 'Mature', 'Established']
const WATER_METHODS = [
  { value: 'jug', label: 'Jug / Watering Can' },
  { value: 'spray', label: 'Spray / Mist' },
  { value: 'bottom-water', label: 'Bottom Watering' },
  { value: 'hose', label: 'Hose' },
  { value: 'irrigation', label: 'Irrigation System' },
  { value: 'drip', label: 'Drip System' },
]
const POT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small (< 15cm)' },
  { value: 'medium', label: 'Medium (15–25cm)' },
  { value: 'large', label: 'Large (25–40cm)' },
  { value: 'xlarge', label: 'X-Large (> 40cm)' },
]
const SOIL_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard potting mix' },
  { value: 'well-draining', label: 'Well-draining (perlite/sand)' },
  { value: 'moisture-retaining', label: 'Moisture-retaining (peat/coir)' },
  { value: 'succulent-mix', label: 'Succulent / cactus mix' },
  { value: 'orchid-mix', label: 'Orchid mix (bark)' },
]
const PLANTED_IN_OPTIONS = [
  { value: 'ground', label: 'In the Ground' },
  { value: 'garden-bed', label: 'Garden Bed' },
  { value: 'pot', label: 'Pot' },
]

const ANALYSIS_STAGES = [
  'Identifying plant species...',
  'Assessing plant health...',
  'Evaluating maturity...',
  'Calculating care schedule...',
]

export default function BulkPlantCard({ entry, floors, rooms, onChange, onRemove, onRetry, onReanalyse }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hint, setHint] = useState('')
  const { previewUrl, status, form, error } = entry

  const submitHint = () => {
    if (!hint.trim() || !onReanalyse) return
    onReanalyse(hint.trim())
    setShowHint(false)
    setHint('')
  }

  const update = (field, value) => {
    const updatedForm = { ...form, [field]: value }
    // When floor changes, auto-select the first room on the new floor
    if (field === 'floor') {
      const newFloorRooms = (floors.find((f) => f.id === value)?.rooms || []).map((r) => r.name).filter(Boolean)
      if (newFloorRooms.length > 0 && !newFloorRooms.includes(form.room)) {
        updatedForm.room = newFloorRooms[0]
      }
    }
    onChange({ ...entry, form: updatedForm })
  }

  const floorRooms = form.floor
    ? (floors.find((f) => f.id === form.floor)?.rooms || []).map((r) => r.name).filter(Boolean)
    : rooms

  return (
    <Card className={`mb-3 ${status === 'saved' ? 'border-success' : status === 'error' ? 'border-danger' : ''}`}>
      {/* Thumbnail with overlay */}
      <div className="position-relative" style={{ height: 140, overflow: 'hidden' }}>
        <img src={previewUrl} alt="" className="w-100 h-100" style={{ objectFit: 'cover' }} />
        {status === 'analysing' && (
          <AnalysingOverlay stageIndex={entry.stageIndex || 0} />
        )}
        {status === 'saving' && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="text-center">
              <Spinner size="sm" variant="light" className="mb-1" />
              <p className="text-white fs-xs mb-0">Saving...</p>
            </div>
          </div>
        )}
        {status === 'saved' && (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <svg className="sa-icon text-success" style={{ width: 48, height: 48 }}><use href="/icons/sprite.svg#check-circle"></use></svg>
          </div>
        )}
        {status !== 'saving' && status !== 'saved' && (
          <Button
            variant="dark" size="sm"
            className="position-absolute top-0 end-0 m-1 rounded-circle p-0"
            style={{ width: 24, height: 24 }}
            onClick={onRemove}
          >
            <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#x"></use></svg>
          </Button>
        )}
      </div>

      <Card.Body className="py-2 px-3">
        {/* Error state */}
        {status === 'error' && (
          <div className="text-danger fs-xs mb-2">
            {error}
            <Button variant="link" size="sm" className="p-0 ms-2 text-danger" onClick={onRetry}>Retry</Button>
          </div>
        )}

        {/* Analysis badges */}
        {form.health && (
          <div className="d-flex flex-wrap gap-1 mb-2">
            <Badge bg={HEALTH_COLORS[form.health] || 'secondary'} className="fs-xs">{form.health}</Badge>
            {form.maturity && <Badge bg={MATURITY_COLORS[form.maturity] || 'secondary'} className="fs-xs">{form.maturity}</Badge>}
            {form.frequencyDays && <Badge bg="info" className="fs-xs">Every {form.frequencyDays}d</Badge>}
          </div>
        )}

        {/* Core fields */}
        {(status === 'ready' || status === 'error') && (
          <>
            <Form.Group className="mb-2">
              <Form.Control size="sm" placeholder="Plant Name *" value={form.name || ''}
                onChange={(e) => update('name', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Control size="sm" placeholder="Species" value={form.species || ''}
                onChange={(e) => update('species', e.target.value)} />
              {onReanalyse && !showHint && (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 fs-xs text-muted mt-1"
                  onClick={() => setShowHint(true)}
                >
                  Not right? Suggest species
                </Button>
              )}
              {showHint && (
                <InputGroup size="sm" className="mt-1">
                  <Form.Control
                    placeholder="e.g. Monstera, Peace Lily..."
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitHint() }}
                  />
                  <Button variant="primary" onClick={submitHint} disabled={!hint.trim()}>
                    Re-analyse
                  </Button>
                  <Button variant="outline-secondary" onClick={() => { setShowHint(false); setHint('') }}>
                    Cancel
                  </Button>
                </InputGroup>
              )}
            </Form.Group>
            <Row className="mb-2 g-2">
              <Col xs={6}>
                <Form.Select size="sm" value={form.floor || ''} onChange={(e) => update('floor', e.target.value)}>
                  {(floors ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Form.Select>
              </Col>
              <Col xs={6}>
                <Form.Select size="sm" value={form.room || ''} onChange={(e) => update('room', e.target.value)}>
                  {floorRooms.map((r) => <option key={r} value={r}>{r}</option>)}
                </Form.Select>
              </Col>
            </Row>
            <Row className="mb-2 g-2">
              <Col xs={6}>
                <Form.Select size="sm" value={form.plantedIn || 'pot'} onChange={(e) => update('plantedIn', e.target.value)}>
                  {PLANTED_IN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Form.Select>
              </Col>
              <Col xs={6}>
                <div className="input-group input-group-sm">
                  <Form.Control type="number" min={1} max={90} value={form.frequencyDays || ''}
                    onChange={(e) => update('frequencyDays', Number(e.target.value))} />
                  <span className="input-group-text fs-xs">days</span>
                </div>
              </Col>
            </Row>

            {/* Advanced fields */}
            <Button variant="link" size="sm" className="p-0 fs-xs text-muted mb-1"
              onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'Hide' : 'More'} options
            </Button>
            <Collapse in={showAdvanced}>
              <div>
                <Row className="mb-2 g-2">
                  <Col xs={6}>
                    <Form.Select size="sm" value={form.health || ''} onChange={(e) => update('health', e.target.value)}>
                      <option value="">Health</option>
                      {HEALTH_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Form.Select>
                  </Col>
                  <Col xs={6}>
                    <Form.Select size="sm" value={form.maturity || ''} onChange={(e) => update('maturity', e.target.value)}>
                      <option value="">Maturity</option>
                      {MATURITY_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </Form.Select>
                  </Col>
                </Row>
                <Row className="mb-2 g-2">
                  <Col xs={6}>
                    <Form.Select size="sm" value={form.waterMethod || ''} onChange={(e) => update('waterMethod', e.target.value)}>
                      <option value="">Water Method</option>
                      {WATER_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Form.Select>
                  </Col>
                  <Col xs={6}>
                    <Form.Control size="sm" placeholder="Water Amount" value={form.waterAmount || ''}
                      onChange={(e) => update('waterAmount', e.target.value)} />
                  </Col>
                </Row>
                {form.plantedIn === 'pot' && (
                  <Row className="mb-2 g-2">
                    <Col xs={6}>
                      <Form.Select size="sm" value={form.potSize || ''} onChange={(e) => update('potSize', e.target.value)}>
                        <option value="">Pot Size</option>
                        {POT_SIZE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </Form.Select>
                    </Col>
                    <Col xs={6}>
                      <Form.Select size="sm" value={form.soilType || ''} onChange={(e) => update('soilType', e.target.value)}>
                        <option value="">Soil Type</option>
                        {SOIL_TYPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Form.Select>
                    </Col>
                  </Row>
                )}
              </div>
            </Collapse>
          </>
        )}

        {/* Pending / analysing placeholder */}
        {status === 'analysing' && (
          <div className="text-center py-2">
            <p className="fs-xs text-muted mb-0">Analysing photo...</p>
          </div>
        )}
        {status === 'pending' && (
          <div className="text-center py-2">
            <p className="fs-xs text-muted mb-0">Waiting...</p>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

function AnalysingOverlay({ stageIndex }) {
  return (
    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="text-center">
        <Spinner size="sm" variant="primary" className="mb-1" />
        <p className="text-white fs-xs mb-0">{ANALYSIS_STAGES[stageIndex % ANALYSIS_STAGES.length]}</p>
      </div>
    </div>
  )
}
