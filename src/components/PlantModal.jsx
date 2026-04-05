import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal, Button, Form, Nav, Tab, Badge, Spinner, Row, Col } from 'react-bootstrap'
import ImageAnalyser from './ImageAnalyser.jsx'
import { imagesApi, recommendApi } from '../api/plants.js'
import { getWateringStatus, getAdjustedWaterAmount } from '../utils/watering.js'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'

// Derive rooms from configured floors
function getRoomsFromFloors(floors) {
  const rooms = []
  for (const floor of (floors || [])) {
    for (const room of (floor.rooms || [])) {
      if (room.name && !rooms.includes(room.name)) rooms.push(room.name)
    }
  }
  return rooms.length > 0 ? rooms : ['Living Room', 'Kitchen', 'Bedroom', 'Other']
}
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
const SUN_EXPOSURE_OPTIONS = [
  { value: 'full-sun', label: 'Full Sun' },
  { value: 'part-sun', label: 'Part Sun' },
  { value: 'shade', label: 'Shade' },
]
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function today() { return new Date().toISOString().split('T')[0] }

export default function PlantModal({ plant, position, floors, activeFloorId, weather, onSave, onDelete, onWater, onClose }) {
  const isEditing = !!plant
  const [mode, setMode] = useState(() => (plant ? 'edit' : null))
  const [activeTab, setActiveTab] = useState('edit')

  const [form, setForm] = useState({
    name: '', species: '', room: getRoomsFromFloors(floors)[0] || '', floor: activeFloorId ?? 'ground',
    lastWatered: today(), frequencyDays: 7, notes: '',
    imageFile: null, imageUrl: null, health: null, healthReason: null,
    maturity: null, potSize: null, recommendations: [],
    waterAmount: null, waterMethod: null,
    irrigationDuration: null, irrigationSchedule: null,
    sunExposure: null, sunHoursPerDay: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [careData, setCareData] = useState(() => plant?.careRecommendations || null)
  const [careLoading, setCareLoading] = useState(false)
  const [careError, setCareError] = useState(null)

  useEffect(() => {
    if (plant) {
      setForm({
        name: plant.name || '', species: plant.species || '', room: plant.room || 'Living Room',
        floor: plant.floor ?? activeFloorId ?? 'ground',
        lastWatered: plant.lastWatered ? plant.lastWatered.split('T')[0] : today(),
        frequencyDays: plant.frequencyDays ?? 7, notes: plant.notes || '',
        imageFile: null, imageUrl: plant.imageUrl || null,
        health: plant.health || null, healthReason: plant.healthReason || null,
        maturity: plant.maturity || null, potSize: plant.potSize || null,
        recommendations: plant.recommendations || [],
        waterAmount: plant.waterAmount || null, waterMethod: plant.waterMethod || null,
        irrigationDuration: plant.irrigationDuration || null,
        irrigationSchedule: plant.irrigationSchedule || null,
        sunExposure: plant.sunExposure || null,
        sunHoursPerDay: plant.sunHoursPerDay ?? null,
      })
    }
  }, [plant, activeFloorId])

  const update = useCallback((key, value) => setForm((prev) => ({ ...prev, [key]: value })), [])

  const handleAnalysisComplete = useCallback((result) => {
    setForm((prev) => {
      const species = result.species || prev.species
      // Auto-generate name: short species name + room
      const shortSpecies = species ? species.split('(')[0].split(',')[0].trim() : ''
      const autoName = (!prev.name || prev.name === '') && shortSpecies
        ? `${shortSpecies} - ${prev.room}`
        : prev.name
      return {
        ...prev,
        ...(result.species ? { species: result.species } : {}),
        ...(result.frequencyDays ? { frequencyDays: Math.min(30, Math.max(1, Number(result.frequencyDays))) } : {}),
        name: autoName,
        health: result.health, healthReason: result.healthReason,
        maturity: result.maturity, recommendations: result.recommendations || [],
        ...(result.waterAmount ? { waterAmount: result.waterAmount } : {}),
        ...(result.waterMethod ? { waterMethod: result.waterMethod } : {}),
      }
    })
  }, [])

  const handleImageChange = useCallback((file) => setForm((prev) => ({ ...prev, imageFile: file, imageUrl: null })), [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSaving(true)
    let imageUrl = form.imageUrl
    if (form.imageFile) {
      try { imageUrl = await imagesApi.upload(form.imageFile, 'plants') }
      catch { setIsSaving(false); return }
    }
    onSave({
      name: form.name.trim(), species: form.species.trim(), room: form.room, floor: form.floor,
      lastWatered: new Date(form.lastWatered).toISOString(), frequencyDays: Number(form.frequencyDays),
      notes: form.notes.trim(), imageUrl, health: form.health, healthReason: form.healthReason,
      maturity: form.maturity, potSize: form.potSize, recommendations: form.recommendations,
      waterAmount: form.waterAmount, waterMethod: form.waterMethod,
      irrigationDuration: form.irrigationDuration ? Number(form.irrigationDuration) : null,
      irrigationSchedule: form.irrigationSchedule,
      sunExposure: form.sunExposure,
      sunHoursPerDay: form.sunHoursPerDay ? Number(form.sunHoursPerDay) : null,
    })
    setIsSaving(false)
  }, [form, onSave])

  const handleDelete = useCallback(() => {
    if (confirmDelete) { onDelete(plant.id); setConfirmDelete(false) }
    else setConfirmDelete(true)
  }, [confirmDelete, plant, onDelete])

  const handleGetRecommendations = useCallback(async () => {
    setCareLoading(true); setCareError(null)
    try {
      const data = await recommendApi.get(form.name, form.species)
      setCareData(data)
      // Save recommendations to the plant so they persist
      if (plant && onSave) {
        onSave({ ...form, lastWatered: new Date(form.lastWatered).toISOString(), frequencyDays: Number(form.frequencyDays), careRecommendations: data })
      }
    }
    catch (err) { setCareError(err.message) }
    finally { setCareLoading(false) }
  }, [form, plant, onSave])

  const wateringStatus = useMemo(() => plant ? getWateringStatus(plant, weather, floors) : null, [plant, weather, floors])

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="d-flex align-items-center gap-2 fs-6">
          <svg className="sa-icon text-primary"><use href="/icons/sprite.svg#feather"></use></svg>
          {isEditing ? plant.name : 'Add Plant'}
          {wateringStatus && (
            <Badge bg={wateringStatus.daysUntil < 0 ? 'danger' : wateringStatus.daysUntil === 0 ? 'warning' : wateringStatus.daysUntil <= 2 ? 'info' : 'success'}>
              {wateringStatus.label}
            </Badge>
          )}
        </Modal.Title>
      </Modal.Header>

      {/* Mode choice for new plants */}
      {!isEditing && mode === null && (
        <Modal.Body className="d-flex flex-column gap-3 py-5 px-4">
          <p className="text-muted text-center mb-2">How would you like to add it?</p>
          <button type="button" className="card border w-100 text-start" onClick={() => setMode('photo')}>
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                <svg className="sa-icon text-primary sa-icon-2x"><use href="/icons/sprite.svg#camera"></use></svg>
              </div>
              <div>
                <h6 className="mb-0 fw-500">Analyse with AI</h6>
                <small className="text-muted">Take or upload a photo — Gemini identifies the plant automatically</small>
              </div>
            </div>
          </button>
          <button type="button" className="card border w-100 text-start" onClick={() => setMode('manual')}>
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                <svg className="sa-icon text-secondary sa-icon-2x"><use href="/icons/sprite.svg#clipboard"></use></svg>
              </div>
              <div>
                <h6 className="mb-0 fw-500">Enter manually</h6>
                <small className="text-muted">Fill in the plant name and care details yourself</small>
              </div>
            </div>
          </button>
        </Modal.Body>
      )}

      {/* Tab nav for editing */}
      {isEditing && (
        <Nav variant="tabs" className="px-3 pt-2">
          {[{ id: 'edit', label: 'Edit Plant' }, { id: 'watering', label: 'Watering' }, { id: 'care', label: 'Care' }].map((tab) => (
            <Nav.Item key={tab.id}>
              <Nav.Link active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      )}

      {/* Edit form */}
      {mode !== null && (!isEditing || activeTab === 'edit') && (
        <Modal.Body as="form" onSubmit={handleSubmit}>
          {!isEditing && mode === 'photo' && (
            <>
              <ImageAnalyser initialImage={form.imageUrl} onAnalysisComplete={handleAnalysisComplete} onImageChange={handleImageChange} />
              <hr />
            </>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Plant Name *</Form.Label>
            <Form.Control type="text" placeholder="e.g. Living Room Fern" value={form.name}
              onChange={(e) => update('name', e.target.value)} onBlur={() => setNameTouched(true)}
              isInvalid={nameTouched && !form.name.trim()} required />
            <Form.Control.Feedback type="invalid">Plant name is required</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Species</Form.Label>
            <Form.Control type="text" placeholder="e.g. Nephrolepis exaltata" value={form.species}
              onChange={(e) => update('species', e.target.value)} />
          </Form.Group>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Floor</Form.Label>
                <Form.Select value={form.floor} onChange={(e) => update('floor', e.target.value)}>
                  {(floors ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Room / Zone</Form.Label>
                <Form.Select value={form.room} onChange={(e) => update('room', e.target.value)}>
                  {getRoomsFromFloors(floors).map((r) => <option key={r} value={r}>{r}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Last Watered</Form.Label>
                <Form.Control type="date" value={form.lastWatered} max={today()} onChange={(e) => update('lastWatered', e.target.value)} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Frequency: {form.frequencyDays}d</Form.Label>
                <Form.Range min={1} max={30} value={form.frequencyDays} onChange={(e) => update('frequencyDays', e.target.value)} className="mt-2" />
                <div className="d-flex justify-content-between fs-xs text-muted"><span>1d</span><span>30d</span></div>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Health</Form.Label>
                <Form.Select value={form.health || ''} onChange={(e) => update('health', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {HEALTH_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Maturity</Form.Label>
                <Form.Select value={form.maturity || ''} onChange={(e) => update('maturity', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {MATURITY_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Sun Exposure</Form.Label>
                <Form.Select value={form.sunExposure || ''} onChange={(e) => update('sunExposure', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {SUN_EXPOSURE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Sun Hours / Day{form.sunHoursPerDay ? `: ${form.sunHoursPerDay}h` : ''}</Form.Label>
                <Form.Range min={0} max={16} value={form.sunHoursPerDay || 0} onChange={(e) => update('sunHoursPerDay', Number(e.target.value) || null)} className="mt-2" />
                <div className="d-flex justify-content-between fs-xs text-muted"><span>0h</span><span>16h</span></div>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Watering Method</Form.Label>
                <Form.Select value={form.waterMethod || ''} onChange={(e) => update('waterMethod', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {WATER_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Water Amount</Form.Label>
                <Form.Control type="text" placeholder="e.g. 250ml, 1L, 2 cups" value={form.waterAmount || ''} onChange={(e) => update('waterAmount', e.target.value || null)} />
              </Form.Group>
            </Col>
          </Row>
          {(form.waterMethod === 'hose' || form.waterMethod === 'irrigation') && (
            <Row className="mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Duration (min)</Form.Label>
                  <Form.Control type="number" min={1} max={120} placeholder="15" value={form.irrigationDuration || ''} onChange={(e) => update('irrigationDuration', e.target.value || null)} />
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Schedule</Form.Label>
                  <div className="d-flex gap-1 flex-wrap mb-1">
                    {DAYS_OF_WEEK.map((day) => {
                      const schedule = form.irrigationSchedule || ''
                      const days = schedule.split(' ')[0]?.split(',') || []
                      const isSelected = days.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => {
                            const time = schedule.split(' ')[1] || '06:00'
                            const newDays = isSelected ? days.filter((d) => d !== day) : [...days, day]
                            update('irrigationSchedule', newDays.length ? `${newDays.join(',')} ${time}` : null)
                          }}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  <Form.Control
                    type="time"
                    size="sm"
                    value={(form.irrigationSchedule || '').split(' ')[1] || '06:00'}
                    onChange={(e) => {
                      const days = (form.irrigationSchedule || '').split(' ')[0] || ''
                      update('irrigationSchedule', days ? `${days} ${e.target.value}` : null)
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control as="textarea" rows={3} placeholder="Any special care instructions..." value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </Form.Group>
          {isEditing && (
            <>
              <hr />
              <ImageAnalyser initialImage={form.imageUrl} onAnalysisComplete={handleAnalysisComplete} onImageChange={handleImageChange} />
            </>
          )}
        </Modal.Body>
      )}

      {/* Watering tab */}
      {isEditing && activeTab === 'watering' && (
        <Modal.Body>
          {(plant.waterMethod || plant.waterAmount) && (() => {
            const adjusted = getAdjustedWaterAmount(plant, weather, floors)
            return (
              <div className="mb-3 p-2 rounded bg-body-tertiary fs-sm">
                <div className="d-flex align-items-center gap-3">
                  {plant.waterMethod && (
                    <span className="d-flex align-items-center gap-1">
                      <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                      <strong>{WATER_METHODS.find((m) => m.value === plant.waterMethod)?.label || plant.waterMethod}</strong>
                    </span>
                  )}
                  {adjusted.amount && (
                    <span className={adjusted.adjusted ? 'fw-bold text-primary' : ''}>
                      {adjusted.amount}
                      {adjusted.adjusted && plant.waterAmount && adjusted.amount !== 'Skip' && (
                        <small className="text-muted ms-1" style={{ textDecoration: 'line-through' }}>{plant.waterAmount}</small>
                      )}
                    </span>
                  )}
                  {plant.irrigationDuration && <span>{plant.irrigationDuration} min</span>}
                  {plant.irrigationSchedule && <span className="text-muted">{plant.irrigationSchedule}</span>}
                </div>
                {adjusted.reason && (
                  <small className="text-primary d-block mt-1">
                    <svg className="sa-icon me-1" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#info"></use></svg>
                    {adjusted.reason}
                  </small>
                )}
              </div>
            )
          })()}
          {onWater && (
            <Button variant="info" className="w-100 mb-3" onClick={() => onWater(plant.id)}>
              <svg className="sa-icon me-2"><use href="/icons/sprite.svg#droplet"></use></svg>
              Mark as Watered
            </Button>
          )}
          {plant.wateringLog?.length > 0 ? (
            <div>
              <h6 className="text-muted text-uppercase fs-xs fw-600 mb-3">Watering History</h6>
              {[...plant.wateringLog].reverse().map((entry, i) => (
                <div key={i} className="d-flex align-items-center gap-2 mb-2 fs-sm text-muted">
                  <svg className="sa-icon text-info" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                  {new Date(entry.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="text-muted">{new Date(entry.date).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</span>
                  {entry.note && <span>— {entry.note}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-center py-4">No watering history yet.</p>
          )}
        </Modal.Body>
      )}

      {/* Care tab */}
      {isEditing && activeTab === 'care' && (
        <Modal.Body>
          <div className="d-flex justify-content-end mb-3">
            <Button variant="outline-success" size="sm" onClick={handleGetRecommendations} disabled={careLoading}>
              {careLoading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
              {careLoading ? 'Loading...' : careData ? 'Refresh' : 'Get Recommendations'}
            </Button>
          </div>
          {careError && <p className="text-danger text-center fs-sm">{careError}</p>}
          {careData && (
            <div>
              {careData.summary && <p className="mb-3">{careData.summary}</p>}
              <Row>
                {[
                  { label: 'Watering', value: careData.watering },
                  { label: 'Light', value: careData.light },
                  { label: 'Humidity', value: careData.humidity },
                  { label: 'Soil', value: careData.soil },
                  { label: 'Temperature', value: careData.temperature },
                  { label: 'Fertilising', value: careData.fertilising },
                ].map(({ label, value }) => value && (
                  <Col md={6} key={label} className="mb-3">
                    <h6 className="text-muted text-uppercase fs-xs fw-600">{label}</h6>
                    <p className="fs-sm text-muted mb-0">{value}</p>
                  </Col>
                ))}
              </Row>
              {careData.tips?.length > 0 && (
                <div className="mt-2">
                  <h6 className="text-muted text-uppercase fs-xs fw-600">Tips</h6>
                  <ul className="list-unstyled">
                    {careData.tips.map((tip, i) => (
                      <li key={i} className="d-flex gap-2 fs-sm text-muted mb-1">
                        <span className="text-success">•</span>{tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10, borderRadius: 'inherit' }}>
          <div className="card shadow-lg mx-4" style={{ maxWidth: 320 }}>
            <div className="card-body p-4">
              <p className="fw-500 mb-1">Delete {plant?.name || 'this plant'}?</p>
              <p className="text-muted fs-sm mb-3">This cannot be undone.</p>
              <div className="d-flex gap-2 justify-content-end">
                <Button variant="light" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button variant="danger" onClick={handleDelete}>
                  <svg className="sa-icon me-1"><use href="/icons/sprite.svg#trash-2"></use></svg>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Modal.Footer>
        {isEditing && (
          <Button variant="outline-danger" className="me-auto" onClick={() => setConfirmDelete(true)}>
            <svg className="sa-icon me-1"><use href="/icons/sprite.svg#trash-2"></use></svg>
            Delete
          </Button>
        )}
        <Button variant="light" onClick={onClose}>Cancel</Button>
        {mode !== null && (!isEditing || activeTab === 'edit') && (
          <Button variant="primary" onClick={handleSubmit} disabled={!form.name.trim() || isSaving}>
            {isSaving ? <Spinner size="sm" className="me-2" /> : <svg className="sa-icon me-1"><use href="/icons/sprite.svg#save"></use></svg>}
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Plant'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
