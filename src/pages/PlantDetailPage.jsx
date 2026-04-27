import { useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import PlantModal from '../components/PlantModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonRect } from '../components/Skeleton.jsx'

export default function PlantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    plants, plantsLoading, floors, activeFloorId, weather,
    handleSavePlant, handleDeletePlant, handleWaterPlant, handleMoisturePlant,
  } = usePlantContext()

  const plant = plants.find((p) => p.id === id) || null

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }, [navigate])

  const handleSave = useCallback(async (plantData) => {
    await handleSavePlant(plantData, plant, null)
  }, [handleSavePlant, plant])

  const handleDelete = useCallback(async (plantId) => {
    await handleDeletePlant(plantId)
    goBack()
  }, [handleDeletePlant, goBack])

  return (
    <div className="content-wrapper" style={{ padding: 0 }}>
      <div className="main-content">
        <div className="px-3 pt-3 pb-2 d-flex align-items-center gap-2">
          <Button variant="light" size="sm" onClick={goBack} aria-label="Back to Garden">
            <svg className="sa-icon me-1" aria-hidden="true"><use href="/icons/sprite.svg#arrow-left"></use></svg>
            Back
          </Button>
          <nav aria-label="breadcrumb" className="ms-1">
            <ol className="breadcrumb mb-0 fs-sm">
              <li className="breadcrumb-item"><Link to="/">Garden</Link></li>
              <li className="breadcrumb-item active" aria-current="page">
                {plant?.name || (plantsLoading ? '…' : 'Plant')}
              </li>
            </ol>
          </nav>
        </div>

        <div className="px-3 pb-4">
          {plantsLoading && !plant ? (
            <div aria-label="Loading plant" aria-busy="true">
              <SkeletonRect height={480} style={{ borderRadius: 8 }} />
            </div>
          ) : !plant ? (
            <div className="panel panel-icon">
              <div className="panel-container"><div className="panel-content">
                <EmptyState
                  icon="alert-circle"
                  title="Plant not found"
                  description="This plant may have been deleted, or the link is broken."
                  actions={[{ label: 'Back to Garden', icon: 'arrow-left', onClick: goBack }]}
                />
              </div></div>
            </div>
          ) : (
            <PlantModal
              embedded
              plant={plant}
              floors={floors}
              activeFloorId={activeFloorId}
              weather={weather}
              onSave={handleSave}
              onDelete={handleDelete}
              onWater={handleWaterPlant}
              onMoisture={handleMoisturePlant}
              onClose={goBack}
            />
          )}
        </div>
      </div>
    </div>
  )
}
