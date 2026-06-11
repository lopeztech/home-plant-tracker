import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { usePlantContext } from '../../context/PlantContext.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useSubscription } from '../../context/SubscriptionContext.jsx'
import { propagationApi, journalApi } from '../../api/plants.js'
import { getWateringStatus } from '../../utils/watering.js'
import { Garden } from './screens/Garden.jsx'
import { Today } from './screens/Today.jsx'
import { Plant } from './screens/Plant.jsx'
import { Calendar } from './screens/Calendar.jsx'
import { Forecast } from './screens/Forecast.jsx'
import { Propagation } from './screens/Propagation.jsx'
import { Library } from './screens/Library.jsx'
import { Insights } from './screens/Insights.jsx'
import { AddPlant } from './screens/AddPlant.jsx'
import { Settings } from './screens/Settings.jsx'
import { Billing } from './screens/Billing.jsx'
import { Members } from './screens/Members.jsx'
import { Login } from './screens/Login.jsx'

function speciesIcon(species = '') {
  const s = species.toLowerCase()
  if (s.includes('monstera')) return 'monstera'
  if (s.includes('snake') || s.includes('sansevieria')) return 'snake'
  if (s.includes('pothos') || s.includes('epipremnum')) return 'pothos'
  if (s.includes('fiddle') || s.includes('ficus lyrata')) return 'fiddle'
  if (s.includes('aloe')) return 'succulent'
  if (s.includes('cactus') || s.includes('barrel')) return 'cactus'
  if (s.includes('fern') || s.includes('boston')) return 'fern'
  if (s.includes('palm')) return 'palm'
  if (s.includes('lily') || s.includes('peace') || s.includes('spathiphyllum')) return 'lily'
  if (s.includes('herb') || s.includes('basil') || s.includes('mint') || s.includes('rosemary')) return 'herb'
  return 'monstera'
}

function normalizePlant(plant, weather, floors, timezone) {
  const ws = getWateringStatus(plant, weather, floors, timezone)
  const _status = ws.daysUntil < 0 ? 'overdue' : ws.daysUntil === 0 ? 'today' : 'ok'
  return { ...plant, _status, _daysUntil: ws.daysUntil ?? 0, icon: speciesIcon(plant.species) }
}

export function DesktopApp() {
  const { plants, floors, activeFloorId, weather, timezone, handleWaterPlant } = usePlantContext()
  const { user, logout, isAuthenticated, isGuest } = useAuth()
  const { tier, ...subscription } = useSubscription()

  const [screen, setScreen] = useState('garden')
  const [activePlantId, setActivePlantId] = useState(null)
  const [wateredSet, setWateredSet] = useState(() => new Set())
  const [propagations, setPropagations] = useState([])
  const [careHistory, setCareHistory] = useState({})

  useEffect(() => {
    if (!isAuthenticated || isGuest) return
    propagationApi.list?.()?.then((data) => setPropagations(Array.isArray(data) ? data : data?.items || [])).catch(() => {})
  }, [isAuthenticated, isGuest])

  const normalizedPlants = useMemo(
    () => plants.map((p) => normalizePlant(p, weather, floors, timezone)),
    [plants, weather, floors, timezone],
  )

  const water = useCallback(async (id) => {
    setWateredSet((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
    handleWaterPlant(id, {}).catch(() => {})
  }, [handleWaterPlant])

  const waterAll = useCallback((ids) => {
    setWateredSet((prev) => { const s = new Set(prev); ids.forEach((id) => s.add(id)); return s })
    ids.forEach((id) => handleWaterPlant(id, {}).catch(() => {}))
  }, [handleWaterPlant])

  const openPlant = useCallback((id) => {
    setActivePlantId(id)
    setScreen('plant')
    if (isGuest) return
    journalApi.list(id).then((entries) => {
      const history = (entries || []).slice(0, 6).map((e) => ({
        date: e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        kind: e.type === 'watering' ? 'water' : e.type === 'fertiliser' ? 'feed' : 'note',
        label: e.title || (e.type === 'watering' ? 'Watered' : 'Note'),
        detail: e.body || e.notes || '',
      }))
      setCareHistory((prev) => ({ ...prev, [id]: history }))
    }).catch(() => {})
  }, [])

  const navigate = useCallback((s) => setScreen(s), [])

  const userInfo = {
    name: user?.name || user?.email?.split('@')[0] || 'Plant Keeper',
    initial: (user?.name || user?.email || 'A')[0].toUpperCase(),
    email: user?.email || '',
  }

  const ctx = {
    navigate, openPlant, water, waterAll,
    wateredSet, user: userInfo, weather,
    activeFloorId, onSignOut: logout,
  }

  if (!isAuthenticated) {
    return <Login onGoogleSignIn={() => setScreen('garden')} />
  }

  switch (screen) {
    case 'today':
      return <Today plants={normalizedPlants} wateredSet={wateredSet} onWater={water} waterAll={waterAll} openPlant={openPlant} ctx={ctx} />
    case 'plant':
      return <Plant plantId={activePlantId} plants={normalizedPlants} careHistory={careHistory[activePlantId] || []} onWater={water} ctx={ctx} />
    case 'calendar':
      return <Calendar plants={normalizedPlants} ctx={ctx} />
    case 'forecast':
      return <Forecast plants={normalizedPlants} ctx={ctx} />
    case 'propagation':
      return <Propagation propagations={propagations} ctx={ctx} />
    case 'insights':
      return <Insights plants={normalizedPlants} wateredSet={wateredSet} ctx={ctx} />
    case 'library':
      return <Library plants={normalizedPlants} wateredSet={wateredSet} ctx={ctx} />
    case 'addplant':
      return <AddPlant floors={floors} plants={normalizedPlants} ctx={ctx} />
    case 'settings':
      return <Settings user={userInfo} subscription={{ tier, ...subscription }} ctx={ctx} />
    case 'billing':
      return <Billing subscription={{ tier, ...subscription }} ctx={ctx} />
    case 'members':
      return <Members household={{}} ctx={ctx} />
    case 'garden':
    default:
      return (
        <Garden
          plants={normalizedPlants} floors={floors} activeFloorId={activeFloorId}
          weather={weather} wateredSet={wateredSet} onWater={water} waterAll={waterAll}
          openPlant={openPlant} ctx={ctx}
        />
      )
  }
}
