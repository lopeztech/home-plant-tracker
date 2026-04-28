import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { profileApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

export const ACCOUNT_TYPES = ['household', 'landscaper', 'both']
const DEFAULT_ACCOUNT_TYPE = 'household'

const ProfileContext = createContext(undefined)

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}

export function ProfileProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth()
  const [accountType, setAccountTypeState] = useState(DEFAULT_ACCOUNT_TYPE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setAccountTypeState(DEFAULT_ACCOUNT_TYPE)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await profileApi.get()
      setAccountTypeState(ACCOUNT_TYPES.includes(data?.accountType) ? data.accountType : DEFAULT_ACCOUNT_TYPE)
      setError(null)
    } catch (err) {
      // Route may not be live (gateway not yet updated) — degrade to default
      // rather than block the whole app.
      setAccountTypeState(DEFAULT_ACCOUNT_TYPE)
      setError(err?.message || 'Profile lookup failed')
    } finally {
      setLoading(false)
    }
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

  const value = useMemo(
    () => ({ accountType, setAccountType, loading, error, refresh }),
    [accountType, setAccountType, loading, error, refresh],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
