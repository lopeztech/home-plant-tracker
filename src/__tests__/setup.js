import { vi } from 'vitest'
import '@testing-library/jest-dom'

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
