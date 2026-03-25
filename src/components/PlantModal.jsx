import React, { useState, useEffect, useCallback } from 'react'
import { X, Trash2, Save, Leaf, Loader2 } from 'lucide-react'
import ImageAnalyser from './ImageAnalyser.jsx'
import { imagesApi } from '../api/plants.js'

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

export default function PlantModal({ plant, position, floors, activeFloorId, onSave, onDelete, onClose }) {
  const isEditing = !!plant

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

  // Compute urgency for current plant data
  const daysUntil = React.useMemo(() => {
    if (!form.lastWatered || !form.frequencyDays) return null
    const last = new Date(form.lastWatered)
    const next = new Date(last.getTime() + Number(form.frequencyDays) * 86400000)
    return Math.ceil((next - new Date()) / 86400000)
  }, [form.lastWatered, form.frequencyDays])

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
              {isEditing ? 'Edit Plant' : 'Add Plant'}
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

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 py-4 space-y-4">
            {/* Name */}
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

            {/* Species */}
            <FormField label="Species">
              <input
                className={InputClass()}
                type="text"
                placeholder="e.g. Nephrolepis exaltata"
                value={form.species}
                onChange={e => update('species', e.target.value)}
              />
            </FormField>

            {/* Floor + Room */}
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

            {/* Watering */}
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

            {/* Health & Maturity (manual override) */}
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

            {/* Notes */}
            <FormField label="Notes">
              <textarea
                className={InputClass('resize-none')}
                rows={3}
                placeholder="Any special care instructions, observations..."
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
              />
            </FormField>

            {/* Divider */}
            <hr className="border-gray-800" />

            {/* Image Analyser */}
            <ImageAnalyser
              initialImage={form.imageUrl}
              onAnalysisComplete={handleAnalysisComplete}
              onImageChange={handleImageChange}
            />
          </div>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800 flex-shrink-0 gap-3">
          {isEditing ? (
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
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              Cancel
            </button>
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
          </div>
        </div>
      </div>
    </div>
  )
}
