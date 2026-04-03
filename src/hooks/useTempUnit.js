import { useState, useCallback } from 'react'

const STORAGE_KEY = 'plantTracker_tempUnit'

function detectDefault() {
  try {
    const lang = navigator.language || ''
    // US, Liberia, Myanmar use Fahrenheit
    if (lang.startsWith('en-US') || lang === 'en-LR' || lang === 'my') return 'fahrenheit'
  } catch {}
  return 'celsius'
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'fahrenheit' || v === 'celsius') return v
  } catch {}
  return null
}

export function useTempUnit() {
  const [unit, setUnitState] = useState(() => readStored() || detectDefault())

  const setUnit = useCallback((u) => {
    setUnitState(u)
    try { localStorage.setItem(STORAGE_KEY, u) } catch {}
  }, [])

  const toggle = useCallback(() => {
    setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')
  }, [unit, setUnit])

  const symbol = unit === 'fahrenheit' ? '°F' : '°C'

  return { unit, setUnit, toggle, symbol }
}
