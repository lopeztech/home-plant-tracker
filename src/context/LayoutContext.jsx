import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const INIT_STATE = {
  theme: 'light',
  headerFixed: false,
  navCollapsed: false,
  navMinified: false,
  darkNavigation: true,
  selectedTheme: 'olive',
  houseHeight: 500,
  outdoorHeight: 200,
  sideWidth: 140,
  hiddenYardAreas: [],
}

const LS_KEY = '__PLANT_TRACKER_LAYOUT__'

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...INIT_STATE, ...JSON.parse(raw) } : INIT_STATE
  } catch {
    return INIT_STATE
  }
}

const LayoutContext = createContext(undefined)

export function useLayoutContext() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayoutContext must be used within LayoutProvider')
  return ctx
}

export function LayoutProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)
  const [showCustomizer, setShowCustomizer] = useState(false)

  const persist = useCallback((next) => {
    setSettings((prev) => {
      const merged = typeof next === 'function' ? next(prev) : { ...prev, ...next }
      localStorage.setItem(LS_KEY, JSON.stringify(merged))
      return merged
    })
  }, [])

  const CLASS_MAP = {
    headerFixed: 'set-header-fixed',
    navCollapsed: 'set-nav-collapsed',
    navMinified: 'set-nav-minified',
    darkNavigation: 'set-nav-dark',
  }

  const toggleSetting = useCallback((key, value) => {
    const cls = CLASS_MAP[key]
    if (cls) document.documentElement.classList.toggle(cls, value)
    persist((prev) => ({ ...prev, [key]: value }))
  }, [persist])

  const changeTheme = useCallback((theme) => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    persist((prev) => ({ ...prev, theme }))
  }, [persist])

  const changeThemeStyle = useCallback((themeId) => {
    const el = document.getElementById('app-theme')
    if (el) el.href = themeId === 'default' ? '' : `/css/${themeId}.css`
    persist((prev) => ({ ...prev, selectedTheme: themeId }))
  }, [persist])

  const showBackdrop = useCallback(() => {
    const backdrop = document.createElement('div')
    backdrop.id = 'custom-backdrop'
    backdrop.className = 'offcanvas-backdrop sidenav-backdrop fade show'
    document.body.appendChild(backdrop)
    document.body.style.overflow = 'hidden'
    backdrop.addEventListener('click', () => {
      document.documentElement.classList.remove('app-mobile-menu-open')
      hideBackdrop()
    })
  }, [])

  const hideBackdrop = useCallback(() => {
    const el = document.getElementById('custom-backdrop')
    if (el) {
      document.body.removeChild(el)
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  const customizer = useMemo(() => ({
    isOpen: showCustomizer,
    toggle: () => setShowCustomizer((v) => !v),
  }), [showCustomizer])

  // Apply persisted settings on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', settings.theme)
    const el = document.getElementById('app-theme')
    if (el && settings.selectedTheme !== 'default') {
      el.href = `/css/${settings.selectedTheme}.css`
    }
    Object.entries(settings).forEach(([key, val]) => {
      if (typeof val === 'boolean' && CLASS_MAP[key]) {
        document.documentElement.classList.toggle(CLASS_MAP[key], val)
      }
    })
  }, [])

  const value = useMemo(() => ({
    ...settings,
    settings,
    changeTheme,
    changeThemeStyle,
    toggleSetting,
    showBackdrop,
    hideBackdrop,
    customizer,
  }), [settings, changeTheme, changeThemeStyle, toggleSetting, showBackdrop, hideBackdrop, customizer])

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}
