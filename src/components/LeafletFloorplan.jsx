import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getWateringStatus } from '../utils/watering.js'

// ── Coordinate helpers ────────────────────────────────────────────────────────
// Gemini / stored coords: (x, y) percentages, y axis goes DOWN.
// Leaflet CRS.Simple: [lat, lng], lat axis goes UP.
// Mapping: lat = 100 - y,  lng = x
function toLL(x, y) { return L.latLng(100 - y, x) }
function fromLL({ lat, lng }) { return { x: lng, y: 100 - lat } }

const BOUNDS = L.latLngBounds([[0, 0], [100, 100]])

// ── Plant marker DivIcon ──────────────────────────────────────────────────────
// Map plant type to a simple emoji for the marker
function getPlantEmoji(plant) {
  const species = (plant.species || '').toLowerCase()
  if (/cactus|succulent|aloe/i.test(species)) return '🌵'
  if (/tree|palm|fig|olive|eucalyptus/i.test(species)) return '🌳'
  if (/herb|basil|mint|rosemary/i.test(species)) return '🌿'
  if (/vine|ivy|pothos|philodendron|monstera/i.test(species)) return '🍃'
  if (/flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/i.test(species)) return '🌸'
  if (/grass|hedge|shrub/i.test(species)) return '🌲'
  return '🪴'
}

function makePlantIcon(plant, weather, floors) {
  const { color, daysUntil } = getWateringStatus(plant, weather, floors)
  const overdue = daysUntil < 0
  const attention = daysUntil >= 0 && daysUntil <= 2
  const emoji = getPlantEmoji(plant)
  const cls = overdue ? ' plant-lf-overdue' : attention ? ' plant-lf-attention' : ''

  return L.divIcon({
    className: 'plant-lf-icon',
    html: `<div class="plant-lf-inner${cls}"
                style="width:32px;height:32px;border-radius:50%;
                       border:2px solid ${color};
                       background:#fff;
                       display:flex;align-items:center;justify-content:center;
                       box-shadow:0 2px 8px ${color}80,0 0 0 3px ${color}30;">
              <span style="font-size:16px;line-height:1;">${emoji}</span>
            </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18],
  })
}

// ── Room rectangle styles by floor type ──────────────────────────────────────
const ROOM_STYLE = {
  indoor:   { color: '#495057', weight: 3, fillColor: '#ffffff', fillOpacity: 0.9, dashArray: null },
  interior: { color: '#495057', weight: 3, fillColor: '#ffffff', fillOpacity: 0.9, dashArray: null },
  outdoor:  { color: '#2e7d32', weight: 2, fillColor: '#e8f5e9', fillOpacity: 0.5, dashArray: '6 4' },
}

// ── Edit mode icons ───────────────────────────────────────────────────────────
function makeMoveIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:#10b981;border-radius:50%;border:2px solid #fff;cursor:move;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);" title="Drag to move zone">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
               <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
               <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
             </svg>
           </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function makeResizeIcon(corner) {
  const cursor = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' }[corner]
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;background:#fff;border:2px solid #10b981;border-radius:2px;cursor:${cursor};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LeafletFloorplan({
  floor,
  floors,
  plants,
  weather,
  onFloorplanClick,
  onMarkerClick,
  onMarkerDrag,
  editMode = false,
  onRoomsChange,
  gnomeWaterRef,
}) {
  const containerRef   = useRef(null)
  const mapRef         = useRef(null)
  const roomLayerRef   = useRef(null)
  const imageLayerRef  = useRef(null)
  const markerLayerRef = useRef(null)
  const editLayerRef   = useRef(null)
  const drawRef        = useRef(null) // { startLL, tempRect }
  const prevFloorIdRef = useRef(null)


  // Stable callback refs — avoid stale closures in Leaflet event handlers
  const clickRef       = useRef(onFloorplanClick)
  const markerClickRef = useRef(onMarkerClick)
  const markerDragRef  = useRef(onMarkerDrag)
  const onRoomsRef     = useRef(onRoomsChange)
  const editModeRef    = useRef(editMode)
  const floorRef       = useRef(floor)
  useEffect(() => { clickRef.current       = onFloorplanClick }, [onFloorplanClick])
  useEffect(() => { markerClickRef.current = onMarkerClick    }, [onMarkerClick])
  useEffect(() => { markerDragRef.current  = onMarkerDrag     }, [onMarkerDrag])
  useEffect(() => { onRoomsRef.current     = onRoomsChange    }, [onRoomsChange])
  useEffect(() => { editModeRef.current    = editMode         }, [editMode])
  useEffect(() => { floorRef.current       = floor            }, [floor])

  // ── Initialise Leaflet once ───────────────────────────────────────────────
  useEffect(() => {
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    map.fitBounds(BOUNDS)

    roomLayerRef.current   = L.layerGroup().addTo(map)
    imageLayerRef.current  = L.layerGroup().addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    editLayerRef.current   = L.layerGroup().addTo(map)

    map.on('click', (e) => {
      if (editModeRef.current) return
      const { x, y } = fromLL(e.latlng)
      clickRef.current?.(
        Math.round(x * 10) / 10,
        Math.round(y * 10) / 10,
      )
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Draw mode (click-drag to create a new zone) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!editMode) {
      if (drawRef.current?.tempRect) drawRef.current.tempRect.remove()
      drawRef.current = null
      return
    }

    const onMouseDown = (e) => {
      drawRef.current = { startLL: e.latlng, tempRect: null }
    }

    const onMouseMove = (e) => {
      const draw = drawRef.current
      if (!draw?.startLL) return
      if (!draw.tempRect) {
        draw.tempRect = L.rectangle([draw.startLL, e.latlng], {
          color: '#10b981',
          weight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.15,
          dashArray: '6,4',
          interactive: false,
        }).addTo(map)
      } else {
        draw.tempRect.setBounds([draw.startLL, e.latlng])
      }
    }

    const onMouseUp = () => {
      const draw = drawRef.current
      drawRef.current = null
      if (!draw?.startLL || !draw.tempRect) return

      draw.tempRect.remove()

      const bounds = draw.tempRect.getBounds()
      const sw = fromLL(bounds.getSouthWest())
      const ne = fromLL(bounds.getNorthEast())

      const x      = Math.min(sw.x, ne.x)
      const y      = Math.min(sw.y, ne.y)
      const width  = Math.abs(ne.x - sw.x)
      const height = Math.abs(ne.y - sw.y)

      if (width < 3 || height < 3) return // too small, ignore

      const rooms = floorRef.current?.rooms ?? []
      const newRoom = {
        x:      Math.round(Math.max(0, Math.min(98, x))),
        y:      Math.round(Math.max(0, Math.min(98, y))),
        width:  Math.round(Math.min(width,  100 - x)),
        height: Math.round(Math.min(height, 100 - y)),
        name:   `Zone ${rooms.length + 1}`,
      }
      onRoomsRef.current?.([...rooms, newRoom])
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup',   onMouseUp)

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup',   onMouseUp)
      if (drawRef.current?.tempRect) drawRef.current.tempRect.remove()
      drawRef.current = null
    }
  }, [editMode])

  // ── Re-render rooms when floor changes ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    roomLayerRef.current.clearLayers()
    imageLayerRef.current.clearLayers()

    // Background represents the outdoor/yard area; indoor rooms are white boxes on top
    map.getContainer().style.background = '#e8f5e9'

    if (floor?.imageUrl) {
      L.imageOverlay(floor.imageUrl, BOUNDS, { opacity: 0.9 })
        .addTo(imageLayerRef.current)
    }

    if (floor?.rooms?.length > 0) {
      // Only fit bounds when switching to a different floor, not on every re-render
      const floorChanged = prevFloorIdRef.current !== floor.id
      prevFloorIdRef.current = floor.id

      if (floorChanged) {
        // Calculate bounds that encompass all rooms (including outdoor zones with negative coords)
        let minX = 0, minY = 0, maxX = 100, maxY = 100
        for (const room of floor.rooms) {
          if (room.hidden) continue
          minX = Math.min(minX, room.x)
          minY = Math.min(minY, room.y)
          maxX = Math.max(maxX, room.x + room.width)
          maxY = Math.max(maxY, room.y + room.height)
        }
        // Add padding
        const pad = 5
        const dynamicBounds = L.latLngBounds(
          toLL(minX - pad, maxY + pad),
          toLL(maxX + pad, minY - pad)
        )
        map.fitBounds(dynamicBounds)
      }

      for (const room of floor.rooms) {
        if (room.hidden) continue
        const roomType = room.type || floor.type || 'interior'
        const style = ROOM_STYLE[roomType] ?? ROOM_STYLE.interior
        const sw = toLL(room.x,              room.y + room.height)
        const ne = toLL(room.x + room.width, room.y)
        L.rectangle([sw, ne], { ...style, interactive: false })
          .bindTooltip(room.name, {
            permanent: true,
            direction: 'center',
            className: 'lf-room-label',
          })
          .addTo(roomLayerRef.current)
      }
    }
  }, [floor])

  // ── Edit handles (move + corner resize per room) ──────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    editLayerRef.current.clearLayers()
    if (!editMode || !floor?.rooms?.length) return

    for (const room of floor.rooms) {
      if (room.hidden) continue
      const roomIndex = floor.rooms.indexOf(room)
      let currentRoom = { ...room }

      // Edit overlay rect (visual indicator, non-interactive)
      const rect = L.rectangle(
        [toLL(room.x, room.y + room.height), toLL(room.x + room.width, room.y)],
        { color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.08, dashArray: '6,3', interactive: false }
      ).addTo(editLayerRef.current)

      function cornerLL(r, c) {
        if (c === 'nw') return toLL(r.x,              r.y)
        if (c === 'ne') return toLL(r.x + r.width,    r.y)
        if (c === 'sw') return toLL(r.x,              r.y + r.height)
        return               toLL(r.x + r.width,    r.y + r.height) // se
      }

      function syncRect(r) {
        rect.setBounds([toLL(r.x, r.y + r.height), toLL(r.x + r.width, r.y)])
      }

      function saveRoom() {
        const newRooms = floor.rooms.map((r, i) => i === roomIndex ? { ...r, ...currentRoom } : r)
        onRoomsRef.current?.(newRooms)
      }

      // ── Move handle ──────────────────────────────────────────────────────
      const moveMarker = L.marker(
        toLL(room.x + room.width / 2, room.y + room.height / 2),
        { icon: makeMoveIcon(), draggable: true, zIndexOffset: 100 }
      ).addTo(editLayerRef.current)

      let moveStart = null

      moveMarker.on('dragstart', (e) => {
        moveStart = { ll: e.target.getLatLng(), room: { ...currentRoom } }
        L.DomEvent.stopPropagation(e)
      })
      moveMarker.on('drag', (e) => {
        if (!moveStart) return
        const cur = fromLL(e.target.getLatLng())
        const ori = fromLL(moveStart.ll)
        currentRoom = {
          ...moveStart.room,
          x: moveStart.room.x + (cur.x - ori.x),
          y: moveStart.room.y + (cur.y - ori.y),
        }
        syncRect(currentRoom)
        for (const [c, m] of Object.entries(cornerMarkers)) m.setLatLng(cornerLL(currentRoom, c))
        L.DomEvent.stopPropagation(e)
      })
      moveMarker.on('dragend', () => { moveStart = null; saveRoom() })
      moveMarker.on('click',   (e) => L.DomEvent.stopPropagation(e))

      // ── Corner resize handles ────────────────────────────────────────────
      const cornerMarkers = {}

      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const marker = L.marker(cornerLL(room, corner), {
          icon: makeResizeIcon(corner),
          draggable: true,
          zIndexOffset: 200,
        }).addTo(editLayerRef.current)

        cornerMarkers[corner] = marker

        let cornerStart = null

        marker.on('dragstart', () => { cornerStart = { ...currentRoom } })
        marker.on('drag', (e) => {
          if (!cornerStart) return
          const pos = fromLL(e.target.getLatLng())
          const opp = {
            nw: { x: cornerStart.x + cornerStart.width,  y: cornerStart.y + cornerStart.height },
            ne: { x: cornerStart.x,                       y: cornerStart.y + cornerStart.height },
            sw: { x: cornerStart.x + cornerStart.width,  y: cornerStart.y },
            se: { x: cornerStart.x,                       y: cornerStart.y },
          }[corner]

          currentRoom = {
            ...cornerStart,
            x:      Math.min(pos.x, opp.x),
            y:      Math.min(pos.y, opp.y),
            width:  Math.abs(pos.x - opp.x),
            height: Math.abs(pos.y - opp.y),
          }
          syncRect(currentRoom)
          for (const [c, m] of Object.entries(cornerMarkers)) {
            if (c !== corner) m.setLatLng(cornerLL(currentRoom, c))
          }
          moveMarker.setLatLng(toLL(currentRoom.x + currentRoom.width / 2, currentRoom.y + currentRoom.height / 2))
          L.DomEvent.stopPropagation(e)
        })
        marker.on('dragend', () => { cornerStart = null; saveRoom() })
        marker.on('click',   (e) => L.DomEvent.stopPropagation(e))
      }
    }
  }, [floor, editMode])

  // ── Re-render plant markers when plants list changes ──────────────────────
  // Track markers by plant ID to update positions without destroying/recreating
  const plantMarkersRef = useRef({})
  // IDs of plants dragged locally — never override their position from props
  // Positions are updated in context directly, so this just prevents
  // the useEffect from fighting with the Leaflet marker's drag position
  const draggedIdsRef = useRef(new Set())

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(plants.map((p) => p.id))
    const existingIds = new Set(Object.keys(plantMarkersRef.current))

    // Remove markers for plants no longer on this floor
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        markerLayerRef.current.removeLayer(plantMarkersRef.current[id])
        delete plantMarkersRef.current[id]
      }
    }

    for (const plant of plants) {
      const existing = plantMarkersRef.current[plant.id]

      if (existing) {
        // Never override position for locally-dragged plants
        if (!draggedIdsRef.current.has(plant.id)) {
          existing.setLatLng(toLL(plant.x, plant.y))
        }
        // Update icon (status color may change)
        existing.setIcon(makePlantIcon(plant, weather, floors))
        // Update tooltip
        const { color, label } = getWateringStatus(plant, weather, floors)
        existing.unbindTooltip()
        existing.bindTooltip(
          `<div class="lf-plant-tip">
             <div class="lf-plant-tip-name">${plant.name}</div>
             ${plant.species ? `<div class="lf-plant-tip-species">${plant.species}</div>` : ''}
             <div style="color:${color};font-size:11px;margin-top:2px;">${label}</div>
           </div>`,
          { direction: 'top', offset: [0, -18], className: 'lf-plant-tip-wrap' },
        )
      } else {
        // Create new marker
        const marker = L.marker(toLL(plant.x, plant.y), {
          icon: makePlantIcon(plant, weather, floors),
          draggable: true,
        })

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          markerClickRef.current?.(plant)
        })

        marker.on('dragend', (e) => {
          draggedIdsRef.current.add(plant.id)
          const pos = fromLL(e.target.getLatLng())
          const newX = Math.round(pos.x * 10) / 10
          const newY = Math.round(pos.y * 10) / 10
          markerDragRef.current?.(
            plant,
            newX,
            newY,
          )
        })

        const { color, label } = getWateringStatus(plant, weather, floors)
        marker.bindTooltip(
          `<div class="lf-plant-tip">
             <div class="lf-plant-tip-name">${plant.name}</div>
             ${plant.species ? `<div class="lf-plant-tip-species">${plant.species}</div>` : ''}
             <div style="color:${color};font-size:11px;margin-top:2px;">${label}</div>
           </div>`,
          { direction: 'top', offset: [0, -18], className: 'lf-plant-tip-wrap' },
        )

        marker.addTo(markerLayerRef.current)
        plantMarkersRef.current[plant.id] = marker
      }
    }
  }, [plants, weather, floors])

  // ── Gnome watering animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!gnomeWaterRef) return
    gnomeWaterRef.current = async (targetPlants, onComplete) => {
      const map = mapRef.current
      if (!map || !targetPlants.length) { onComplete?.(); return }

      // Sort plants left-to-right for a natural walking path
      const sorted = [...targetPlants].sort((a, b) => a.x - b.x)

      // Create gnome marker
      const startX = Math.max(0, sorted[0].x - 10)
      const startY = sorted[0].y
      const gnomeIcon = L.divIcon({
        className: 'gnome-marker',
        html: `<div class="gnome-body">🧑‍🌾</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      })
      const gnome = L.marker(toLL(startX, startY), { icon: gnomeIcon, interactive: false, zIndexOffset: 9999 })
      gnome.addTo(map)

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

      // Walk to each plant and water it
      for (let i = 0; i < sorted.length; i++) {
        const plant = sorted[i]
        const targetLL = toLL(plant.x, plant.y)

        // Determine walking direction for flip
        const gnomePos = fromLL(gnome.getLatLng())
        const dir = plant.x >= gnomePos.x ? 1 : -1

        // Update gnome direction
        gnome.setIcon(L.divIcon({
          className: 'gnome-marker',
          html: `<div class="gnome-body" style="--gnome-dir:${dir}">🧑‍🌾</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 28],
        }))

        // Animate walk: move in steps
        const startLL = gnome.getLatLng()
        const steps = 20
        const duration = 600
        for (let s = 1; s <= steps; s++) {
          const t = s / steps
          const lat = startLL.lat + (targetLL.lat - startLL.lat) * t
          const lng = startLL.lng + (targetLL.lng - startLL.lng) * t
          gnome.setLatLng([lat, lng])
          await sleep(duration / steps)
        }

        // Watering animation
        gnome.setIcon(L.divIcon({
          className: 'gnome-marker',
          html: `<div class="gnome-body watering" style="--gnome-dir:${dir}">🧑‍🌾</div>
                 <div class="gnome-splash">💧</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 28],
        }))
        await sleep(800)

        // Brief flash on the plant marker inner div (not the Leaflet container which uses transform for positioning)
        const plantMarker = plantMarkersRef.current[plant.id]
        if (plantMarker) {
          const inner = plantMarker.getElement()?.querySelector('.plant-lf-inner')
          if (inner) {
            inner.style.transition = 'transform 0.2s'
            inner.style.transform = 'scale(1.3)'
            setTimeout(() => { inner.style.transform = '' }, 300)
          }
        }

        // Reset gnome to walking
        gnome.setIcon(L.divIcon({
          className: 'gnome-marker',
          html: `<div class="gnome-body" style="--gnome-dir:${dir}">🧑‍🌾</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 28],
        }))
        await sleep(200)
      }

      // Walk gnome off screen to the right
      const lastPos = fromLL(gnome.getLatLng())
      const exitLL = toLL(Math.min(100, lastPos.x + 15), lastPos.y)
      const startExit = gnome.getLatLng()
      const exitSteps = 15
      for (let s = 1; s <= exitSteps; s++) {
        const t = s / exitSteps
        gnome.setLatLng([
          startExit.lat + (exitLL.lat - startExit.lat) * t,
          startExit.lng + (exitLL.lng - startExit.lng) * t,
        ])
        await sleep(400 / exitSteps)
      }

      map.removeLayer(gnome)
      onComplete?.()
    }
  }, [gnomeWaterRef])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
