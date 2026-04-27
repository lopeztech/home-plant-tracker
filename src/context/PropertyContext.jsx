import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { propertiesApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

const STORAGE_KEY = 'plantTracker_activePropertyId'

const PropertyContext = createContext(null)

export function useProperty() {
  const ctx = useContext(PropertyContext)
  if (!ctx) throw new Error('useProperty must be used within PropertyProvider')
  return ctx
}

export function PropertyProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth()
  const [properties, setProperties] = useState([])
  const [activePropertyId, setActivePropertyId] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'primary',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setProperties([])
      return
    }
    setLoading(true)
    try {
      const data = await propertiesApi.list()
      const list = data.properties || []
      setProperties(list)
      // Reset active ID if it no longer exists
      if (list.length > 0 && !list.find((p) => p.id === activePropertyId)) {
        const fallback = list[0].id
        setActivePropertyId(fallback)
        localStorage.setItem(STORAGE_KEY, fallback)
      }
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isGuest, activePropertyId])

  useEffect(() => { refresh() }, [isAuthenticated, isGuest]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchTo = useCallback((id) => {
    setActivePropertyId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const activeProperty = useMemo(
    () => properties.find((p) => p.id === activePropertyId) || properties[0] || null,
    [properties, activePropertyId],
  )

  const value = useMemo(() => ({
    properties,
    activePropertyId: activeProperty?.id || 'primary',
    activeProperty,
    loading,
    error,
    refresh,
    switchTo,
  }), [properties, activeProperty, loading, error, refresh, switchTo])

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
}
