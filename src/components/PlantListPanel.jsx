import { useMemo, useState, useCallback, useEffect } from 'react'
import { List as VirtualList } from 'react-window'
import { Button, Badge, ListGroup, Spinner, ProgressBar, ButtonGroup } from 'react-bootstrap'
import { motion } from 'framer-motion'
import { usePlantContext } from '../context/PlantContext.jsx'
import { plantsApi, recommendApi } from '../api/plants.js'
import { getWateringStatus, urgencyColor, OUTDOOR_ROOMS, getSeason, isOutdoor } from '../utils/watering.js'
import { derivePlantName } from '../utils/plantName.js'
import { fanOut } from '../utils/concurrency.js'
import PlantIcon from './PlantIcon.jsx'
import { friendlyErrorMessage } from '../utils/errorMessages.js'
import EmptyState from './EmptyState.jsx'
import { SkeletonPlantCard } from './Skeleton.jsx'
import { DURATION, EASE, STAGGER_DELAY } from '../motion/tokens.js'
import FilterBar from './FilterBar.jsx'

const VIEW_STORAGE_KEY = 'plantListViewMode'

function useViewMode() {
  const [viewMode, setViewModeState] = useState(() => {
    try { return localStorage.getItem(VIEW_STORAGE_KEY) || 'card' } catch { return 'card' }
  })
  const setViewMode = useCallback((mode) => {
    setViewModeState(mode)
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode) } catch {}
  }, [])
  return [viewMode, setViewMode]
}

const RECOMMENDATION_HISTORY_LIMIT = 20
const BATCH_CONCURRENCY = 3

const MotionListGroupItem = motion.create(ListGroup.Item)

function UrgencyIcon({ days, skippedRain }) {
  if (skippedRain) return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#cloud-rain"></use></svg>
  if (days < 0) return <svg className="sa-icon status-overdue" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#alert-circle"></use></svg>
  if (days === 0) return <svg className="sa-icon status-today" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#droplet"></use></svg>
  if (days <= 2) return <svg className="sa-icon status-soon" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#clock"></use></svg>
  return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }} aria-hidden="true"><use href="/icons/sprite.svg#check-circle"></use></svg>
}

function PlantCard({ plant, onClick, onWater, weather, floors, index = 0 }) {
  const status = getWateringStatus(plant, weather, floors)
  const { daysUntil, color, label, skippedRain } = status

  return (
    <MotionListGroupItem
      action
      onClick={() => onClick(plant)}
      className="plant-card d-flex align-items-center gap-3 py-2 px-3"
      style={{ borderLeftColor: color }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE.out, delay: Math.min(index * STAGGER_DELAY, 0.32) }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
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
    </MotionListGroupItem>
  )
}

function PlantListRow({ plant, onClick, onWater, weather, floors, index = 0 }) {
  const status = getWateringStatus(plant, weather, floors)
  const { daysUntil, color, label, skippedRain, dormant } = status
  return (
    <div
      className="d-flex align-items-center gap-2 px-3 py-2 border-bottom plant-list-row"
      style={{ cursor: 'pointer', borderLeft: `3px solid ${color}` }}
      onClick={() => onClick(plant)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(plant)}
    >
      <PlantIcon plant={plant} size={28} color={color} />
      <span className="fw-500 text-truncate flex-grow-1" style={{ minWidth: 0 }}>{plant.name}</span>
      {plant.species && <small className="text-muted text-truncate d-none d-md-block" style={{ maxWidth: 140 }}>{plant.species}</small>}
      {plant.room && <small className="text-muted text-truncate d-none d-lg-block" style={{ maxWidth: 120 }}>{plant.room}</small>}
      {plant.health && (
        <Badge bg={plant.health === 'Excellent' || plant.health === 'Good' ? 'success' : plant.health === 'Fair' ? 'warning' : 'danger'} className="fs-nano">
          {plant.health}
        </Badge>
      )}
      <small className="fw-500 flex-shrink-0" style={{ color }}>{dormant ? '💤' : label}</small>
      {onWater && !dormant && (
        <button
          type="button"
          className="flex-shrink-0 p-1 text-muted btn-plant-water"
          onClick={(e) => { e.stopPropagation(); onWater(plant.id) }}
          aria-label={`Water ${plant.name}`}
        >
          <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet" /></svg>
        </button>
      )}
    </div>
  )
}

const ITEM_HEIGHT = 76
const VIRTUALISE_THRESHOLD = 40
const LIST_HEIGHT = 500

// Hoisted row renderer for the react-window v2 `List`. Receives `index`/`style`
// from the virtualiser and the rest from `rowProps` on the parent List.
function VirtualPlantRow({ index, style, plants, onPlantClick, handleWaterPlant, weather, floors }) {
  const plant = plants[index]
  return (
    <div style={style}>
      <PlantCard
        plant={plant}
        index={index}
        onClick={onPlantClick}
        onWater={handleWaterPlant}
        weather={weather}
        floors={floors}
      />
    </div>
  )
}

export default function PlantListPanel({ onPlantClick, onAddPlant, onImportPlants, gnomeWaterRef }) {
  const plantCtx = usePlantContext()
  const { plants, floors, activeFloorId, weather, handleWaterPlant, handleBatchWater, plantsLoading,
    plantsHasMore, plantsLoadingMore, loadMorePlants } = plantCtx
  const location = plantCtx.location || null
  const tempUnitCode = plantCtx.tempUnit?.unit || null
  const [viewMode, setViewMode] = useViewMode()
  const [filters, setFilters] = useState({ search: '', room: '', health: '', overdue: false })
  const searchTerm = filters.search
  const roomFilter = filters.room || null
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
    if (filters.room) result = result.filter((p) => p.room === filters.room)
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      result = result.filter((p) => p.name?.toLowerCase().includes(q) || p.species?.toLowerCase().includes(q))
    }
    if (filters.health) result = result.filter((p) => p.health === filters.health)
    if (filters.overdue) result = result.filter((p) => {
      const s = getWateringStatus(p, weather, floors)
      return !s.dormant && s.daysUntil < 0
    })
    return result
  }, [sortedPlants, filters, weather, floors])

  const counts = useMemo(() => {
    const overdue = filteredPlants.filter((p) => getWateringStatus(p, weather, floors).daysUntil < 0).length
    const today = filteredPlants.filter((p) => { const s = getWateringStatus(p, weather, floors); return !s.skippedRain && s.daysUntil === 0 }).length
    const soon = filteredPlants.filter((p) => { const d = getWateringStatus(p, weather, floors).daysUntil; return d > 0 && d <= 2 }).length
    const good = filteredPlants.filter((p) => getWateringStatus(p, weather, floors).daysUntil > 2).length
    return { overdue, today, soon, good }
  }, [filteredPlants, weather, floors])

  return (
    <div className="panel panel-icon" data-tour="plant-list">
      <div className="panel-hdr d-flex justify-content-between align-items-center">
        <span>
          Plants
          {floorPlants.length > 0 && <Badge bg="primary" className="ms-2">{floorPlants.length}</Badge>}
        </span>
        {floorPlants.length > 0 && (
          <div className="panel-toolbar ms-auto d-flex gap-2 align-items-center">
            {/* View mode toggle */}
            <ButtonGroup size="sm" aria-label="View mode">
              <Button
                variant={viewMode === 'card' ? 'primary' : 'outline-secondary'}
                onClick={() => setViewMode('card')}
                title="Card view"
                aria-pressed={viewMode === 'card'}
              >
                <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#grid" /></svg>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline-secondary'}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-pressed={viewMode === 'list'}
              >
                <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#list" /></svg>
              </Button>
            </ButtonGroup>
            {onImportPlants && (
              <Button variant="outline-secondary" size="sm" onClick={onImportPlants} data-testid="import-plants-btn">
                <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#upload"></use></svg>
                Import
              </Button>
            )}
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

          {/* Unified filter bar */}
          {floorPlants.length > 0 && (
            <div className="px-3 pb-2">
              <FilterBar
                filters={filters}
                onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                rooms={rooms}
                resultCount={filteredPlants.length}
              />
            </div>
          )}

          {/* Plant list */}
          <div>
            {plantsLoading ? (
              <div aria-label="Loading plants" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => <SkeletonPlantCard key={i} />)}
              </div>
            ) : filteredPlants.length === 0 ? (
              plants.length === 0 ? (
                <EmptyState
                  icon="feather"
                  title="No plants yet"
                  description="Add your first plant to start tracking watering schedules and care history."
                  actions={[
                    { label: 'Add a plant', icon: 'plus', onClick: onAddPlant },
                  ]}
                />
              ) : (
                <div className="text-center py-4 text-muted fs-sm">No plants match your search.</div>
              )
            ) : viewMode === 'list' ? (
              /* Compact list view */
              <div style={{ maxHeight: LIST_HEIGHT, overflowY: 'auto' }}>
                {filteredPlants.map((plant) => (
                  <PlantListRow
                    key={plant.id}
                    plant={plant}
                    onClick={onPlantClick}
                    onWater={handleWaterPlant}
                    weather={weather}
                    floors={floors}
                  />
                ))}
              </div>
            ) : filteredPlants.length > VIRTUALISE_THRESHOLD ? (
              /* Virtualised card rendering for large collections */
              <VirtualList
                rowCount={filteredPlants.length}
                rowHeight={ITEM_HEIGHT}
                rowComponent={VirtualPlantRow}
                rowProps={{ plants: filteredPlants, onPlantClick, handleWaterPlant, weather, floors }}
                style={{ height: LIST_HEIGHT }}
              />
            ) : (
              /* Grouped card rendering for small collections */
              <div style={{ maxHeight: LIST_HEIGHT, overflowY: 'auto' }}>
                {(() => {
                  const grouped = {}
                  filteredPlants.forEach((p) => {
                    const room = p.room || 'Unassigned'
                    if (!grouped[room]) grouped[room] = []
                    grouped[room].push(p)
                  })
                  const roomNames = Object.keys(grouped).sort()
                  let cardIndex = 0
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
                            index={cardIndex++}
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

            {/* Load more for paginated collections */}
            {plantsHasMore && !searchTerm && !roomFilter && (
              <div className="px-3 py-2 border-top">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-100"
                  disabled={plantsLoadingMore}
                  onClick={loadMorePlants}
                >
                  {plantsLoadingMore
                    ? <><span className="spinner-border spinner-border-sm me-1" />Loading more plants…</>
                    : <><svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#chevron-down"></use></svg>Load more plants</>
                  }
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
