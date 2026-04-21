import { useMemo, useState, useCallback } from 'react'
import { Button, FormControl, InputGroup, Badge, ListGroup, Form, Spinner, ProgressBar } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { plantsApi, recommendApi } from '../api/plants.js'
import { getWateringStatus, urgencyColor, OUTDOOR_ROOMS, getSeason, isOutdoor } from '../utils/watering.js'
import { derivePlantName } from '../utils/plantName.js'
import { fanOut } from '../utils/concurrency.js'
import PlantIcon from './PlantIcon.jsx'
import EmptyState from './EmptyState.jsx'
import { friendlyErrorMessage } from '../utils/errorMessages.js'

const RECOMMENDATION_HISTORY_LIMIT = 20
const BATCH_CONCURRENCY = 3

function UrgencyIcon({ days, skippedRain }) {
  if (skippedRain) return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#cloud-rain"></use></svg>
  if (days < 0) return <svg className="sa-icon status-overdue" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#alert-circle"></use></svg>
  if (days === 0) return <svg className="sa-icon status-today" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#droplet"></use></svg>
  if (days <= 2) return <svg className="sa-icon status-soon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#clock"></use></svg>
  return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#check-circle"></use></svg>
}

function PlantCard({ plant, onClick, onWater, weather, floors }) {
  const status = getWateringStatus(plant, weather, floors)
  const { daysUntil, color, label, skippedRain } = status

  return (
    <ListGroup.Item
      action
      onClick={() => onClick(plant)}
      className="plant-card d-flex align-items-center gap-3 py-2 px-3"
      style={{ borderLeftColor: color }}
    >
      <div
        className="plant-avatar"
        style={{ background: 'transparent', border: `2px solid ${color}` }}
      >
        <PlantIcon plant={plant} size={36} color={color} />
      </div>

      <div className="flex-grow-1 min-w-0">
        <div className="d-flex align-items-center justify-content-between gap-1">
          <span className="fw-500 text-truncate">{plant.name}</span>
          <span className="d-flex align-items-center gap-1 flex-shrink-0">
            <UrgencyIcon days={daysUntil} skippedRain={skippedRain} />
            <small className="fw-500" style={{ color }}>{label}</small>
          </span>
        </div>
        <div className="d-flex align-items-center gap-1 mt-0">
          {plant.species && <small className="text-muted text-truncate">{plant.species}</small>}
          {plant.species && plant.room && <small className="text-muted">·</small>}
          {plant.room && <small className="text-muted text-truncate">{plant.room}</small>}
        </div>
        {plant.health && (
          <Badge bg={plant.health === 'Excellent' || plant.health === 'Good' ? 'success' : plant.health === 'Fair' ? 'warning' : 'danger'} className="mt-1 fs-nano fw-500">
            {plant.health}
          </Badge>
        )}
      </div>

      {onWater && (
        <button
          type="button"
          className="flex-shrink-0 p-1 text-muted btn-plant-water"
          onClick={(e) => { e.stopPropagation(); onWater(plant.id) }}
          aria-label={`Water ${plant.name}`}
          title={`Water ${plant.name}`}
        >
          <svg className="sa-icon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#droplet"></use></svg>
        </button>
      )}
    </ListGroup.Item>
  )
}

export default function PlantListPanel({ onPlantClick, onAddPlant, gnomeWaterRef }) {
  const plantCtx = usePlantContext()
  const { plants, floors, activeFloorId, weather, handleWaterPlant, handleBatchWater, plantsLoading } = plantCtx
  const location = plantCtx.location || null
  const tempUnitCode = plantCtx.tempUnit?.unit || null
  const [searchTerm, setSearchTerm] = useState('')
  const [roomFilter, setRoomFilter] = useState(null)
  const [gnomeActive, setGnomeActive] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)
  const [batchStatus, setBatchStatus] = useState(null) // { total, done, failed }

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true); setRecalcResult(null)
    try {
      const season = getSeason(weather?.location?.lat)
      const data = await plantsApi.recalculateFrequencies({ season, temperature: weather?.current?.temp })
      setRecalcResult(data)
      // Reload plants to reflect new frequencies
      window.location.reload()
    } catch (err) { setRecalcResult({ error: friendlyErrorMessage(err, { context: 'recalculating watering frequencies' }) }) }
    finally { setRecalculating(false) }
  }, [weather])

  // Fan out Gemini care + watering recommendations across all plants on the
  // active floor with capped concurrency. Each plant gets two Gemini calls
  // + one Firestore update; we expose live progress via batchStatus so the
  // UI can show "n of N" without long-polling from the server.
  const refreshOne = useCallback(async (plant) => {
    const outdoor = isOutdoor(plant, floors)
    const season = getSeason(weather?.location?.lat)
    const name = derivePlantName({ species: plant.species, room: plant.room })

    const [careData, wateringData] = await Promise.all([
      recommendApi.get(name, plant.species, {
        plantedIn: plant.plantedIn, isOutdoor: outdoor,
        location, tempUnit: tempUnitCode,
      }),
      recommendApi.getWatering({
        name, species: plant.species,
        plantedIn: plant.plantedIn, isOutdoor: outdoor,
        potSize: plant.plantedIn === 'pot' ? plant.potSize : null,
        potMaterial: plant.plantedIn === 'pot' ? plant.potMaterial : null,
        soilType: plant.plantedIn === 'pot' ? plant.soilType : null,
        sunExposure: plant.sunExposure, health: plant.health,
        maturity: plant.maturity, season,
        temperature: weather?.current?.temp || null,
        location, tempUnit: tempUnitCode,
      }),
    ])

    const now = new Date().toISOString()
    const careHistory = [...(plant.careRecommendationHistory || []), { date: now, data: careData }]
      .slice(-RECOMMENDATION_HISTORY_LIMIT)
    const wateringHistory = [...(plant.wateringRecommendationHistory || []), { date: now, data: wateringData }]
      .slice(-RECOMMENDATION_HISTORY_LIMIT)

    await plantsApi.update(plant.id, {
      careRecommendationHistory: careHistory,
      wateringRecommendationHistory: wateringHistory,
    })
  }, [floors, weather, location, tempUnitCode])

  const handleBatchRefresh = useCallback(async (targetPlants) => {
    if (!targetPlants?.length || batchStatus?.running) return
    setBatchStatus({ running: true, total: targetPlants.length, done: 0, failed: 0 })

    await fanOut(targetPlants, refreshOne, {
      limit: BATCH_CONCURRENCY,
      onResult: (_i, r) => {
        setBatchStatus((prev) => prev ? {
          ...prev,
          done: prev.done + 1,
          failed: prev.failed + (r.ok ? 0 : 1),
        } : prev)
      },
    })

    // Reload so image URLs re-sign and the modal picks up fresh history.
    window.location.reload()
  }, [batchStatus, refreshOne])

  const handleGnomeBatchWater = useCallback((targetPlants) => {
    if (gnomeActive) return
    // Split indoor vs outdoor — gnome can only animate on the indoor map
    const indoorPlants = targetPlants.filter((p) => !isOutdoor(p, floors))
    const outdoorPlants = targetPlants.filter((p) => isOutdoor(p, floors))

    // Water outdoor plants immediately (no gnome animation)
    if (outdoorPlants.length > 0) {
      handleBatchWater(outdoorPlants.map((p) => p.id))
    }

    if (gnomeWaterRef?.current && indoorPlants.length > 0) {
      setGnomeActive(true)
      gnomeWaterRef.current(indoorPlants, () => {
        handleBatchWater(indoorPlants.map((p) => p.id))
        setGnomeActive(false)
      })
    } else if (indoorPlants.length > 0) {
      handleBatchWater(indoorPlants.map((p) => p.id))
    } else {
      // All plants were outdoor, already watered above
    }
  }, [gnomeActive, gnomeWaterRef, handleBatchWater, floors])

  const floorPlants = useMemo(() => {
    if (!activeFloorId) return plants
    return plants.filter((p) => (p.floor || 'ground') === activeFloorId)
  }, [plants, activeFloorId])

  const sortedPlants = useMemo(() =>
    [...floorPlants].sort((a, b) => {
      const dA = getWateringStatus(a, weather, floors).daysUntil
      const dB = getWateringStatus(b, weather, floors).daysUntil
      return dA - dB
    }),
  [floorPlants, weather, floors])

  const rooms = useMemo(() => {
    // Get all zones from floor config + any rooms plants are assigned to
    const activeFloor = floors.find((f) => f.id === activeFloorId)
    const floorRooms = (activeFloor?.rooms || []).filter((r) => !r.hidden).map((r) => r.name)
    const plantRooms = floorPlants.map((p) => p.room).filter(Boolean)
    return [...new Set([...floorRooms, ...plantRooms])].sort()
  }, [floorPlants, floors, activeFloorId])

  const filteredPlants = useMemo(() => {
    let result = sortedPlants
    if (roomFilter) result = result.filter((p) => p.room === roomFilter)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter((p) => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q))
    }
    return result
  }, [sortedPlants, roomFilter, searchTerm])

  const counts = useMemo(() => {
    const overdue = filteredPlants.filter((p) => getWateringStatus(p, weather, floors).daysUntil < 0).length
    const today = filteredPlants.filter((p) => { const s = getWateringStatus(p, weather, floors); return !s.skippedRain && s.daysUntil === 0 }).length
    const soon = filteredPlants.filter((p) => { const d = getWateringStatus(p, weather, floors).daysUntil; return d > 0 && d <= 2 }).length
    const good = filteredPlants.filter((p) => getWateringStatus(p, weather, floors).daysUntil > 2).length
    return { overdue, today, soon, good }
  }, [filteredPlants, weather, floors])

  return (
    <div className="panel panel-icon">
      <div className="panel-hdr d-flex justify-content-between align-items-center">
        <span>
          Plants
          {floorPlants.length > 0 && <Badge bg="primary" className="ms-2">{floorPlants.length}</Badge>}
        </span>
        {floorPlants.length > 0 && (
          <div className="panel-toolbar ms-auto">
            <Button variant="primary" size="sm" className="waves-effect waves-themed" onClick={onAddPlant}>
              <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus"></use></svg>
              Add Plant
            </Button>
          </div>
        )}
      </div>
      <div className="panel-container">
        <div className="panel-content p-0">
          {/* Summary pills */}
          {floorPlants.length > 0 && (
            <div className="d-flex gap-2 px-3 pt-3 pb-2 flex-wrap">
              {counts.overdue > 0 && <span className="status-pill bg-danger bg-opacity-10 text-danger">{counts.overdue} overdue</span>}
              {counts.today > 0 && <span className="status-pill bg-warning bg-opacity-10 text-warning">{counts.today} today</span>}
              {counts.soon > 0 && <span className="status-pill" style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308' }}>{counts.soon} soon</span>}
              {counts.good > 0 && <span className="status-pill bg-success bg-opacity-10 text-success">{counts.good} good</span>}
            </div>
          )}

          {/* Water all on floor */}
          {floorPlants.length > 0 && (counts.overdue > 0 || counts.today > 0) && (
            <div className="px-3 pb-2">
              <Button
                variant="outline-info"
                size="sm"
                className="w-100"
                disabled={gnomeActive}
                onClick={() => handleGnomeBatchWater(floorPlants)}
              >
                {gnomeActive ? <span className="spinner-border spinner-border-sm me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>}
                {gnomeActive ? 'Watering...' : `Water All on Floor (${floorPlants.length} plants)`}
              </Button>
            </div>
          )}

          {/* Recalculate + Water all */}
          {floorPlants.length > 0 && (
            <div className="d-flex gap-2 px-3 pb-2">
              <Button
                variant="outline-warning"
                size="sm"
                className="flex-grow-1"
                disabled={recalculating}
                onClick={handleRecalculate}
              >
                {recalculating ? <Spinner size="sm" className="me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>}
                {recalculating ? 'Recalculating...' : 'Recalculate All Watering Frequencies'}
              </Button>
              <Button
                variant="outline-info"
                size="sm"
                className="flex-grow-1"
                disabled={gnomeActive}
                onClick={() => handleGnomeBatchWater(floorPlants)}
              >
                {gnomeActive ? <span className="spinner-border spinner-border-sm me-1" /> : <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>}
                {gnomeActive ? 'Watering...' : 'Water All Plants'}
              </Button>
            </div>
          )}

          {/* Refresh AI recommendations (fan-out with concurrency) */}
          {floorPlants.length > 0 && (
            <div className="px-3 pb-2">
              {batchStatus?.running ? (
                <div className="border rounded p-2 bg-body-tertiary">
                  <div className="d-flex align-items-center justify-content-between mb-1 fs-xs">
                    <span className="fw-500">
                      Refreshing AI advice — {batchStatus.done} of {batchStatus.total}
                    </span>
                    {batchStatus.failed > 0 && (
                      <span className="text-danger">{batchStatus.failed} failed</span>
                    )}
                  </div>
                  <ProgressBar
                    now={(batchStatus.done / batchStatus.total) * 100}
                    variant={batchStatus.failed > 0 ? 'warning' : 'success'}
                    style={{ height: 6 }}
                  />
                </div>
              ) : (
                <Button
                  variant="outline-success"
                  size="sm"
                  className="w-100"
                  onClick={() => handleBatchRefresh(floorPlants)}
                  title="Fetch fresh Gemini care + watering advice for every plant on this floor"
                >
                  <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>
                  Refresh AI Advice for All Plants ({floorPlants.length})
                </Button>
              )}
            </div>
          )}

          {/* Search + room filter */}
          {floorPlants.length > 0 && (
            <div className="px-3 pb-2">
              <InputGroup size="sm">
                <InputGroup.Text>
                  <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#search"></use></svg>
                </InputGroup.Text>
                <FormControl
                  placeholder="Search plants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
              {rooms.length > 1 && (
                <Form.Select
                  size="sm"
                  className="mt-2"
                  value={roomFilter || ''}
                  onChange={(e) => setRoomFilter(e.target.value || null)}
                >
                  <option value="">All zones ({rooms.length})</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </Form.Select>
              )}
            </div>
          )}

          {/* Plant list */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {plantsLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" />
              </div>
            ) : filteredPlants.length === 0 ? (
              plants.length === 0 ? (
                <EmptyState
                  compact
                  icon="feather"
                  title="Your greenhouse is empty"
                  description="Add your first plant and we'll start tracking its health, watering, and feeding schedule."
                  actions={[{ label: 'Add your first plant', onClick: onAddPlant, variant: 'primary', icon: 'plus' }]}
                />
              ) : (
                <EmptyState
                  compact
                  icon="search"
                  title="No plants match"
                  description="Try clearing the search or picking a different zone to widen the view."
                />
              )
            ) : (
              <div>
                {(() => {
                  const grouped = {}
                  filteredPlants.forEach((p) => {
                    const room = p.room || 'Unassigned'
                    if (!grouped[room]) grouped[room] = []
                    grouped[room].push(p)
                  })
                  const roomNames = Object.keys(grouped).sort()
                  return roomNames.map((room) => (
                    <div key={room}>
                      {roomNames.length > 1 && (
                        <div className="d-flex align-items-center justify-content-between px-3 py-1 bg-body-tertiary border-top border-bottom">
                          <small className="text-muted fw-600 text-uppercase fs-xs">{room}</small>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="py-0 px-2 fs-xs"
                            disabled={gnomeActive}
                            onClick={() => handleGnomeBatchWater(grouped[room])}
                          >
                            <svg className="sa-icon me-1" style={{ width: 10, height: 10 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                            Water all
                          </Button>
                        </div>
                      )}
                      <ListGroup variant="flush">
                        {grouped[room].map((plant) => (
                          <PlantCard
                            key={plant.id}
                            plant={plant}
                            onClick={onPlantClick}
                            onWater={handleWaterPlant}
                            weather={weather}
                            floors={floors}
                          />
                        ))}
                      </ListGroup>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
