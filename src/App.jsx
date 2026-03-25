import React, { useState, useEffect, useCallback } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import Header from './components/Header.jsx'
import FloorplanView from './components/FloorplanView.jsx'
import PlantSidebar from './components/PlantSidebar.jsx'
import PlantModal from './components/PlantModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { plantsApi, imagesApi, floorsApi } from './api/plants.js'
import { useWeather } from './hooks/useWeather.js'

const DEFAULT_FLOORS = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior', imageUrl: null },
  { id: 'garden', name: 'Garden', order: -1, type: 'outdoor', imageUrl: null },
]

const STORAGE_KEYS = {
  API_KEY: 'plantTracker_apiKey',
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth()
  const { weather, locationDenied } = useWeather()

  const [plants, setPlants] = useState([])
  const [plantsLoading, setPlantsLoading] = useState(false)
  const [plantsError, setPlantsError] = useState(null)
  const [apiKey, setApiKey] = useState(() => loadFromStorage(STORAGE_KEYS.API_KEY, null))

  const [floors, setFloors] = useState(DEFAULT_FLOORS)
  const [activeFloorId, setActiveFloorId] = useState('ground')

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)

  // Load plants and floors from API when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    setPlantsLoading(true)
    setPlantsError(null)
    plantsApi.list()
      .then(setPlants)
      .catch(err => setPlantsError(err.message))
      .finally(() => setPlantsLoading(false))

    floorsApi.get()
      .then(({ floors: loaded }) => {
        if (loaded?.length) {
          setFloors(loaded)
          // Default to first interior floor
          const first = loaded.find(f => f.type === 'interior') ?? loaded[0]
          setActiveFloorId(first.id)
        }
      })
      .catch(() => {}) // fall back to DEFAULT_FLOORS
  }, [isAuthenticated])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.API_KEY, apiKey)
  }, [apiKey])

  const handleFloorplanClick = useCallback((x, y) => {
    setPendingPosition({ x, y })
    setEditingPlant(null)
    setShowPlantModal(true)
  }, [])

  const handleAddPlant = useCallback(() => {
    setPendingPosition({ x: 50, y: 50 })
    setEditingPlant(null)
    setShowPlantModal(true)
  }, [])

  const handleMarkerClick = useCallback((plant) => {
    setEditingPlant(plant)
    setPendingPosition(null)
    setShowPlantModal(true)
  }, [])

  const handleMarkerDrag = useCallback(async (plant, x, y) => {
    setPlants(prev => prev.map(p => p.id === plant.id ? { ...p, x, y } : p))
    try {
      await plantsApi.update(plant.id, { x, y })
    } catch (err) {
      console.error('Failed to update plant position:', err)
      setPlants(prev => prev.map(p => p.id === plant.id ? plant : p))
    }
  }, [])

  const handleSavePlant = useCallback(async (plantData) => {
    const data = {
      ...plantData,
      floor: plantData.floor ?? activeFloorId,
      x: pendingPosition?.x ?? editingPlant?.x ?? 50,
      y: pendingPosition?.y ?? editingPlant?.y ?? 50,
    }
    try {
      if (editingPlant) {
        const updated = await plantsApi.update(editingPlant.id, data)
        setPlants(prev => prev.map(p => p.id === editingPlant.id ? updated : p))
      } else {
        const created = await plantsApi.create(data)
        setPlants(prev => [created, ...prev])
      }
    } catch (err) {
      console.error('Failed to save plant:', err)
      alert(`Failed to save plant: ${err.message}`)
      return
    }
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [editingPlant, pendingPosition, activeFloorId])

  const handleDeletePlant = useCallback(async (plantId) => {
    try {
      await plantsApi.delete(plantId)
      setPlants(prev => prev.filter(p => p.id !== plantId))
    } catch (err) {
      console.error('Failed to delete plant:', err)
      alert(`Failed to delete plant: ${err.message}`)
      return
    }
    setShowPlantModal(false)
    setEditingPlant(null)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [])

  const handleFloorplanUpload = useCallback(async (file) => {
    try {
      const rawUrl = await imagesApi.upload(file, 'floorplans')
      // Update the active floor's imageUrl (stored as raw GCS URL)
      const updatedFloors = floors.map(f =>
        f.id === activeFloorId ? { ...f, imageUrl: rawUrl } : f
      )
      const { floors: saved } = await floorsApi.save(updatedFloors)
      setFloors(saved) // API returns signed imageUrls
    } catch (err) {
      alert(`Floorplan upload failed: ${err.message}`)
    }
  }, [floors, activeFloorId])

  const handleSaveApiKey = useCallback((key) => {
    setApiKey(key)
    setShowSettingsModal(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Header
        onAddPlant={handleAddPlant}
        onOpenSettings={() => setShowSettingsModal(true)}
        apiKeySet={!!apiKey}
      />

      {plantsError && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2 text-center">
          Failed to load plants: {plantsError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <FloorplanView
          plants={plants}
          onFloorplanUpload={handleFloorplanUpload}
          onFloorplanClick={handleFloorplanClick}
          onMarkerClick={handleMarkerClick}
          onMarkerDrag={handleMarkerDrag}
          loading={plantsLoading}
          weather={weather}
          floors={floors}
          activeFloorId={activeFloorId}
          onFloorChange={setActiveFloorId}
        />
        <PlantSidebar
          plants={plants}
          onPlantClick={handleMarkerClick}
          loading={plantsLoading}
          weather={weather}
          locationDenied={locationDenied}
        />
      </div>

      {showPlantModal && (
        <PlantModal
          plant={editingPlant}
          position={pendingPosition}
          apiKey={apiKey}
          floors={floors}
          activeFloorId={activeFloorId}
          onSave={handleSavePlant}
          onDelete={handleDeletePlant}
          onClose={handleCloseModal}
          onOpenSettings={() => {
            handleCloseModal()
            setShowSettingsModal(true)
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          currentApiKey={apiKey}
          onSave={handleSaveApiKey}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  )
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'

export default function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
