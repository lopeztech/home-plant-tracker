import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal, Button, Form, Nav, Tab, Badge, Spinner, Row, Col } from 'react-bootstrap'
import ImageAnalyser from './ImageAnalyser.jsx'
import { imagesApi, recommendApi, plantsApi } from '../api/plants.js'
import { getWateringStatus, getAdjustedWaterAmount, getSuggestedFrequency, isOutdoor } from '../utils/watering.js'
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

// Determine which room contains a given (x, y) position on the floor
function getRoomAtPosition(floors, floorId, position) {
  if (!position || !floorId) return null
  const floor = (floors || []).find((f) => f.id === floorId)
  if (!floor?.rooms?.length) return null
  for (const room of floor.rooms) {
    if (room.hidden || !room.name) continue
    if (
      position.x >= room.x && position.x <= room.x + room.width &&
      position.y >= room.y && position.y <= room.y + room.height
    ) {
      return room.name
    }
  }
  return null
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
const POT_MATERIAL_OPTIONS = [
  { value: 'terracotta', label: 'Terracotta / Clay' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'ceramic', label: 'Ceramic / Glazed' },
  { value: 'fabric', label: 'Fabric / Grow Bag' },
  { value: 'metal', label: 'Metal' },
]
const PLANTED_IN_OPTIONS = [
  { value: 'ground', label: 'In the Ground' },
  { value: 'garden-bed', label: 'Garden Bed' },
  { value: 'pot', label: 'Pot' },
]
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function today() { return new Date().toISOString().split('T')[0] }

function GrowthUpload({ plantId, onComplete }) {
  const [uploading, setUploading] = useState(false)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)

  const handleFile = async (file) => {
    if (!file?.type.startsWith('image/')) return
    setUploading(true)
    try {
      const imageUrl = await imagesApi.upload(file, 'plants')
      await plantsApi.update(plantId, { imageUrl })
      try {
        const analysis = await (await import('../api/plants.js')).analyseApi.analyse(file)
        onComplete?.(analysis)
      } catch { /* analysis optional */ }
    } catch (err) { console.error('Growth upload failed:', err) }
    finally { setUploading(false) }
  }

  const onFileChange = (e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }

  return (
    <div className="d-flex gap-1">
      <Button variant="outline-success" size="sm" onClick={() => galleryRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#image"></use></svg>}
        {uploading ? 'Recording...' : 'Photo Gallery'}
      </Button>
      <Button variant="outline-success" size="sm" onClick={() => cameraRef.current?.click()} disabled={uploading}>
        <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#camera"></use></svg>
        Take Photo
      </Button>
      <input ref={galleryRef} type="file" accept="image/*" className="d-none" onChange={onFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="d-none" onChange={onFileChange} />
    </div>
  )
}

function DiagnosticUpload({ plantId, onComplete }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const handleFile = async (file) => {
    if (!file?.type.startsWith('image/')) return
    setUploading(true); setError(null); setResult(null)
    try {
      const data = await plantsApi.diagnostic(plantId, file)
      setResult(data)
      onComplete?.(data)
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  return (
    <div>
      <Button variant="outline-warning" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#search"></use></svg>}
        {uploading ? 'Analysing...' : 'Diagnose Issue'}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="d-none"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />

      {error && <p className="text-danger fs-xs mt-2">{error}</p>}

      {result?.analysis && (
        <div className="mt-2 p-2 rounded border bg-body-tertiary">
          <div className="d-flex align-items-center gap-2 mb-1">
            <Badge bg={result.analysis.severity === 'severe' ? 'danger' : result.analysis.severity === 'moderate' ? 'warning' : 'info'}>
              {result.analysis.severity}
            </Badge>
            <strong className="fs-sm">{result.analysis.issue}</strong>
          </div>
          <p className="fs-xs text-muted mb-1"><strong>Cause:</strong> {result.analysis.cause}</p>
          <p className="fs-xs text-muted mb-1"><strong>Treatment:</strong> {result.analysis.treatment}</p>
          {result.analysis.preventionTips?.length > 0 && (
            <ul className="list-unstyled mb-0">
              {result.analysis.preventionTips.map((tip, i) => (
                <li key={i} className="fs-xs text-muted">• {tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlantModal({ plant, position, floors, activeFloorId, weather, onSave, onDelete, onWater, onClose }) {
  const isEditing = !!plant
  const [mode, setMode] = useState(() => (plant ? 'edit' : null))
  const [activeTab, setActiveTab] = useState('edit')

  const [form, setForm] = useState({
    name: '', species: '', room: getRoomAtPosition(floors, activeFloorId, position) || getRoomsFromFloors(floors)[0] || '', floor: activeFloorId ?? 'ground',
    lastWatered: today(), frequencyDays: 7, notes: '',
    imageFile: null, imageUrl: null, health: null, healthReason: null,
    maturity: null, recommendations: [],
    waterAmount: null, waterMethod: null,
    irrigationDuration: null, irrigationSchedule: null,
    sunExposure: null, sunHoursPerDay: null,
    potSize: null, soilType: null, potMaterial: null,
    plantedIn: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [careData, setCareData] = useState(() => plant?.careRecommendations || null)
  const [careLoading, setCareLoading] = useState(false)
  const [careError, setCareError] = useState(null)
  const [wateringRec, setWateringRec] = useState(null)
  const [wateringRecLoading, setWateringRecLoading] = useState(false)
  const [wateringRecError, setWateringRecError] = useState(null)

  useEffect(() => {
    if (plant) {
      setForm({
        name: plant.name || '', species: plant.species || '', room: plant.room || 'Living Room',
        floor: plant.floor ?? activeFloorId ?? 'ground',
        lastWatered: plant.lastWatered ? plant.lastWatered.split('T')[0] : today(),
        frequencyDays: plant.frequencyDays ?? 7, notes: plant.notes || '',
        imageFile: null, imageUrl: plant.imageUrl || null,
        health: plant.health || null, healthReason: plant.healthReason || null,
        maturity: plant.maturity || null,
        recommendations: plant.recommendations || [],
        waterAmount: plant.waterAmount || null, waterMethod: plant.waterMethod || null,
        irrigationDuration: plant.irrigationDuration || null,
        irrigationSchedule: plant.irrigationSchedule || null,
        sunExposure: plant.sunExposure || null,
        sunHoursPerDay: plant.sunHoursPerDay ?? null,
        potSize: plant.potSize || null,
        soilType: plant.soilType || null,
        potMaterial: plant.potMaterial || null,
        plantedIn: plant.plantedIn || null,
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
        ...(result.potSize ? { potSize: result.potSize } : {}),
        ...(result.soilType ? { soilType: result.soilType } : {}),
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
    await onSave({
      name: form.name.trim(), species: form.species.trim(), room: form.room, floor: form.floor,
      lastWatered: new Date(form.lastWatered).toISOString(), frequencyDays: Number(form.frequencyDays),
      notes: form.notes.trim(), imageUrl, health: form.health, healthReason: form.healthReason,
      maturity: form.maturity, recommendations: form.recommendations,
      waterAmount: form.waterAmount, waterMethod: form.waterMethod,
      irrigationDuration: form.irrigationDuration ? Number(form.irrigationDuration) : null,
      irrigationSchedule: form.irrigationSchedule,
      sunExposure: form.sunExposure,
      sunHoursPerDay: form.sunHoursPerDay ? Number(form.sunHoursPerDay) : null,
      potSize: form.plantedIn === 'pot' ? form.potSize : null,
      soilType: form.plantedIn === 'pot' ? form.soilType : null,
      potMaterial: form.plantedIn === 'pot' ? form.potMaterial : null,
      plantedIn: form.plantedIn,
    })
    setIsSaving(false)
  }, [form, onSave])

  const handleDelete = useCallback(() => {
    if (confirmDelete) { onDelete(plant.id); setConfirmDelete(false) }
    else setConfirmDelete(true)
  }, [confirmDelete, plant, onDelete])

  const wateringStatus = useMemo(() => plant ? getWateringStatus(plant, weather, floors) : null, [plant, weather, floors])

  const handleGetRecommendations = useCallback(async () => {
    setCareLoading(true); setCareError(null)
    try {
      const outdoor = plant ? isOutdoor(plant, floors) : false
      const data = await recommendApi.get(form.name, form.species, { plantedIn: form.plantedIn, isOutdoor: outdoor })
      setCareData(data)
    }
    catch (err) { setCareError(err.message) }
    finally { setCareLoading(false) }
  }, [form, plant, floors])

  const handleGetWateringRec = useCallback(async () => {
    setWateringRecLoading(true); setWateringRecError(null)
    try {
      const outdoor = plant ? isOutdoor(plant, floors) : false
      const data = await recommendApi.getWatering({
        name: form.name, species: form.species,
        plantedIn: form.plantedIn, isOutdoor: outdoor,
        potSize: form.plantedIn === 'pot' ? form.potSize : null,
        potMaterial: form.plantedIn === 'pot' ? form.potMaterial : null,
        soilType: form.plantedIn === 'pot' ? form.soilType : null,
        sunExposure: form.sunExposure, health: form.health,
        maturity: form.maturity,
        season: wateringStatus?.season || null,
        temperature: weather?.current?.temp || null,
      })
      setWateringRec(data)
    }
    catch (err) { setWateringRecError(err.message) }
    finally { setWateringRecLoading(false) }
  }, [form, plant, floors, wateringStatus])

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
          {[{ id: 'edit', label: 'Plant' }, { id: 'watering', label: 'Watering' }, { id: 'care', label: 'Care' }, { id: 'recommendations', label: 'Recommendations' }].map((tab) => (
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
          <Form.Group className="mb-3">
            <Form.Label>Planted In</Form.Label>
            <Form.Select value={form.plantedIn || ''} onChange={(e) => update('plantedIn', e.target.value || null)}>
              <option value="">— Select —</option>
              {PLANTED_IN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Form.Select>
          </Form.Group>
          {form.plantedIn === 'pot' && (
            <>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Pot Size</Form.Label>
                    <Form.Select value={form.potSize || ''} onChange={(e) => update('potSize', e.target.value || null)}>
                      <option value="">— Select —</option>
                      {POT_SIZE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Soil Type</Form.Label>
                    <Form.Select value={form.soilType || ''} onChange={(e) => update('soilType', e.target.value || null)}>
                      <option value="">— Select —</option>
                      {SOIL_TYPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Pot Material</Form.Label>
                <Form.Select value={form.potMaterial || ''} onChange={(e) => update('potMaterial', e.target.value || null)}>
                  <option value="">— Select —</option>
                  {POT_MATERIAL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
      )}

      {/* Watering tab */}
      {isEditing && activeTab === 'watering' && (
        <Modal.Body>
          {wateringStatus?.seasonNote && (
            <div className="mb-3 p-2 rounded border fs-sm d-flex align-items-center gap-2" style={{ borderColor: '#60a5fa', background: 'rgba(96,165,250,0.08)' }}>
              <svg className="sa-icon text-info" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#sun"></use></svg>
              <span>{wateringStatus.seasonNote}</span>
            </div>
          )}
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
          {/* Adaptive frequency suggestion */}
          {(() => {
            const suggestion = plant ? getSuggestedFrequency(plant) : null
            if (!suggestion || suggestion.suggestedDays === Number(form.frequencyDays)) return null
            return (
              <div className="mb-3 p-2 rounded border border-info bg-body-tertiary fs-sm">
                <div className="d-flex align-items-center gap-2">
                  <svg className="sa-icon text-info" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#trending-up"></use></svg>
                  <span>{suggestion.reason}</span>
                </div>
                <Button variant="outline-info" size="sm" className="mt-2" onClick={() => update('frequencyDays', suggestion.suggestedDays)}>
                  Update to {suggestion.suggestedDays}d
                </Button>
              </div>
            )
          })()}
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
          {/* Suggested water amount */}
          {plant.waterAmount && (() => {
            const adjusted = getAdjustedWaterAmount(plant, weather, floors)
            return (
              <div className="d-flex align-items-center gap-2 mb-3 p-2 rounded bg-body-tertiary fs-sm">
                <svg className="sa-icon text-info" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                <span>Suggested: <strong className={adjusted.adjusted ? 'text-primary' : ''}>{adjusted.amount}</strong></span>
                {adjusted.adjusted && <small className="text-muted">({adjusted.reason})</small>}
                {!adjusted.adjusted && <small className="text-muted">(base amount)</small>}
              </div>
            )
          })()}
          <div className="d-flex justify-content-center gap-2 mb-3">
            {onWater && (
              <Button variant="outline-info" size="sm" onClick={() => onWater(plant.id)}>
                <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                Mark as Watered
              </Button>
            )}
            <Button variant="outline-success" size="sm" onClick={handleGetWateringRec} disabled={wateringRecLoading}>
              {wateringRecLoading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
              {wateringRecLoading ? 'Loading...' : wateringRec ? 'Refresh' : 'Get Watering Recommendation'}
            </Button>
          </div>
          <div className="mb-3">
            {wateringRecError && <p className="text-danger fs-sm">{wateringRecError}</p>}
            {wateringRec && (
              <div className="p-2 rounded border bg-body-tertiary fs-sm">
                <p className="mb-2 fw-500">{wateringRec.summary}</p>
                <Row>
                  {[
                    { label: 'Amount', value: wateringRec.amount, icon: 'droplet' },
                    { label: 'Frequency', value: wateringRec.frequency, icon: 'clock' },
                    { label: 'Method', value: wateringRec.method, icon: 'tool' },
                    { label: 'Seasonal Tips', value: wateringRec.seasonalTips, icon: 'sun' },
                  ].map(({ label, value, icon }) => value && (
                    <Col md={6} key={label} className="mb-2">
                      <div className="d-flex align-items-start gap-1">
                        <svg className="sa-icon text-info mt-1" style={{ width: 12, height: 12 }}><use href={`/icons/sprite.svg#${icon}`}></use></svg>
                        <div>
                          <strong className="text-uppercase fs-xs">{label}</strong>
                          <p className="text-muted mb-0 fs-xs">{value}</p>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
                {wateringRec.signs && (
                  <div className="mt-2 pt-2 border-top">
                    <strong className="text-uppercase fs-xs">Signs to Watch</strong>
                    <p className="text-muted mb-0 fs-xs">{wateringRec.signs}</p>
                  </div>
                )}
                {wateringRec.recommendedFrequencyDays && wateringRec.recommendedFrequencyDays !== Number(form.frequencyDays) && (
                  <div className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between">
                    <span className="fs-xs">
                      AI recommends watering every <strong>{wateringRec.recommendedFrequencyDays}d</strong>
                      {form.frequencyDays ? <span className="text-muted"> (currently {form.frequencyDays}d)</span> : null}
                    </span>
                    <Button variant="outline-primary" size="sm" className="ms-2" onClick={() => update('frequencyDays', wateringRec.recommendedFrequencyDays)}>
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
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

      {/* Care tab — consolidated: health, maturity, notes, photos, recommendations */}
      {isEditing && activeTab === 'care' && (
        <Modal.Body>
          {/* Health & Maturity (read-only, updated by AI) */}
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="text-muted fs-xs">Health</Form.Label>
                <div className="fw-500">{form.health || <span className="text-muted">—</span>}</div>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="text-muted fs-xs">Maturity</Form.Label>
                <div className="fw-500">{form.maturity || <span className="text-muted">—</span>}</div>
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <small className="text-muted fs-xs">Updated automatically from photo analysis</small>
            </Col>
          </Row>

          <hr />

          {/* Take a photo — Record Growth or Diagnose */}
          <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Take a Photo</h6>
          <div className="d-flex gap-2 mb-3">
            <GrowthUpload plantId={plant.id} onComplete={(result) => {
              if (result?.maturity) update('maturity', result.maturity)
              if (result?.health) update('health', result.health)
            }} />
            <DiagnosticUpload plantId={plant.id} onComplete={(result) => {
              if (result?.analysis?.severity === 'severe') update('health', 'Poor')
              else if (result?.analysis?.severity === 'moderate') update('health', 'Fair')
            }} />
          </div>

          {/* Photo timeline */}
          {(() => {
            const photos = [...(plant.photoLog || [])].sort((a, b) => new Date(b.date) - new Date(a.date))

            if (photos.length === 0) return null

            return (
              <>
                <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Photo History ({photos.length})</h6>
                <Row className="g-2 mb-3">
                  {photos.map((photo, i) => (
                    <Col xs={6} md={4} key={i}>
                      <div className="border rounded overflow-hidden position-relative" style={{ minHeight: 120 }}>
                        <img src={photo.url} alt={`Photo ${i + 1}`} className="w-100"
                          style={{ height: 120, objectFit: 'cover', display: 'block' }}
                          onError={(e) => { e.target.style.display = 'none' }} />
                        <div className="position-absolute bottom-0 start-0 end-0 px-2 py-1" style={{ background: 'rgba(0,0,0,0.6)' }}>
                          <div className="d-flex align-items-center justify-content-between">
                            <small className="text-white" style={{ fontSize: '0.6rem' }}>
                              {new Date(photo.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                            </small>
                            <Badge bg={photo.type === 'diagnostic' ? 'warning' : 'success'} style={{ fontSize: '0.5rem' }}>
                              {photo.type === 'diagnostic' ? 'Diagnostic' : 'Growth'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {photo.type === 'diagnostic' && photo.analysis && (
                        <div className="border border-top-0 rounded-bottom px-2 py-1 bg-body-tertiary">
                          <small className="fw-500 d-block">{photo.analysis.issue}</small>
                        </div>
                      )}
                    </Col>
                  ))}
                </Row>
              </>
            )
          })()}

        </Modal.Body>
      )}

      {/* Recommendations tab */}
      {isEditing && activeTab === 'recommendations' && (
        <Modal.Body>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="text-muted text-uppercase fs-xs fw-600 mb-0">AI Care Recommendations</h6>
            <Button variant="outline-success" size="sm" onClick={handleGetRecommendations} disabled={careLoading}>
              {careLoading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
              {careLoading ? 'Loading...' : careData ? 'Refresh' : 'Get Recommendations'}
            </Button>
          </div>
          {careError && <p className="text-danger text-center fs-sm">{careError}</p>}
          {careData && (
            <div>
              {careData.summary && <p className="fs-sm mb-2">{careData.summary}</p>}
              <Row>
                {[
                  { label: 'Watering', value: careData.watering },
                  { label: 'Light', value: careData.light },
                  { label: 'Humidity', value: careData.humidity },
                  { label: 'Soil', value: careData.soil },
                  { label: 'Temperature', value: careData.temperature },
                  { label: 'Fertilising', value: careData.fertilising },
                ].map(({ label, value }) => value && (
                  <Col md={6} key={label} className="mb-2">
                    <h6 className="text-muted text-uppercase fs-xs fw-600">{label}</h6>
                    <p className="fs-xs text-muted mb-0">{value}</p>
                  </Col>
                ))}
              </Row>
              {careData.commonIssues?.length > 0 && (
                <>
                  <h6 className="text-muted text-uppercase fs-xs fw-600 mt-2">Common Issues</h6>
                  <ul className="list-unstyled">
                    {careData.commonIssues.map((issue, i) => (
                      <li key={i} className="d-flex gap-2 fs-xs text-muted mb-1">
                        <span className="text-warning">•</span>{issue}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {careData.tips?.length > 0 && (
                <>
                  <h6 className="text-muted text-uppercase fs-xs fw-600">Tips</h6>
                  <ul className="list-unstyled">
                    {careData.tips.map((tip, i) => (
                      <li key={i} className="d-flex gap-2 fs-xs text-muted mb-1">
                        <span className="text-success">•</span>{tip}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {!careData && !careLoading && !careError && (
            <p className="text-muted text-center py-4">Click "Get Recommendations" for AI-powered care advice tailored to your plant.</p>
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
