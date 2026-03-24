import React, { useState, useEffect, useCallback } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import Header from './components/Header.jsx'
import FloorplanView from './components/FloorplanView.jsx'
import PlantSidebar from './components/PlantSidebar.jsx'
import PlantModal from './components/PlantModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import LoginPage from './pages/LoginPage.jsx'

const STORAGE_KEYS = {
  PLANTS: 'plantTracker_plants',
  FLOORPLAN: 'plantTracker_floorplanImage',
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

  const [plants, setPlants] = useState(() => loadFromStorage(STORAGE_KEYS.PLANTS, []))
  const [floorplanImage, setFloorplanImage] = useState(() => loadFromStorage(STORAGE_KEYS.FLOORPLAN, null))
  const [apiKey, setApiKey] = useState(() => loadFromStorage(STORAGE_KEYS.API_KEY, null))

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)

  // Persist state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PLANTS, plants)
  }, [plants])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FLOORPLAN, floorplanImage)
  }, [floorplanImage])

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

  const handleSavePlant = useCallback((plantData) => {
    setPlants(prev => {
      if (editingPlant) {
        return prev.map(p => p.id === editingPlant.id ? { ...p, ...plantData } : p)
      } else {
        const newPlant = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          x: pendingPosition?.x ?? 50,
          y: pendingPosition?.y ?? 50,
          ...plantData,
        }
        return [...prev, newPlant]
      }
    })
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [editingPlant, pendingPosition])

  const handleDeletePlant = useCallback((plantId) => {
    setPlants(prev => prev.filter(p => p.id !== plantId))
    setShowPlantModal(false)
    setEditingPlant(null)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [])

  const handleFloorplanUpload = useCallback((base64) => {
    setFloorplanImage(base64)
  }, [])

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

      <div className="flex flex-1 overflow-hidden">
        <FloorplanView
          plants={plants}
          floorplanImage={floorplanImage}
          onFloorplanUpload={handleFloorplanUpload}
          onFloorplanClick={handleFloorplanClick}
          onMarkerClick={handleMarkerClick}
        />
        <PlantSidebar
          plants={plants}
          onPlantClick={handleMarkerClick}
        />
      </div>

      {showPlantModal && (
        <PlantModal
          plant={editingPlant}
          position={pendingPosition}
          apiKey={apiKey}
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
