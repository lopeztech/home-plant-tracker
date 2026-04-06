import { useMemo, useState, useCallback } from 'react'
import { Button, FormControl, InputGroup, Badge, ListGroup } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { getWateringStatus, urgencyColor, OUTDOOR_ROOMS } from '../utils/watering.js'
import PlantIcon from './PlantIcon.jsx'

function UrgencyIcon({ days, skippedRain }) {
  if (skippedRain) return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#cloud-rain"></use></svg>
  if (days < 0) return <svg className="sa-icon status-overdue" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#alert-circle"></use></svg>
  if (days === 0) return <svg className="sa-icon status-today" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#droplet"></use></svg>
  if (days <= 2) return <svg className="sa-icon status-soon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#clock"></use></svg>
  return <svg className="sa-icon status-good" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#check-circle"></use></svg>
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
        <span
          role="button"
          tabIndex={0}
          className="flex-shrink-0 p-1 text-muted"
          onClick={(e) => { e.stopPropagation(); onWater(plant.id) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onWater(plant.id) } }}
          title={`Water ${plant.name}`}
          style={{ cursor: 'pointer' }}
        >
          <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#droplet"></use></svg>
        </span>
      )}
    </ListGroup.Item>
  )
}

export default function PlantListPanel({ onPlantClick, onAddPlant }) {
  const { plants, floors, activeFloorId, weather, handleWaterPlant, handleBatchWater, plantsLoading } = usePlantContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [roomFilter, setRoomFilter] = useState(null)

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

  const rooms = useMemo(
    () => [...new Set(floorPlants.map((p) => p.room).filter(Boolean))].sort(),
    [floorPlants],
  )

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
                onClick={() => handleBatchWater(floorPlants.map((p) => p.id))}
              >
                <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#droplet"></use></svg>
                Water All on Floor ({floorPlants.length} plants)
              </Button>
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
                <div className="d-flex gap-1 mt-2 flex-wrap">
                  {rooms.map((room) => (
                    <Button
                      key={room}
                      variant={roomFilter === room ? 'primary' : 'outline-secondary'}
                      size="sm"
                      className="py-0 px-2 fs-nano"
                      onClick={() => setRoomFilter((f) => (f === room ? null : room))}
                    >
                      {room}
                    </Button>
                  ))}
                </div>
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
              <div className="text-center py-5 px-3">
                <svg className="sa-icon sa-icon-5x text-muted mb-3"><use href="/icons/sprite.svg#feather"></use></svg>
                <p className="text-muted mb-1">{plants.length === 0 ? 'No plants yet' : 'No plants match'}</p>
                {plants.length === 0 && (
                  <Button variant="primary" size="sm" onClick={onAddPlant} className="mt-2">
                    <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus"></use></svg>
                    Get started
                  </Button>
                )}
              </div>
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
                            onClick={() => handleBatchWater(grouped[room].map((p) => p.id))}
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
