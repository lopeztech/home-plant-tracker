import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Map, Leaf, Plus, Keyboard, BarChart2 } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import Header from './components/Header.jsx'
import FloorplanView from './components/FloorplanView.jsx'
import PlantSidebar from './components/PlantSidebar.jsx'
import PlantModal from './components/PlantModal.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Onboarding from './components/Onboarding.jsx'
import CareCalendar from './components/CareCalendar.jsx'
import AnalyticsPage from './components/AnalyticsModal.jsx'
import { ToastProvider, useToast } from './components/Toast.jsx'
import { plantsApi, imagesApi, floorsApi, analyseApi } from './api/plants.js'
import { useWeather } from './hooks/useWeather.js'
import { getWateringStatus } from './utils/watering.js'
import { GUEST_PLANTS, GUEST_FLOORS } from './data/guestData.js'
import { useKeyboardShortcuts, SHORTCUTS } from './hooks/useKeyboardShortcuts.js'
import { useThemeProvider } from './hooks/useTheme.js'

const DEFAULT_FLOORS = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior', imageUrl: null },
  { id: 'garden', name: 'Garden', order: -1, type: 'outdoor', imageUrl: null },
]

function AppContent() {
  const { isAuthenticated, isGuest, isLoading, logout } = useAuth()
  const { weather, locationDenied } = useWeather()
  const toast = useToast()
  const { theme, toggleTheme, ThemeContext } = useThemeProvider()

  const [plants, setPlants] = useState([])
  const [plantsLoading, setPlantsLoading] = useState(false)
  const [plantsError, setPlantsError] = useState(null)

  const [floors, setFloors] = useState(DEFAULT_FLOORS)
  const [activeFloorId, setActiveFloorId] = useState('ground')

  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState(null)
  const [pendingPosition, setPendingPosition] = useState(null)
  const [isAnalysingFloorplan, setIsAnalysingFloorplan] = useState(false)

  const overdueCount = useMemo(
    () => plants.filter(p => getWateringStatus(p, weather, floors).daysUntil < 0).length,
    [plants, weather, floors]
  )

  // Responsive layout state
  const [mobileTab, setMobileTab] = useState('floorplan')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const toggleAnalytics = useCallback(() => {
    setShowAnalytics(prev => {
      if (!prev) setMobileTab('analytics')
      return !prev
    })
  }, [])

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    onAddPlant: () => { if (!showPlantModal && !showSettings) handleAddPlant() },
    onToggleSettings: () => setShowSettings(s => !s),
    onEscape: () => {
      if (showHelp) setShowHelp(false)
      else if (showAnalytics) { setShowAnalytics(false); setMobileTab('floorplan') }
      else if (showCalendar) setShowCalendar(false)
      else if (showSettings) setShowSettings(false)
      else if (showPlantModal) { setShowPlantModal(false); setEditingPlant(null); setPendingPosition(null) }
    },
    onToggleSidebar: () => setSidebarOpen(o => !o),
  })

  // Load plants and floors when authenticated
  useEffect(() => {
    if (!isAuthenticated) return

    if (isGuest) {
      // Use mock data for guest mode — no API calls
      setPlants(GUEST_PLANTS)
      setFloors(GUEST_FLOORS)
      setActiveFloorId('ground')
      return
    }

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
          const first = loaded.find(f => f.type === 'interior') ?? loaded[0]
          setActiveFloorId(first.id)
        }
      })
      .catch(() => {}) // fall back to DEFAULT_FLOORS
  }, [isAuthenticated, isGuest])

  const handleFloorplanClick = useCallback((x, y) => {
    setPendingPosition({ x, y })
    setEditingPlant(null)
    setShowPlantModal(true)
  }, [])

  const handleAddPlant = useCallback(() => {
    setPendingPosition({ x: 50, y: 50 })
    setEditingPlant(null)
    setShowPlantModal(true)
    setMobileTab('floorplan') // show the floorplan so users see where the plant lands
  }, [])

  const handleMarkerClick = useCallback((plant) => {
    setEditingPlant(plant)
    setPendingPosition(null)
    setShowPlantModal(true)
  }, [])

  const handleMarkerDrag = useCallback(async (plant, x, y) => {
    setPlants(prev => prev.map(p => p.id === plant.id ? { ...p, x, y } : p))
    if (isGuest) return
    try {
      await plantsApi.update(plant.id, { x, y })
    } catch (err) {
      console.error('Failed to update plant position:', err)
      setPlants(prev => prev.map(p => p.id === plant.id ? plant : p))
    }
  }, [isGuest])

  const handleSavePlant = useCallback(async (plantData) => {
    const data = {
      ...plantData,
      floor: plantData.floor ?? activeFloorId,
      x: pendingPosition?.x ?? editingPlant?.x ?? 50,
      y: pendingPosition?.y ?? editingPlant?.y ?? 50,
    }
    if (isGuest) {
      // In guest mode, update local state only
      if (editingPlant) {
        setPlants(prev => prev.map(p => p.id === editingPlant.id ? { ...p, ...data } : p))
      } else {
        const newPlant = { ...data, id: `guest-new-${Date.now()}` }
        setPlants(prev => [newPlant, ...prev])
      }
      setShowPlantModal(false)
      setEditingPlant(null)
      setPendingPosition(null)
      return
    }
    try {
      if (editingPlant) {
        const updated = await plantsApi.update(editingPlant.id, data)
        setPlants(prev => prev.map(p => p.id === editingPlant.id ? updated : p))
        toast('Plant saved!')
      } else {
        const created = await plantsApi.create(data)
        setPlants(prev => [created, ...prev])
        toast('Plant added!')
      }
    } catch (err) {
      console.error('Failed to save plant:', err)
      toast.error(`Failed to save plant: ${err.message}`)
      return
    }
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [editingPlant, pendingPosition, activeFloorId, isGuest])

  const handleWaterPlant = useCallback(async (plantId) => {
    if (isGuest) {
      const now = new Date().toISOString()
      const entry = { date: now, note: '' }
      const update = p => ({ ...p, lastWatered: now, wateringLog: [...(p.wateringLog || []), entry] })
      setPlants(prev => prev.map(p => p.id === plantId ? update(p) : p))
      setEditingPlant(prev => prev?.id === plantId ? update(prev) : prev)
      return
    }
    try {
      const updated = await plantsApi.water(plantId)
      setPlants(prev => prev.map(p => p.id === plantId ? updated : p))
      setEditingPlant(prev => prev?.id === plantId ? updated : prev)
      toast('Plant watered!')
    } catch (err) {
      console.error('Failed to water plant:', err)
      toast.error(`Failed to water plant: ${err.message}`)
    }
  }, [isGuest])

  const handleBatchWater = useCallback(async (plantIds) => {
    if (isGuest) {
      const now = new Date().toISOString()
      const entry = { date: now, note: '' }
      setPlants(prev => prev.map(p =>
        plantIds.includes(p.id)
          ? { ...p, lastWatered: now, wateringLog: [...(p.wateringLog || []), entry] }
          : p
      ))
      return plantIds.length
    }
    const results = await Promise.allSettled(plantIds.map(id => plantsApi.water(id)))
    let count = 0
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        count++
        setPlants(prev => prev.map(p => p.id === plantIds[i] ? result.value : p))
      }
    })
    return count
  }, [isGuest])

  const handleDeletePlant = useCallback(async (plantId) => {
    if (isGuest) {
      setPlants(prev => prev.filter(p => p.id !== plantId))
      setShowPlantModal(false)
      setEditingPlant(null)
      return
    }
    try {
      await plantsApi.delete(plantId)
      setPlants(prev => prev.filter(p => p.id !== plantId))
      toast('Plant deleted.')
    } catch (err) {
      console.error('Failed to delete plant:', err)
      toast.error(`Failed to delete plant: ${err.message}`)
      return
    }
    setShowPlantModal(false)
    setEditingPlant(null)
  }, [isGuest])

  const handleCloseModal = useCallback(() => {
    setShowPlantModal(false)
    setEditingPlant(null)
    setPendingPosition(null)
  }, [])

  const handleFloorRoomsChange = useCallback(async (rooms) => {
    const updatedFloors = floors.map(f =>
      f.id === activeFloorId ? { ...f, rooms } : f
    )
    if (isGuest) { setFloors(updatedFloors); return }
    try {
      const { floors: saved } = await floorsApi.save(updatedFloors)
      setFloors(saved)
    } catch (err) {
      console.error('Failed to save rooms:', err)
    }
  }, [floors, activeFloorId, isGuest])

  const handleSaveFloors = useCallback(async (updatedFloors) => {
    if (isGuest) {
      setFloors(updatedFloors)
      const stillVisible = updatedFloors.find(f => f.id === activeFloorId && !f.hidden)
      if (!stillVisible) {
        const first = updatedFloors.find(f => !f.hidden && f.type === 'interior') ?? updatedFloors.find(f => !f.hidden) ?? updatedFloors[0]
        if (first) setActiveFloorId(first.id)
      }
      return
    }
    const { floors: saved } = await floorsApi.save(updatedFloors)
    setFloors(saved)
    // If the active floor is now hidden, switch to the first visible floor
    const stillVisible = saved.find(f => f.id === activeFloorId && !f.hidden)
    if (!stillVisible) {
      const first = saved.find(f => !f.hidden && f.type === 'interior') ?? saved.find(f => !f.hidden) ?? saved[0]
      if (first) setActiveFloorId(first.id)
    }
  }, [activeFloorId, isGuest])

  const handleFloorplanUpload = useCallback(async (file) => {
    if (isGuest) { toast.error('Floorplan upload is not available in guest mode.'); return }
    setIsAnalysingFloorplan(true)
    try {
      const { floors: analysedFloors } = await analyseApi.analyseFloorplan(file)
      const { floors: saved } = await floorsApi.save(analysedFloors)
      setFloors(saved)
      const first = saved.find(f => f.type === 'interior') ?? saved[0]
      if (first) setActiveFloorId(first.id)
    } catch (err) {
      toast.error(`Floorplan analysis failed: ${err.message}`)
    } finally {
      setIsAnalysingFloorplan(false)
    }
  }, [isGuest])

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
    <ThemeContext.Provider value={theme}>
    <div className="flex flex-col h-screen bg-gray-950">
      <a href="#plant-sidebar" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-emerald-600 focus:text-white focus:text-sm">
        Skip to plant list
      </a>
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenAnalytics={toggleAnalytics}
        analyticsActive={showAnalytics}
      />

      {plantsError && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2 text-center">
          Failed to load plants: {plantsError}
        </div>
      )}

      {/* Main content: analytics page or floorplan+sidebar */}
      {showAnalytics ? (
        <AnalyticsPage plants={plants} />
      ) : (
        <>
          <div className="flex flex-1 overflow-hidden">
            {/* Floorplan panel — hidden on mobile when Plants tab is active */}
            <div className={mobileTab === 'plants' ? 'hidden md:flex md:flex-1 md:flex-col md:min-w-0' : 'flex flex-1 flex-col min-w-0'}>
              <FloorplanView
                plants={plants}
                onFloorplanUpload={handleFloorplanUpload}
                onFloorplanClick={handleFloorplanClick}
                onMarkerClick={handleMarkerClick}
                onMarkerDrag={handleMarkerDrag}
                onRoomsChange={handleFloorRoomsChange}
                loading={plantsLoading}
                weather={weather}
                floors={floors}
                activeFloorId={activeFloorId}
                onFloorChange={setActiveFloorId}
                isAnalysingFloorplan={isAnalysingFloorplan}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(o => !o)}
              />
            </div>

            {/* Sidebar panel — controlled by mobileTab on mobile, sidebarOpen on md+ */}
            <div className={[
              'flex-col',
              mobileTab === 'floorplan' ? 'hidden' : 'flex w-full',
              sidebarOpen ? 'md:flex md:flex-shrink-0 md:w-72' : 'md:hidden',
            ].join(' ')}>
              <PlantSidebar
                plants={plants}
                floors={floors}
                activeFloorId={activeFloorId}
                onPlantClick={handleMarkerClick}
                onAddPlant={handleAddPlant}
                onWater={handleWaterPlant}
                onBatchWater={handleBatchWater}
                loading={plantsLoading}
                weather={weather}
                locationDenied={locationDenied}
                onOpenCalendar={() => setShowCalendar(true)}
              />
            </div>
          </div>

          {/* Mobile FAB — add plant on floorplan view */}
          {mobileTab === 'floorplan' && (
            <button
              onClick={handleAddPlant}
              className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-lg shadow-emerald-900/40 flex items-center justify-center transition-all"
              aria-label="Add new plant"
            >
              <Plus size={24} />
            </button>
          )}
        </>
      )}

      {/* Mobile tab bar */}
      <nav
        role="tablist"
        aria-label="App navigation"
        className="md:hidden flex-shrink-0 flex border-t border-gray-800 bg-gray-900"
      >
        <button
          role="tab"
          aria-selected={mobileTab === 'floorplan'}
          onClick={() => { setMobileTab('floorplan'); setShowAnalytics(false) }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${mobileTab === 'floorplan' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Map size={20} />
          <span>Floorplan</span>
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === 'plants'}
          onClick={() => { setMobileTab('plants'); setShowAnalytics(false) }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
            overdueCount > 0
              ? (mobileTab === 'plants' ? 'text-red-400' : 'text-red-500')
              : (mobileTab === 'plants' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300')
          }`}
        >
          <div className="relative">
            <Leaf size={20} />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {overdueCount > 9 ? '9+' : overdueCount}
              </span>
            )}
          </div>
          <span>
            {overdueCount > 0
              ? `${overdueCount} overdue`
              : `Plants${plants.length > 0 ? ` (${plants.length})` : ''}`
            }
          </span>
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === 'analytics'}
          onClick={() => { setMobileTab('analytics'); setShowAnalytics(true) }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${mobileTab === 'analytics' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <BarChart2 size={20} />
          <span>Analytics</span>
        </button>
      </nav>

      {showPlantModal && (
        <PlantModal
          plant={editingPlant}
          position={pendingPosition}
          floors={floors}
          activeFloorId={activeFloorId}
          weather={weather}
          onSave={handleSavePlant}
          onDelete={handleDeletePlant}
          onWater={handleWaterPlant}
          onClose={handleCloseModal}
        />
      )}

      {showSettings && (
        <SettingsModal
          floors={floors}
          onSaveFloors={handleSaveFloors}
          onClose={() => setShowSettings(false)}
          onToggleTheme={toggleTheme}
          onFloorplanUpload={handleFloorplanUpload}
          isAnalysingFloorplan={isAnalysingFloorplan}
        />
      )}

      {showCalendar && (
        <CareCalendar
          plants={plants}
          weather={weather}
          floors={floors}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {!isGuest && <Onboarding />}

      {isGuest && (
        <div className="bg-emerald-900/40 border-t border-emerald-800/60 text-emerald-300 text-xs px-4 py-2 text-center flex items-center justify-center gap-3">
          <span>You are browsing in guest mode with sample data. Changes are not saved.</span>
          <button
            onClick={logout}
            className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-colors"
          >
            Sign in
          </button>
        </div>
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowHelp(false)}
        >
          <div className="animate-fade-in-up bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Keyboard size={18} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts</h2>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{s.description}</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 font-mono">{s.key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4 text-center">Press <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs font-mono">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs font-mono">Esc</kbd> to close</p>
          </div>
        </div>
      )}
    </div>
    </ThemeContext.Provider>
  )
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'

export default function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
