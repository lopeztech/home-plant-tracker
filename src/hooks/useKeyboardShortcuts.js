import { useEffect, useCallback, useState } from 'react'

export function useKeyboardShortcuts({ onAddPlant, onToggleSettings, onEscape, onToggleSidebar }) {
  const [showHelp, setShowHelp] = useState(false)

  const handler = useCallback((e) => {
    // Don't fire shortcuts when typing in inputs
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
      if (e.key === 'Escape') e.target.blur()
      return
    }

    switch (e.key) {
      case 'n':
        e.preventDefault()
        onAddPlant?.()
        break
      case 's':
        e.preventDefault()
        onToggleSettings?.()
        break
      case 'b':
        e.preventDefault()
        onToggleSidebar?.()
        break
      case 'Escape':
        onEscape?.()
        break
      case '?':
        e.preventDefault()
        setShowHelp(h => !h)
        break
    }
  }, [onAddPlant, onToggleSettings, onEscape, onToggleSidebar])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])

  return { showHelp, setShowHelp }
}

export const SHORTCUTS = [
  { key: 'N', description: 'Add new plant' },
  { key: 'S', description: 'Open settings' },
  { key: 'B', description: 'Toggle sidebar' },
  { key: 'Esc', description: 'Close modal / blur input' },
  { key: '?', description: 'Show this help' },
]
