import React, { useRef, useCallback } from 'react'
import { Home, ScanLine, Upload, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react'
import PlantMarker from './PlantMarker.jsx'
import WeatherSky, { SKY_BORDER_COLORS } from './WeatherSky.jsx'
import FloorNav from './FloorNav.jsx'
import { GROUND_FLOOR_SVG, UPPER_FLOOR_SVG, GARDEN_SVG, generateFloorSvg } from '../data/defaultFloorSvgs.js'

function svgForFloor(floor) {
  if (!floor) return GROUND_FLOOR_SVG
  if (floor.rooms && floor.rooms.length > 0) return generateFloorSvg(floor)
  if (floor.type === 'outdoor') return GARDEN_SVG
  if (floor.order >= 1) return UPPER_FLOOR_SVG
  return GROUND_FLOOR_SVG
}

export default function FloorplanView({
  plants,
  onFloorplanUpload,
  onFloorplanClick,
  onMarkerClick,
  onMarkerDrag,
  weather,
  floors,
  activeFloorId,
  onFloorChange,
  isAnalysingFloorplan,
  sidebarOpen,
  onToggleSidebar,
}) {
  const containerRef = useRef(null)
  const lastTouchRef = useRef(0)

  const visibleFloors = floors.filter(f => !f.hidden)
  const activeFloor = visibleFloors.find(f => f.id === activeFloorId) ?? visibleFloors[0]

  const sky = weather && weather.current
    ? (weather.current.isDay ? weather.current.condition.sky : 'night')
    : null
  const borderColor = sky ? SKY_BORDER_COLORS[sky] : null

  const handleContainerClick = useCallback((e) => {
    // Suppress the synthetic click that fires ~300ms after a touch
    if (Date.now() - lastTouchRef.current < 500) return
    if (!containerRef.current) return
    if (e.target.closest('.plant-marker')) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100))
    onFloorplanClick(x, y)
  }, [onFloorplanClick])

  const handleTouchEnd = useCallback((e) => {
    if (e.changedTouches.length !== 1) return
    if (e.target.closest('.plant-marker')) return
    lastTouchRef.current = Date.now()
    const touch = e.changedTouches[0]
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(98, ((touch.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(2, Math.min(98, ((touch.clientY - rect.top) / rect.height) * 100))
    onFloorplanClick(x, y)
  }, [onFloorplanClick])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-active')
    const file = e.dataTransfer.files && e.dataTransfer.files[0]
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

  const hasAnalysedFloors = visibleFloors.some(f => f.rooms && f.rooms.length > 0)

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-950 border-r border-gray-800">
      {/* Toolbar */}
      <div className="flex items-center px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0 gap-2">
        <Home size={14} className="text-emerald-400 flex-shrink-0" />

        {/* Desktop: static floor name */}
        <span className="hidden md:inline text-sm text-gray-400 truncate">
          {activeFloor ? activeFloor.name : 'Floorplan'}
        </span>
        <span className="hidden md:inline text-xs text-gray-600">(click to place plant)</span>

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

      {/* Floor nav + canvas */}
      <div className="flex-1 overflow-hidden flex">
        <FloorNav
          floors={visibleFloors}
          activeFloorId={activeFloorId}
          onChange={onFloorChange}
        />

        <div className="flex-1 overflow-hidden p-3">
          <div
            ref={containerRef}
            className="floorplan-container w-full h-full rounded-xl overflow-hidden border-2 transition-colors"
            style={{
              position: 'relative',
              borderColor: borderColor ? borderColor : '#1f2937',
              boxShadow: borderColor ? ('0 0 20px ' + borderColor + '40') : undefined,
            }}
            onClick={handleContainerClick}
            onTouchEnd={handleTouchEnd}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Active floor — rendered directly, no stacking */}
            {activeFloor && (() => {
              const plantsOnFloor = plants.filter(p => (p.floor || 'ground') === activeFloor.id)
              return (
                <div className="floor-layer">
                  <div
                    style={{ width: '100%', height: '100%' }}
                    dangerouslySetInnerHTML={{ __html: svgForFloor(activeFloor) }}
                  />
                  <WeatherSky weather={weather} />
                  {plantsOnFloor.map(plant => (
                    <PlantMarker
                      key={plant.id}
                      plant={plant}
                      onClick={onMarkerClick}
                      onDragEnd={onMarkerDrag}
                      containerRef={containerRef}
                    />
                  ))}
                </div>
              )
            })()}

            {/* Full-canvas analysis loading overlay */}
            {isAnalysingFloorplan && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-40"
                style={{ background: 'rgba(7,13,24,0.85)', backdropFilter: 'blur(2px)' }}
              >
                <ScanLine size={32} className="text-emerald-400 animate-pulse" />
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-300">Analysing floorplan with Gemini</p>
                  <p className="text-xs text-gray-500 mt-1">Identifying floors and rooms...</p>
                </div>
              </div>
            )}

            {/* Upload prompt when no floors analysed yet */}
            {!isAnalysingFloorplan && !hasAnalysedFloors && (
              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{ zIndex: 5 }}
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/80 border border-gray-700 text-xs text-gray-500">
                  <Upload size={11} />
                  Upload a floorplan image to generate your home layout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
