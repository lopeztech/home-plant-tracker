import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const INIT_STATE = {
  theme: 'light',
  themeMode: 'light', // 'light' | 'dark' | 'auto'
  headerFixed: false,
  navCollapsed: false,
  navMinified: false,
  darkNavigation: true,
  selectedTheme: 'olive',
  houseHeight: 500,
  frontyardHeight: 200,
  backyardHeight: 200,
  sideLeftWidth: 140,
  sideRightWidth: 140,
  hiddenYardAreas: [],
}

const LS_KEY = '__PLANT_TRACKER_LAYOUT__'

function getOsTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return INIT_STATE
    const saved = { ...INIT_STATE, ...JSON.parse(raw) }
    // Back-compat: if themeMode not stored, derive from theme
    if (!saved.themeMode) saved.themeMode = saved.theme
    return saved
  } catch {
    return INIT_STATE
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
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

  // changeThemeMode: 'light' | 'dark' | 'auto'
  const changeThemeMode = useCallback((mode) => {
    const resolved = mode === 'auto' ? getOsTheme() : mode
    applyTheme(resolved)
    persist((prev) => ({ ...prev, themeMode: mode, theme: resolved }))
  }, [persist])

  // Legacy alias kept so existing callers (e.g. old Settings toggle) still work
  const changeTheme = useCallback((theme) => {
    changeThemeMode(theme)
  }, [changeThemeMode])

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
    const resolved = settings.themeMode === 'auto' ? getOsTheme() : settings.theme
    applyTheme(resolved)
    // Sync theme state if auto-resolved differs from persisted
    if (resolved !== settings.theme) {
      setSettings((prev) => ({ ...prev, theme: resolved }))
    }
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

  // Watch for OS theme changes when themeMode === 'auto'
  useEffect(() => {
    if (settings.themeMode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      const next = e.matches ? 'dark' : 'light'
      applyTheme(next)
      setSettings((prev) => ({ ...prev, theme: next }))
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.themeMode])

  const value = useMemo(() => ({
    ...settings,
    settings,
    changeTheme,
    changeThemeMode,
    changeThemeStyle,
    toggleSetting,
    showBackdrop,
    hideBackdrop,
    customizer,
  }), [settings, changeTheme, changeThemeMode, changeThemeStyle, toggleSetting, showBackdrop, hideBackdrop, customizer])

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}
