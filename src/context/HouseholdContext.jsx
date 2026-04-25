import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { householdsApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

// Frontend mirror of api/plants/households.js role hierarchy.
const ROLE_LEVEL = { viewer: 0, editor: 1, owner: 2 }

const HouseholdContext = createContext(null)

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}

export function HouseholdProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth()
  const [households, setHouseholds] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [activeRole, setActiveRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setHouseholds([])
      setActiveId(null)
      setActiveRole(null)
      return
    }
    setLoading(true)
    try {
      const data = await householdsApi.list()
      setHouseholds(data.households || [])
      setActiveId(data.activeHouseholdId || null)
      const active = (data.households || []).find((h) => h.isActive)
      setActiveRole(active?.role || null)
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load households')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isGuest])

  useEffect(() => { refresh() }, [refresh])

  const switchTo = useCallback(async (id) => {
    await householdsApi.switch(id)
    await refresh()
  }, [refresh])

  const value = useMemo(() => {
    const canEdit = ROLE_LEVEL[activeRole] >= ROLE_LEVEL.editor
    const canOwn  = ROLE_LEVEL[activeRole] >= ROLE_LEVEL.owner
    return {
      households,
      activeHouseholdId: activeId,
      activeRole,
      canEdit,
      canOwn,
      loading,
      error,
      refresh,
      switchTo,
    }
  }, [households, activeId, activeRole, loading, error, refresh, switchTo])

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export { ROLE_LEVEL }
