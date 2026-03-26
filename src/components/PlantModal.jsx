import React, { useState, useEffect, useCallback } from 'react'
import { X, Trash2, Save, Leaf, Loader2, Droplets, Sparkles, Camera, ClipboardList } from 'lucide-react'
import ImageAnalyser from './ImageAnalyser.jsx'
import { imagesApi, recommendApi } from '../api/plants.js'

const ROOMS = [
  'Living Room',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Garden',
  'Balcony',
  'Office',
  'Hallway',
  'Dining Room',
  'Other',
]

const HEALTH_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor']
const MATURITY_OPTIONS = ['Seedling', 'Young', 'Mature', 'Established']

const TABS = [
  { id: 'edit',     label: 'Edit Plant' },
  { id: 'watering', label: 'Watering' },
  { id: 'care',     label: 'Care' },
]

function today() {
  return new Date().toISOString().split('T')[0]
}

function FormField({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  )
}

function InputClass(extra = '') {
  return `w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors ${extra}`
}

function CareSection({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  )
}

export default function PlantModal({ plant, position, floors, activeFloorId, onSave, onDelete, onWater, onClose }) {
  const isEditing = !!plant

  // null = show mode-choice screen (new plants only); 'photo' or 'manual' after choice
  const [mode, setMode] = useState(() => plant ? 'edit' : null)

  const [activeTab, setActiveTab] = useState('edit')

  const [form, setForm] = useState({
    name: '',
    species: '',
    room: 'Living Room',
    floor: activeFloorId ?? 'ground',
    lastWatered: today(),
    frequencyDays: 7,
    notes: '',
    imageFile: null,
    imageUrl: null,
    health: null,
    healthReason: null,
    maturity: null,
    recommendations: [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [careData, setCareData] = useState(null)
  const [careLoading, setCareLoading] = useState(false)
  const [careError, setCareError] = useState(null)

  useEffect(() => {
    if (plant) {
      setForm({
        name: plant.name || '',
        species: plant.species || '',
        room: plant.room || 'Living Room',
        floor: plant.floor ?? activeFloorId ?? 'ground',
        lastWatered: plant.lastWatered ? plant.lastWatered.split('T')[0] : today(),
        frequencyDays: plant.frequencyDays ?? 7,
        notes: plant.notes || '',
        imageFile: null,
        imageUrl: plant.imageUrl || null,
        health: plant.health || null,
        healthReason: plant.healthReason || null,
        maturity: plant.maturity || null,
        recommendations: plant.recommendations || [],
      })
    }
  }, [plant, activeFloorId])

  const update = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleAnalysisComplete = useCallback((result) => {
    setForm(prev => ({
      ...prev,
      ...(result.species ? { species: result.species } : {}),
      ...(result.frequencyDays ? { frequencyDays: Math.min(30, Math.max(1, Number(result.frequencyDays))) } : {}),
      health: result.health,
      healthReason: result.healthReason,
      maturity: result.maturity,
      recommendations: result.recommendations || [],
    }))
  }, [])

  const handleImageChange = useCallback((file) => {
    setForm(prev => ({ ...prev, imageFile: file, imageUrl: null }))
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setIsSaving(true)

    let imageUrl = form.imageUrl
    if (form.imageFile) {
      try {
        imageUrl = await imagesApi.upload(form.imageFile, 'plants')
      } catch (err) {
        alert(`Image upload failed: ${err.message}`)
        setIsSaving(false)
        return
      }
    }

    onSave({
      name: form.name.trim(),
      species: form.species.trim(),
      room: form.room,
      floor: form.floor,
      lastWatered: new Date(form.lastWatered).toISOString(),
      frequencyDays: Number(form.frequencyDays),
      notes: form.notes.trim(),
      imageUrl,
      health: form.health,
      healthReason: form.healthReason,
      maturity: form.maturity,
      recommendations: form.recommendations,
    })
    setIsSaving(false)
  }, [form, onSave])

  const handleDelete = useCallback(() => {
    if (confirmDelete && plant) {
      onDelete(plant.id)
    } else {
      setConfirmDelete(true)
    }
  }, [confirmDelete, plant, onDelete])

  const handleGetRecommendations = useCallback(async () => {
    setCareLoading(true)
    setCareError(null)
    try {
      const data = await recommendApi.get(form.name, form.species)
      setCareData(data)
    } catch (err) {
      setCareError(err.message)
    } finally {
      setCareLoading(false)
    }
  }, [form.name, form.species])

  const daysUntil = React.useMemo(() => {
    if (!form.lastWatered || !form.frequencyDays) return null
    const last = new Date(form.lastWatered)
    const next = new Date(last.getTime() + Number(form.frequencyDays) * 86400000)
    return Math.ceil((next - new Date()) / 86400000)
  }, [form.lastWatered, form.frequencyDays])

  const showSave = mode !== null && (!isEditing || activeTab === 'edit')

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-enter w-full flex-1 md:flex-none md:max-w-md bg-gray-900 md:border md:border-gray-800 md:rounded-2xl shadow-2xl flex flex-col md:max-h-[calc(100vh-2rem)]"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center">
              <Leaf size={14} className="text-white" />
            </div>
            <h2 className="text-base font-semibold text-white">
              {isEditing ? plant.name : 'Add Plant'}
            </h2>
            {daysUntil !== null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: daysUntil < 0 ? '#450a0a' : daysUntil === 0 ? '#431407' : daysUntil <= 2 ? '#422006' : '#052e16',
                  color: daysUntil < 0 ? '#fca5a5' : daysUntil === 0 ? '#fdba74' : daysUntil <= 2 ? '#fde047' : '#86efac',
                }}
              >
                {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Water today' : `${daysUntil}d left`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar — only when editing */}
        {isEditing && (
          <div className="flex border-b border-gray-800 flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-px'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Mode-choice screen (new plants only) ───────────────────── */}
        {!isEditing && mode === null && (
          <div className="flex-1 flex flex-col justify-center px-5 py-8 gap-3">
            <p className="text-sm text-gray-400 text-center mb-2">How would you like to add it?</p>

            <button
              type="button"
              onClick={() => setMode('photo')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-900/20 border border-emerald-800/40 hover:bg-emerald-900/35 hover:border-emerald-700 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                <Camera size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Analyse with AI</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Take or upload a photo — Gemini identifies the plant and fills in care details automatically
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-full bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Enter manually</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fill in the plant name and care details yourself
                </p>
              </div>
            </button>
          </div>
        )}

        {/* ── Edit tab (or new plant form) ───────────────────────────── */}
        {(mode !== null) && (!isEditing || activeTab === 'edit') && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="px-5 py-4 space-y-4">
              {/* Photo-first: show analyser at the top when in photo mode (new plant) */}
              {!isEditing && mode === 'photo' && (
                <>
                  <ImageAnalyser
                    initialImage={form.imageUrl}
                    onAnalysisComplete={handleAnalysisComplete}
                    onImageChange={handleImageChange}
                  />
                  <hr className="border-gray-800" />
                </>
              )}

              <FormField label="Plant Name *">
                <input
                  className={InputClass()}
                  type="text"
                  placeholder="e.g. Living Room Fern"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Species">
                <input
                  className={InputClass()}
                  type="text"
                  placeholder="e.g. Nephrolepis exaltata"
                  value={form.species}
                  onChange={e => update('species', e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Floor">
                  <select
                    className={InputClass('cursor-pointer')}
                    value={form.floor}
                    onChange={e => update('floor', e.target.value)}
                  >
                    {(floors ?? []).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Room / Zone">
                  <select
                    className={InputClass('cursor-pointer')}
                    value={form.room}
                    onChange={e => update('room', e.target.value)}
                  >
                    {ROOMS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Last Watered">
                  <input
                    className={InputClass()}
                    type="date"
                    value={form.lastWatered}
                    max={today()}
                    onChange={e => update('lastWatered', e.target.value)}
                  />
                </FormField>

                <FormField label={`Frequency: ${form.frequencyDays}d`}>
                  <div className="flex flex-col gap-1">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={form.frequencyDays}
                      onChange={e => update('frequencyDays', e.target.value)}
                      className="w-full h-2 accent-emerald-500 cursor-pointer mt-1"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>1d</span>
                      <span>30d</span>
                    </div>
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Health">
                  <select
                    className={InputClass('cursor-pointer')}
                    value={form.health || ''}
                    onChange={e => update('health', e.target.value || null)}
                  >
                    <option value="">— Select —</option>
                    {HEALTH_OPTIONS.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Maturity">
                  <select
                    className={InputClass('cursor-pointer')}
                    value={form.maturity || ''}
                    onChange={e => update('maturity', e.target.value || null)}
                  >
                    <option value="">— Select —</option>
                    {MATURITY_OPTIONS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea
                  className={InputClass('resize-none')}
                  rows={3}
                  placeholder="Any special care instructions, observations..."
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                />
              </FormField>

              {/* Edit mode: show analyser at the bottom (secondary to the form fields) */}
              {isEditing && (
                <>
                  <hr className="border-gray-800" />
                  <ImageAnalyser
                    initialImage={form.imageUrl}
                    onAnalysisComplete={handleAnalysisComplete}
                    onImageChange={handleImageChange}
                  />
                </>
              )}
            </div>
          </form>
        )}

        {/* ── Watering tab ───────────────────────────────────────────── */}
        {isEditing && activeTab === 'watering' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
            {onWater && (
              <button
                type="button"
                onClick={() => onWater(plant.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-800/60 transition-colors"
              >
                <Droplets size={15} />
                Watered
              </button>
            )}

            {plant.wateringLog && plant.wateringLog.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Watering History</p>
                <div className="space-y-1.5">
                  {[...plant.wateringLog].reverse().map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <Droplets size={11} className="text-blue-400 flex-shrink-0" />
                      <span>
                        {new Date(entry.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {entry.note && <span className="text-gray-600 truncate">— {entry.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 text-center py-8">No watering history yet.</p>
            )}
          </div>
        )}

        {/* ── Care tab ───────────────────────────────────────────────── */}
        {isEditing && activeTab === 'care' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
            <button
              type="button"
              onClick={handleGetRecommendations}
              disabled={careLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {careLoading
                ? <Loader2 size={15} className="animate-spin" />
                : <Sparkles size={15} />}
              {careLoading ? 'Getting recommendations...' : 'Get Recommendations'}
            </button>

            {careError && (
              <p className="text-xs text-red-400 text-center">{careError}</p>
            )}

            {careData && (
              <div className="space-y-3">
                {careData.summary && (
                  <p className="text-sm text-gray-300 leading-relaxed">{careData.summary}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Watering',     value: careData.watering },
                    { label: 'Light',        value: careData.light },
                    { label: 'Humidity',     value: careData.humidity },
                    { label: 'Soil',         value: careData.soil },
                    { label: 'Temperature',  value: careData.temperature },
                    { label: 'Fertilising',  value: careData.fertilising },
                  ].map(({ label, value }) => value && (
                    <CareSection key={label} label={label}>
                      <p className="text-xs text-gray-400">{value}</p>
                    </CareSection>
                  ))}
                </div>
                {careData.commonIssues && careData.commonIssues.length > 0 && (
                  <CareSection label="Common Issues">
                    <ul className="space-y-1">
                      {careData.commonIssues.map((issue, i) => (
                        <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                          <span className="text-red-500 flex-shrink-0">•</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </CareSection>
                )}
                {careData.tips && careData.tips.length > 0 && (
                  <CareSection label="Tips">
                    <ul className="space-y-1">
                      {careData.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                          <span className="text-emerald-500 flex-shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CareSection>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800 flex-shrink-0 gap-3">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  confirmDelete
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 border border-gray-700'
                }`}
              >
                <Trash2 size={14} />
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              Cancel
            </button>
            {showSave && (
              <button
                type="submit"
                form=""
                onClick={handleSubmit}
                disabled={!form.name.trim() || isSaving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.name.trim() && !isSaving
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Plant'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
