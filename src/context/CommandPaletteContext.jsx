import { createContext, useCallback, useContext, useState } from 'react'

const RECENT_KEY = '__PLANT_TRACKER_RECENT_PLANTS__'
const MAX_RECENT = 5

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] }
  catch { return [] }
}

const CommandPaletteContext = createContext(null)

export function CommandPaletteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [recentPlantIds, setRecentPlantIds] = useState(loadRecent)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const trackPlant = useCallback((plantId) => {
    setRecentPlantIds(prev => {
      const next = [plantId, ...prev.filter(id => id !== plantId)].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, recentPlantIds, trackPlant }}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>')
  return ctx
}
