import React, { useRef, useCallback } from 'react'
import { Upload, Home } from 'lucide-react'
import PlantMarker from './PlantMarker.jsx'
import WeatherSky, { SKY_BORDER_COLORS } from './WeatherSky.jsx'
import FloorNav from './FloorNav.jsx'
import { GROUND_FLOOR_SVG, UPPER_FLOOR_SVG, GARDEN_SVG } from '../data/defaultFloorSvgs.js'

function defaultSvgForFloor(floor) {
  if (!floor) return GROUND_FLOOR_SVG
  if (floor.type === 'outdoor') return GARDEN_SVG
  if (floor.order >= 1) return UPPER_FLOOR_SVG
  return GROUND_FLOOR_SVG
}

function floorOffset(floor, activeOrder) {
  if (floor.order === activeOrder) return 'translateY(0%)'
  if (floor.order > activeOrder) return 'translateY(-100%)'
  return 'translateY(100%)'
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
}) {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  const activeFloor = floors.find(f => f.id === activeFloorId) ?? floors[0]
  const activeOrder = activeFloor?.order ?? 0

  const sky = weather?.current
    ? (weather.current.isDay ? weather.current.condition.sky : 'night')
    : null
  const borderColor = sky ? SKY_BORDER_COLORS[sky] : null

  const handleContainerClick = useCallback((e) => {
    if (!containerRef.current) return
    if (e.target.closest('.plant-marker')) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100))
    onFloorplanClick(x, y)
  }, [onFloorplanClick])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    onFloorplanUpload(file)
    e.target.value = ''
  }, [onFloorplanUpload])

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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-950 border-r border-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Home size={14} className="text-emerald-400" />
          <span className="text-sm text-gray-400">
            {activeFloor?.name ?? 'Floorplan'}
          </span>
          <span className="text-xs text-gray-600">(click to place plant)</span>
          {weather && (
            <span className="flex items-center gap-1 text-xs text-gray-400 ml-1">
              <span className="text-base leading-none">{weather.current.condition.emoji}</span>
              <span>{weather.current.temp}°</span>
            </span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
        >
          <Upload size={12} />
          Upload Floorplan
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Floor nav + canvas */}
      <div className="flex-1 overflow-hidden flex">
        <FloorNav
          floors={floors}
          activeFloorId={activeFloorId}
          onChange={onFloorChange}
        />

        <div className="flex-1 overflow-hidden p-3">
          <div
            ref={containerRef}
            className="floorplan-container w-full h-full rounded-xl overflow-hidden border-2 transition-colors"
            style={{
              position: 'relative',
              borderColor: borderColor ?? '#1f2937',
              boxShadow: borderColor ? `0 0 20px ${borderColor}40` : undefined,
            }}
            onClick={handleContainerClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* All floor layers — CSS translateY stacks them like building floors */}
            {floors.map(floor => {
              const plantsOnFloor = plants.filter(p => (p.floor ?? 'ground') === floor.id)
              const isActive = floor.id === activeFloorId
              return (
                <div
                  key={floor.id}
                  className="floor-layer"
                  style={{
                    transform: floorOffset(floor, activeOrder),
                    pointerEvents: isActive ? 'auto' : 'none',
                  }}
                >
                  {/* Background: uploaded image or default SVG */}
                  {floor.imageUrl ? (
                    <img
                      src={floor.imageUrl}
                      alt={floor.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        background: '#111827',
                      }}
                      draggable={false}
                    />
                  ) : (
                    <div
                      style={{ width: '100%', height: '100%' }}
                      dangerouslySetInnerHTML={{ __html: defaultSvgForFloor(floor) }}
                    />
                  )}

                  {/* Weather overlay on active floor only */}
                  {isActive && <WeatherSky weather={weather} />}

                  {/* Plant markers for this floor */}
                  {plantsOnFloor.map(plant => (
                    <PlantMarker
                      key={plant.id}
                      plant={plant}
                      onClick={onMarkerClick}
                      onDragEnd={onMarkerDrag}
                      containerRef={containerRef}
                    />
                  ))}

                  {/* Drop hint when no reference image */}
                  {isActive && !floor.imageUrl && (
                    <div
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
                      style={{ zIndex: 5 }}
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/80 border border-gray-700 text-xs text-gray-500">
                        <Upload size={11} />
                        Drop an image or click Upload Floorplan
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
