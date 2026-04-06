import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { plantsApi, imagesApi, floorsApi, analyseApi } from '../api/plants.js'
import { useWeather } from '../hooks/useWeather.js'
import { useTempUnit } from '../hooks/useTempUnit.js'
import { getWateringStatus, isOutdoor } from '../utils/watering.js'
import { GUEST_PLANTS, GUEST_FLOORS } from '../data/guestData.js'

const DEFAULT_FLOORS = []

const PlantContext = createContext(undefined)

export function usePlantContext() {
  const ctx = useContext(PlantContext)
  if (!ctx) throw new Error('usePlantContext must be used within PlantProvider')
  return ctx
}

export function PlantProvider({ children }) {
  const { isAuthenticated, isGuest, logout } = useAuth()
  const tempUnit = useTempUnit()
  const { weather, locationDenied, location, setLocation } = useWeather(tempUnit.unit)

  const [plants, setPlants] = useState([])
  const [plantsLoading, setPlantsLoading] = useState(false)
  const [plantsError, setPlantsError] = useState(null)
  const [floors, setFloors] = useState(DEFAULT_FLOORS)
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [isAnalysingFloorplan, setIsAnalysingFloorplan] = useState(false)

  const overdueCount = useMemo(
    () => plants.filter((p) => getWateringStatus(p, weather, floors).daysUntil < 0).length,
    [plants, weather, floors],
  )

  // Auto-mark outdoor plants as watered when it's raining
  useEffect(() => {
    if (!weather?.current?.condition?.sky) return
    const sky = weather.current.condition.sky
    const isRaining = sky === 'rainy' || sky === 'stormy'
    if (!isRaining) return

    const today = new Date().toISOString().slice(0, 10)
    const outdoorPlantsDueForRainWater = plants.filter((p) => {
      if (!isOutdoor(p, floors)) return false
      // Check if already watered today
      const lastEntry = p.wateringLog?.[p.wateringLog.length - 1]
      if (lastEntry?.date?.slice(0, 10) === today && lastEntry?.method === 'rain') return false
      // Only auto-water if due within 1 day
      const status = getWateringStatus(p, weather, floors)
      return status.daysUntil <= 1 && !status.skippedRain
    })

    if (outdoorPlantsDueForRainWater.length === 0) return

    const now = new Date().toISOString()
    const entry = { date: now, note: 'Auto-watered by rain', amount: null, method: 'rain' }
    setPlants((prev) =>
      prev.map((p) =>
        outdoorPlantsDueForRainWater.some((op) => op.id === p.id)
          ? { ...p, lastWatered: now, wateringLog: [...(p.wateringLog || []), entry] }
          : p
      ),
    )
    // Persist to backend (non-blocking)
    if (!isGuest) {
      outdoorPlantsDueForRainWater.forEach((p) => {
        plantsApi.water(p.id).catch(() => {})
      })
    }
  }, [weather?.current?.condition?.sky, plants.length, floors])

  useEffect(() => {
    if (!isAuthenticated) return
    if (isGuest) {
      setPlants(GUEST_PLANTS)
      setFloors(GUEST_FLOORS)
      setActiveFloorId('ground')
      return
    }
    setPlants([])
    setFloors(DEFAULT_FLOORS)
    setPlantsLoading(true)
    setPlantsError(null)
    plantsApi.list()
      .then(setPlants)
      .catch((err) => {
        const msg = err.message || ''
        // CORS errors (expired JWT → 400 without CORS headers) and auth errors
        // indicate a stale credential — force re-login
        const isAuthError = msg.includes('NetworkError') || msg.includes('Failed to fetch')
          || msg.includes('Load failed') || msg.includes('401') || msg.includes('403')
        if (isAuthError) {
          setPlantsError('Session expired. Please sign in again.')
          logout()
          return
        }
        setPlantsError(msg)
      })
      .finally(() => setPlantsLoading(false))
    floorsApi.get()
      .then(({ floors: loaded }) => {
        if (loaded?.length) {
          setFloors(loaded)
          const first = loaded.find((f) => f.type !== 'outdoor') ?? loaded[0]
          setActiveFloorId(first.id)
        }
      })
      .catch(() => {})
  }, [isAuthenticated, isGuest])

  const handleSavePlant = useCallback(async (plantData, editingPlant, pendingPosition) => {
    const data = {
      ...plantData,
      floor: plantData.floor ?? activeFloorId,
      x: pendingPosition?.x ?? editingPlant?.x ?? 50,
      y: pendingPosition?.y ?? editingPlant?.y ?? 50,
    }
    if (isGuest) {
      if (editingPlant) {
        setPlants((prev) => prev.map((p) => (p.id === editingPlant.id ? { ...p, ...data } : p)))
      } else {
        setPlants((prev) => [{ ...data, id: `guest-new-${Date.now()}` }, ...prev])
      }
      return
    }
    if (editingPlant) {
      const updated = await plantsApi.update(editingPlant.id, data)
      setPlants((prev) => prev.map((p) => (p.id === editingPlant.id ? updated : p)))
    } else {
      const created = await plantsApi.create(data)
      setPlants((prev) => [created, ...prev])
    }
  }, [activeFloorId, isGuest])

  const handleWaterPlant = useCallback(async (plantId) => {
    if (isGuest) {
      const now = new Date().toISOString()
      const entry = { date: now, note: '' }
      const updater = (p) => ({ ...p, lastWatered: now, wateringLog: [...(p.wateringLog || []), entry] })
      setPlants((prev) => prev.map((p) => (p.id === plantId ? updater(p) : p)))
      return
    }
    const updated = await plantsApi.water(plantId)
    setPlants((prev) => prev.map((p) => (p.id === plantId ? updated : p)))
  }, [isGuest])

  const handleBatchWater = useCallback(async (plantIds) => {
    if (isGuest) {
      const now = new Date().toISOString()
      const entry = { date: now, note: '' }
      setPlants((prev) =>
        prev.map((p) =>
          plantIds.includes(p.id) ? { ...p, lastWatered: now, wateringLog: [...(p.wateringLog || []), entry] } : p,
        ),
      )
      return plantIds.length
    }
    const results = await Promise.allSettled(plantIds.map((id) => plantsApi.water(id)))
    let count = 0
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        count++
        setPlants((prev) => prev.map((p) => (p.id === plantIds[i] ? result.value : p)))
      }
    })
    return count
  }, [isGuest])

  const handleDeletePlant = useCallback(async (plantId) => {
    if (isGuest) {
      setPlants((prev) => prev.filter((p) => p.id !== plantId))
      return
    }
    await plantsApi.delete(plantId)
    setPlants((prev) => prev.filter((p) => p.id !== plantId))
  }, [isGuest])

  const handleMarkerDrag = useCallback(async (plant, x, y) => {
    // Detect which room the plant was dropped into
    const floor = floors.find((f) => f.id === (plant.floor || activeFloorId))
    let room = plant.room
    if (floor?.rooms?.length) {
      for (const r of floor.rooms) {
        if (r.hidden) continue
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          room = r.name
          break
        }
      }
    }
    const updatedFields = { x, y, room }
    setPlants((prev) => prev.map((p) => (p.id === plant.id ? { ...p, ...updatedFields } : p)))
    if (isGuest) return
    try {
      await plantsApi.update(plant.id, updatedFields)
      // Don't replace with API response — keep the optimistic update
      // to avoid re-rendering markers with potentially different signed URLs
    } catch (err) {
      console.error('Failed to save plant position:', err)
    }
  }, [isGuest, floors, activeFloorId])

  const handleSaveFloors = useCallback(async (updatedFloors) => {
    if (isGuest) {
      setFloors(updatedFloors)
    } else {
      const { floors: saved } = await floorsApi.save(updatedFloors)
      setFloors(saved)
    }
    const current = (isGuest ? updatedFloors : floors).find((f) => f.id === activeFloorId && !f.hidden)
    if (!current) {
      const first = (isGuest ? updatedFloors : floors).find((f) => !f.hidden && f.type !== 'outdoor') ?? (isGuest ? updatedFloors : floors).find((f) => !f.hidden)
      if (first) setActiveFloorId(first.id)
    }
  }, [activeFloorId, isGuest, floors])

  const handleFloorRoomsChange = useCallback(async (rooms) => {
    const updatedFloors = floors.map((f) => (f.id === activeFloorId ? { ...f, rooms } : f))
    if (isGuest) {
      setFloors(updatedFloors)
      return
    }
    try {
      const { floors: saved } = await floorsApi.save(updatedFloors)
      setFloors(saved)
    } catch (err) {
      console.error('Failed to save rooms:', err)
    }
  }, [floors, activeFloorId, isGuest])

  const handleFloorplanUpload = useCallback(async (file) => {
    setIsAnalysingFloorplan(true)
    try {
      const { floors: analysedFloors } = await analyseApi.analyseFloorplan(file)
      const { floors: saved } = await floorsApi.save(analysedFloors)
      setFloors(saved)
      const first = saved.find((f) => f.type !== 'outdoor') ?? saved[0]
      if (first) setActiveFloorId(first.id)
    } finally {
      setIsAnalysingFloorplan(false)
    }
  }, [])

  const value = useMemo(() => ({
    plants, plantsLoading, plantsError,
    floors, activeFloorId, setActiveFloorId,
    weather, locationDenied, location, setLocation, tempUnit,
    overdueCount, isAnalysingFloorplan,
    isGuest,
    handleSavePlant, handleWaterPlant, handleBatchWater,
    handleDeletePlant,
    handleSaveFloors, handleFloorRoomsChange, handleFloorplanUpload,
    updatePlantsLocally: (updates) => setPlants((prev) => prev.map((p) => updates[p.id] ? { ...p, ...updates[p.id] } : p)),
  }), [
    plants, plantsLoading, plantsError, floors, activeFloorId,
    weather, locationDenied, location, setLocation, tempUnit, overdueCount, isAnalysingFloorplan, isGuest,
    handleSavePlant, handleWaterPlant, handleBatchWater,
    handleDeletePlant,
    handleSaveFloors, handleFloorRoomsChange, handleFloorplanUpload,
  ])

  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>
}
