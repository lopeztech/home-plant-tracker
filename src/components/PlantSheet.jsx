import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE, SPRING } from '../motion/tokens.js'

// Mobile bottom-sheet shell for PlantModal V2 (#401 Phase 1).
//
// Renders children inside a sheet that slides up from the bottom edge. The
// shell is responsible only for the surface (open / close / drag-to-dismiss /
// backdrop / safe-area / scroll lock) — content composition stays inside
// PlantModal so the desktop modal and the mobile sheet share one source of
// truth for tabs, fields, and behaviour.
//
// PR-1 scope deliberately stops at single-stop open + drag-to-close. Multi-
// snap points (50% / 90% / full), swipeable-tab gestures, and the sticky
// footer split happen in follow-up PRs (#401 v2 / v3).
export default function PlantSheet({ show, onClose, children, ariaLabelledBy }) {
  const sheetRef = useRef(null)

  // Body scroll lock while the sheet is open. We restore the previous value
  // rather than blanking it, so a host page that uses overflow:hidden for its
  // own reasons keeps its style after the sheet closes.
  useEffect(() => {
    if (!show) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  // Esc to close — matches the React-Bootstrap Modal contract callers expect.
  useEffect(() => {
    if (!show) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, onClose])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="plant-sheet-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.normal, ease: EASE.out }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1055,           // matches Bootstrap modal layer (DESIGN.md)
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            className="plant-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            // Drag-down to dismiss. Constrained to >= 0 so users can't pull
            // the sheet upward past its open position. dragElastic gives a
            // tiny rubber-band on overshoot.
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              const distance = info.offset.y
              const velocity = info.velocity.y
              // Dismiss if user dragged > 120px OR flicked downward fast.
              if (distance > 120 || velocity > 600) onClose?.()
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              background: 'var(--bs-body-bg)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.2)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              touchAction: 'pan-y',
            }}
          >
            {/* Drag handle — visual affordance + tap target for keyboard
                users who can press Enter on it to fire close. */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="plant-sheet-handle"
              style={{
                appearance: 'none',
                border: 0,
                background: 'transparent',
                padding: '10px 0 6px',
                margin: 0,
                cursor: 'grab',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  margin: '0 auto',
                  background: 'var(--bs-border-color)',
                }}
              />
            </button>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
