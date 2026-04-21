import { useState, useCallback } from 'react'

const STORAGE_KEY = 'plantTracker_unitSystem'

function detectDefault() {
  try {
    const lang = navigator.language || ''
    if (lang.startsWith('en-US') || lang === 'en-LR' || lang === 'my') return 'imperial'
  } catch {}
  return 'metric'
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'metric' || v === 'imperial') return v
  } catch {}
  return null
}

export function useUnitSystem() {
  const [system, setSystemState] = useState(() => readStored() || detectDefault())

  const setSystem = useCallback((s) => {
    setSystemState(s)
    try { localStorage.setItem(STORAGE_KEY, s) } catch {}
  }, [])

  const toggle = useCallback(() => {
    setSystem(system === 'metric' ? 'imperial' : 'metric')
  }, [system, setSystem])

  return { system, setSystem, toggle }
}
