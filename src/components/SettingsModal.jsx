import React, { useState, useCallback, useRef } from 'react'
import {
  X, Eye, EyeOff, CheckCircle2,
  Layers, Plus, Trash2, ChevronDown, ChevronRight, Settings,
  Sun, Moon, Upload,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme.js'

function inputCls(extra = '') {
  return `w-full px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 focus:bg-gray-800 transition-all ${extra}`
}

function FloorRow({ floor, onToggleHidden, onNameChange, onTypeChange, onDelete, onUpdateRoom, onToggleRoom, onDeleteRoom, onAddRoom }) {
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
                <div key={i} className={`flex items-center gap-2 ${room.hidden ? 'opacity-50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => onToggleRoom(floor.id, i)}
                    title={room.hidden ? 'Show room' : 'Hide room'}
                    className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {room.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <input
                    className={`flex-1 min-w-0 px-2 py-1 rounded-md bg-gray-900 border border-gray-700 focus:border-emerald-600 focus:outline-none text-sm placeholder-gray-600 transition-colors ${room.hidden ? 'text-gray-500 line-through' : 'text-white'}`}
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

  const toggleRoom = (floorId, idx) =>
    onChange(floors.map(f => {
      if (f.id !== floorId) return f
      return { ...f, rooms: (f.rooms || []).map((r, i) => i === idx ? { ...r, hidden: !r.hidden } : r) }
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
            onToggleRoom={toggleRoom}
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

export default function SettingsModal({ floors: initialFloors, onSaveFloors, onClose, onToggleTheme, onFloorplanUpload, isAnalysingFloorplan }) {
  const theme = useTheme()
  const fileInputRef = useRef(null)
  const [editableFloors, setEditableFloors] = useState(
    () => (initialFloors || []).map(f => ({ ...f, rooms: (f.rooms || []).map(r => ({ ...r })) }))
  )
  const [floorsSaving, setFloorsSaving] = useState(false)
  const [floorsSaved, setFloorsSaved] = useState(false)

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

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    onFloorplanUpload(file)
    e.target.value = ''
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in-up w-full flex-1 md:flex-none md:max-w-lg bg-gray-900 md:border md:border-gray-800 md:rounded-2xl shadow-2xl shadow-black/40 flex flex-col md:max-h-[calc(100vh-2rem)]" style={{ background: 'linear-gradient(180deg, var(--tw-gray-900) 0%, #0f1925 100%)' }}>
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

        {/* Header label */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-emerald-400" />
            <span className="text-sm font-medium text-gray-300">Floors &amp; Zones</span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalysingFloorplan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isAnalysingFloorplan ? 'Analysing…' : 'Upload floorplan'}
          >
            <Upload size={13} />
            {isAnalysingFloorplan ? 'Analysing…' : 'Upload Floorplan'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          <FloorsTab floors={editableFloors} onChange={setEditableFloors} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-gray-800 flex-shrink-0 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
          >
            Cancel
          </button>
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
        </div>

        {/* Preferences */}
        <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Theme</span>
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
