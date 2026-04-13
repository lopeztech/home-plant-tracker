import { useMemo, useState, useCallback, lazy, Suspense, useRef } from 'react'
import { Nav, Spinner, ButtonGroup, Button } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'
import { plantsApi } from '../api/plants.js'
import LeafletFloorplan from './LeafletFloorplan.jsx'
import HouseWeatherFrame from './HouseWeatherFrame.jsx'
import { calculateReorganisedPositions } from '../utils/reorganise.js'
import { isOutdoor, YARD_AREAS } from '../utils/watering.js'

const Floorplan3D = lazy(() => import('./Floorplan3D.jsx'))

export default function FloorplanPanel({ onPlantClick, onFloorplanClick, gnomeWaterRef }) {
  const {
    plants, floors, activeFloorId, setActiveFloorId,
    weather, location, handleFloorRoomsChange,
    isAnalysingFloorplan, isGuest, updatePlantsLocally,
  } = usePlantContext()

  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('2d')
  const [saving, setSaving] = useState(false)

  // Track dragged positions directly — { plantId: { x, y, room } }
  const dirtyMovesRef = useRef({})

  const visibleFloors = useMemo(
    () => [...floors].filter((f) => !f.hidden).sort((a, b) => b.order - a.order),
    [floors],
  )

  const activeFloor = useMemo(
    () => floors.find((f) => f.id === activeFloorId),
    [floors, activeFloorId],
  )

  const plantsOnFloor = useMemo(
    () => plants.filter((p) => (p.floor || 'ground') === activeFloorId),
    [plants, activeFloorId],
  )

  // Split rooms and plants into indoor vs outdoor
  const isOutdoorFloor = activeFloor?.type === 'outdoor'
  const indoorRooms = useMemo(
    () => (activeFloor?.rooms || []).filter((r) => {
      if (r.hidden) return false
      const t = r.type || activeFloor?.type || 'interior'
      return t !== 'outdoor'
    }),
    [activeFloor],
  )
  const outdoorRooms = useMemo(
    () => (activeFloor?.rooms || []).filter((r) => {
      if (r.hidden) return false
      const t = r.type || activeFloor?.type || 'interior'
      return t === 'outdoor'
    }),
    [activeFloor],
  )
  const hasIndoorOutdoorSplit = !isOutdoorFloor && indoorRooms.length > 0 && outdoorRooms.length > 0

  const indoorFloor = useMemo(() => {
    if (!hasIndoorOutdoorSplit || !activeFloor) return activeFloor
    return { ...activeFloor, rooms: indoorRooms }
  }, [activeFloor, indoorRooms, hasIndoorOutdoorSplit])

  // Group outdoor rooms by yard area
  const outdoorByArea = useMemo(() => {
    if (!activeFloor) return {}
    const allOutdoor = isOutdoorFloor ? (activeFloor.rooms || []).filter((r) => !r.hidden) : outdoorRooms
    if (allOutdoor.length === 0) return {}
    const grouped = {}
    for (const room of allOutdoor) {
      const area = room.area || 'frontyard'
      if (!grouped[area]) grouped[area] = []
      grouped[area].push(room)
    }
    return grouped
  }, [activeFloor, isOutdoorFloor, outdoorRooms])

  const hasAnyOutdoorAreas = isOutdoorFloor || (hasIndoorOutdoorSplit && outdoorRooms.length > 0)

  const indoorPlants = useMemo(() => {
    if (isOutdoorFloor) return []
    if (!hasIndoorOutdoorSplit) return plantsOnFloor
    const outdoorRoomNames = new Set(outdoorRooms.map((r) => r.name))
    return plantsOnFloor.filter((p) => !outdoorRoomNames.has(p.room))
  }, [plantsOnFloor, outdoorRooms, hasIndoorOutdoorSplit, isOutdoorFloor])

  // Group outdoor plants by their room's area
  const outdoorPlantsByArea = useMemo(() => {
    if (!hasAnyOutdoorAreas) return {}
    const roomAreaMap = {}
    const allOutdoor = isOutdoorFloor ? (activeFloor?.rooms || []) : outdoorRooms
    for (const room of allOutdoor) {
      roomAreaMap[room.name] = room.area || 'frontyard'
    }
    const outdoorRoomNames = new Set(allOutdoor.map((r) => r.name))
    const relevantPlants = isOutdoorFloor ? plantsOnFloor : plantsOnFloor.filter((p) => outdoorRoomNames.has(p.room))
    const grouped = {}
    for (const plant of relevantPlants) {
      const area = roomAreaMap[plant.room] || 'frontyard'
      if (!grouped[area]) grouped[area] = []
      grouped[area].push(plant)
    }
    return grouped
  }, [plantsOnFloor, outdoorRooms, hasAnyOutdoorAreas, isOutdoorFloor, activeFloor])

  const [hasDirty, setHasDirty] = useState(false)

  // Reorganise plants — evenly distribute within their assigned room bounds
  const handleReorganise = useCallback(() => {
    if (!activeFloor?.rooms?.length || plantsOnFloor.length === 0) return

    const { plantUpdates, expandedRooms } = calculateReorganisedPositions(plantsOnFloor, activeFloor.rooms)

    if (Object.keys(plantUpdates).length > 0) {
      // If rooms were expanded, persist the new room bounds
      if (expandedRooms) {
        handleFloorRoomsChange(expandedRooms)
      }
      for (const [id, move] of Object.entries(plantUpdates)) {
        dirtyMovesRef.current[id] = move
      }
      updatePlantsLocally(plantUpdates)
      setHasDirty(true)
    }
  }, [activeFloor, plantsOnFloor, updatePlantsLocally, handleFloorRoomsChange])

  // Drag handler — update context immediately (no API call)
  const handleLocalDrag = useCallback((plant, x, y) => {
    // Always use the active floor (not plant.floor which may be stale in closure)
    const floor = activeFloor
    let room = null
    if (floor?.rooms?.length) {
      for (const r of floor.rooms) {
        if (r.hidden) continue
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          room = r.name
          break
        }
      }
    }
    // Fall back to current room if drop position isn't inside any zone
    if (!room) room = dirtyMovesRef.current[plant.id]?.room || plant.room
    const move = { x, y, room }
    console.log(`Drag ${plant.name} to x=${x.toFixed(1)}, y=${y.toFixed(1)}, room=${room}`)
    updatePlantsLocally({ [plant.id]: move })
    dirtyMovesRef.current[plant.id] = move
    setHasDirty(true)
  }, [activeFloor, updatePlantsLocally])

  // Save dirty plants to API — uses stored positions from ref
  const handleSaveMoves = useCallback(async () => {
    const moves = { ...dirtyMovesRef.current }
    const entries = Object.entries(moves)
    if (entries.length === 0) return

    setSaving(true)
    if (!isGuest) {
      const results = await Promise.allSettled(
        entries.map(([id, { x, y, room }]) => {
          console.log(`Saving plant ${id}: x=${x}, y=${y}, room=${room}`)
          return plantsApi.update(id, { x, y, room })
        })
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        console.error('Some saves failed:', failed.map((r) => r.reason?.message))
      }
    }
    dirtyMovesRef.current = {}
    setHasDirty(false)
    setSaving(false)
  }, [isGuest])

  // Discard — reload from server
  const handleDiscard = useCallback(() => {
    dirtyMovesRef.current = {}
    setHasDirty(false)
    window.location.reload()
  }, [])

  // Build yard area content for each area that has rooms
  const yardAreaContent = useMemo(() => {
    if (!hasAnyOutdoorAreas || viewMode !== '2d') return null
    const areas = {}
    for (const areaId of YARD_AREAS.map((a) => a.id)) {
      const areaRooms = outdoorByArea[areaId]
      if (!areaRooms?.length) continue
      const areaFloor = {
        ...activeFloor,
        id: `${activeFloor.id}-${areaId}`,
        type: 'outdoor',
        rooms: areaRooms,
      }
      const areaPlants = outdoorPlantsByArea[areaId] || []
      areas[areaId] = { floor: areaFloor, plants: areaPlants }
    }
    return Object.keys(areas).length > 0 ? areas : null
  }, [hasAnyOutdoorAreas, viewMode, outdoorByArea, outdoorPlantsByArea, activeFloor])

  const renderYardAreas = useMemo(() => {
    if (!yardAreaContent) return null
    const rendered = {}
    for (const [areaId, { floor: areaFloor, plants: areaPlants }] of Object.entries(yardAreaContent)) {
      const isSide = areaId === 'side-left' || areaId === 'side-right'
      rendered[areaId] = (
        <div style={{ height: isSide ? '100%' : 200, minHeight: isSide ? 400 : undefined }}>
          <LeafletFloorplan
            key={areaFloor.id}
            floor={areaFloor}
            floors={floors}
            plants={areaPlants}
            weather={weather}
            onFloorplanClick={onFloorplanClick}
            onMarkerClick={onPlantClick}
            onMarkerDrag={handleLocalDrag}
            editMode={false}
            onRoomsChange={handleFloorRoomsChange}
          />
        </div>
      )
    }
    return rendered
  }, [yardAreaContent, floors, weather, onFloorplanClick, onPlantClick, handleLocalDrag, handleFloorRoomsChange])

  return (
    <HouseWeatherFrame
      weather={weather}
      location={location}
      onLocationClick={() => navigate('/settings')}
      yardAreas={renderYardAreas}
    >
      {/* Floor tabs + view toggle */}
      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom flex-wrap gap-2">
        <Nav variant="pills" className="gap-1 flex-nowrap overflow-auto flex-grow-1">
          {visibleFloors.map((f) => (
            <Nav.Item key={f.id}>
              <Nav.Link
                active={f.id === activeFloorId}
                onClick={() => setActiveFloorId(f.id)}
                className="floor-tab py-1 px-2"
              >
                <span className="d-inline-flex align-items-center gap-1">
                  {f.type === 'outdoor' && (
                    <svg className="sa-icon sa-thin" style={{ width: 12, height: 12 }}>
                      <use href="/icons/sprite.svg#sun"></use>
                    </svg>
                  )}
                  {f.name}
                </span>
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <div className="d-flex gap-2 flex-shrink-0">
          {plantsOnFloor.length > 0 && activeFloor?.rooms?.length > 0 && (
            <Button variant="outline-secondary" size="sm" onClick={handleReorganise} title="Evenly space plants within their rooms">
              <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#grid"></use></svg>
              Reorganise
            </Button>
          )}
          <ButtonGroup size="sm">
            <Button variant={viewMode === '2d' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('2d')} title="2D View">
              <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#grid"></use></svg>
              2D
            </Button>
            <Button variant={viewMode === '3d' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('3d')} title="3D View">
              <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#box"></use></svg>
              3D
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {/* Map view */}
      <div className="floorplan-wrapper" style={{ height: isOutdoorFloor ? 0 : 500 }}>
        {isAnalysingFloorplan && (
          <div
            className="position-absolute d-flex flex-column align-items-center justify-content-center gap-2 w-100 h-100"
            style={{ background: 'rgba(0,0,0,0.7)', zIndex: 1000, top: 0, left: 0 }}
          >
            <Spinner animation="border" variant="primary" />
            <p className="text-white fw-500 mb-0">Analysing floorplan...</p>
            <small className="text-muted">Identifying floors and rooms</small>
          </div>
        )}
        {activeFloor && viewMode === '2d' && !isOutdoorFloor && (
          <LeafletFloorplan
            key={indoorFloor?.id || activeFloor.id}
            floor={hasIndoorOutdoorSplit ? indoorFloor : activeFloor}
            floors={floors}
            plants={hasIndoorOutdoorSplit ? indoorPlants : plantsOnFloor}
            weather={weather}
            onFloorplanClick={onFloorplanClick}
            onMarkerClick={onPlantClick}
            onMarkerDrag={handleLocalDrag}
            editMode={false}
            onRoomsChange={handleFloorRoomsChange}
            gnomeWaterRef={gnomeWaterRef}
          />
        )}
        {activeFloor && viewMode === '3d' && (
          <Suspense fallback={<div className="d-flex align-items-center justify-content-center h-100"><Spinner animation="border" variant="primary" /></div>}>
            <Floorplan3D
              floor={activeFloor}
              floors={floors}
              plants={plantsOnFloor}
              weather={weather}
              onPlantClick={onPlantClick}
              onFloorplanClick={onFloorplanClick}
            />
          </Suspense>
        )}
      </div>

      {/* Save positions button */}
      {hasDirty && (
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top bg-warning bg-opacity-10">
          <small className="text-muted">{Object.keys(dirtyMovesRef.current).length} plant{Object.keys(dirtyMovesRef.current).length !== 1 ? 's' : ''} moved</small>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveMoves} disabled={saving}>
              {saving ? 'Saving...' : 'Save Positions'}
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      {plantsOnFloor.length > 0 && (
        <div className="d-flex align-items-center gap-3 px-3 py-2 border-top fs-xs text-muted">
          {[
            { color: '#ef4444', label: 'Overdue' },
            { color: '#f97316', label: 'Due today' },
            { color: '#eab308', label: '1-2 days' },
            { color: '#22c55e', label: 'All good' },
          ].map(({ color, label }) => (
            <span key={label} className="d-flex align-items-center gap-1">
              <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </HouseWeatherFrame>
  )
}
