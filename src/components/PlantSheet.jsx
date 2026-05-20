import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE, SPRING } from '../motion/tokens.js'

// Mobile bottom-sheet shell for PlantModal V2 (#401).
//
// PR 1 (#449) shipped the single-stop slide-up + drag-to-dismiss surface.
// PR 3 (this file) adds three snap stops — 50% / 90% / 100% — so the user
// can pull the sheet up to fullscreen for forms with long content, snap
// back to a half-height peek to see the floorplan behind, or flick away to
// dismiss. Snap heights are issued in the original #401 spec.
//
// Implementation: the sheet is rendered at full viewport height and
// position:absolute / bottom:0. A vertical y motion-value translates the
// sheet *down*, exposing more of the backdrop above it as snaps decrease.
// We avoid animating CSS height because that triggers layout reflow on
// every spring frame; translating y is GPU-cheap.

export const SNAP_PCT = [50, 90, 100]
export const DEFAULT_SNAP_INDEX = 1 // 90%

// Pure decision helper for what to do at drag-end. Exported so tests can
// cover every branch without simulating a real pointer drag in jsdom.
//
// `distance` is the total y offset (px) from the drag start; `velocity` is
// the instantaneous y velocity (px/s) at release. Positive = downward.
//
// Returns `{ close: true }` when the user has dragged the sheet below the
// lowest snap (50%), otherwise `{ snap: <new index> }` (which may equal
// `currentSnap` when neither threshold is crossed — the spring then pulls
// the element back to its resting position).
export function nextSnapFromDrag({
  currentSnap,
  distance,
  velocity,
  totalSnaps = SNAP_PCT.length,
  distanceThreshold = 80,
  velocityThreshold = 600,
}) {
  // Downward drag/flick → shrink one stop, or close if already at the
  // lowest stop.
  if (distance > distanceThreshold || velocity > velocityThreshold) {
    if (currentSnap === 0) return { close: true }
    return { snap: currentSnap - 1 }
  }
  // Upward drag/flick → grow one stop, capped at the top.
  if (distance < -distanceThreshold || velocity < -velocityThreshold) {
    return { snap: Math.min(currentSnap + 1, totalSnaps - 1) }
  }
  // Neither threshold met — caller animates back to the current rest snap.
  return { snap: currentSnap }
}

export default function PlantSheet({ show, onClose, children, ariaLabelledBy }) {
  const sheetRef = useRef(null)
  const [snap, setSnap] = useState(DEFAULT_SNAP_INDEX)

  // Reset to the default 90% snap on each open. Persisting the user's last
  // snap across opens hides info (e.g. the floorplan) that the close
  // gesture was meant to reveal — fresh open should always land at the
  // default surface.
  useEffect(() => {
    if (show) setSnap(DEFAULT_SNAP_INDEX)
  }, [show])

  // Track the live viewport height so snap targets recompute on rotate /
  // resize. SSR fallback keeps Framer Motion's pre-mount maths sane.
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setViewportH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Pixel offset for snap index `s`. y=0 = sheet covers full viewport;
  // larger y pushes the sheet's top edge further down, revealing more
  // backdrop.
  const snapToY = useCallback(
    (s) => ((100 - SNAP_PCT[s]) * viewportH) / 100,
    [viewportH],
  )

  // Body scroll lock while the sheet is open. We restore the previous value
  // rather than blanking it, so a host page that uses overflow:hidden for
  // its own reasons keeps its style after the sheet closes.
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

  const handleDragEnd = useCallback((_, info) => {
    const decision = nextSnapFromDrag({
      currentSnap: snap,
      distance: info.offset.y,
      velocity: info.velocity.y,
    })
    if (decision.close) { onClose?.(); return }
    if (decision.snap !== snap) setSnap(decision.snap)
    // If decision.snap === snap, the `animate` prop's spring will pull the
    // element back to its rest position automatically — no setState needed.
  }, [snap, onClose])

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
            data-snap-pct={SNAP_PCT[snap]}
            initial={{ y: viewportH }}
            animate={{ y: snapToY(snap) }}
            exit={{ y: viewportH }}
            transition={SPRING}
            // Drag is constrained to [0, viewportH]: 0 = fully open at top
            // of the viewport, viewportH = fully off-screen below. The
            // snap decision in onDragEnd picks the resting position; we
            // give a touch of elastic past the top edge so the user feels
            // a soft wall rather than a hard stop.
            drag="y"
            dragConstraints={{ top: 0, bottom: viewportH }}
            dragElastic={{ top: 0.1, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              margin: '0 auto',
              width: '100%',
              maxWidth: 720,
              height: '100vh',
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
