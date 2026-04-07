import { useState, useCallback } from 'react'
import { Row, Col, Alert } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import FloorplanPanel from '../components/FloorplanPanel.jsx'
import PlantListPanel from '../components/PlantListPanel.jsx'
import PlantModal from '../components/PlantModal.jsx'

export default function DashboardPage() {
  const { floors, activeFloorId, weather, handleSavePlant, handleDeletePlant, handleWaterPlant, isGuest, plantsError, plants, plantsLoading } = usePlantContext()

  const hasFloors = floors.length > 0

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlantId, setEditingPlantId] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)

  // Always get latest plant data from the array (not a stale snapshot)
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
    <div className="content-wrapper">
      <div className="main-content">
        {plantsError && (
          <Alert variant="danger" className="mb-3" dismissible>
            Failed to load plants: {plantsError}
          </Alert>
        )}
        {plantsLoading ? (
          <div className="panel panel-icon">
            <div className="panel-container"><div className="panel-content text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted mb-0">Loading your plants and floorplan...</p>
            </div></div>
          </div>
        ) : hasFloors ? (
          <>
            <FloorplanPanel
              onPlantClick={handlePlantClick}
              onFloorplanClick={handleFloorplanClick}
            />
            <div className="mt-4">
              <PlantListPanel
                onPlantClick={handlePlantClick}
                onAddPlant={handleAddPlant}
              />
            </div>
          </>
        ) : (
          <div className="panel panel-icon">
            <div className="panel-container"><div className="panel-content text-center py-5">
              <svg className="sa-icon sa-icon-5x text-muted mb-3"><use href="/icons/sprite.svg#upload"></use></svg>
              <h5 className="fw-500 mb-2">No floorplan uploaded yet</h5>
              <p className="text-muted mb-0">Go to <a href="/settings">Settings</a> to upload a floorplan or add floors manually.</p>
            </div></div>
          </div>
        )}
      </div>

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
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
