import { useState, useCallback, useRef, useEffect } from 'react'
import { Badge, Button } from 'react-bootstrap'
import { useLocation } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'
import FloorplanPanel from '../components/FloorplanPanel.jsx'
import PlantModal from '../components/PlantModal.jsx'
import CsvImportModal from '../components/CsvImportModal.jsx'
import UpgradePrompt from '../components/UpgradePrompt.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonRect, SkeletonPlantCard } from '../components/Skeleton.jsx'
import { outbreakApi } from '../api/plants.js'

export default function DashboardPage() {
  const { floors, activeFloorId, weather, handleSavePlant, handleDeletePlant, handleWaterPlant, handleMoisturePlant, plantsError, plants, plantsLoading, reloadPlants, isGuest } = usePlantContext()
  const gnomeWaterRef = useRef(null)
  const [outbreaks, setOutbreaks] = useState([])
  const [bulkTreating, setBulkTreating] = useState(null)
  const [bulkTreatInput, setBulkTreatInput] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (isGuest) return
    outbreakApi.list().then(setOutbreaks).catch(() => {})
  }, [isGuest, plants])

  const handleBulkResolve = useCallback(async (outbreakId) => {
    try {
      await outbreakApi.bulkResolve(outbreakId)
      setOutbreaks(prev => prev.filter(o => o.outbreakId !== outbreakId))
    } catch (err) { console.error('Bulk resolve failed:', err) }
  }, [])

  const handleBulkTreat = useCallback(async (outbreakId) => {
    if (!bulkTreatInput.trim()) return
    try {
      await outbreakApi.bulkTreat(outbreakId, { treatment: bulkTreatInput.trim() })
      setBulkTreating(null)
      setBulkTreatInput('')
    } catch (err) { console.error('Bulk treat failed:', err) }
  }, [bulkTreatInput])

  useEffect(() => {
    const state = location.state
    if (!state) return
    if (state.openPlantId && plants.length > 0) {
      setEditingPlantId(state.openPlantId)
      setPendingPosition(null)
      setShowPlantModal(true)
      window.history.replaceState({}, '')
    } else if (state.addPlant) {
      setPendingPosition({ x: 50, y: 50 })
      setEditingPlantId(null)
      setShowPlantModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state, plants])

  const hasFloors = floors.length > 0

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlantId, setEditingPlantId] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const editingPlant = editingPlantId ? plants.find((p) => p.id === editingPlantId) || null : null

  const handleFloorplanClick = useCallback((x, y) => {
    setPendingPosition({ x, y })
    setEditingPlantId(null)
    setShowPlantModal(true)
  }, [])

  const handlePlantClick = useCallback((plant) => {
    setEditingPlantId(plant.id)
    setPendingPosition(null)
    setShowPlantModal(true)
  }, [])

  const handleAddPlant = useCallback(() => {
    setPendingPosition({ x: 50, y: 50 })
    setEditingPlantId(null)
    setShowPlantModal(true)
  }, [])

  const handleSave = useCallback(async (plantData) => {
    try {
      await handleSavePlant(plantData, editingPlant, pendingPosition)
    } catch (err) {
      console.error('Failed to save plant:', err)
      return
    }
    setShowPlantModal(false)
    setEditingPlantId(null)
    setPendingPosition(null)
  }, [editingPlant, pendingPosition, handleSavePlant])

  const handleDelete = useCallback(async (plantId) => {
    try {
      await handleDeletePlant(plantId)
    } catch (err) {
      console.error('Failed to delete plant:', err)
      return
    }
    setShowPlantModal(false)
    setEditingPlantId(null)
  }, [handleDeletePlant])

  const handleCloseModal = useCallback(() => {
    setShowPlantModal(false)
    setEditingPlantId(null)
    setPendingPosition(null)
  }, [])

  return (
    <div className="content-wrapper" style={{ padding: 0 }}>
      <div className="main-content">
        <div className="px-3 pt-2">
          <UpgradePrompt id="dashboard-plant-limit" quota="plants">
            You've reached your Free-tier plant limit. Unlock unlimited plants with Home Pro.
          </UpgradePrompt>
        </div>
        {outbreaks.length > 0 && (
          <div className="mx-3 mt-3">
            {outbreaks.map(ob => (
              <div key={ob.outbreakId} className="alert alert-danger d-flex flex-wrap align-items-start gap-2 py-2 mb-2" role="alert">
                <svg className="sa-icon sa-icon-lg text-danger mt-1 flex-shrink-0"><use href="/icons/sprite.svg#alert-triangle" /></svg>
                <div className="flex-grow-1">
                  <strong className="text-capitalize">{ob.category} Outbreak — {ob.specificType}</strong>
                  <span className="ms-2 text-muted fs-xs">
                    {ob.plants.length} plant{ob.plants.length !== 1 ? 's' : ''} affected
                    {ob.maxSeverity ? ` · Severity ${ob.maxSeverity}/5` : ''}
                  </span>
                  <div className="mt-1 fs-xs">
                    {ob.plants.map(p => (
                      <Badge key={p.plantId} bg="light" text="dark" className="me-1">{p.plantName}</Badge>
                    ))}
                  </div>
                  {bulkTreating === ob.outbreakId && (
                    <div className="d-flex gap-2 mt-2">
                      <input className="form-control form-control-sm" style={{ maxWidth: 260 }}
                        placeholder="Treatment applied…" value={bulkTreatInput}
                        onChange={e => setBulkTreatInput(e.target.value)} />
                      <Button size="sm" variant="danger" onClick={() => handleBulkTreat(ob.outbreakId)}>
                        Apply to all
                      </Button>
                      <Button size="sm" variant="light" onClick={() => setBulkTreating(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2 flex-shrink-0">
                  {bulkTreating !== ob.outbreakId && (
                    <Button size="sm" variant="outline-danger" onClick={() => { setBulkTreating(ob.outbreakId); setBulkTreatInput('') }}>
                      Treat all
                    </Button>
                  )}
                  <Button size="sm" variant="outline-success" onClick={() => handleBulkResolve(ob.outbreakId)}>
                    Resolve all
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {plantsError && (
          <div className="mx-3 mt-3">
            <ErrorAlert error={plantsError} context="plants" onRetry={reloadPlants} />
          </div>
        )}
        {plantsLoading ? (
          <div className="p-4" aria-label="Loading dashboard" aria-busy="true">
            <div className="panel panel-icon mb-3">
              <div className="panel-container"><div className="panel-content p-0">
                <SkeletonRect height={320} style={{ borderRadius: 0 }} />
              </div></div>
            </div>
            <div className="panel panel-icon">
              <div className="panel-container"><div className="panel-content p-0">
                {Array.from({ length: 5 }, (_, i) => <SkeletonPlantCard key={i} />)}
              </div></div>
            </div>
          </div>
        ) : hasFloors ? (
          <FloorplanPanel
            onPlantClick={handlePlantClick}
            onFloorplanClick={handleFloorplanClick}
            onAddPlant={handleAddPlant}
            onImportPlants={() => setShowImportModal(true)}
            gnomeWaterRef={gnomeWaterRef}
            fullWidth
          />
        ) : (
          <div className="p-4">
            <div className="panel panel-icon">
              <div className="panel-container"><div className="panel-content">
                <EmptyState
                  icon="map"
                  title="No floorplan yet"
                  description="Add a floor to place plants on a map of your home, or skip straight to adding plants by species and room."
                  actions={
                    isGuest
                      ? [
                          { label: 'Sign in to get started', icon: 'log-in', href: '/login' },
                        ]
                      : [
                          { label: 'Set up floors', icon: 'layers', href: '/settings' },
                          { label: 'Add a plant first', icon: 'plus', onClick: handleAddPlant },
                        ]
                  }
                />
              </div></div>
            </div>
          </div>
        )}
      </div>

      <CsvImportModal
        show={showImportModal}
        onHide={() => setShowImportModal(false)}
        onImported={() => { setShowImportModal(false); reloadPlants?.() }}
      />

      {showPlantModal && (
        <PlantModal
          plant={editingPlant}
          position={pendingPosition}
          floors={floors}
          activeFloorId={activeFloorId}
          weather={weather}
          onSave={handleSave}
          onDelete={handleDelete}
          onWater={handleWaterPlant}
          onMoisture={handleMoisturePlant}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
