import React, { useMemo, useState, useCallback } from 'react'
import { Droplets, AlertCircle, Clock, CheckCircle2, MapPin, CloudRain, Plus, Search, Sun, Moon, Check, Leaf, ListChecks } from 'lucide-react'
import { getWateringStatus, urgencyColor, urgencyLabel, OUTDOOR_ROOMS } from '../utils/watering.js'
import { useToast } from './Toast.jsx'

function dayLabel(dateStr, index) {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tmrw'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })
}

function WeatherSection({ weather, locationDenied, outdoorPlantCount }) {
  if (locationDenied) {
    return (
      <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MapPin size={12} />
          <span>Enable location for weather</span>
        </div>
      </div>
    )
  }
  if (!weather) return null

  const { current, days } = weather
  const forecast = days.slice(0, 3)
  const nearRain  = days.slice(0, 3).filter(d => d.precipitation >= 2)
  const showAlert = outdoorPlantCount > 0 && nearRain.length > 0

  return (
    <div className="border-b border-gray-800 flex-shrink-0">
      {/* Current conditions */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{current.condition.emoji}</span>
          <div>
            <p className="text-xs font-medium text-white leading-tight">{current.condition.label}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {current.isDay
                ? <Sun size={11} className="text-yellow-400" />
                : <Moon size={11} className="text-indigo-400" />
              }
              <span className="text-xs text-gray-600">{current.isDay ? 'Day' : 'Night'}</span>
            </div>
          </div>
        </div>
        <span className="text-xl font-light text-white">{current.temp}°</span>
      </div>

      {/* 3-day forecast */}
      <div className="px-4 pb-2 space-y-1">
        {forecast.map((day, i) => {
          const hasRain = day.precipitation >= 2
          return (
            <div key={day.date} className="flex items-center gap-2 text-xs">
              <span className="w-8 text-gray-500 font-medium flex-shrink-0">{dayLabel(day.date, i)}</span>
              <span className="text-sm leading-none flex-shrink-0">{day.condition.emoji}</span>
              <span className="flex-1 text-gray-500 truncate">{day.condition.label}</span>
              <span className="text-gray-500 flex-shrink-0 tabular-nums">
                {day.maxTemp}°<span className="text-gray-700">/</span>{day.minTemp}°
              </span>
              {hasRain && (
                <span className="text-blue-400 font-medium flex-shrink-0 tabular-nums">
                  {day.precipitation.toFixed(1)}mm
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Outdoor watering alert */}
      {showAlert && (
        <div className="mx-4 mb-3 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-blue-950/60 border border-blue-900/60">
          <CloudRain size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300 leading-snug">
            Rain forecast ({nearRain.map(d => dayLabel(d.date, forecast.indexOf(d))).join(', ')})
            {' '}— skip watering outdoor plants
          </p>
        </div>
      )}
    </div>
  )
}

function UrgencyIcon({ days, skippedRain }) {
  if (skippedRain) return <CloudRain size={14} style={{ color: '#60a5fa' }} />
  if (days < 0)  return <AlertCircle size={14} style={{ color: '#ef4444' }} />
  if (days === 0) return <Droplets size={14} style={{ color: '#f97316' }} />
  if (days <= 2)  return <Clock size={14} style={{ color: '#eab308' }} />
  return <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
}

function HealthBadge({ health }) {
  if (!health) return null
  const colors = {
    Excellent: 'bg-emerald-900 text-emerald-300',
    Good: 'bg-green-900 text-green-300',
    Fair: 'bg-yellow-900 text-yellow-300',
    Poor: 'bg-red-900 text-red-300',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[health] || 'bg-gray-800 text-gray-400'}`}>
      {health}
    </span>
  )
}

function MaturityBadge({ maturity }) {
  if (!maturity) return null
  const colors = {
    Seedling: 'bg-cyan-900 text-cyan-300',
    Young: 'bg-blue-900 text-blue-300',
    Mature: 'bg-violet-900 text-violet-300',
    Established: 'bg-purple-900 text-purple-300',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[maturity] || 'bg-gray-800 text-gray-400'}`}>
      {maturity}
    </span>
  )
}

function PlantCard({ plant, onClick, onWater, weather, floors, selectMode, selected, onSelect }) {
  const [imgError, setImgError] = useState(false)
  const status = getWateringStatus(plant, weather, floors)
  const { daysUntil, color, label, note, skippedRain } = status
  const initial = plant.name ? plant.name.charAt(0).toUpperCase() : '?'
  const showPhoto = plant.imageUrl && !imgError

  return (
    <div
      className={`w-full flex rounded-lg bg-gray-800 border transition-all duration-150 group overflow-hidden hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg hover:shadow-black/20 ${
        selected ? 'border-emerald-500 bg-emerald-950/20' : 'border-gray-700 hover:border-gray-600'
      }`}
      style={{ borderTop: `3px solid ${color}` }}
    >
      <button
        onClick={() => selectMode ? onSelect(plant.id) : onClick(plant)}
        className="flex-1 flex items-center gap-2.5 text-left px-3 py-2.5 min-w-0"
      >
        {/* Checkbox in select mode */}
        {selectMode && (
          <div
            className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
              selected
                ? 'bg-emerald-600 border-emerald-500'
                : 'bg-gray-800 border-gray-600'
            }`}
          >
            {selected && <Check size={12} className="text-white" />}
          </div>
        )}

        {/* Avatar: photo thumbnail or initial with leaf icon */}
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold overflow-hidden relative"
          style={{
            backgroundColor: showPhoto ? 'transparent' : color,
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 1px ${color}40`,
          }}
        >
          {showPhoto ? (
            <img
              src={plant.imageUrl}
              alt={plant.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <Leaf size={16} className="absolute opacity-15" />
              <span className="relative">{initial}</span>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-medium text-white truncate">{plant.name}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <UrgencyIcon days={daysUntil} skippedRain={skippedRain} />
              <span className="text-xs font-medium" style={{ color }}>
                {label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {plant.species && (
              <span className="text-xs text-gray-500 truncate">{plant.species}</span>
            )}
            {plant.species && plant.room && (
              <span className="text-gray-700 text-xs">·</span>
            )}
            {plant.room && (
              <span className="text-xs text-gray-600 truncate">{plant.room}</span>
            )}
          </div>
          {note && (
            <p className="text-xs text-blue-400 mt-0.5 truncate">{note}</p>
          )}
          {(plant.health || plant.maturity) && (
            <div className="mt-1 flex items-center gap-1">
              <HealthBadge health={plant.health} />
              <MaturityBadge maturity={plant.maturity} />
            </div>
          )}
        </div>
      </button>

      {onWater && !selectMode && (
        <button
          onClick={() => onWater(plant.id)}
          className="flex-shrink-0 px-2.5 hover:bg-blue-900/30 text-gray-600 hover:text-blue-400 transition-colors border-l border-gray-700"
          aria-label={`Mark ${plant.name} as watered`}
          title={`Water ${plant.name} now`}
        >
          <Droplets size={13} />
        </button>
      )}
    </div>
  )
}

function BatchActionBar({ selectedCount, onWaterSelected, onWaterAllDue, onSelectAll, onDeselectAll, onCancel, dueCount }) {
  return (
    <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 flex-shrink-0 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">{selectedCount} selected</span>
        <div className="flex items-center gap-2">
          <button
            onClick={selectedCount > 0 ? onDeselectAll : onSelectAll}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {selectedCount > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onWaterSelected}
          disabled={selectedCount === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Droplets size={12} />
          Water Selected
        </button>
        {dueCount > 0 && (
          <button
            onClick={onWaterAllDue}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition-colors"
          >
            <AlertCircle size={12} />
            Water All Due ({dueCount})
          </button>
        )}
      </div>
    </div>
  )
}

const LEGEND_ITEMS = [
  { color: '#ef4444', label: 'Overdue' },
  { color: '#f97316', label: 'Due today' },
  { color: '#eab308', label: '1–2 days' },
  { color: '#22c55e', label: 'All good' },
]

function SkeletonCard() {
  return (
    <div className="w-full flex rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5">
      <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, #374151 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
      <div className="flex-1 ml-2.5 space-y-2">
        <div className="h-3 bg-gray-700 rounded w-24 animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, #374151 0%, #4b5563 50%, #374151 100%)', backgroundSize: '200% 100%' }} />
        <div className="h-2.5 bg-gray-700/60 rounded w-16 animate-shimmer" style={{ backgroundImage: 'linear-gradient(90deg, #374151 0%, #4b5563 50%, #374151 100%)', backgroundSize: '200% 100%', animationDelay: '0.2s' }} />
      </div>
    </div>
  )
}

export default function PlantSidebar({ plants, floors, activeFloorId, onPlantClick, onAddPlant, onWater, onBatchWater, loading, weather, locationDenied }) {
  const toast = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [roomFilter, setRoomFilter] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Filter to only plants on the active floor (if a floor is selected)
  const floorPlants = useMemo(() => {
    if (!activeFloorId) return plants
    return plants.filter(p => (p.floor || 'ground') === activeFloorId)
  }, [plants, activeFloorId])

  const sortedPlants = useMemo(() => {
    return [...floorPlants].sort((a, b) => {
      const daysA = getWateringStatus(a, weather, floors).daysUntil
      const daysB = getWateringStatus(b, weather, floors).daysUntil
      return daysA - daysB
    })
  }, [floorPlants, weather, floors])

  const rooms = useMemo(
    () => [...new Set(floorPlants.map(p => p.room).filter(Boolean))].sort(),
    [floorPlants]
  )

  const filteredPlants = useMemo(() => {
    let result = sortedPlants
    if (roomFilter) result = result.filter(p => p.room === roomFilter)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q)
      )
    }
    return result
  }, [sortedPlants, roomFilter, searchTerm])

  // Weather alert uses all plants (outdoor alert applies regardless of active floor)
  const outdoorPlantCount = useMemo(
    () => plants.filter(p => OUTDOOR_ROOMS.has(p.room)).length,
    [plants]
  )

  const counts = useMemo(() => {
    const overdue = filteredPlants.filter(p => getWateringStatus(p, weather, floors).daysUntil < 0).length
    const today   = filteredPlants.filter(p => { const s = getWateringStatus(p, weather, floors); return !s.skippedRain && s.daysUntil === 0 }).length
    const soon    = filteredPlants.filter(p => { const d = getWateringStatus(p, weather, floors).daysUntil; return d > 0 && d <= 2 }).length
    const good    = filteredPlants.filter(p => getWateringStatus(p, weather, floors).daysUntil > 2).length
    return { overdue, today, soon, good }
  }, [filteredPlants, weather, floors])

  const duePlantIds = useMemo(() =>
    filteredPlants
      .filter(p => getWateringStatus(p, weather, floors).daysUntil <= 0)
      .map(p => p.id),
    [filteredPlants, weather, floors]
  )

  const isFiltered = roomFilter !== null || searchTerm.trim() !== ''

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleWaterSelected = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const count = await onBatchWater(ids)
    toast(`Watered ${count} plant${count !== 1 ? 's' : ''}`)
    exitSelectMode()
  }, [selectedIds, onBatchWater, toast, exitSelectMode])

  const handleWaterAllDue = useCallback(async () => {
    if (duePlantIds.length === 0) return
    const count = await onBatchWater(duePlantIds)
    toast(`Watered ${count} plant${count !== 1 ? 's' : ''}`)
    exitSelectMode()
  }, [duePlantIds, onBatchWater, toast, exitSelectMode])

  return (
    <div id="plant-sidebar" className="flex flex-col bg-gray-900 border-l border-gray-800 w-full h-full">
      {/* Weather */}
      <WeatherSection
        weather={weather}
        locationDenied={locationDenied}
        outdoorPlantCount={outdoorPlantCount}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Plant List</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {isFiltered ? `${filteredPlants.length} / ${floorPlants.length}` : floorPlants.length} plants
            </span>
            {onBatchWater && floorPlants.length > 0 && (
              <button
                onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors font-medium ${
                  selectMode
                    ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                <ListChecks size={12} />
                {selectMode ? 'Done' : 'Select'}
              </button>
            )}
            <button
              onClick={onAddPlant}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium"
            >
              <Plus size={12} />
              Add Plant
            </button>
          </div>
        </div>
        {/* Summary pills */}
        {floorPlants.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {counts.overdue > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-900">
                {counts.overdue} overdue
              </span>
            )}
            {counts.today > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-900">
                {counts.today} today
              </span>
            )}
            {counts.soon > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-950 text-yellow-400 border border-yellow-900">
                {counts.soon} soon
              </span>
            )}
            {counts.good > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">
                {counts.good} good
              </span>
            )}
          </div>
        )}
      </div>

      {/* Search + room filter */}
      {floorPlants.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-800 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Search plants…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
          {rooms.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {rooms.map(room => (
                <button
                  key={room}
                  onClick={() => setRoomFilter(f => f === room ? null : room)}
                  aria-pressed={roomFilter === room}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    roomFilter === room
                      ? 'bg-emerald-700 border-emerald-600 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {room}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plant list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredPlants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 animate-fade-in-up">
            {plants.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center mb-4">
                  <Leaf size={28} className="text-emerald-600" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No plants yet</p>
                <p className="text-xs text-gray-600 mt-1 max-w-[200px]">Click on the floorplan or tap the button below to add your first plant</p>
                <button
                  onClick={onAddPlant}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium"
                >
                  <Plus size={12} />
                  Get started
                </button>
              </>
            ) : floorPlants.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center mb-4">
                  <MapPin size={28} className="text-gray-600" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No plants on this floor</p>
                <p className="text-xs text-gray-600 mt-1">Click on the floorplan to add a plant here</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center mb-4">
                  <Search size={28} className="text-gray-600" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No plants match</p>
                <p className="text-xs text-gray-600 mt-1">Try a different search or filter</p>
                <button
                  onClick={() => { setSearchTerm(''); setRoomFilter(null) }}
                  className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          filteredPlants.map(plant => (
            <PlantCard
              key={plant.id}
              plant={plant}
              onClick={onPlantClick}
              onWater={onWater}
              weather={weather}
              floors={floors}
              selectMode={selectMode}
              selected={selectedIds.has(plant.id)}
              onSelect={toggleSelect}
            />
          ))
        )}
      </div>

      {/* Batch action bar or Legend */}
      {selectMode ? (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onWaterSelected={handleWaterSelected}
          onWaterAllDue={handleWaterAllDue}
          onSelectAll={() => setSelectedIds(new Set(filteredPlants.map(p => p.id)))}
          onDeselectAll={() => setSelectedIds(new Set())}
          onCancel={exitSelectMode}
          dueCount={duePlantIds.length}
        />
      ) : (
        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">Legend</p>
          <div className="space-y-1.5">
            {LEGEND_ITEMS.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
