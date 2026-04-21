import { useState, useCallback, useRef } from 'react'
import { usePlantContext } from '../context/PlantContext.jsx'
import FloorplanPanel from '../components/FloorplanPanel.jsx'
import PlantModal from '../components/PlantModal.jsx'
import UpgradePrompt from '../components/UpgradePrompt.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonRect, SkeletonPlantCard } from '../components/Skeleton.jsx'

export default function DashboardPage() {
  const { floors, activeFloorId, weather, handleSavePlant, handleDeletePlant, handleWaterPlant, handleMoisturePlant, plantsError, plants, plantsLoading, reloadPlants, isGuest } = usePlantContext()
  const gnomeWaterRef = useRef(null)

  const hasFloors = floors.length > 0

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlantId, setEditingPlantId] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)

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
