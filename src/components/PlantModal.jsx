import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react'
import { Link } from 'react-router'
import { Modal, Button, Form, Badge, Spinner, Row, Col, Pagination, Accordion } from 'react-bootstrap'
import ImageAnalyser from './ImageAnalyser.jsx'
import PlantQRTag from './PlantQRTag.jsx'
import WateringSheet from './WateringSheet.jsx'
import SoilTab from './SoilTab.jsx'
import LifecycleTab from './LifecycleTab.jsx'
import BloomTab from './BloomTab.jsx'
import { imagesApi, recommendApi, plantsApi, analyseApi, measurementsApi, phenologyApi, journalApi, harvestApi, wildlifeApi, incidentApi, dormancyApi } from '../api/plants.js'
import PlantIdentify from './PlantIdentify.jsx'
import Chart from 'react-apexcharts'
import { getWateringStatus, getAdjustedWaterAmount, isOutdoor, getMoistureDisplay } from '../utils/watering.js'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'
import { derivePlantName } from '../utils/plantName.js'
import { getPlantEmoji, PLANT_EMOJI_GROUPS } from '../utils/plantEmoji.js'
import { PlantContext } from '../context/PlantContext.jsx'
import { POT_SIZES, formatLength } from '../utils/units.js'
import { friendlyErrorMessage } from '../utils/errorMessages.js'
import { formatDate, formatTime } from '../utils/format.js'

// Max recommendation entries retained per plant. Older entries are trimmed
// when a new one is appended so Firestore docs don't grow unbounded.
const RECOMMENDATION_HISTORY_LIMIT = 20

function formatRecDate(iso) {
  try {
    return `${formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' })} · ${formatTime(iso)}`
  } catch { return iso }
}

// Human-readable "X ago" for a recommendation's age. Full timestamp is
// exposed separately via formatRecDate() for title tooltips.
function formatRelativeAge(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  const y = Math.floor(mo / 12)
  return `${y}y ago`
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
// POT_SIZE_OPTIONS is derived at render time from POT_SIZES[unitSystem]
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

const SPECIES_MAX_LENGTH = 80

function validateSpecies(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Species is required.'
  if (trimmed.length > SPECIES_MAX_LENGTH) {
    return `Species must be at most ${SPECIES_MAX_LENGTH} characters (currently ${trimmed.length}).`
  }
  return null
}

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

const SEVERITY_VARIANT = { severe: 'danger', moderate: 'warning', mild: 'info' }
const URGENCY_VARIANT  = { today: 'danger', 'this-week': 'warning', ongoing: 'secondary' }

function DiagnosticUpload({ plantId, plant, onComplete }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [checkedSteps, setCheckedSteps] = useState({})
  const fileRef = useRef(null)

  const isEdible = plant?.category === 'edible'
  const contextTags = [
    ...(isEdible ? ['edible'] : []),
    ...(plant?.plantedIn === 'ground' || plant?.plantedIn === 'garden-bed' ? ['outdoor'] : []),
  ]

  const handleFile = async (file) => {
    if (!file?.type.startsWith('image/')) return
    setUploading(true); setError(null); setResult(null); setCheckedSteps({})
    try {
      const data = await plantsApi.diagnostic(plantId, file, { contextTags })
      setResult(data)
      onComplete?.(data)
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  const toggleStep = (i) => setCheckedSteps(prev => ({ ...prev, [i]: !prev[i] }))

  const analysis = result?.analysis
  const topDiagnosis = analysis?.diagnoses?.[0]

  return (
    <div>
      <Button variant="outline-warning" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#search"></use></svg>}
        {uploading ? 'Analysing…' : 'Diagnose Issue'}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="d-none"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />

      {error && <p className="text-danger fs-xs mt-2">{error}</p>}

      {analysis && (
        <div className="mt-2 rounded border bg-body-tertiary">
          {/* Diagnoses list */}
          <div className="p-2 border-bottom">
            <p className="fw-semibold fs-xs text-muted mb-1 text-uppercase">Diagnoses</p>
            {analysis.diagnoses?.map((dx, i) => (
              <div key={i} className="d-flex align-items-start gap-2 mb-1">
                <Badge bg={SEVERITY_VARIANT[dx.severity] || 'secondary'} className="mt-1 flex-shrink-0">{dx.severity}</Badge>
                <div>
                  <span className="fs-sm fw-semibold">{dx.name}</span>
                  <span className="fs-xs text-muted ms-1">({Math.round(dx.confidence * 100)}% confidence)</span>
                  {dx.evidence?.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {dx.evidence.map((e, j) => <Badge key={j} bg="light" text="dark" className="fw-normal">{e}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Treatment checklist */}
          {analysis.treatments?.length > 0 && (
            <div className="p-2 border-bottom">
              <p className="fw-semibold fs-xs text-muted mb-1 text-uppercase">Treatment plan</p>
              {analysis.treatments.map((t, i) => (
                <div key={i} className="d-flex align-items-start gap-2 mb-1">
                  <Form.Check type="checkbox" id={`treatment-${plantId}-${i}`} checked={!!checkedSteps[i]}
                    onChange={() => toggleStep(i)} className="flex-shrink-0 mt-1" />
                  <div className={checkedSteps[i] ? 'text-decoration-line-through text-muted' : ''}>
                    <span className="fs-xs">{t.action}</span>
                    <div className="d-flex gap-1 mt-1">
                      <Badge bg={URGENCY_VARIANT[t.urgency] || 'secondary'} className="fw-normal">{t.urgency}</Badge>
                      {isEdible && <Badge bg={t.safeForEdibles ? 'success' : 'danger'} className="fw-normal">{t.safeForEdibles ? 'food-safe' : 'not edible-safe'}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preventive care */}
          {analysis.preventiveCare?.length > 0 && (
            <div className="p-2 border-bottom">
              <p className="fw-semibold fs-xs text-muted mb-1 text-uppercase">Preventive care</p>
              {analysis.preventiveCare.map((tip, i) => <p key={i} className="fs-xs text-muted mb-0">• {tip}</p>)}
            </div>
          )}

          {/* Escalation */}
          {analysis.escalation?.consultExpert && (
            <div className="p-2">
              <Badge bg="danger" className="me-1">Expert advice recommended</Badge>
              {analysis.escalation.urgentFlags?.map((f, i) => <span key={i} className="fs-xs text-danger ms-1">{f}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlantModal({ plant, position, floors, activeFloorId, weather, onSave, onDelete, onWater, onMoisture, onClose, embedded = false, initialTab, onTabChange, onDirtyChange }) {
  const isEditing = !!plant
  const [mode, setMode] = useState(() => (plant ? 'edit' : null))
  const [activeTab, setActiveTabInternal] = useState(initialTab || 'edit')
  const setActiveTab = useCallback((next) => {
    setActiveTabInternal((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      if (value !== prev) onTabChange?.(value)
      return value
    })
  }, [onTabChange])

  // Sync incoming initialTab changes (e.g. URL hash navigation) into local state.
  useEffect(() => {
    if (!initialTab) return
    setActiveTabInternal((prev) => (prev === initialTab ? prev : initialTab))
  }, [initialTab])

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
    emoji: null,
    category: null,
    isUnderCover: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showWateringSheet, setShowWateringSheet] = useState(false)
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

  // Dormancy state (#307)
  const [dormancyLoading, setDormancyLoading] = useState(false)
  const [dormancyError, setDormancyError] = useState(null)
  const [currentPhase, setCurrentPhase] = useState(plant?.currentPhase || 'active-growth')

  // Plant identify modal (#294)
  const [showIdentify, setShowIdentify] = useState(false)

  // Growth tab state
  const [measurements, setMeasurements] = useState(plant?.measurements || [])
  const [phenologyEvents, setPhenologyEvents] = useState(plant?.phenologyEvents || [])
  const [newMeasurement, setNewMeasurement] = useState({ height_cm: '', width_cm: '', leafCount: '', stemCount: '', notes: '' })
  const [newPhenology, setNewPhenology] = useState({ event: '', date: new Date().toISOString().slice(0, 10), notes: '' })
  const [measurementSaving, setMeasurementSaving] = useState(false)
  const [measurementError, setMeasurementError] = useState(null)
  const [phenologySaving, setPhenologySaving] = useState(false)
  // #303 — growth-shot comparison state
  const [compareA, setCompareA] = useState(null)
  const [compareB, setCompareB] = useState(null)
  const [compareSlider, setCompareSlider] = useState(50)

  // Journal tab state
  const [journalEntries, setJournalEntries] = useState(
    () => [...(plant?.journalEntries || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
  )
  const [newJournalBody, setNewJournalBody] = useState('')
  const [newJournalMood, setNewJournalMood] = useState('')
  const [newJournalTags, setNewJournalTags] = useState([])
  const [journalSaving, setJournalSaving] = useState(false)
  const [journalError, setJournalError] = useState(null)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [editingBody, setEditingBody] = useState('')

  // Harvest tab state
  const [harvestEntries, setHarvestEntries] = useState(
    () => [...(plant?.harvestLog || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
  )
  const [newHarvest, setNewHarvest] = useState({ date: new Date().toISOString().slice(0, 10), quantity: '', unit: 'kg', quality: '', notes: '' })
  const [harvestSaving, setHarvestSaving] = useState(false)
  const [harvestError, setHarvestError] = useState(null)

  // Wildlife tab state
  const [wildlifeEntries, setWildlifeEntries] = useState(
    () => [...(plant?.wildlifeObservationLog || [])].sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))
  )
  const [newWildlife, setNewWildlife] = useState({ observedAt: new Date().toISOString().slice(0, 10), category: 'bee', species: '', count: '', notes: '' })
  const [wildlifeSaving, setWildlifeSaving] = useState(false)
  const [wildlifeError, setWildlifeError] = useState(null)

  // Health tab state (incidents)
  const [incidents, setIncidents] = useState(
    () => [...(plant?.incidents || [])].sort((a, b) => new Date(b.firstObservedAt) - new Date(a.firstObservedAt))
  )
  const [newIncident, setNewIncident] = useState({ category: 'pest', specificType: '', severity: '', firstObservedAt: new Date().toISOString().slice(0, 10), notes: '' })
  const [incidentSaving, setIncidentSaving] = useState(false)
  const [incidentError, setIncidentError] = useState(null)
  const [treatmentInput, setTreatmentInput] = useState({})
  const [treatmentSaving, setTreatmentSaving] = useState({})

  // Validation + unsaved-change guard state. `isDirty` is set by user-initiated
  // edits only (not programmatic resyncs like the wateringRec effect).
  const [isDirty, setIsDirty] = useState(false)
  const [showUnsavedGuard, setShowUnsavedGuard] = useState(false)

  // Notify parent surfaces (e.g. PlantDetailPage) of dirty-state changes so they
  // can wire their own navigation guards (router blocker, beforeunload, etc.).
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  const [speciesError, setSpeciesError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const speciesInputRef = useRef(null)
  const errorSummaryRef = useRef(null)

  // Optional: when rendered inside the app PlantProvider we can update the
  // in-memory plants list so history persists across modal reopens without a
  // page refresh. Tests render PlantModal without a provider, so this is
  // intentionally undefined-safe.
  const plantCtx = useContext(PlantContext)
  const updatePlantsLocally = plantCtx?.updatePlantsLocally
  const contextIsGuest = plantCtx?.isGuest ?? false
  const unitSystem = plantCtx?.unitSystem?.system ?? 'metric'
  const potSizeOptions = POT_SIZES[unitSystem] ?? POT_SIZES.metric

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
        emoji: plant.emoji || null,
        category: plant.category || null,
        isUnderCover: plant.isUnderCover ?? false,
      })
    }
  }, [plant, activeFloorId])

  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }, [])

  // Mirror species validity whenever the field changes so the error clears as
  // soon as the user fixes it (no blur needed).
  useEffect(() => {
    if (submitAttempted || speciesError) setSpeciesError(validateSpecies(form.species))
  }, [form.species, submitAttempted, speciesError])

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
    setIsDirty(true)
  }, [])

  const handleImageChange = useCallback((file) => {
    setForm((prev) => ({ ...prev, imageFile: file, imageUrl: null }))
    setIsDirty(true)
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setSubmitAttempted(true)
    const err = validateSpecies(form.species)
    setSpeciesError(err)
    if (err) {
      // Scroll the error summary into view and return focus to the invalid
      // field so keyboard + screen-reader users can recover immediately.
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
        speciesInputRef.current?.focus?.()
      })
      return
    }
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
      emoji: form.emoji || null,
      category: form.category || null,
      isUnderCover: form.isUnderCover ?? false,
    })
    setIsDirty(false)
    setIsSaving(false)
  }, [form, onSave])

  // Unsaved-change guard. All close paths (X, Esc, backdrop, Cancel) route
  // through this so dirty edits aren't silently discarded. When embedded on a
  // page, the parent owns the guard via React Router's useBlocker, so we let
  // close paths through directly here.
  const handleClose = useCallback(() => {
    if (isDirty && !embedded) setShowUnsavedGuard(true)
    else onClose()
  }, [isDirty, embedded, onClose])

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedGuard(false)
    setIsDirty(false)
    onClose()
  }, [onClose])

  // Keyboard navigation between tabs (Left/Right, Home/End) per WAI-ARIA
  // Tabs Pattern.
  const isEdiblePlant = form.category === 'edible'

  const TABS = useMemo(
    () => [
      { id: 'edit', label: 'Plant' },
      { id: 'watering', label: 'Watering' },
      { id: 'care', label: 'Care' },
      { id: 'growth', label: 'Growth' },
      { id: 'journal', label: 'Journal' },
      ...(isEditing ? [{ id: 'blooms', label: 'Blooms' }] : []),
      ...(isEditing ? [{ id: 'lifecycle', label: 'Lifecycle' }] : []),
      ...(isEditing ? [{ id: 'soil', label: 'Soil' }] : []),
      ...(isEdiblePlant ? [{ id: 'harvest', label: 'Harvest' }] : []),
      ...(isEditing ? [{ id: 'health', label: 'Health' }] : []),
      ...(isEditing ? [{ id: 'wildlife', label: 'Wildlife' }] : []),
    ],
    [isEdiblePlant, isEditing],
  )

  const handleDormancyEnter = useCallback(async () => {
    setDormancyLoading(true); setDormancyError(null)
    try {
      await dormancyApi.enter(plant.id)
      setCurrentPhase('dormant')
    } catch (err) {
      setDormancyError(friendlyErrorMessage(err, { context: 'entering dormancy' }))
    } finally { setDormancyLoading(false) }
  }, [plant])

  const handleDormancyExit = useCallback(async () => {
    setDormancyLoading(true); setDormancyError(null)
    try {
      await dormancyApi.exit(plant.id)
      setCurrentPhase('active-growth')
    } catch (err) {
      setDormancyError(friendlyErrorMessage(err, { context: 'exiting dormancy' }))
    } finally { setDormancyLoading(false) }
  }, [plant])

  const handleIdentified = useCallback((candidate) => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || candidate.commonName,
      species: candidate.scientificName,
      frequencyDays: candidate.careDefaults?.frequencyDays ?? prev.frequencyDays,
      soilType: candidate.careDefaults?.soilType ?? prev.soilType,
      potSize: candidate.careDefaults?.potSize ?? prev.potSize,
      sunExposure: candidate.careDefaults?.sunExposure ?? prev.sunExposure,
    }))
  }, [])

  const handleTabKeyDown = useCallback((e, index) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveTab(TABS[(index + 1) % TABS.length].id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveTab(TABS[(index - 1 + TABS.length) % TABS.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveTab(TABS[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveTab(TABS[TABS.length - 1].id)
    }
  }, [TABS])

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

  const handleAddMeasurement = useCallback(async () => {
    const { height_cm, width_cm, leafCount, stemCount, notes } = newMeasurement
    const payload = {}
    const inToCm = unitSystem === 'imperial' ? (v) => parseFloat((v * 2.54).toFixed(1)) : (v) => v
    if (height_cm !== '') payload.height_cm = inToCm(Number(height_cm))
    if (width_cm  !== '') payload.width_cm  = inToCm(Number(width_cm))
    if (leafCount  !== '') payload.leafCount  = Number(leafCount)
    if (stemCount  !== '') payload.stemCount  = Number(stemCount)
    if (Object.keys(payload).length === 0) {
      setMeasurementError('Enter at least one measurement value (height, width, leaf count, or stem count).')
      return
    }
    setMeasurementSaving(true)
    setMeasurementError(null)
    try {
      const entry = await measurementsApi.add(plant.id, { ...payload, notes })
      setMeasurements(prev => [...prev, entry])
      setNewMeasurement({ height_cm: '', width_cm: '', leafCount: '', stemCount: '', notes: '' })
    } catch (err) {
      setMeasurementError(friendlyErrorMessage(err))
    } finally {
      setMeasurementSaving(false)
    }
  }, [newMeasurement, plant])

  const handleDeleteMeasurement = useCallback(async (measurementId) => {
    try {
      await measurementsApi.delete(plant.id, measurementId)
      setMeasurements(prev => prev.filter(m => m.id !== measurementId))
    } catch (err) { console.error('Delete measurement failed:', err) }
  }, [plant])

  const handleAddPhenology = useCallback(async () => {
    if (!newPhenology.event) return
    setPhenologySaving(true)
    try {
      const entry = await phenologyApi.add(plant.id, newPhenology)
      setPhenologyEvents(prev => [...prev, entry])
      setNewPhenology({ event: '', date: new Date().toISOString().slice(0, 10), notes: '' })
    } catch (err) { console.error('Add phenology event failed:', err) }
    finally { setPhenologySaving(false) }
  }, [newPhenology, plant])

  const handleDeletePhenology = useCallback(async (eventId) => {
    try {
      await phenologyApi.delete(plant.id, eventId)
      setPhenologyEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (err) { console.error('Delete phenology event failed:', err) }
  }, [plant])

  const handleAddJournalEntry = useCallback(async () => {
    if (!newJournalBody.trim()) {
      setJournalError('Entry cannot be empty.')
      return
    }
    setJournalSaving(true)
    setJournalError(null)
    try {
      const entry = await journalApi.add(plant.id, {
        body: newJournalBody.trim(),
        mood: newJournalMood || undefined,
        tags: newJournalTags,
      })
      setJournalEntries(prev => [entry, ...prev])
      setNewJournalBody('')
      setNewJournalMood('')
      setNewJournalTags([])
    } catch (err) {
      setJournalError(friendlyErrorMessage(err))
    } finally {
      setJournalSaving(false)
    }
  }, [newJournalBody, newJournalMood, newJournalTags, plant])

  const handleDeleteJournalEntry = useCallback(async (entryId) => {
    try {
      await journalApi.delete(plant.id, entryId)
      setJournalEntries(prev => prev.filter(e => e.id !== entryId))
    } catch (err) { console.error('Delete journal entry failed:', err) }
  }, [plant])

  const handleSaveJournalEdit = useCallback(async (entryId) => {
    if (!editingBody.trim()) return
    try {
      const updated = await journalApi.update(plant.id, entryId, { body: editingBody.trim() })
      setJournalEntries(prev => prev.map(e => e.id === entryId ? updated : e))
      setEditingEntryId(null)
      setEditingBody('')
    } catch (err) { console.error('Update journal entry failed:', err) }
  }, [editingBody, plant])

  const handleAddHarvest = useCallback(async () => {
    const { date, quantity, unit, quality, notes } = newHarvest
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setHarvestError('Quantity must be a positive number.')
      return
    }
    setHarvestSaving(true)
    setHarvestError(null)
    try {
      const entry = await harvestApi.add(plant.id, {
        date, quantity: Number(quantity), unit,
        quality: quality ? Number(quality) : null,
        notes: notes.trim() || null,
      })
      setHarvestEntries(prev => [entry, ...prev])
      setNewHarvest({ date: new Date().toISOString().slice(0, 10), quantity: '', unit: 'kg', quality: '', notes: '' })
    } catch (err) {
      setHarvestError(friendlyErrorMessage(err))
    } finally {
      setHarvestSaving(false)
    }
  }, [newHarvest, plant])

  const handleDeleteHarvest = useCallback(async (harvestId) => {
    try {
      await harvestApi.delete(plant.id, harvestId)
      setHarvestEntries(prev => prev.filter(e => e.id !== harvestId))
    } catch (err) { console.error('Delete harvest entry failed:', err) }
  }, [plant])

  const handleAddWildlife = useCallback(async () => {
    setWildlifeSaving(true)
    setWildlifeError(null)
    try {
      const entry = await wildlifeApi.add(plant.id, {
        observedAt: newWildlife.observedAt,
        category: newWildlife.category,
        species: newWildlife.species.trim() || null,
        count: newWildlife.count ? Number(newWildlife.count) : null,
        notes: newWildlife.notes.trim() || null,
      })
      setWildlifeEntries(prev => [entry, ...prev])
      setNewWildlife({ observedAt: new Date().toISOString().slice(0, 10), category: 'bee', species: '', count: '', notes: '' })
    } catch (err) {
      setWildlifeError(friendlyErrorMessage(err))
    } finally {
      setWildlifeSaving(false)
    }
  }, [newWildlife, plant])

  const handleDeleteWildlife = useCallback(async (obsId) => {
    try {
      await wildlifeApi.delete(plant.id, obsId)
      setWildlifeEntries(prev => prev.filter(e => e.id !== obsId))
    } catch (err) { console.error('Delete wildlife observation failed:', err) }
  }, [plant])

  const handleAddIncident = useCallback(async () => {
    const { category, specificType, severity, firstObservedAt, notes } = newIncident
    if (!specificType.trim()) {
      setIncidentError('Specify the pest or disease type.')
      return
    }
    setIncidentSaving(true)
    setIncidentError(null)
    try {
      const entry = await incidentApi.add(plant.id, {
        category, specificType: specificType.trim(),
        severity: severity ? Number(severity) : null,
        firstObservedAt, notes: notes.trim() || null,
      })
      setIncidents(prev => [entry, ...prev])
      setNewIncident({ category: 'pest', specificType: '', severity: '', firstObservedAt: new Date().toISOString().slice(0, 10), notes: '' })
    } catch (err) {
      setIncidentError(friendlyErrorMessage(err))
    } finally {
      setIncidentSaving(false)
    }
  }, [newIncident, plant])

  const handleResolveIncident = useCallback(async (incidentId) => {
    try {
      const updated = await incidentApi.resolve(plant.id, incidentId)
      setIncidents(prev => prev.map(e => e.id === incidentId ? updated : e))
    } catch (err) { console.error('Resolve incident failed:', err) }
  }, [plant])

  const handleAddTreatment = useCallback(async (incidentId) => {
    const treatment = treatmentInput[incidentId] || ''
    if (!treatment.trim()) return
    setTreatmentSaving(prev => ({ ...prev, [incidentId]: true }))
    try {
      const entry = await incidentApi.addTreatment(plant.id, incidentId, { treatment: treatment.trim() })
      setIncidents(prev => prev.map(e => e.id === incidentId
        ? { ...e, treatments: [...(e.treatments || []), entry] }
        : e,
      ))
      setTreatmentInput(prev => ({ ...prev, [incidentId]: '' }))
    } catch (err) { console.error('Add treatment failed:', err) }
    finally { setTreatmentSaving(prev => ({ ...prev, [incidentId]: false })) }
  }, [plant, treatmentInput])

  const handleDeleteIncident = useCallback(async (incidentId) => {
    try {
      await incidentApi.delete(plant.id, incidentId)
      setIncidents(prev => prev.filter(e => e.id !== incidentId))
    } catch (err) { console.error('Delete incident failed:', err) }
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

  const headerNode = (
    <Modal.Header closeButton={!embedded} className="border-bottom">
      <Modal.Title id="plant-modal-title" className="d-flex align-items-center gap-2 fs-6">
        <svg className="sa-icon text-primary" aria-hidden="true"><use href="/icons/sprite.svg#feather"></use></svg>
        {isEditing ? (plant.name || derivePlantName(plant)) : 'Add Plant'}
        {wateringStatus && (
          <Badge bg={wateringStatus.daysUntil < 0 ? 'danger' : wateringStatus.daysUntil === 0 ? 'warning' : wateringStatus.daysUntil <= 2 ? 'info' : 'success'}>
            {wateringStatus.label}
          </Badge>
        )}
      </Modal.Title>
    </Modal.Header>
  )

  const innerContent = (
    <>
      {headerNode}

      {/* Mode choice for new plants */}
      {!isEditing && mode === null && (
        <Modal.Body className="d-flex flex-column gap-3 py-5 px-4">
          <p className="text-muted text-center mb-2">How would you like to add it?</p>

          {/* #294 — one-tap identification */}
          <button type="button" className="card border w-100 text-start" onClick={() => { setShowIdentify(true) }}>
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                <svg className="sa-icon text-success sa-icon-2x"><use href="/icons/sprite.svg#search"></use></svg>
              </div>
              <div>
                <h6 className="mb-0 fw-500">Identify from photo</h6>
                <small className="text-muted">One tap — AI identifies the species and pre-fills care defaults</small>
              </div>
            </div>
          </button>

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

      {/* Tab nav for editing — WAI-ARIA Tabs Pattern. Using native buttons
          (rather than Nav.Link) so aria-controls / aria-selected are preserved
          exactly as set; React-Bootstrap's Nav.Link filters them when it's not
          nested inside a Tab.Container. */}
      {isEditing && (
        <ul className="nav nav-tabs px-3 pt-2" role="tablist" aria-label="Plant sections">
          {TABS.map((tab, i) => {
            const selected = activeTab === tab.id
            return (
              <li key={tab.id} className="nav-item" role="presentation">
                <button
                  type="button"
                  role="tab"
                  id={`plant-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`plant-tabpanel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  className={`nav-link${selected ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, i)}
                >
                  {tab.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Edit form */}
      {mode !== null && (!isEditing || activeTab === 'edit') && (
        <Modal.Body
          as="form"
          onSubmit={handleSubmit}
          noValidate
          {...(isEditing
            ? { role: 'tabpanel', id: 'plant-tabpanel-edit', 'aria-labelledby': 'plant-tab-edit' }
            : {})}
        >
          {submitAttempted && speciesError && (
            <div
              ref={errorSummaryRef}
              role="alert"
              aria-live="assertive"
              className="alert alert-danger py-2 mb-3"
            >
              <strong className="d-block mb-1">Please fix the following before saving:</strong>
              <ul className="mb-0 ps-3">
                <li>
                  <a
                    href="#plant-species-input"
                    className="alert-link"
                    onClick={(e) => { e.preventDefault(); speciesInputRef.current?.focus() }}
                  >
                    {speciesError}
                  </a>
                </li>
              </ul>
            </div>
          )}
          {!isEditing && mode === 'photo' && (
            <>
              <ImageAnalyser initialImage={form.imageUrl} onAnalysisComplete={handleAnalysisComplete} onImageChange={handleImageChange} />
              <hr />
            </>
          )}
          <Accordion defaultActiveKey={isEditing ? ['identity'] : ['identity', 'environment']} alwaysOpen>
            <Accordion.Item eventKey="identity">
              <Accordion.Header>Identity</Accordion.Header>
              <Accordion.Body>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="plant-species-input">
                    Species <span aria-hidden="true">*</span>
                    <span className="visually-hidden"> (required)</span>
                  </Form.Label>
                  <Form.Control
                    id="plant-species-input"
                    ref={speciesInputRef}
                    type="text"
                    placeholder="e.g. Nephrolepis exaltata"
                    value={form.species}
                    onChange={(e) => update('species', e.target.value)}
                    onBlur={() => setSpeciesError(validateSpecies(form.species))}
                    aria-required="true"
                    aria-invalid={speciesError ? 'true' : 'false'}
                    aria-describedby={speciesError ? 'plant-species-error' : 'plant-species-help'}
                    isInvalid={!!speciesError}
                    maxLength={SPECIES_MAX_LENGTH + 20}
                  />
                  {speciesError ? (
                    <Form.Control.Feedback type="invalid" id="plant-species-error">
                      {speciesError}
                    </Form.Control.Feedback>
                  ) : (
                    <Form.Text className="text-muted" id="plant-species-help">
                      Display name will be {form.species ? <strong>{derivePlantName({ species: form.species, room: form.room })}</strong> : 'derived from species + room'}
                    </Form.Text>
                  )}
                </Form.Group>
                <Form.Group>
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <Form.Label className="mb-0">
                      Marker Emoji <span className="text-muted fs-xs">(shown on the floorplan)</span>
                    </Form.Label>
                    {form.emoji && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="p-0 fs-xs"
                        onClick={() => update('emoji', null)}
                      >
                        Use auto
                      </Button>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-3 mb-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: '#fff',
                        border: '2px solid #22c55e',
                        boxShadow: '0 2px 8px rgba(34,197,94,0.5), 0 0 0 3px rgba(34,197,94,0.18)',
                      }}
                      aria-label="Marker preview"
                    >
                      <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>
                        {getPlantEmoji({ species: form.species, emoji: form.emoji })}
                      </span>
                    </div>
                    <small className="text-muted">
                      {form.emoji
                        ? 'Custom marker — tap "Use auto" to let the species name pick.'
                        : 'Auto — derived from the species name. Open the picker to override.'}
                    </small>
                  </div>
                  <details>
                    <summary className="text-muted fs-xs fw-500 user-select-none mb-2" style={{ cursor: 'pointer' }}>
                      Choose a different emoji
                    </summary>
                    <div className="pt-2">
                  {PLANT_EMOJI_GROUPS.map((group) => (
                    <div key={group.label} className="mb-2">
                      <div className="text-muted fs-xs fw-600 text-uppercase mb-1">{group.label}</div>
                      <div className="d-flex flex-wrap gap-1">
                        {group.emojis.map((e) => (
                          <Button
                            key={e}
                            type="button"
                            size="sm"
                            variant={form.emoji === e ? 'primary' : 'outline-secondary'}
                            onClick={() => update('emoji', e)}
                            style={{ fontSize: '1.1rem', lineHeight: 1, padding: '0.25rem 0.5rem', minWidth: 36 }}
                            aria-label={`Use ${e} as marker`}
                          >
                            {e}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                    </div>
                  </details>
                </Form.Group>
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="environment">
              <Accordion.Header>Environment</Accordion.Header>
              <Accordion.Body>
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
                      <Form.Range
                        min={0} max={16}
                        value={form.sunHoursPerDay || 0}
                        onChange={(e) => update('sunHoursPerDay', Number(e.target.value) || null)}
                        className="mt-2"
                        list="sun-hours-ticks"
                      />
                      <datalist id="sun-hours-ticks">
                        <option value="4" label="4h" />
                        <option value="8" label="8h" />
                        <option value="12" label="12h" />
                      </datalist>
                      <div className="d-flex justify-content-between fs-xs text-muted">
                        <span>0h</span><span>4h</span><span>8h</span><span>12h</span><span>16h</span>
                      </div>
                    </Form.Group>
                  </Col>
                </Row>
                {isOutdoor({ room: form.room, floor: form.floor }, floors) && (
                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      id="is-under-cover"
                      label={<>Under cover <span className="text-muted fs-xs">(patio, porch, greenhouse — reduces effective rainfall)</span></>}
                      checked={!!form.isUnderCover}
                      onChange={e => update('isUnderCover', e.target.checked)}
                    />
                  </Form.Group>
                )}
                <Form.Group className="mb-3">
                  <Form.Label>Plant Category</Form.Label>
                  <Form.Select value={form.category || ''} onChange={(e) => update('category', e.target.value || null)}>
                    <option value="">— General —</option>
                    <option value="edible">Edible (vegetables, herbs, fruit)</option>
                    <option value="ornamental">Ornamental</option>
                    <option value="succulent">Succulent / Cactus</option>
                    <option value="tropical">Tropical / Houseplant</option>
                    <option value="tree">Tree / Shrub</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Planted In <span className="text-muted fs-xs">(shapes the watering advice)</span>
                  </Form.Label>
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
                            {potSizeOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
                    <Form.Group>
                      <Form.Label>Pot Material</Form.Label>
                      <Form.Select value={form.potMaterial || ''} onChange={(e) => update('potMaterial', e.target.value || null)}>
                        <option value="">— Select —</option>
                        {POT_MATERIAL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </>
                )}
              </Accordion.Body>
            </Accordion.Item>

            {/* Photo capture + gallery — only available once the plant exists,
                because the upload endpoints target plant.id. */}
            {isEditing && (
            <Accordion.Item eventKey="photos">
              <Accordion.Header>Photos</Accordion.Header>
              <Accordion.Body>
              <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Take a Photo</h6>
              <div className="d-flex gap-2 mb-3">
                <GrowthUpload plantId={plant.id} onComplete={(result) => {
                  if (result?.maturity) update('maturity', result.maturity)
                  if (result?.health) update('health', result.health)
                }} />
                <DiagnosticUpload plantId={plant.id} plant={plant} onComplete={(result) => {
                  const topSeverity = result?.analysis?.diagnoses?.[0]?.severity
                  if (topSeverity === 'severe') update('health', 'Poor')
                  else if (topSeverity === 'moderate') update('health', 'Fair')
                }} />
              </div>

              {(() => {
                let photos = [...(plant.photoLog || [])]
                  .filter((p) => !deletedPhotoUrls.includes(p.url?.split('?')[0]))
                  .sort((a, b) => new Date(b.date) - new Date(a.date))

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
                                  {formatDate(photo.date, { day: 'numeric', month: 'short' })}
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
              </Accordion.Body>
            </Accordion.Item>
            )}
            {isEditing && (
            <Accordion.Item eventKey="qr-tag">
              <Accordion.Header>QR Tag</Accordion.Header>
              <Accordion.Body>
                <PlantQRTag plant={plant} />
              </Accordion.Body>
            </Accordion.Item>
            )}
          </Accordion>
        </Modal.Body>
      )}

      {/* Watering tab */}
      {isEditing && activeTab === 'watering' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-watering" aria-labelledby="plant-tab-watering">
          {wateringStatus?.seasonNote && (
            <div className="mb-3 p-2 rounded border fs-sm d-flex align-items-center gap-2" style={{ borderColor: '#60a5fa', background: 'rgba(96,165,250,0.08)' }}>
              <svg className="sa-icon text-info" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#sun"></use></svg>
              <span>{wateringStatus.seasonNote}</span>
            </div>
          )}
          {/* Primary action: fetch an AI watering recommendation. Frequency,
              method, and amount below all derive from its response. */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <Button variant="success" size="sm" onClick={handleGetWateringRec} disabled={wateringRecLoading}>
              {wateringRecLoading ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
              {wateringRecLoading ? 'Loading...' : wateringRec ? 'Refresh Watering Recommendation' : 'Get Watering Recommendation'}
            </Button>
            {onWater && (
              <Button variant="outline-info" size="sm" onClick={() => setShowWateringSheet(true)}>
                <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                Log Watering
              </Button>
            )}
            {wateringRec && wateringHistory.length > 0 && (() => {
              const iso = wateringHistory[wateringHistory.length - 1]?.date
              const rel = formatRelativeAge(iso)
              return rel ? (
                <small className="text-muted ms-auto" title={formatRecDate(iso)}>
                  Updated {rel}
                </small>
              ) : null
            })()}
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
              const latest = reversed[0]
              const latestDisplay = getMoistureDisplay(latest.reading)
              const ago = Math.round((Date.now() - new Date(latest.date).getTime()) / 3600000)
              const agoLabel = ago < 1 ? 'just now' : ago < 24 ? `${ago}h ago` : `${Math.round(ago / 24)}d ago`
              return (
                <div className="d-flex align-items-center gap-2 mb-2 fs-sm">
                  <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: latestDisplay.color }} />
                  <span>Last: <strong>{latest.reading}/10</strong> ({latestDisplay.label})</span>
                  <span className="text-muted">— {agoLabel}</span>
                </div>
              )
            })()}
          </div>
          {/* History: tucked behind a disclosure so the tab lands on
              "should I water today?" not a wall of past readings. */}
          {(plant.moistureLog?.length > 0 || plant.wateringLog?.length > 0) ? (
            <details className="mb-3">
              <summary className="text-muted fs-sm fw-500 user-select-none" style={{ cursor: 'pointer' }}>
                History
              </summary>
              <div className="pt-3">
                {plant.moistureLog?.length > 0 && (() => {
                  const reversed = [...plant.moistureLog].reverse()
                  const totalPages = Math.ceil(reversed.length / 5)
                  const page = Math.min(moisturePage, totalPages)
                  const paged = reversed.slice((page - 1) * 5, page * 5)
                  return (
                    <div className="mb-3">
                      <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Moisture Log</h6>
                      {paged.map((entry, i) => {
                        const d = getMoistureDisplay(entry.reading)
                        return (
                          <div key={i} className="d-flex align-items-center gap-2 mb-1 fs-xs text-muted">
                            <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: d.color }} />
                            <span><strong>{entry.reading}/10</strong></span>
                            <span>{formatDate(entry.date, { day: 'numeric', month: 'short' })}</span>
                            <span>{formatTime(entry.date)}</span>
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
                <div>
                  <h6 className="text-muted text-uppercase fs-xs fw-600 mb-2">Watering History</h6>
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
                            {formatDate(entry.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="text-muted">{formatTime(entry.date)}</span>
                            {entry.wateredBy?.displayName && (
                              <span className="text-muted">by {entry.wateredBy.displayName}</span>
                            )}
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
                    <p className="text-muted fs-sm mb-0">No watering history yet.</p>
                  )}
                </div>
              </div>
            </details>
          ) : (
            <p className="text-muted fs-sm text-center py-3 mb-0">No watering history yet.</p>
          )}
        </Modal.Body>
      )}

      {/* Care tab — consolidated: health, maturity, notes, photos, recommendations */}
      {isEditing && activeTab === 'care' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-care" aria-labelledby="plant-tab-care">
          {/* #307 — Dormancy banner */}
          {currentPhase === 'dormant' ? (
            <div className="d-flex align-items-center gap-2 mb-3 p-3 rounded border bg-secondary bg-opacity-10">
              <span style={{ fontSize: 20 }}>💤</span>
              <div className="flex-grow-1">
                <div className="fw-500">Dormant — watering suspended</div>
                <small className="text-muted">This plant is in dormancy. Overdue alerts are suppressed.</small>
              </div>
              <Button size="sm" variant="outline-success" disabled={dormancyLoading} onClick={handleDormancyExit}>
                {dormancyLoading ? <Spinner size="sm" /> : 'Exit dormancy'}
              </Button>
            </div>
          ) : (
            <div className="d-flex align-items-center justify-content-end mb-3">
              <Button size="sm" variant="outline-secondary" disabled={dormancyLoading} onClick={handleDormancyEnter}>
                {dormancyLoading ? <Spinner size="sm" className="me-1" /> : '💤 '}
                Mark as dormant
              </Button>
            </div>
          )}
          {dormancyError && <p className="text-danger fs-xs mb-2">{dormancyError}</p>}

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

          {/* AI Care Recommendations — merged in from the former separate tab
              so all care-related information lives in one place. */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2 min-w-0">
              <h6 className="text-muted text-uppercase fs-xs fw-600 mb-0">AI Care Recommendations</h6>
              {careData && careHistory.length > 0 && (() => {
                const iso = careHistory[careHistory.length - 1]?.date
                const rel = formatRelativeAge(iso)
                return rel ? (
                  <small className="text-muted fs-xs" title={formatRecDate(iso)}>
                    · updated {rel}
                  </small>
                ) : null
              })()}
            </div>
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
            <p className="text-muted text-center py-4 mb-0">Click "Get Recommendations" for AI-powered care advice tailored to your plant.</p>
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

      {/* Growth tab */}
      {isEditing && activeTab === 'growth' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-growth" aria-labelledby="plant-tab-growth">
          {measurements.filter(m => m.height_cm != null).length >= 2 && (
            <div className="mb-4">
              <h6 className="fw-500 mb-2">Height over time</h6>
              <Chart
                type="line"
                height={180}
                options={{
                  chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
                  xaxis: { categories: measurements.filter(m => m.height_cm != null).map(m => m.date.slice(0, 10)), type: 'category' },
                  yaxis: { title: { text: unitSystem === 'imperial' ? 'in' : 'cm' }, min: 0 },
                  stroke: { curve: 'smooth', width: 2 },
                  markers: { size: 4 },
                  tooltip: { x: { show: true } },
                  grid: { borderColor: 'rgba(128,128,128,0.15)' },
                }}
                series={[{
                  name: unitSystem === 'imperial' ? 'Height (in)' : 'Height (cm)',
                  data: measurements.filter(m => m.height_cm != null).map(m =>
                    unitSystem === 'imperial' ? parseFloat((m.height_cm / 2.54).toFixed(1)) : m.height_cm
                  ),
                }]}
              />
            </div>
          )}

          <div className="mb-4">
            <h6 className="fw-500 mb-2">Log Measurement</h6>
            <Row className="g-2">
              <Col xs={6}>
                <Form.Group controlId="growth-height-cm">
                  <Form.Label className="fs-xs">{unitSystem === 'imperial' ? 'Height (in)' : 'Height (cm)'}</Form.Label>
                  <Form.Control type="number" min="0" step="0.1"
                    placeholder={unitSystem === 'imperial' ? 'e.g. 18' : 'e.g. 45'}
                    value={newMeasurement.height_cm}
                    onChange={e => setNewMeasurement(prev => ({ ...prev, height_cm: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="growth-width-cm">
                  <Form.Label className="fs-xs">{unitSystem === 'imperial' ? 'Width (in)' : 'Width (cm)'}</Form.Label>
                  <Form.Control type="number" min="0" step="0.1"
                    placeholder={unitSystem === 'imperial' ? 'e.g. 12' : 'e.g. 30'}
                    value={newMeasurement.width_cm}
                    onChange={e => setNewMeasurement(prev => ({ ...prev, width_cm: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="growth-leaf-count">
                  <Form.Label className="fs-xs">Leaf count</Form.Label>
                  <Form.Control type="number" min="0" placeholder="e.g. 12"
                    value={newMeasurement.leafCount}
                    onChange={e => setNewMeasurement(prev => ({ ...prev, leafCount: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="growth-stem-count">
                  <Form.Label className="fs-xs">Stem count</Form.Label>
                  <Form.Control type="number" min="0" placeholder="e.g. 3"
                    value={newMeasurement.stemCount}
                    onChange={e => setNewMeasurement(prev => ({ ...prev, stemCount: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="growth-notes">
                  <Form.Label className="fs-xs">Notes</Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Optional notes…"
                    value={newMeasurement.notes}
                    onChange={e => setNewMeasurement(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </Form.Group>
              </Col>
            </Row>
            {measurementError && <div className="text-danger fs-xs mt-2">{measurementError}</div>}
            <Button variant="outline-primary" size="sm" className="mt-2" onClick={handleAddMeasurement} disabled={measurementSaving}>
              {measurementSaving && <Spinner size="sm" className="me-1" />}
              + Log Measurement
            </Button>
          </div>

          {measurements.length > 0 && (
            <div className="mb-4">
              <h6 className="fw-500 mb-2">Measurement history</h6>
              <div className="table-responsive">
                <table className="table table-sm fs-xs mb-0">
                  <thead><tr><th>Date</th><th>Height</th><th>Width</th><th>Leaves</th><th>Stems</th><th></th></tr></thead>
                  <tbody>
                    {[...measurements].reverse().map(m => (
                      <tr key={m.id}>
                        <td>{m.date.slice(0, 10)}</td>
                        <td>{m.height_cm != null ? `${m.height_cm} cm` : '—'}</td>
                        <td>{m.width_cm  != null ? `${m.width_cm} cm`  : '—'}</td>
                        <td>{m.leafCount  != null ? m.leafCount  : '—'}</td>
                        <td>{m.stemCount  != null ? m.stemCount  : '—'}</td>
                        <td>
                          <Button variant="link" size="sm" className="text-danger p-0" aria-label="Delete measurement"
                            onClick={() => handleDeleteMeasurement(m.id)}>
                            <svg className="sa-icon"><use href="/icons/sprite.svg#trash-2"></use></svg>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mb-2">
            <h6 className="fw-500 mb-2">Phenology Events</h6>
            <Row className="g-2 mb-2">
              <Col xs={12} sm={6}>
                <Form.Select size="sm" value={newPhenology.event}
                  onChange={e => setNewPhenology(prev => ({ ...prev, event: e.target.value }))}>
                  <option value="">Select event type…</option>
                  <option value="first-leaf">First leaf</option>
                  <option value="first-bud">First bud</option>
                  <option value="first-bloom">First bloom</option>
                  <option value="first-fruit">First fruit</option>
                  <option value="leaf-drop">Leaf drop</option>
                  <option value="dormancy">Dormancy</option>
                  <option value="new-growth">New growth</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Control type="date" size="sm" value={newPhenology.date}
                  onChange={e => setNewPhenology(prev => ({ ...prev, date: e.target.value }))} />
              </Col>
              <Col xs={12}>
                <Form.Control size="sm" placeholder="Notes (optional)" value={newPhenology.notes}
                  onChange={e => setNewPhenology(prev => ({ ...prev, notes: e.target.value }))} />
              </Col>
            </Row>
            <Button variant="outline-secondary" size="sm" className="mb-3"
              onClick={handleAddPhenology} disabled={!newPhenology.event || phenologySaving}>
              {phenologySaving && <Spinner size="sm" className="me-1" />}
              + Log Event
            </Button>
            {phenologyEvents.length > 0 ? (
              <ul className="list-unstyled mb-0">
                {[...phenologyEvents].reverse().map(ev => (
                  <li key={ev.id} className="d-flex align-items-center gap-2 mb-1 fs-xs">
                    <Badge bg="secondary">{ev.event}</Badge>
                    <span className="text-muted">{ev.date.slice(0, 10)}</span>
                    {ev.notes && <span className="flex-grow-1">{ev.notes}</span>}
                    <Button variant="link" size="sm" className="text-danger p-0 ms-auto" aria-label="Delete event"
                      onClick={() => handleDeletePhenology(ev.id)}>
                      <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#x"></use></svg>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted fs-xs mb-0">No phenology events logged yet. Record milestones like first bloom, first fruit, or leaf drop.</p>
            )}
          </div>

          {/* #303 — Growth-shot photo timeline */}
          {(() => {
            const growthPhotos = (plant?.photoLog || []).filter(
              (p) => p.kind === 'growth-shot' || p.type === 'growth',
            )
            if (growthPhotos.length < 2) return null
            return (
              <div className="mt-4">
                <h6 className="fw-500 mb-2">
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#image" /></svg>
                  Photo Timeline — Compare Growth
                </h6>
                {/* Thumbnail strip */}
                <div className="d-flex gap-2 overflow-auto pb-2 mb-3">
                  {[...growthPhotos].reverse().map((photo, i) => (
                    <button
                      key={photo.url + i}
                      type="button"
                      className={`flex-shrink-0 border rounded p-0 overflow-hidden ${compareA?.url === photo.url ? 'border-primary border-2' : compareB?.url === photo.url ? 'border-success border-2' : ''}`}
                      style={{ width: 72, height: 72, cursor: 'pointer' }}
                      title={photo.date ? photo.date.slice(0, 10) : 'Select'}
                      onClick={() => {
                        if (!compareA || compareA?.url === photo.url) setCompareA(photo)
                        else setCompareB(photo)
                      }}
                    >
                      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
                {compareA && compareB ? (
                  <div>
                    <div className="text-muted fs-xs mb-2 text-center">
                      Drag slider to compare · <button type="button" className="btn btn-link p-0 fs-xs" onClick={() => { setCompareA(null); setCompareB(null) }}>Clear</button>
                    </div>
                    <div className="position-relative rounded overflow-hidden border" style={{ height: 220 }}>
                      <img src={compareA.url} alt="Before" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${compareSlider}%` }}>
                        <img src={compareB.url} alt="After" style={{ width: `${10000 / compareSlider}%`, maxWidth: 'none', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${compareSlider}%`, width: 2, background: 'white', transform: 'translateX(-50%)' }} />
                      <input
                        type="range"
                        min="5" max="95"
                        value={compareSlider}
                        onChange={(e) => setCompareSlider(Number(e.target.value))}
                        style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'col-resize', height: '100%' }}
                        aria-label="Compare slider"
                      />
                    </div>
                    <div className="d-flex justify-content-between mt-1">
                      <small className="text-muted">{compareA.date?.slice(0, 10)}</small>
                      <small className="text-muted">{compareB.date?.slice(0, 10)}</small>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted fs-xs">Select two photos above to compare them side-by-side.</p>
                )}
              </div>
            )
          })()}
        </Modal.Body>
      )}

      {/* Journal tab */}
      {isEditing && activeTab === 'journal' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-journal" aria-labelledby="plant-tab-journal">
          <div className="mb-4">
            <h6 className="fw-500 mb-2">New Entry</h6>
            <Form.Group controlId="journal-body" className="mb-2">
              <Form.Label visuallyHidden>Journal entry</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="What did you observe? e.g. 'Noticed new leaf bud, moved away from radiator...'"
                value={newJournalBody}
                onChange={e => setNewJournalBody(e.target.value)}
              />
            </Form.Group>
            <Row className="g-2 mb-2">
              <Col xs={12} sm={6}>
                <Form.Select size="sm" value={newJournalMood} onChange={e => setNewJournalMood(e.target.value)}>
                  <option value="">Mood (optional)</option>
                  <option value="thriving">🌿 Thriving</option>
                  <option value="ok">😐 OK</option>
                  <option value="struggling">😟 Struggling</option>
                  <option value="dying">⚠️ Dying</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Select size="sm" value={newJournalTags[0] || ''} onChange={e => setNewJournalTags(e.target.value ? [e.target.value] : [])}>
                  <option value="">Tag (optional)</option>
                  <option value="pest">Pest</option>
                  <option value="disease">Disease</option>
                  <option value="bloom">Bloom</option>
                  <option value="new-growth">New growth</option>
                  <option value="repot">Repot</option>
                  <option value="propagate">Propagate</option>
                  <option value="relocate">Relocate</option>
                  <option value="experiment">Experiment</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Col>
            </Row>
            {journalError && <div className="text-danger fs-xs mb-2">{journalError}</div>}
            <Button variant="primary" size="sm" onClick={handleAddJournalEntry} disabled={journalSaving || !newJournalBody.trim()}>
              {journalSaving && <Spinner size="sm" className="me-1" />}
              Add Entry
            </Button>
          </div>

          {journalEntries.length > 0 ? (
            <div>
              <h6 className="fw-500 mb-2">Entries ({journalEntries.length})</h6>
              {journalEntries.map(entry => (
                <div key={entry.id} className="border rounded p-3 mb-2">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fs-xs text-muted">{entry.date.slice(0, 10)}</span>
                    {entry.mood && (
                      <Badge bg="light" text="dark" className="fs-xs">
                        {entry.mood === 'thriving' ? '🌿' : entry.mood === 'ok' ? '😐' : entry.mood === 'struggling' ? '😟' : '⚠️'} {entry.mood}
                      </Badge>
                    )}
                    {(entry.tags || []).map(tag => (
                      <Badge key={tag} bg="secondary" className="fs-xs">{tag}</Badge>
                    ))}
                    <div className="ms-auto d-flex gap-1">
                      <Button variant="link" size="sm" className="text-muted p-0 fs-xs"
                        onClick={() => { setEditingEntryId(entry.id); setEditingBody(entry.body) }}>
                        Edit
                      </Button>
                      <Button variant="link" size="sm" className="text-danger p-0 fs-xs" aria-label="Delete entry"
                        onClick={() => handleDeleteJournalEntry(entry.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {editingEntryId === entry.id ? (
                    <div>
                      <Form.Control as="textarea" rows={3} value={editingBody}
                        onChange={e => setEditingBody(e.target.value)} className="mb-2 fs-xs" />
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => handleSaveJournalEdit(entry.id)}>Save</Button>
                        <Button size="sm" variant="light" onClick={() => setEditingEntryId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mb-0 fs-sm" style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-center py-3 mb-0 fs-sm">
              No journal entries yet. Start recording observations, moves, and milestones for this plant.
            </p>
          )}
        </Modal.Body>
      )}

      {/* ── Blooms tab ───────────────────────────────────────────────────── */}
      {isEditing && activeTab === 'blooms' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-blooms" aria-labelledby="plant-tab-blooms" className="p-0">
          <BloomTab plant={plant} onUpdated={() => { /* refresh handled by BloomTab internal state */ }} />
        </Modal.Body>
      )}

      {/* ── Lifecycle tab ────────────────────────────────────────────────── */}
      {isEditing && activeTab === 'lifecycle' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-lifecycle" aria-labelledby="plant-tab-lifecycle" className="p-0">
          <LifecycleTab plant={plant} onUpdated={() => { /* refresh handled by LifecycleTab internal state */ }} />
        </Modal.Body>
      )}

      {/* ── Soil tab ─────────────────────────────────────────────────────── */}
      {isEditing && activeTab === 'soil' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-soil" aria-labelledby="plant-tab-soil">
          <SoilTab plantId={plant?.id} />
        </Modal.Body>
      )}

      {/* ── Harvest tab ──────────────────────────────────────────────────── */}
      {isEditing && activeTab === 'harvest' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-harvest" aria-labelledby="plant-tab-harvest">
          <div className="mb-4">
            <h6 className="fw-500 mb-2">Log Harvest</h6>
            <Row className="g-2 mb-2">
              <Col xs={12} sm={4}>
                <Form.Group controlId="harvest-date">
                  <Form.Label visuallyHidden>Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={newHarvest.date}
                    onChange={e => setNewHarvest(h => ({ ...h, date: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6} sm={4}>
                <Form.Group controlId="harvest-quantity">
                  <Form.Label visuallyHidden>Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    min="0.001"
                    step="any"
                    placeholder="Quantity"
                    value={newHarvest.quantity}
                    onChange={e => setNewHarvest(h => ({ ...h, quantity: e.target.value }))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6} sm={4}>
                <Form.Select value={newHarvest.unit} onChange={e => setNewHarvest(h => ({ ...h, unit: e.target.value }))}>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                  <option value="count">count</option>
                  <option value="bunches">bunches</option>
                </Form.Select>
              </Col>
            </Row>
            <Row className="g-2 mb-2">
              <Col xs={12} sm={6}>
                <Form.Select value={newHarvest.quality} onChange={e => setNewHarvest(h => ({ ...h, quality: e.target.value }))}>
                  <option value="">Quality (optional)</option>
                  <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                  <option value="4">⭐⭐⭐⭐ Good</option>
                  <option value="3">⭐⭐⭐ Average</option>
                  <option value="2">⭐⭐ Below average</option>
                  <option value="1">⭐ Poor</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Control
                  type="text"
                  placeholder="Notes (optional)"
                  value={newHarvest.notes}
                  onChange={e => setNewHarvest(h => ({ ...h, notes: e.target.value }))}
                />
              </Col>
            </Row>
            {harvestError && <div className="text-danger fs-xs mb-2">{harvestError}</div>}
            <Button variant="primary" size="sm" onClick={handleAddHarvest} disabled={harvestSaving || !newHarvest.quantity}>
              {harvestSaving && <Spinner size="sm" className="me-1" />}
              Log Harvest
            </Button>
          </div>

          {harvestEntries.length > 0 ? (
            <div>
              <h6 className="fw-500 mb-2">
                History ({harvestEntries.length})
                <span className="text-muted fs-xs fw-400 ms-2">
                  Total:{' '}
                  {(() => {
                    const byUnit = {}
                    harvestEntries.forEach(e => { byUnit[e.unit] = (byUnit[e.unit] || 0) + e.quantity })
                    return Object.entries(byUnit).map(([u, q]) => `${q.toFixed(2).replace(/\.?0+$/, '')} ${u}`).join(', ')
                  })()}
                </span>
              </h6>
              {harvestEntries.map(entry => (
                <div key={entry.id} className="border rounded p-3 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-500">{entry.quantity} {entry.unit}</span>
                    <span className="fs-xs text-muted">{entry.date?.slice(0, 10)}</span>
                    {entry.quality && (
                      <Badge bg="warning" text="dark" className="fs-xs">{'⭐'.repeat(entry.quality)}</Badge>
                    )}
                    <Button variant="link" size="sm" className="text-danger p-0 fs-xs ms-auto" aria-label="Delete harvest"
                      onClick={() => handleDeleteHarvest(entry.id)}>
                      Delete
                    </Button>
                  </div>
                  {entry.notes && <p className="mb-0 mt-1 fs-xs text-muted">{entry.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-center py-3 mb-0 fs-sm">
              No harvests logged yet. Log your first harvest to start tracking yield over time.
            </p>
          )}
        </Modal.Body>
      )}

      {/* Health tab — incident log */}
      {isEditing && activeTab === 'health' && (
        <Modal.Body className="pt-3 pb-4">
          <h6 className="fw-600 mb-3">Log Pest / Disease Incident</h6>
          {incidentError && <div className="alert alert-danger py-2 fs-sm mb-3">{incidentError}</div>}
          <Row className="g-2 mb-2">
            <Col xs={6}>
              <Form.Select size="sm" value={newIncident.category}
                onChange={e => setNewIncident(p => ({ ...p, category: e.target.value }))}>
                <option value="pest">Pest</option>
                <option value="disease">Disease</option>
                <option value="deficiency">Deficiency</option>
                <option value="environmental">Environmental</option>
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Control size="sm" placeholder="Type (e.g. Spider mites)" value={newIncident.specificType}
                onChange={e => setNewIncident(p => ({ ...p, specificType: e.target.value }))} />
            </Col>
            <Col xs={4}>
              <Form.Control size="sm" type="date" value={newIncident.firstObservedAt}
                onChange={e => setNewIncident(p => ({ ...p, firstObservedAt: e.target.value }))} />
            </Col>
            <Col xs={4}>
              <Form.Select size="sm" value={newIncident.severity}
                onChange={e => setNewIncident(p => ({ ...p, severity: e.target.value }))}>
                <option value="">Severity</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {['Minimal','Moderate','Significant','Severe','Critical'][n-1]}</option>)}
              </Form.Select>
            </Col>
            <Col xs={4}>
              <Button size="sm" variant="primary" className="w-100" onClick={handleAddIncident} disabled={incidentSaving || !newIncident.specificType.trim()}>
                {incidentSaving ? <Spinner size="sm" /> : 'Log Incident'}
              </Button>
            </Col>
            <Col xs={12}>
              <Form.Control size="sm" as="textarea" rows={2} placeholder="Notes (optional)" value={newIncident.notes}
                onChange={e => setNewIncident(p => ({ ...p, notes: e.target.value }))} />
            </Col>
          </Row>

          <hr className="my-3" />
          <h6 className="fw-600 mb-2">Incident History</h6>
          {incidents.length === 0 ? (
            <p className="text-muted text-center py-3 mb-0 fs-sm">No incidents logged yet.</p>
          ) : incidents.map(incident => (
            <div key={incident.id} className="border rounded p-3 mb-3">
              <div className="d-flex align-items-start gap-2 mb-1">
                <Badge bg={incident.category === 'pest' ? 'danger' : incident.category === 'disease' ? 'warning' : 'secondary'}
                  text={incident.category === 'disease' ? 'dark' : undefined} className="fs-xs text-capitalize">
                  {incident.category}
                </Badge>
                <span className="fw-500 fs-sm">{incident.specificType}</span>
                {incident.severity && (
                  <Badge bg="light" text="dark" className="fs-xs ms-1">Severity {incident.severity}/5</Badge>
                )}
                {incident.outbreakId && (
                  <Badge bg="danger" className="fs-xs ms-1">Outbreak</Badge>
                )}
                <span className="ms-auto fs-xs text-muted">{incident.firstObservedAt?.slice(0,10)}</span>
              </div>
              {incident.notes && <p className="fs-xs text-muted mb-2">{incident.notes}</p>}

              {/* Treatments */}
              {(incident.treatments || []).length > 0 && (
                <div className="mb-2">
                  <span className="fs-xs fw-600 text-muted d-block mb-1">Treatments applied:</span>
                  {incident.treatments.map(t => (
                    <div key={t.id} className="fs-xs text-muted ps-2 border-start border-2">
                      {t.appliedAt?.slice(0,10)} — {t.treatment}{t.outcome ? ` → ${t.outcome}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {!incident.resolvedAt && (
                <div className="d-flex gap-2 mt-2">
                  <Form.Control size="sm" placeholder="Add treatment…" value={treatmentInput[incident.id] || ''}
                    onChange={e => setTreatmentInput(p => ({ ...p, [incident.id]: e.target.value }))} />
                  <Button size="sm" variant="outline-secondary" disabled={treatmentSaving[incident.id] || !treatmentInput[incident.id]?.trim()}
                    onClick={() => handleAddTreatment(incident.id)}>
                    {treatmentSaving[incident.id] ? <Spinner size="sm" /> : 'Add'}
                  </Button>
                  <Button size="sm" variant="outline-success" onClick={() => handleResolveIncident(incident.id)}>
                    Resolve
                  </Button>
                </div>
              )}
              {incident.resolvedAt && (
                <div className="mt-1">
                  <Badge bg="success" className="fs-xs">Resolved {incident.resolvedAt.slice(0,10)}</Badge>
                </div>
              )}
              <Button variant="link" size="sm" className="text-danger p-0 fs-xs d-block mt-2" onClick={() => handleDeleteIncident(incident.id)}>
                Delete
              </Button>
            </div>
          ))}
        </Modal.Body>
      )}

      {/* Wildlife tab — pollinator & visitor log */}
      {isEditing && activeTab === 'wildlife' && (
        <Modal.Body role="tabpanel" id="plant-tabpanel-wildlife" aria-labelledby="plant-tab-wildlife" className="pt-3 pb-4">
          <h6 className="fw-600 mb-3">Log Wildlife Observation</h6>
          {wildlifeError && <div className="alert alert-danger py-2 fs-sm mb-3">{wildlifeError}</div>}
          <Row className="g-2 mb-3">
            <Col xs={6}>
              <Form.Select size="sm" aria-label="Category" value={newWildlife.category}
                onChange={e => setNewWildlife(p => ({ ...p, category: e.target.value }))}>
                <option value="bee">Bee</option>
                <option value="butterfly">Butterfly</option>
                <option value="bird">Bird</option>
                <option value="other-insect">Other insect</option>
                <option value="mammal">Mammal</option>
                <option value="reptile">Reptile</option>
                <option value="other">Other</option>
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Control size="sm" placeholder="Species (optional)" aria-label="Species" value={newWildlife.species}
                onChange={e => setNewWildlife(p => ({ ...p, species: e.target.value }))} />
            </Col>
            <Col xs={4}>
              <Form.Control size="sm" type="date" aria-label="Date observed" value={newWildlife.observedAt}
                onChange={e => setNewWildlife(p => ({ ...p, observedAt: e.target.value }))} />
            </Col>
            <Col xs={4}>
              <Form.Control size="sm" type="number" min="1" placeholder="Count" aria-label="Count" value={newWildlife.count}
                onChange={e => setNewWildlife(p => ({ ...p, count: e.target.value }))} />
            </Col>
            <Col xs={4}>
              <Button size="sm" variant="primary" className="w-100" onClick={handleAddWildlife} disabled={wildlifeSaving}>
                {wildlifeSaving ? <Spinner size="sm" /> : 'Log'}
              </Button>
            </Col>
            <Col xs={12}>
              <Form.Control size="sm" as="textarea" rows={2} placeholder="Notes (optional)" aria-label="Notes" value={newWildlife.notes}
                onChange={e => setNewWildlife(p => ({ ...p, notes: e.target.value }))} />
            </Col>
          </Row>

          <hr className="my-3" />
          <h6 className="fw-600 mb-2">Observation History</h6>
          {wildlifeEntries.length === 0 ? (
            <p className="text-muted text-center py-3 mb-0 fs-sm">
              No observations logged yet. Record the pollinators and wildlife visiting this plant.
            </p>
          ) : wildlifeEntries.map(obs => (
            <div key={obs.id} className="border rounded p-3 mb-2">
              <div className="d-flex align-items-center gap-2">
                <Badge bg="success" className="fs-xs text-capitalize">{obs.category.replace('-', ' ')}</Badge>
                {obs.species && <span className="fw-500 fs-sm">{obs.species}</span>}
                {obs.count && <Badge bg="light" text="dark" className="fs-xs">×{obs.count}</Badge>}
                <span className="ms-auto fs-xs text-muted">{obs.observedAt?.slice(0, 10)}</span>
                <Button variant="link" size="sm" className="text-danger p-0 fs-xs" aria-label="Delete observation"
                  onClick={() => handleDeleteWildlife(obs.id)}>Delete</Button>
              </div>
              {obs.notes && <p className="mb-0 mt-1 fs-xs text-muted">{obs.notes}</p>}
            </div>
          ))}
        </Modal.Body>
      )}

      {/* Unsaved-change guard */}
      {showUnsavedGuard && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="unsaved-guard-title"
          aria-describedby="unsaved-guard-body"
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10, borderRadius: 'inherit' }}
        >
          <div className="card shadow-lg mx-4" style={{ maxWidth: 360 }}>
            <div className="card-body p-4">
              <p id="unsaved-guard-title" className="fw-500 mb-1">Discard unsaved changes?</p>
              <p id="unsaved-guard-body" className="text-muted fs-sm mb-3">
                Your edits to this plant haven't been saved. Leaving now will lose them.
              </p>
              <div className="d-flex gap-2 justify-content-end">
                <Button variant="light" onClick={() => setShowUnsavedGuard(false)} autoFocus>
                  Keep editing
                </Button>
                <Button variant="danger" onClick={handleDiscardChanges}>
                  Discard changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10, borderRadius: 'inherit' }}>
          <div className="card shadow-lg mx-4" style={{ maxWidth: 360 }}>
            <div className="card-body p-4">
              <p className="fw-500 mb-1">Delete {plant?.name || 'this plant'}?</p>
              <p className="text-muted fs-sm mb-2">This cannot be undone.</p>
              {plant?.lastEditedBy && (
                <p className="text-muted fs-sm mb-3">
                  Last edited by{' '}
                  <strong>{plant.lastEditedBy.displayName || plant.lastEditedBy.userId}</strong>
                  {plant.lastEditedBy.at && (
                    <> on {new Date(plant.lastEditedBy.at).toLocaleDateString()}</>
                  )}
                </p>
              )}
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
        {!embedded && isEditing && plant?.id && (
          <Link to={`/plants/${plant.id}`} className="btn btn-link text-decoration-none">
            Open full record
            <svg className="sa-icon ms-1" aria-hidden="true"><use href="/icons/sprite.svg#arrow-right"></use></svg>
          </Link>
        )}
        <Button variant="light" onClick={handleClose}>Cancel</Button>
        {mode !== null && (!isEditing || activeTab === 'edit') && (
          <Button variant="primary" onClick={handleSubmit} disabled={!form.species.trim() || isSaving}>
            {isSaving ? <Spinner size="sm" className="me-2" /> : <svg className="sa-icon me-1"><use href="/icons/sprite.svg#save"></use></svg>}
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Plant'}
          </Button>
        )}
      </Modal.Footer>
    </>
  )

  return (
    <>
    {embedded ? (
      <div className="modal-content position-relative shadow-sm" aria-labelledby="plant-modal-title">
        {innerContent}
      </div>
    ) : (
      <Modal show onHide={handleClose} size="lg" centered scrollable fullscreen="sm-down" aria-labelledby="plant-modal-title">
        {innerContent}
      </Modal>
    )}

    {plant && showWateringSheet && (
      <WateringSheet
        plant={plant}
        show={showWateringSheet}
        onHide={() => setShowWateringSheet(false)}
        onLog={onWater}
      />
    )}

    {/* #294 — one-tap plant identification */}
    <PlantIdentify
      show={showIdentify}
      onHide={() => { setShowIdentify(false); setMode('manual') }}
      onIdentified={(candidate) => {
        handleIdentified(candidate)
        setShowIdentify(false)
        setMode('manual')
      }}
    />
  </>
  )
}
