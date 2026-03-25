import React, { useState, useCallback } from 'react'
import {
  X, Key, Eye, EyeOff, CheckCircle2, AlertCircle, ExternalLink,
  Layers, Plus, Trash2, ChevronDown, ChevronRight, Settings,
} from 'lucide-react'

const TABS = [
  { id: 'floors', label: 'Floors & Zones', icon: Layers },
  { id: 'api',    label: 'API Key',         icon: Key },
]

function inputCls(extra = '') {
  return `w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors ${extra}`
}

// ── Floors tab ────────────────────────────────────────────────────────────────

function FloorRow({ floor, onToggleHidden, onNameChange, onTypeChange, onDelete, onUpdateRoom, onDeleteRoom, onAddRoom }) {
  const [expanded, setExpanded] = useState(false)
  const [newRoom, setNewRoom] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleAddRoom = () => {
    if (!newRoom.trim()) return
    onAddRoom(floor.id, newRoom.trim())
    setNewRoom('')
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(floor.id)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const rooms = floor.rooms || []

  return (
    <div className={`rounded-xl border transition-colors ${floor.hidden ? 'border-gray-800 bg-gray-900/30 opacity-60' : 'border-gray-700 bg-gray-800/50'}`}>
      {/* Floor header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() => onToggleHidden(floor.id)}
          title={floor.hidden ? 'Show floor' : 'Hide floor'}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          {floor.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>

        {/* Name */}
        <input
          className="flex-1 min-w-0 px-2 py-1 rounded-md bg-transparent border border-transparent hover:border-gray-600 focus:border-emerald-600 focus:outline-none text-sm text-white placeholder-gray-600 transition-colors"
          value={floor.name}
          onChange={e => onNameChange(floor.id, e.target.value)}
          placeholder="Floor name"
        />

        {/* Type badge */}
        <button
          type="button"
          onClick={() => onTypeChange(floor.id, floor.type === 'indoor' ? 'outdoor' : floor.type === 'outdoor' ? 'interior' : 'outdoor')}
          title="Toggle floor type"
          className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium transition-colors ${
            floor.type === 'outdoor'
              ? 'bg-green-900/40 text-green-400 border border-green-800/60 hover:bg-green-800/40'
              : 'bg-blue-900/40 text-blue-400 border border-blue-800/60 hover:bg-blue-800/40'
          }`}
        >
          {floor.type === 'outdoor' ? 'outdoor' : 'interior'}
        </button>

        {/* Expand rooms */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Hide rooms' : 'Edit rooms'}
          className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        {/* Delete floor */}
        <button
          type="button"
          onClick={handleDelete}
          className={`flex-shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
            confirmDelete
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'text-red-500 hover:text-red-400 hover:bg-red-900/30'
          }`}
        >
          {confirmDelete ? 'Confirm' : <Trash2 size={13} />}
        </button>
      </div>

      {/* Rooms section */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50 pt-2">
          {rooms.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No rooms defined — add one below or upload a floorplan.</p>
          ) : (
            <div className="space-y-1">
              {rooms.map((room, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 min-w-0 px-2 py-1 rounded-md bg-gray-900 border border-gray-700 focus:border-emerald-600 focus:outline-none text-sm text-white placeholder-gray-600 transition-colors"
                    value={room.name}
                    onChange={e => onUpdateRoom(floor.id, i, e.target.value)}
                    placeholder="Room name"
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteRoom(floor.id, i)}
                    className="flex-shrink-0 text-red-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add room */}
          <div className="flex gap-2">
            <input
              className={inputCls('flex-1')}
              placeholder="New room name…"
              value={newRoom}
              onChange={e => setNewRoom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
            />
            <button
              type="button"
              onClick={handleAddRoom}
              disabled={!newRoom.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FloorsTab({ floors, onChange }) {
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('interior')

  const sorted = [...floors].sort((a, b) => b.order - a.order)

  const toggleHidden = (id) =>
    onChange(floors.map(f => f.id === id ? { ...f, hidden: !f.hidden } : f))

  const updateName = (id, name) =>
    onChange(floors.map(f => f.id === id ? { ...f, name } : f))

  const updateType = (id, type) =>
    onChange(floors.map(f => f.id === id ? { ...f, type } : f))

  const deleteFloor = (id) =>
    onChange(floors.filter(f => f.id !== id))

  const updateRoom = (floorId, idx, name) =>
    onChange(floors.map(f => {
      if (f.id !== floorId) return f
      return { ...f, rooms: (f.rooms || []).map((r, i) => i === idx ? { ...r, name } : r) }
    }))

  const deleteRoom = (floorId, idx) =>
    onChange(floors.map(f => {
      if (f.id !== floorId) return f
      return { ...f, rooms: (f.rooms || []).filter((_, i) => i !== idx) }
    }))

  const addRoom = (floorId, name) =>
    onChange(floors.map(f => {
      if (f.id !== floorId) return f
      const rooms = f.rooms || []
      const last = rooms[rooms.length - 1]
      const newY = last ? Math.min(last.y + last.height + 2, 90) : 5
      return { ...f, rooms: [...rooms, { name, x: 5, y: newY, width: 90, height: Math.min(20, 95 - newY) }] }
    }))

  const addFloor = () => {
    if (!newName.trim()) return
    const maxOrder = Math.max(...floors.map(f => f.order), -1)
    const order = newType === 'outdoor' ? -1 : maxOrder + 1
    const id = newName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    onChange([...floors, { id, name: newName.trim(), type: newType, order, imageUrl: null, rooms: [], hidden: false }])
    setNewName('')
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Toggle floor visibility, rename floors, and edit rooms. Hidden floors don't appear in the main view.
      </p>

      <div className="space-y-2">
        {sorted.map(floor => (
          <FloorRow
            key={floor.id}
            floor={floor}
            onToggleHidden={toggleHidden}
            onNameChange={updateName}
            onTypeChange={updateType}
            onDelete={deleteFloor}
            onUpdateRoom={updateRoom}
            onDeleteRoom={deleteRoom}
            onAddRoom={addRoom}
          />
        ))}
      </div>

      {/* Add zone */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Add Zone / Floor</p>
        <div className="flex gap-2">
          <input
            className={inputCls('flex-1')}
            placeholder="Zone name (e.g. Loft, Basement)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFloor()}
          />
          <select
            className="px-2 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:outline-none focus:border-emerald-600 transition-colors"
            value={newType}
            onChange={e => setNewType(e.target.value)}
          >
            <option value="interior">Interior</option>
            <option value="outdoor">Outdoor</option>
          </select>
          <button
            type="button"
            onClick={addFloor}
            disabled={!newName.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── API Key tab ───────────────────────────────────────────────────────────────

function ApiKeyTab({ apiKey, onChange }) {
  const [showKey, setShowKey] = useState(false)
  const isValid = apiKey.trim().startsWith('sk-ant-')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
            Anthropic API Key
          </label>
          <p className="text-xs text-gray-500 leading-relaxed">
            Required for AI plant analysis. Stored only in your browser's localStorage.
          </p>
        </div>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={e => onChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {apiKey.trim() && (
          <div className={`flex items-center gap-1.5 text-xs ${isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isValid
              ? <><CheckCircle2 size={13} /> Key format looks valid</>
              : <><AlertCircle size={13} /> Key should start with "sk-ant-"</>}
          </div>
        )}

        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Get your API key at console.anthropic.com
          <ExternalLink size={11} />
        </a>
      </div>

      <div className="p-3 rounded-xl bg-gray-800 border border-gray-700">
        <p className="text-xs text-gray-400 font-medium mb-1">About AI Analysis</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          The AI analysis feature uses Claude Sonnet (claude-sonnet-4-6) to evaluate plant health, maturity, and provide personalised care recommendations from your plant photos.
        </p>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function SettingsModal({ currentApiKey, floors: initialFloors, onSave, onSaveFloors, onClose }) {
  const [tab, setTab] = useState('floors')

  // API key state
  const [apiKey, setApiKey] = useState(currentApiKey || '')
  const [apiSaved, setApiSaved] = useState(false)

  // Floors state — local copy for editing
  const [editableFloors, setEditableFloors] = useState(
    () => (initialFloors || []).map(f => ({ ...f, rooms: (f.rooms || []).map(r => ({ ...r })) }))
  )
  const [floorsSaving, setFloorsSaving] = useState(false)
  const [floorsSaved, setFloorsSaved] = useState(false)

  const handleSaveApi = useCallback(() => {
    onSave(apiKey.trim() || null)
    setApiSaved(true)
    setTimeout(() => setApiSaved(false), 2000)
  }, [apiKey, onSave])

  const handleSaveFloors = useCallback(async () => {
    setFloorsSaving(true)
    try {
      await onSaveFloors(editableFloors)
      setFloorsSaved(true)
      setTimeout(() => setFloorsSaved(false), 2000)
    } finally {
      setFloorsSaving(false)
    }
  }, [editableFloors, onSaveFloors])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-enter w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center">
              <Settings size={14} className="text-gray-300" />
            </div>
            <h2 className="text-base font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          {tab === 'floors'
            ? <FloorsTab floors={editableFloors} onChange={setEditableFloors} />
            : <ApiKeyTab apiKey={apiKey} onChange={setApiKey} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800 flex-shrink-0 gap-3">
          {tab === 'api' && apiKey && (
            <button
              onClick={() => setApiKey('')}
              className="px-3 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 border border-gray-700 transition-colors"
            >
              Clear Key
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              Cancel
            </button>
            {tab === 'floors' ? (
              <button
                onClick={handleSaveFloors}
                disabled={floorsSaving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  floorsSaved
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60'
                }`}
              >
                {floorsSaved ? <><CheckCircle2 size={14} /> Saved!</> : 'Save Floors'}
              </button>
            ) : (
              <button
                onClick={handleSaveApi}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  apiSaved
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {apiSaved ? <><CheckCircle2 size={14} /> Saved!</> : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
