import React, { useCallback, useState, useRef } from 'react'
import { Home, ScanLine, Upload, ChevronLeft, ChevronRight, Sun, Moon, Pencil } from 'lucide-react'
import LeafletFloorplan from './LeafletFloorplan.jsx'
import WeatherSky, { SKY_BORDER_COLORS } from './WeatherSky.jsx'
import FloorNav from './FloorNav.jsx'

export default function FloorplanView({
  plants,
  onFloorplanUpload,
  onFloorplanClick,
  onMarkerClick,
  onMarkerDrag,
  onRoomsChange,
  weather,
  floors,
  activeFloorId,
  onFloorChange,
  isAnalysingFloorplan,
  sidebarOpen,
  onToggleSidebar,
}) {
  const [editZones, setEditZones] = useState(false)
  const touchStartX = useRef(null)
  const visibleFloors  = floors.filter(f => !f.hidden)
  const activeFloor    = visibleFloors.find(f => f.id === activeFloorId) ?? visibleFloors[0]
  const plantsOnFloor  = plants.filter(p => (p.floor || 'ground') === activeFloor?.id)
  const hasAnalysedFloors = visibleFloors.some(f => f.rooms && f.rooms.length > 0)

  const sky = weather?.current
    ? (weather.current.isDay ? weather.current.condition.sky : 'night')
    : null
  const borderColor = sky ? SKY_BORDER_COLORS[sky] : null

  // File drag-drop for uploading a floorplan image
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-active')
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    onFloorplanUpload(file)
  }, [onFloorplanUpload])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-active')
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-active')
  }, [])

  // Swipe to switch floors on mobile
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null || visibleFloors.length < 2) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 60) return
    const idx = visibleFloors.findIndex(f => f.id === activeFloorId)
    if (dx < 0 && idx < visibleFloors.length - 1) onFloorChange(visibleFloors[idx + 1].id)
    if (dx > 0 && idx > 0) onFloorChange(visibleFloors[idx - 1].id)
  }, [visibleFloors, activeFloorId, onFloorChange])

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-950 border-r border-gray-800" style={{ background: 'linear-gradient(180deg, var(--tw-gray-950) 0%, #080e1a 100%)' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0 gap-2">
        <Home size={14} className="text-emerald-400 flex-shrink-0" />

        {/* Desktop: static floor name */}
        <span className="hidden md:inline text-sm text-gray-400 truncate">
          {activeFloor ? activeFloor.name : 'Floorplan'}
        </span>
        <span className="hidden md:inline text-xs text-gray-600">
          {editZones ? '(drag to draw zone)' : '(click to place plant)'}
        </span>

        {/* Edit zones toggle — only when floor has rooms */}
        {activeFloor?.rooms?.length > 0 && (
          <button
            onClick={() => setEditZones(z => !z)}
            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-colors flex-shrink-0 ${
              editZones
                ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={editZones ? 'Exit zone editing' : 'Edit zones'}
          >
            <Pencil size={12} />
            <span className="hidden lg:inline">{editZones ? 'Done' : 'Edit Zones'}</span>
          </button>
        )}

        {/* Mobile: floor selector dropdown */}
        {visibleFloors.length > 1 && (
          <select
            className="md:hidden text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none"
            value={activeFloorId}
            onChange={e => onFloorChange(e.target.value)}
          >
            {visibleFloors.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        {/* Sidebar toggle — tablet and desktop */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex ml-auto items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors flex-shrink-0"
            aria-label={sidebarOpen ? 'Hide plant list' : 'Show plant list'}
            aria-expanded={sidebarOpen}
            aria-controls="plant-sidebar"
          >
            {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            <span className="hidden lg:inline">{sidebarOpen ? 'Hide' : 'Plants'}</span>
          </button>
        )}

        {weather && (
          <span className={`flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0 ${onToggleSidebar ? '' : 'ml-auto'}`}>
            {weather.current.isDay
              ? <Sun size={13} className="text-yellow-400" />
              : <Moon size={13} className="text-indigo-400" />
            }
            <span className="text-base leading-none">{weather.current.condition.emoji}</span>
            <span>{weather.current.temp}°</span>
          </span>
        )}
      </div>

      {/* ── Weather sky strip ─────────────────────────────────────────────── */}
      {weather && (
        <div className="flex-shrink-0 relative overflow-hidden" style={{ height: 80 }}>
          <WeatherSky weather={weather} />
        </div>
      )}

      {/* ── Floor nav + Leaflet canvas ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">
        <FloorNav
          floors={visibleFloors}
          activeFloorId={activeFloorId}
          onChange={onFloorChange}
        />

        <div className="flex-1 overflow-hidden p-3">
          <div
            className="floorplan-container w-full h-full rounded-xl overflow-hidden border-2 transition-colors"
            style={{
              position: 'relative',
              borderColor: borderColor ?? '#1e2d42',
              boxShadow: borderColor ? `0 0 24px ${borderColor}30, inset 0 0 40px ${borderColor}05` : '0 4px 16px rgba(0,0,0,0.2)',
              borderRadius: '14px',
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Leaflet map — one instance per floor (keyed by floor id) */}
            {activeFloor && (
              <LeafletFloorplan
                key={activeFloor.id}
                floor={activeFloor}
                floors={floors}
                plants={plantsOnFloor}
                weather={weather}
                onFloorplanClick={onFloorplanClick}
                onMarkerClick={onMarkerClick}
                onMarkerDrag={onMarkerDrag}
                editMode={editZones}
                onRoomsChange={onRoomsChange}
              />
            )}

            {/* Full-canvas analysis loading overlay (above Leaflet layers) */}
            {isAnalysingFloorplan && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(7,13,24,0.85)', backdropFilter: 'blur(2px)', zIndex: 1000 }}
              >
                <ScanLine size={32} className="text-emerald-400 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-300">Analysing floorplan with Gemini</p>
                  <p className="text-xs text-gray-500 mt-1">Identifying floors and rooms...</p>
                </div>
              </div>
            )}

            {/* Upload prompt when no floors have been analysed yet */}
            {!isAnalysingFloorplan && !hasAnalysedFloors && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none animate-fade-in-up"
                style={{ zIndex: 1000 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center mb-4">
                  <Upload size={24} className="text-gray-500" />
                </div>
                <p className="hidden md:block text-sm text-gray-400 font-medium">Upload a floorplan to get started</p>
                <p className="hidden md:block text-xs text-gray-600 mt-1">Drag an image here or use the Upload button</p>
                <p className="md:hidden text-xs text-gray-500">Tap anywhere to add a plant</p>
              </div>
            )}

            {/* Hint when floor has rooms but no plants */}
            {!isAnalysingFloorplan && hasAnalysedFloors && plantsOnFloor.length === 0 && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none animate-fade-in"
                style={{ zIndex: 1000 }}
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 border border-gray-700 text-xs text-gray-400 shadow-lg">
                  <ScanLine size={12} className="text-emerald-500" />
                  <span className="hidden md:inline">Click anywhere on the floorplan to place a plant</span>
                  <span className="md:hidden">Tap to add a plant</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
