import React, { useRef, useCallback } from 'react'
import { Upload, Home } from 'lucide-react'
import PlantMarker from './PlantMarker.jsx'
import WeatherSky, { SKY_BORDER_COLORS } from './WeatherSky.jsx'

const DEFAULT_FLOORPLAN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#111827">
  <!-- Outer walls -->
  <rect x="50" y="80" width="700" height="480" fill="none" stroke="#374151" stroke-width="8" rx="4"/>

  <!-- Roof / triangle -->
  <polygon points="400,20 760,80 40,80" fill="none" stroke="#374151" stroke-width="6"/>

  <!-- Living Room label area -->
  <rect x="60" y="90" width="320" height="220" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="220" y="205" text-anchor="middle" fill="#4b5563" font-size="16" font-family="sans-serif">Living Room</text>

  <!-- Kitchen -->
  <rect x="390" y="90" width="350" height="220" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="565" y="205" text-anchor="middle" fill="#4b5563" font-size="16" font-family="sans-serif">Kitchen</text>

  <!-- Kitchen counter suggestion -->
  <rect x="630" y="100" width="100" height="40" fill="#374151" rx="2"/>
  <rect x="720" y="100" width="10" height="200" fill="#374151" rx="2"/>

  <!-- Bedroom 1 -->
  <rect x="60" y="320" width="200" height="230" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="160" y="438" text-anchor="middle" fill="#4b5563" font-size="14" font-family="sans-serif">Bedroom 1</text>
  <!-- Bed shape -->
  <rect x="75" y="335" width="120" height="80" fill="#374151" rx="4"/>
  <rect x="75" y="335" width="120" height="22" fill="#4b5563" rx="4"/>

  <!-- Bedroom 2 -->
  <rect x="270" y="320" width="200" height="230" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="370" y="438" text-anchor="middle" fill="#4b5563" font-size="14" font-family="sans-serif">Bedroom 2</text>
  <rect x="285" y="335" width="120" height="80" fill="#374151" rx="4"/>
  <rect x="285" y="335" width="120" height="22" fill="#4b5563" rx="4"/>

  <!-- Bathroom -->
  <rect x="480" y="320" width="130" height="120" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="545" y="383" text-anchor="middle" fill="#4b5563" font-size="13" font-family="sans-serif">Bath</text>
  <!-- Tub outline -->
  <rect x="490" y="330" width="50" height="100" fill="none" stroke="#374151" stroke-width="2" rx="6"/>

  <!-- Garden/Balcony -->
  <rect x="620" y="320" width="120" height="230" fill="#14532d22" stroke="#166534" stroke-width="3" stroke-dasharray="8,4" rx="4"/>
  <text x="680" y="438" text-anchor="middle" fill="#166534" font-size="13" font-family="sans-serif">Garden</text>

  <!-- Hallway -->
  <rect x="480" y="448" width="130" height="102" fill="#1f2937" stroke="#374151" stroke-width="3" rx="2"/>
  <text x="545" y="500" text-anchor="middle" fill="#4b5563" font-size="12" font-family="sans-serif">Hallway</text>

  <!-- Door symbols -->
  <path d="M380 310 Q380 320 390 320" fill="none" stroke="#6b7280" stroke-width="2"/>
  <path d="M260 310 Q260 320 270 320" fill="none" stroke="#6b7280" stroke-width="2"/>
  <path d="M470 380 Q470 390 480 390" fill="none" stroke="#6b7280" stroke-width="2"/>

  <!-- Window symbols on outer walls -->
  <line x1="120" y1="88" x2="180" y2="88" stroke="#60a5fa" stroke-width="3"/>
  <line x1="500" y1="88" x2="560" y2="88" stroke="#60a5fa" stroke-width="3"/>
  <line x1="742" y1="200" x2="742" y2="260" stroke="#60a5fa" stroke-width="3"/>
  <line x1="58" y1="200" x2="58" y2="260" stroke="#60a5fa" stroke-width="3"/>
</svg>
`

export default function FloorplanView({
  plants,
  floorplanImage,
  onFloorplanUpload,
  onFloorplanClick,
  onMarkerClick,
  weather,
}) {
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  const sky = weather?.current
    ? (weather.current.isDay ? weather.current.condition.sky : 'night')
    : null
  const borderColor = sky ? SKY_BORDER_COLORS[sky] : null

  const handleContainerClick = useCallback((e) => {
    if (!containerRef.current) return
    // Ignore if clicking on a marker
    if (e.target.closest('.plant-marker')) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const clampedX = Math.max(2, Math.min(98, x))
    const clampedY = Math.max(2, Math.min(98, y))

    onFloorplanClick(clampedX, clampedY)
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
          <span className="text-sm text-gray-400">Floorplan</span>
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

      {/* Floorplan area */}
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
          {floorplanImage ? (
            <img
              src={floorplanImage}
              alt="Floorplan"
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
              dangerouslySetInnerHTML={{ __html: DEFAULT_FLOORPLAN_SVG }}
            />
          )}

          {/* Weather sky overlay — rendered before markers so markers stay on top */}
          <WeatherSky weather={weather} />

          {/* Plant markers */}
          {plants.map(plant => (
            <PlantMarker
              key={plant.id}
              plant={plant}
              onClick={onMarkerClick}
            />
          ))}

          {/* Drop hint overlay when no floorplan */}
          {!floorplanImage && (
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
      </div>
    </div>
  )
}
