import { useState, useCallback } from 'react'
import { Alert } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import PlantListPanel from '../components/PlantListPanel.jsx'
import PlantModal from '../components/PlantModal.jsx'
import FloorNav from '../components/FloorNav.jsx'

export default function PlantsPage() {
  const {
    floors,
    activeFloorId,
    setActiveFloorId,
    weather,
    plants,
    plantsError,
    plantsLoading,
    handleSavePlant,
    handleDeletePlant,
    handleWaterPlant,
    handleMoisturePlant,
  } = usePlantContext()

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlantId, setEditingPlantId] = useState(null)

  const editingPlant = editingPlantId ? plants.find((p) => p.id === editingPlantId) || null : null

  const handlePlantClick = useCallback((plant) => {
    setEditingPlantId(plant.id)
    setShowPlantModal(true)
  }, [])

  const handleAddPlant = useCallback(() => {
    setEditingPlantId(null)
    setShowPlantModal(true)
  }, [])

  const handleSave = useCallback(async (plantData) => {
    try {
      await handleSavePlant(plantData, editingPlant, { x: 50, y: 50 })
    } catch (err) {
      console.error('Failed to save plant:', err)
      return
    }
    setShowPlantModal(false)
    setEditingPlantId(null)
  }, [editingPlant, handleSavePlant])

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
              <p className="text-muted mb-0">Loading your plants...</p>
            </div></div>
          </div>
        ) : (
          <>
            {floors.length > 1 && (
              <div className="mb-3">
                <FloorNav floors={floors} activeFloorId={activeFloorId} onChange={setActiveFloorId} />
              </div>
            )}
            <PlantListPanel
              onPlantClick={handlePlantClick}
              onAddPlant={handleAddPlant}
            />
          </>
        )}
      </div>

      {showPlantModal && (
        <PlantModal
          plant={editingPlant}
          position={null}
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
