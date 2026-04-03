import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const STORAGE_KEY = 'plant_tracker_theme'

const ThemeContext = createContext('light')

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeProvider() {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, toggleTheme, ThemeContext }
}
