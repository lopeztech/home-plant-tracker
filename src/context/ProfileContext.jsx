import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { profileApi, featureFlagsApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export const ACCOUNT_TYPES = ['household', 'landscaper', 'both']
const DEFAULT_ACCOUNT_TYPE = 'household'
export const FEATURE_FLAG_VALUES = ['household', 'landscaper', 'both', 'hidden']

const ProfileContext = createContext(undefined)

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}

export function ProfileProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth()
  const [accountType, setAccountTypeState] = useState(DEFAULT_ACCOUNT_TYPE)
  const [featureOverrides, setFeatureOverrides] = useState({})
  const [canEditFeatureFlags, setCanEditFeatureFlags] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setAccountTypeState(DEFAULT_ACCOUNT_TYPE)
      setFeatureOverrides({})
      setCanEditFeatureFlags(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const [profileResult, flagsResult] = await Promise.allSettled([
      profileApi.get(),
      featureFlagsApi.get(),
    ])
    if (profileResult.status === 'fulfilled') {
      const data = profileResult.value
      setAccountTypeState(ACCOUNT_TYPES.includes(data?.accountType) ? data.accountType : DEFAULT_ACCOUNT_TYPE)
    } else {
      // Route may not be live (gateway not yet updated) — degrade to default
      // rather than block the whole app.
      setAccountTypeState(DEFAULT_ACCOUNT_TYPE)
    }
    if (flagsResult.status === 'fulfilled') {
      const data = flagsResult.value
      setFeatureOverrides(data?.overrides && typeof data.overrides === 'object' ? data.overrides : {})
      setCanEditFeatureFlags(Boolean(data?.canEdit))
    } else {
      setFeatureOverrides({})
      setCanEditFeatureFlags(false)
    }
    const firstErr = [profileResult, flagsResult].find((r) => r.status === 'rejected')
    setError(firstErr ? (firstErr.reason?.message || 'Profile lookup failed') : null)
    setLoading(false)
  }, [isAuthenticated, isGuest])

  useEffect(() => { refresh() }, [refresh])

  const setAccountType = useCallback(async (next) => {
    if (!ACCOUNT_TYPES.includes(next)) throw new Error(`Unknown accountType: ${next}`)
    if (!isAuthenticated || isGuest) {
      setAccountTypeState(next)
      return
    }
    const prev = accountType
    setAccountTypeState(next)
    try {
      await profileApi.set(next)
      setError(null)
    } catch (err) {
      setAccountTypeState(prev)
      setError(err?.message || 'Failed to save profile')
      throw err
    }
  }, [accountType, isAuthenticated, isGuest])

  const saveFeatureOverrides = useCallback(async (next) => {
    if (!next || typeof next !== 'object') throw new Error('overrides must be an object')
    for (const [key, value] of Object.entries(next)) {
      if (!FEATURE_FLAG_VALUES.includes(value)) {
        throw new Error(`Unknown feature value for ${key}: ${value}`)
      }
    }
    const prev = featureOverrides
    setFeatureOverrides(next)
    try {
      const data = await featureFlagsApi.save(next)
      setFeatureOverrides(data?.overrides || next)
      setError(null)
    } catch (err) {
      setFeatureOverrides(prev)
      setError(err?.message || 'Failed to save feature flags')
      throw err
    }
  }, [featureOverrides])

  const value = useMemo(
    () => ({
      accountType, setAccountType,
      featureOverrides, saveFeatureOverrides, canEditFeatureFlags,
      loading, error, refresh,
    }),
    [accountType, setAccountType, featureOverrides, saveFeatureOverrides, canEditFeatureFlags, loading, error, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
