import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Coordinate helpers ────────────────────────────────────────────────────────
// Gemini / stored coords: (x, y) percentages, y axis goes DOWN.
// Leaflet CRS.Simple: [lat, lng], lat axis goes UP.
// Mapping: lat = 100 - y,  lng = x
function toLL(x, y) { return L.latLng(100 - y, x) }
function fromLL({ lat, lng }) { return { x: lng, y: 100 - lat } }

const BOUNDS = L.latLngBounds([[0, 0], [100, 100]])

// ── Urgency helpers ───────────────────────────────────────────────────────────
function urgencyInfo(plant) {
  if (!plant.lastWatered) return { color: '#22c55e', label: 'No data', overdue: false }
  const days = Math.ceil(
    (new Date(plant.lastWatered).getTime() + plant.frequencyDays * 86400000 - Date.now()) / 86400000
  )
  if (days < 0)  return { color: '#ef4444', label: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { color: '#f97316', label: 'Due today',     overdue: false }
  if (days <= 2)  return { color: '#eab308', label: 'Due tomorrow',  overdue: false }
  return { color: '#22c55e', label: `${days}d remaining`, overdue: false }
}

// ── Plant marker DivIcon ──────────────────────────────────────────────────────
function makePlantIcon(plant) {
  const { color, overdue } = urgencyInfo(plant)
  const letter = (plant.name || '?')[0].toUpperCase()
  const inner = plant.imageUrl
    ? `<img src="${plant.imageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : `<span style="color:#fff;font-size:13px;font-weight:700;line-height:1;">${letter}</span>`

  return L.divIcon({
    className: 'plant-lf-icon',
    html: `<div class="plant-lf-inner${overdue ? ' plant-lf-overdue' : ''}"
                style="width:32px;height:32px;border-radius:50%;
                       border:2px solid ${color};
                       background:${plant.imageUrl ? 'transparent' : color};
                       display:flex;align-items:center;justify-content:center;
                       box-shadow:0 2px 8px ${color}80,0 0 0 3px ${color}30;
                       overflow:hidden;">
              ${inner}
            </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    tooltipAnchor: [0, -18],
  })
}

// ── Room rectangle styles by floor type ──────────────────────────────────────
const ROOM_STYLE = {
  interior: { color: '#1e3a5f', weight: 2, fillColor: '#0b1624', fillOpacity: 1 },
  outdoor:  { color: '#166534', weight: 2, fillColor: '#071a0a', fillOpacity: 1 },
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LeafletFloorplan({
  floor,
  plants,
  onFloorplanClick,
  onMarkerClick,
  onMarkerDrag,
}) {
  const containerRef    = useRef(null)
  const mapRef          = useRef(null)
  const roomLayerRef    = useRef(null)
  const imageLayerRef   = useRef(null)
  const markerLayerRef  = useRef(null)

  // Stable callback refs — avoid stale closures in Leaflet event handlers
  const clickRef  = useRef(onFloorplanClick)
  const markerClickRef = useRef(onMarkerClick)
  const markerDragRef  = useRef(onMarkerDrag)
  useEffect(() => { clickRef.current = onFloorplanClick },  [onFloorplanClick])
  useEffect(() => { markerClickRef.current = onMarkerClick }, [onMarkerClick])
  useEffect(() => { markerDragRef.current  = onMarkerDrag  }, [onMarkerDrag])

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

    map.on('click', (e) => {
      const { x, y } = fromLL(e.latlng)
      clickRef.current?.(
        Math.max(2, Math.min(98, x)),
        Math.max(2, Math.min(98, y)),
      )
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ── Re-render rooms when floor changes ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    roomLayerRef.current.clearLayers()
    imageLayerRef.current.clearLayers()

    // Background colour reflects floor type
    map.getContainer().style.background =
      floor?.type === 'outdoor' ? '#040d06' : '#070d18'

    // Uploaded image overlay (takes priority over generated rooms)
    if (floor?.imageUrl) {
      L.imageOverlay(floor.imageUrl, BOUNDS, { opacity: 0.9 })
        .addTo(imageLayerRef.current)
    }

    // Gemini-analysed rooms — each as a labelled rectangle
    if (floor?.rooms?.length > 0) {
      const style = ROOM_STYLE[floor.type] ?? ROOM_STYLE.interior
      for (const room of floor.rooms) {
        if (room.hidden) continue
        // Leaflet [lat,lng] bounds: SW corner = bottom-left, NE corner = top-right
        const sw = toLL(room.x,              room.y + room.height)
        const ne = toLL(room.x + room.width, room.y)
        L.rectangle([sw, ne], style)
          .bindTooltip(room.name, {
            permanent: true,
            direction: 'center',
            className: 'lf-room-label',
          })
          .addTo(roomLayerRef.current)
      }
    }
  }, [floor])

  // ── Re-render plant markers when plants list changes ──────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markerLayerRef.current.clearLayers()

    for (const plant of plants) {
      const marker = L.marker(toLL(plant.x, plant.y), {
        icon: makePlantIcon(plant),
        draggable: true,
      })

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        markerClickRef.current?.(plant)
      })

      marker.on('dragend', (e) => {
        const pos = fromLL(e.target.getLatLng())
        markerDragRef.current?.(
          plant,
          Math.max(2, Math.min(98, pos.x)),
          Math.max(2, Math.min(98, pos.y)),
        )
      })

      // Hover tooltip
      const { color, label } = urgencyInfo(plant)
      marker.bindTooltip(
        `<div class="lf-plant-tip">
           <div class="lf-plant-tip-name">${plant.name}</div>
           ${plant.species ? `<div class="lf-plant-tip-species">${plant.species}</div>` : ''}
           <div style="color:${color};font-size:11px;margin-top:2px;">${label}</div>
         </div>`,
        { direction: 'top', offset: [0, -18], className: 'lf-plant-tip-wrap' },
      )

      marker.addTo(markerLayerRef.current)
    }
  }, [plants])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
