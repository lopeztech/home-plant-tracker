import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react'
import { Modal, Button, Form, Nav, Tab, Badge, Spinner, Row, Col, Pagination } from 'react-bootstrap'
import ImageAnalyser from './ImageAnalyser.jsx'
import { imagesApi, recommendApi, plantsApi, analyseApi } from '../api/plants.js'
import { getWateringStatus, getAdjustedWaterAmount, isOutdoor, getMoistureDisplay } from '../utils/watering.js'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'
import { derivePlantName } from '../utils/plantName.js'
import { PlantContext } from '../context/PlantContext.jsx'

// Max recommendation entries retained per plant. Older entries are trimmed
// when a new one is appended so Firestore docs don't grow unbounded.
const RECOMMENDATION_HISTORY_LIMIT = 20

// Render common low-level errors as friendly text; otherwise pass through.
function friendlyErrorMessage(err) {
  const raw = err?.message || String(err || '')
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  if (/position \d+/i.test(raw) && /object key|expected/i.test(raw)) {
    return 'The AI gave an unexpected response. Please try again in a moment.'
  }
  return raw || 'Something went wrong. Please try again.'
}

function formatRecDate(iso) {
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
  } catch { return iso }
}

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
      // Run upload and AI analysis in parallel for speed
      const uploadPromise = imagesApi.upload(file, 'plants')
      const analysisPromise = analyseApi.analyse(file).catch(() => null)
      const [imageUrl, analysis] = await Promise.all([uploadPromise, analysisPromise])
      await plantsApi.update(plantId, { imageUrl })
      if (analysis) onComplete?.(analysis)
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

export default function PlantModal({ plant, position, floors, activeFloorId, weather, onSave, onDelete, onWater, onMoisture, onClose }) {
  const isEditing = !!plant
  const [mode, setMode] = useState(() => (plant ? 'edit' : null))
  const [activeTab, setActiveTab] = useState('edit')

  const [form, setForm] = useState({
    species: '', room: getRoomAtPosition(floors, activeFloorId, position) || getRoomsFromFloors(floors)[0] || '', floor: activeFloorId ?? 'ground',
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
  const careHistoryInitial = plant?.careRecommendationHistory || []
  const wateringHistoryInitial = plant?.wateringRecommendationHistory || []
  const [careHistory, setCareHistory] = useState(careHistoryInitial)
  const [careData, setCareData] = useState(
    () => careHistoryInitial[careHistoryInitial.length - 1]?.data || plant?.careRecommendations || null,
  )
  const [careLoading, setCareLoading] = useState(false)
  const [careError, setCareError] = useState(null)
  const [showCareHistory, setShowCareHistory] = useState(false)
  const [wateringHistory, setWateringHistory] = useState(wateringHistoryInitial)
  const [wateringRec, setWateringRec] = useState(
    () => wateringHistoryInitial[wateringHistoryInitial.length - 1]?.data || null,
  )
  const [wateringRecLoading, setWateringRecLoading] = useState(false)
  const [wateringRecError, setWateringRecError] = useState(null)
  const [showWateringHistory, setShowWateringHistory] = useState(false)
  const [deletedPhotoUrls, setDeletedPhotoUrls] = useState([])
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const [moistureReading, setMoistureReading] = useState(5)
  const [moistureLogging, setMoistureLogging] = useState(false)
  const [moisturePage, setMoisturePage] = useState(1)
  const [wateringPage, setWateringPage] = useState(1)

  // Optional: when rendered inside the app PlantProvider we can update the
  // in-memory plants list so history persists across modal reopens without a
  // page refresh. Tests render PlantModal without a provider, so this is
  // intentionally undefined-safe.
  const plantCtx = useContext(PlantContext)
  const updatePlantsLocally = plantCtx?.updatePlantsLocally
  const contextIsGuest = plantCtx?.isGuest ?? false

  // Persist recommendation history on the plant doc. Guest plants stay local
  // (their IDs aren't in Firestore). Failures are swallowed — the UI already
  // shows the latest entry and will re-sync on next load.
  const persistHistory = useCallback(async (field, history) => {
    if (!plant?.id) return
    if (updatePlantsLocally) updatePlantsLocally({ [plant.id]: { [field]: history } })
    const looksLikeGuest = contextIsGuest || String(plant.id).startsWith('guest-')
    if (looksLikeGuest) return
    try { await plantsApi.update(plant.id, { [field]: history }) }
    catch (err) { console.warn('Failed to persist recommendation history:', err) }
  }, [plant, updatePlantsLocally, contextIsGuest])

  useEffect(() => {
    const ch = plant?.careRecommendationHistory || []
    const wh = plant?.wateringRecommendationHistory || []
    setCareHistory(ch)
    setWateringHistory(wh)
    setCareData(ch[ch.length - 1]?.data || plant?.careRecommendations || null)
    setWateringRec(wh[wh.length - 1]?.data || null)
    setShowCareHistory(false)
    setShowWateringHistory(false)
    setCareError(null)
    setWateringRecError(null)
  }, [plant?.id])

  useEffect(() => {
    if (plant) {
      setForm({
        species: plant.species || '', room: plant.room || 'Living Room',
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

  // Frequency, watering method, and water amount are no longer user-editable —
  // they mirror whatever the latest AI watering recommendation produced, so
  // sync the form whenever a new wateringRec lands (from a fresh fetch or
  // from the last history entry on load).
  useEffect(() => {
    if (!wateringRec) return
    setForm((prev) => ({
      ...prev,
      ...(wateringRec.recommendedFrequencyDays
        ? { frequencyDays: Math.min(30, Math.max(1, Number(wateringRec.recommendedFrequencyDays))) }
        : {}),
      ...(wateringRec.method ? { waterMethod: wateringRec.method } : {}),
      ...(wateringRec.amount ? { waterAmount: wateringRec.amount } : {}),
    }))
  }, [wateringRec])

  const handleAnalysisComplete = useCallback((result) => {
    setForm((prev) => ({
      ...prev,
      ...(result.species ? { species: result.species } : {}),
      ...(result.frequencyDays ? { frequencyDays: Math.min(30, Math.max(1, Number(result.frequencyDays))) } : {}),
      health: result.health, healthReason: result.healthReason,
      maturity: result.maturity, recommendations: result.recommendations || [],
      ...(result.waterAmount ? { waterAmount: result.waterAmount } : {}),
      ...(result.waterMethod ? { waterMethod: result.waterMethod } : {}),
      ...(result.potSize ? { potSize: result.potSize } : {}),
      ...(result.soilType ? { soilType: result.soilType } : {}),
    }))
  }, [])

  const handleImageChange = useCallback((file) => setForm((prev) => ({ ...prev, imageFile: file, imageUrl: null })), [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!form.species.trim()) return
    setIsSaving(true)
    let imageUrl = form.imageUrl
    if (form.imageFile) {
      try { imageUrl = await imagesApi.upload(form.imageFile, 'plants') }
      catch { setIsSaving(false); return }
    }
    const species = form.species.trim()
    await onSave({
      name: derivePlantName({ species, room: form.room }),
      species, room: form.room, floor: form.floor,
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

  const handleDeletePhoto = useCallback(async (url) => {
    setDeletingPhoto(true)
    try {
      await plantsApi.deletePhoto(plant.id, url)
      setDeletedPhotoUrls((prev) => [...prev, url.split('?')[0]])
    } catch (err) { console.error('Photo delete failed:', err) }
    finally { setDeletingPhoto(false); setConfirmDeletePhoto(null) }
  }, [plant])

  const wateringStatus = useMemo(() => plant ? getWateringStatus(plant, weather, floors) : null, [plant, weather, floors])

  // Pulled from context when available; falls back to props-only so tests
  // without a PlantProvider still work.
  const ctxLocation = plantCtx?.location || null
  const ctxTempUnit = plantCtx?.tempUnit?.unit || null

  const handleGetRecommendations = useCallback(async () => {
    setCareLoading(true); setCareError(null)
    try {
      const outdoor = plant ? isOutdoor(plant, floors) : false
      const derivedName = derivePlantName({ species: form.species, room: form.room })
      const data = await recommendApi.get(derivedName, form.species, {
        plantedIn: form.plantedIn, isOutdoor: outdoor,
        location: ctxLocation, tempUnit: ctxTempUnit,
      })
      setCareData(data)
      const next = [...careHistory, { date: new Date().toISOString(), data }].slice(-RECOMMENDATION_HISTORY_LIMIT)
      setCareHistory(next)
      persistHistory('careRecommendationHistory', next)
    }
    catch (err) { setCareError(friendlyErrorMessage(err)) }
    finally { setCareLoading(false) }
  }, [form, plant, floors, careHistory, persistHistory, ctxLocation, ctxTempUnit])

  const handleGetWateringRec = useCallback(async () => {
    setWateringRecLoading(true); setWateringRecError(null)
    try {
      const outdoor = plant ? isOutdoor(plant, floors) : false
      const data = await recommendApi.getWatering({
        name: derivePlantName({ species: form.species, room: form.room }), species: form.species,
        plantedIn: form.plantedIn, isOutdoor: outdoor,
        potSize: form.plantedIn === 'pot' ? form.potSize : null,
        potMaterial: form.plantedIn === 'pot' ? form.potMaterial : null,
        soilType: form.plantedIn === 'pot' ? form.soilType : null,
        sunExposure: form.sunExposure, health: form.health,
        maturity: form.maturity,
        season: wateringStatus?.season || null,
        temperature: weather?.current?.temp || null,
        location: ctxLocation, tempUnit: ctxTempUnit,
      })
      setWateringRec(data)
      const next = [...wateringHistory, { date: new Date().toISOString(), data }].slice(-RECOMMENDATION_HISTORY_LIMIT)
      setWateringHistory(next)
      persistHistory('wateringRecommendationHistory', next)
    }
    catch (err) { setWateringRecError(friendlyErrorMessage(err)) }
    finally { setWateringRecLoading(false) }
  }, [form, plant, floors, wateringStatus, wateringHistory, persistHistory, ctxLocation, ctxTempUnit, weather])

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="d-flex align-items-center gap-2 fs-6">
          <svg className="sa-icon text-primary"><use href="/icons/sprite.svg#feather"></use></svg>
          {isEditing ? (plant.name || derivePlantName(plant)) : 'Add Plant'}
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
                <small className="text-muted">Fill in the species and care details yourself</small>
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
            <Form.Label>Species *</Form.Label>
            <Form.Control type="text" placeholder="e.g. Nephrolepis exaltata" value={form.species}
              onChange={(e) => update('species', e.target.value)} required />
            <Form.Text className="text-muted">
              Display name will be {form.species ? <strong>{derivePlantName({ species: form.species, room: form.room })}</strong> : 'derived from species + room'}
            </Form.Text>
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
          {/* Primary action: fetch an AI watering recommendation. Frequency,
              method, and amount below all derive from its response. */}
          <div className="mb-3">
            <Button variant="success" size="sm" onClick={handleGetWateringRec} disabled={wateringRecLoading}>
              {wateringRecLoading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
              {wateringRecLoading ? 'Loading...' : wateringRec ? 'Refresh Watering Recommendation' : 'Get Watering Recommendation'}
            </Button>
          </div>
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
          {/* Frequency, Watering Method, Water Amount are driven entirely by
              the AI watering recommendation above — shown as wrapping text
              (not inputs) so long guidance isn't truncated. */}
          {(() => {
            const frequencyText = form.frequencyDays
              ? `${form.frequencyDays} day${Number(form.frequencyDays) === 1 ? '' : 's'}`
              : null
            const methodText = WATER_METHODS.find((m) => m.value === form.waterMethod)?.label || form.waterMethod || null
            const amountText = form.waterAmount || null
            const empty = !frequencyText && !methodText && !amountText
            if (empty) {
              return (
                <p className="text-muted fs-sm mb-3">
                  Click <strong>Get Watering Recommendation</strong> to fill in frequency, method, and amount.
                </p>
              )
            }
            return (
              <Row className="mb-3 g-3">
                <Col md={4}>
                  <h6 className="text-muted text-uppercase fs-xs fw-600 mb-1">Frequency</h6>
                  <p className="mb-0">{frequencyText || <span className="text-muted">—</span>}</p>
                </Col>
                <Col md={4}>
                  <h6 className="text-muted text-uppercase fs-xs fw-600 mb-1">Watering Method</h6>
                  <p className="mb-0" style={{ wordBreak: 'break-word' }}>
                    {methodText || <span className="text-muted">—</span>}
                  </p>
                </Col>
                <Col md={4}>
                  <h6 className="text-muted text-uppercase fs-xs fw-600 mb-1">Water Amount</h6>
                  <p className="mb-0" style={{ wordBreak: 'break-word' }}>
                    {amountText || <span className="text-muted">—</span>}
                  </p>
                </Col>
              </Row>
            )
          })()}
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
              </div>
            )}
            {wateringHistory.length > 1 && (
              <div className="mt-2">
                <Button variant="link" size="sm" className="p-0 fs-xs" onClick={() => setShowWateringHistory((v) => !v)}>
                  {showWateringHistory ? 'Hide' : 'Show'} previous recommendations ({wateringHistory.length - 1})
                </Button>
                {showWateringHistory && (
                  <div className="mt-2 ps-2 border-start">
                    {[...wateringHistory].slice(0, -1).reverse().map((entry, i) => (
                      <div key={entry.date + i} className="mb-2 pb-2 border-bottom">
                        <div className="fs-xs text-muted fw-500 mb-1">{formatRecDate(entry.date)}</div>
                        {entry.data?.summary && <p className="fs-xs mb-1">{entry.data.summary}</p>}
                        <div className="fs-xs text-muted">
                          {entry.data?.frequency && <span className="me-2"><strong>Freq:</strong> {entry.data.frequency}</span>}
                          {entry.data?.amount && <span className="me-2"><strong>Amount:</strong> {entry.data.amount}</span>}
                          {entry.data?.method && <span className="me-2"><strong>Method:</strong> {entry.data.method}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Moisture meter reading */}
          <div className="mb-3">
            <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Moisture Meter</h6>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="fs-xs text-muted" style={{ width: 28 }}>Dry</span>
              <Form.Range
                min={1} max={10} value={moistureReading}
                onChange={(e) => setMoistureReading(Number(e.target.value))}
                className="flex-grow-1"
                style={{
                  accentColor: moistureReading <= 3 ? '#d97706' : moistureReading <= 6 ? '#22c55e' : '#3b82f6',
                }}
              />
              <span className="fs-xs text-muted" style={{ width: 28 }}>Wet</span>
              <Badge bg={moistureReading <= 3 ? 'warning' : moistureReading <= 6 ? 'success' : 'primary'} className="fs-sm" style={{ minWidth: 32 }}>
                {moistureReading}
              </Badge>
              <Button
                variant="outline-success" size="sm" disabled={moistureLogging}
                onClick={async () => {
                  setMoistureLogging(true)
                  try {
                    await onMoisture(plant.id, moistureReading, '')
                  } catch (err) { console.error('Moisture log failed:', err) }
                  finally { setMoistureLogging(false) }
                }}
              >
                {moistureLogging ? <Spinner size="sm" /> : 'Log'}
              </Button>
            </div>
            {plant.moistureLog?.length > 0 && (() => {
              const reversed = [...plant.moistureLog].reverse()
              const totalPages = Math.ceil(reversed.length / 5)
              const page = Math.min(moisturePage, totalPages)
              const paged = reversed.slice((page - 1) * 5, page * 5)
              const latest = reversed[0]
              const latestDisplay = getMoistureDisplay(latest.reading)
              const ago = Math.round((Date.now() - new Date(latest.date).getTime()) / 3600000)
              const agoLabel = ago < 1 ? 'just now' : ago < 24 ? `${ago}h ago` : `${Math.round(ago / 24)}d ago`
              return (
                <div className="mt-2">
                  {page === 1 && (
                    <div className="d-flex align-items-center gap-2 mb-2 fs-sm">
                      <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: latestDisplay.color }} />
                      <span>Last: <strong>{latest.reading}/10</strong> ({latestDisplay.label})</span>
                      <span className="text-muted">— {agoLabel}</span>
                    </div>
                  )}
                  {paged.map((entry, i) => {
                    const d = getMoistureDisplay(entry.reading)
                    return (
                      <div key={i} className="d-flex align-items-center gap-2 mb-1 fs-xs text-muted">
                        <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: d.color }} />
                        <span><strong>{entry.reading}/10</strong></span>
                        <span>{new Date(entry.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
                        <span>{new Date(entry.date).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</span>
                        {entry.note && <span>— {entry.note}</span>}
                      </div>
                    )
                  })}
                  {totalPages > 1 && (
                    <Pagination size="sm" className="mt-2 mb-0 justify-content-center">
                      <Pagination.Prev disabled={page <= 1} onClick={() => setMoisturePage(page - 1)} />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item key={i + 1} active={i + 1 === page} onClick={() => setMoisturePage(i + 1)}>{i + 1}</Pagination.Item>
                      ))}
                      <Pagination.Next disabled={page >= totalPages} onClick={() => setMoisturePage(page + 1)} />
                    </Pagination>
                  )}
                </div>
              )
            })()}
          </div>
          <div>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="text-muted text-uppercase fs-xs fw-600 mb-0">Watering History</h6>
              {onWater && (
                <Button variant="outline-info" size="sm" onClick={() => onWater(plant.id)}>
                  <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                  Mark as Watered
                </Button>
              )}
            </div>
            {plant.wateringLog?.length > 0 ? (() => {
              const reversed = [...plant.wateringLog].reverse()
              const totalPages = Math.ceil(reversed.length / 5)
              const page = Math.min(wateringPage, totalPages)
              const paged = reversed.slice((page - 1) * 5, page * 5)
              return (
                <>
                  {paged.map((entry, i) => (
                    <div key={i} className="d-flex align-items-center gap-2 mb-2 fs-sm text-muted">
                      <svg className="sa-icon text-info" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                      {new Date(entry.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <span className="text-muted">{new Date(entry.date).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</span>
                      {entry.note && <span>— {entry.note}</span>}
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <Pagination size="sm" className="mt-2 mb-0 justify-content-center">
                      <Pagination.Prev disabled={page <= 1} onClick={() => setWateringPage(page - 1)} />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item key={i + 1} active={i + 1 === page} onClick={() => setWateringPage(i + 1)}>{i + 1}</Pagination.Item>
                      ))}
                      <Pagination.Next disabled={page >= totalPages} onClick={() => setWateringPage(page + 1)} />
                    </Pagination>
                  )}
                </>
              )
            })() : (
              <p className="text-muted text-center py-4 mb-0">No watering history yet.</p>
            )}
          </div>
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
            let photos = [...(plant.photoLog || [])]
              .filter((p) => !deletedPhotoUrls.includes(p.url?.split('?')[0]))
              .sort((a, b) => new Date(b.date) - new Date(a.date))

            // Fallback: if no photoLog but imageUrl exists, show it
            if (photos.length === 0 && plant.imageUrl) {
              photos = [{ url: plant.imageUrl, date: plant.createdAt || plant.updatedAt, type: 'growth', analysis: null }]
            }

            if (photos.length === 0) return null

            return (
              <>
                <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Photo History ({photos.length})</h6>
                <Row className="g-2 mb-3">
                  {photos.map((photo, i) => (
                    <Col xs={6} md={4} key={photo.url || i}>
                      <div className="border rounded overflow-hidden position-relative" style={{ minHeight: 120 }}>
                        <img src={photo.url} alt={`Photo ${i + 1}`} className="w-100"
                          style={{ height: 120, objectFit: 'cover', display: 'block' }}
                          onError={(e) => { e.target.style.display = 'none' }} />
                        <Button variant="dark" size="sm"
                          className="position-absolute top-0 end-0 m-1 rounded-circle p-0"
                          style={{ width: 22, height: 22, opacity: 0.8 }}
                          disabled={deletingPhoto}
                          onClick={() => setConfirmDeletePhoto(photo.url)}
                          title="Delete photo">
                          <svg className="sa-icon" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#trash-2"></use></svg>
                        </Button>
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

                {/* Photo delete confirmation */}
                {confirmDeletePhoto && (
                  <div className="alert alert-warning py-2 d-flex align-items-center justify-content-between">
                    <small>Delete this photo? This cannot be undone.</small>
                    <div className="d-flex gap-1">
                      <Button variant="light" size="sm" onClick={() => setConfirmDeletePhoto(null)} disabled={deletingPhoto}>Cancel</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeletePhoto(confirmDeletePhoto)} disabled={deletingPhoto}>
                        {deletingPhoto ? <Spinner size="sm" /> : 'Delete'}
                      </Button>
                    </div>
                  </div>
                )}
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
          {careHistory.length > 1 && (
            <div className="mt-3">
              <Button variant="link" size="sm" className="p-0 fs-xs" onClick={() => setShowCareHistory((v) => !v)}>
                {showCareHistory ? 'Hide' : 'Show'} previous recommendations ({careHistory.length - 1})
              </Button>
              {showCareHistory && (
                <div className="mt-2 ps-2 border-start">
                  {[...careHistory].slice(0, -1).reverse().map((entry, i) => (
                    <div key={entry.date + i} className="mb-3 pb-2 border-bottom">
                      <div className="fs-xs text-muted fw-500 mb-1">{formatRecDate(entry.date)}</div>
                      {entry.data?.summary && <p className="fs-xs mb-1">{entry.data.summary}</p>}
                      <div className="fs-xs text-muted">
                        {entry.data?.watering && <div><strong>Watering:</strong> {entry.data.watering}</div>}
                        {entry.data?.light && <div><strong>Light:</strong> {entry.data.light}</div>}
                        {entry.data?.humidity && <div><strong>Humidity:</strong> {entry.data.humidity}</div>}
                      </div>
                    </div>
                  ))}
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
          <Button variant="primary" onClick={handleSubmit} disabled={!form.species.trim() || isSaving}>
            {isSaving ? <Spinner size="sm" className="me-2" /> : <svg className="sa-icon me-1"><use href="/icons/sprite.svg#save"></use></svg>}
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Plant'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
