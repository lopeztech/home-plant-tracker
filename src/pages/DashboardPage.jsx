import { useState, useCallback } from 'react'
import { Row, Col, Alert } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import FloorplanPanel from '../components/FloorplanPanel.jsx'
import PlantListPanel from '../components/PlantListPanel.jsx'
import PlantModal from '../components/PlantModal.jsx'

export default function DashboardPage() {
  const { floors, activeFloorId, weather, handleSavePlant, handleDeletePlant, handleWaterPlant, isGuest, plantsError } = usePlantContext()

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)

  const handleFloorplanClick = useCallback((x, y) => {
    setPendingPosition({ x, y })
    setEditingPlant(null)
    setShowPlantModal(true)
  }, [])

  const handlePlantClick = useCallback((plant) => {
    setEditingPlant(plant)
    setPendingPosition(null)
    setShowPlantModal(true)
  }, [])

  const handleAddPlant = useCallback(() => {
    setPendingPosition({ x: 50, y: 50 })
    setEditingPlant(null)
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
    setEditingPlant(null)
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
    setEditingPlant(null)
  }, [handleDeletePlant])

  const handleCloseModal = useCallback(() => {
    setShowPlantModal(false)
    setEditingPlant(null)
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
        <Row>
          <Col xl={8} className="mb-4">
            <FloorplanPanel
              onPlantClick={handlePlantClick}
              onFloorplanClick={handleFloorplanClick}
            />
          </Col>
          <Col xl={4} className="mb-4">
            <PlantListPanel
              onPlantClick={handlePlantClick}
              onAddPlant={handleAddPlant}
            />
          </Col>
        </Row>
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
