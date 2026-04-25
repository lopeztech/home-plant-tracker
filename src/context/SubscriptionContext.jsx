import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { billingApi, accountApi } from '../api/plants.js'
import { useAuth } from '../contexts/AuthContext.jsx'

// Same shape as backend billing.js TIERS, kept in sync by manual review.
const TIER_LEVEL = { free: 0, home_pro: 1, landscaper_pro: 2 }

const DEFAULT_SNAPSHOT = {
  billingEnabled: false,
  tier:           'free',
  status:         'free',
  quotas:         { plants: 10, ai_analyses: 5, photo_storage_mb: 50, properties: 1, team_members: 0 },
  usage:          { plants: 0, ai_analyses: 0, photo_storage_mb: 0 },
  currentPeriodEnd:  null,
  cancelAtPeriodEnd: false,
  isTrial:           false,
  trialDaysRemaining: null,
}

export const SubscriptionContext = createContext(undefined)

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  return ctx
}

export function SubscriptionProvider({ children }) {
  const { isAuthenticated, isGuest } = useAuth()
  const [snapshot, setSnapshot] = useState(DEFAULT_SNAPSHOT)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setSnapshot(DEFAULT_SNAPSHOT)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await billingApi.getSubscription()
      // If no subscription exists yet, start the free trial for this new user
      if (data.billingEnabled && !data.status || data.status === 'free' && !data.isTrial && data.billingEnabled) {
        try {
          const trial = await accountApi.startTrial()
          if (trial && !trial.alreadyExists) {
            // Re-fetch subscription now that trial is created
            const refreshed = await billingApi.getSubscription()
            setSnapshot({ ...DEFAULT_SNAPSHOT, ...refreshed })
            setError(null)
            return
          }
        } catch { /* ignore — trial start failing should not block the app */ }
      }
      setSnapshot({ ...DEFAULT_SNAPSHOT, ...data })
      setError(null)
    } catch (err) {
      // If the route isn't live yet (e.g. pre-activation), don't block the app.
      setSnapshot(DEFAULT_SNAPSHOT)
      setError(err.message || 'Subscription lookup failed')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isGuest])

  useEffect(() => { refresh() }, [refresh])

  const value = useMemo(() => {
    const { tier, quotas, usage, billingEnabled } = snapshot
    const canAccess = (minTier) => (TIER_LEVEL[tier] ?? 0) >= (TIER_LEVEL[minTier] ?? 0)
    const getQuotaRemaining = (type) => {
      const limit = quotas?.[type]
      const used  = usage?.[type] ?? 0
      if (limit === undefined) return null
      if (limit === Infinity || limit === null) return Infinity
      return Math.max(0, limit - used)
    }
    const isAtQuotaLimit = (type) => getQuotaRemaining(type) === 0
    return { ...snapshot, loading, error, refresh, canAccess, getQuotaRemaining, isAtQuotaLimit }
  }, [snapshot, loading, error, refresh])

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}
