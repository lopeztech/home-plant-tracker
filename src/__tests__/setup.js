import { vi } from 'vitest'
import '@testing-library/jest-dom'
// Initialise i18next synchronously with English translations so component
// tests that call useTranslation() receive real English strings.
import '../i18n/index.js'

// jsdom doesn't implement pointer capture APIs used by PlantMarker drag logic
Element.prototype.setPointerCapture = vi.fn()
Element.prototype.releasePointerCapture = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)

// jsdom doesn't ship PointerEvent — polyfill so drag tests can construct real events
if (typeof PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
    }
  }
  globalThis.PointerEvent = PointerEvent
}

// Suppress noisy React act() warnings in tests that don't need them
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Vite build-time constants injected by vite.config.js — not available in jsdom
globalThis.__APP_VERSION__ = '0.0.0-test'
globalThis.__BUILD_TIME__ = '2026-01-01T00:00:00.000Z'

// jsdom doesn't implement matchMedia — needed by useTheme
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom 29 may not provide full localStorage API — polyfill if needed
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.removeItem !== 'function') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size },
    key: (i) => [...store.keys()][i] ?? null,
  }
}
