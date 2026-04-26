import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import PlantModal from '../components/PlantModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonRect } from '../components/Skeleton.jsx'

// Tab IDs that may appear in the URL hash. Anything else is ignored so we don't
// pass garbage into PlantModal's setActiveTab.
const VALID_TAB_IDS = new Set([
  'edit', 'watering', 'care', 'growth', 'journal',
  'blooms', 'lifecycle', 'soil', 'harvest', 'health', 'wildlife',
])

function tabFromHash(hash) {
  const id = (hash || '').replace(/^#/, '')
  return VALID_TAB_IDS.has(id) ? id : null
}

export default function PlantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    plants, plantsLoading, floors, activeFloorId, weather,
    handleSavePlant, handleDeletePlant, handleWaterPlant, handleMoisturePlant,
  } = usePlantContext()

  const plant = plants.find((p) => p.id === id) || null
  const [activeTab, setActiveTab] = useState(() => tabFromHash(location.hash) || 'edit')
  const [isDirty, setIsDirty] = useState(false)

  // External hash changes (e.g. user pasting a URL or clicking the breadcrumb)
  // should drive the active tab.
  useEffect(() => {
    const hashTab = tabFromHash(location.hash)
    if (hashTab && hashTab !== activeTab) setActiveTab(hashTab)
  }, [location.hash, activeTab])

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab)
    const nextHash = nextTab && nextTab !== 'edit' ? `#${nextTab}` : ''
    if (nextHash !== location.hash) {
      navigate(`${location.pathname}${location.search}${nextHash}`, { replace: true })
    }
  }, [location.hash, location.pathname, location.search, navigate])

  // Browser-level guard for full reloads / tab closes. In-app navigation
  // (sidebar, breadcrumb, back button) is not blocked yet — that needs
  // useBlocker, which requires a data-router migration (BrowserRouter →
  // createBrowserRouter + RouterProvider). Tracked as a follow-up.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }, [navigate])

  const handleSave = useCallback(async (plantData) => {
    await handleSavePlant(plantData, plant, null)
    setIsDirty(false)
  }, [handleSavePlant, plant])

  const handleDelete = useCallback(async (plantId) => {
    await handleDeletePlant(plantId)
    setIsDirty(false)
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
              initialTab={activeTab}
              onTabChange={handleTabChange}
              onDirtyChange={setIsDirty}
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
