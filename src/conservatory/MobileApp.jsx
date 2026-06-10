import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import { journalApi } from '../api/plants.js'
import { getWateringStatus } from '../utils/watering.js'
import { C } from './tokens.js'
import { MRule, MTabBar } from './shell.jsx'
import { Garden } from './screens/Garden.jsx'
import { Today } from './screens/Today.jsx'
import { Calendar } from './screens/Calendar.jsx'
import { Insights } from './screens/Insights.jsx'
import { You } from './screens/You.jsx'
import { PlantDetail } from './screens/PlantDetail.jsx'

// Derive icon type from species name
function speciesIcon(species = '') {
  const s = species.toLowerCase()
  if (s.includes('monstera')) return 'monstera'
  if (s.includes('snake') || s.includes('sansevieria') || s.includes('dracaena trifasciata')) return 'snake'
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

// Normalize a plant from the API into what the Conservatory UI expects
function normalizePlant(plant, weather, floors, timezone) {
  const ws = getWateringStatus(plant, weather, floors, timezone)
  let _status = 'ok'
  if (ws.daysUntil < 0) _status = 'overdue'
  else if (ws.daysUntil === 0) _status = 'today'
  return {
    ...plant,
    _status,
    _daysUntil: ws.daysUntil ?? 0,
    icon: speciesIcon(plant.species),
  }
}

export function MobileApp() {
  const { plants, floors, activeFloorId, weather, timezone, handleWaterPlant } = usePlantContext()
  const { user, logout } = useAuth()
  const { tier } = useSubscription()
  const navigate = useNavigate()

  const [tab, setTab] = useState('garden')
  const [view, setView] = useState({ screen: 'garden' })
  const [wateredSet, setWateredSet] = useState(() => new Set())
  const [careHistory, setCareHistory] = useState({})

  // Normalized plants with _status/_daysUntil/icon
  const normalizedPlants = useMemo(
    () => plants.map((p) => normalizePlant(p, weather, floors, timezone)),
    [plants, weather, floors, timezone],
  )

  const water = useCallback(async (id) => {
    setWateredSet((prev) => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else { s.add(id) }
      return s
    })
    // Optimistically fire the API call; ignore errors gracefully
    try {
      await handleWaterPlant(id, {})
    } catch {
      // Already optimistically updated
    }
  }, [handleWaterPlant])

  const waterAll = useCallback((ids) => {
    setWateredSet((prev) => {
      const s = new Set(prev)
      ids.forEach((id) => s.add(id))
      return s
    })
    ids.forEach((id) => {
      handleWaterPlant(id, {}).catch(() => {})
    })
  }, [handleWaterPlant])

  const openPlant = useCallback((plantId) => {
    setView({ screen: 'plant', plantId })
    journalApi.list(plantId)
      .then((entries) => {
        const history = (entries || []).slice(0, 5).map((e) => ({
          date: e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          kind: e.type === 'watering' ? 'water' : e.type === 'fertiliser' ? 'feed' : 'note',
          label: e.title || e.type || 'Note',
          detail: e.body || e.notes || '',
        }))
        setCareHistory((prev) => ({ ...prev, [plantId]: history }))
      })
      .catch(() => {})
  }, [])

  const goTab = useCallback((key) => {
    setTab(key)
    setView({ screen: key })
  }, [])

  const back = useCallback(() => {
    setView({ screen: tab })
  }, [tab])

  const handleSignOut = useCallback(() => {
    logout()
  }, [logout])

  const handleNavigate = useCallback((path) => {
    navigate('/' + path)
  }, [navigate])

  const userInfo = {
    name: user?.name || user?.email?.split('@')[0] || 'Plant Keeper',
    initial: (user?.name || user?.email || 'A')[0].toUpperCase(),
    plan: tier === 'landscaper_pro' ? 'Landscaper Pro' : tier === 'home_pro' ? 'Home Pro' : 'Free',
    tier,
  }

  const commonProps = {
    plants: normalizedPlants,
    floors,
    wateredSet,
    onWater: water,
    openPlant,
  }

  const isPlantScreen = view.screen === 'plant'

  function renderScreen() {
    if (isPlantScreen) {
      return (
        <PlantDetail
          plantId={view.plantId}
          plants={normalizedPlants}
          wateredSet={wateredSet}
          onWater={water}
          onBack={back}
          careHistory={careHistory[view.plantId] || []}
        />
      )
    }
    if (view.screen === 'today') return <Today {...commonProps} />
    if (view.screen === 'calendar') return <Calendar {...commonProps} />
    if (view.screen === 'insights') return <Insights {...commonProps} />
    if (view.screen === 'you') {
      return (
        <You
          plants={normalizedPlants}
          wateredSet={wateredSet}
          user={userInfo}
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      )
    }
    return (
      <Garden
        {...commonProps}
        activeFloorId={activeFloorId}
        waterAll={waterAll}
      />
    )
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.paper, fontFamily: C.sans, color: C.ink, overflow: 'hidden',
    }}>
      <MRule />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {renderScreen()}
      </div>
      {!isPlantScreen && <MTabBar active={tab} onNav={goTab} />}
    </div>
  )
}
