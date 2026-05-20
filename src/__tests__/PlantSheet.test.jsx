import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlantSheet, {
  SNAP_PCT,
  DEFAULT_SNAP_INDEX,
  nextSnapFromDrag,
} from '../components/PlantSheet.jsx'

describe('PlantSheet (#401 PR 1)', () => {
  it('renders children inside a role="dialog" with aria-modal when show=true', () => {
    render(
      <PlantSheet show onClose={() => {}} ariaLabelledBy="my-title">
        <h2 id="my-title">Inner</h2>
        <div data-testid="content">Hello sheet</div>
      </PlantSheet>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'my-title')
    expect(screen.getByTestId('content')).toHaveTextContent('Hello sheet')
  })

  it('renders nothing when show=false', () => {
    render(
      <PlantSheet show={false} onClose={() => {}}>
        <div data-testid="content">Should not appear</div>
      </PlantSheet>,
    )
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when the drag-handle button is activated', () => {
    const onClose = vi.fn()
    render(
      <PlantSheet show onClose={onClose}>
        <div>body</div>
      </PlantSheet>,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <PlantSheet show onClose={onClose}>
        <div>body</div>
      </PlantSheet>,
    )
    // Backdrop is the presentation div wrapping the dialog.
    const backdrop = container.querySelector('.plant-sheet-backdrop')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when the sheet body is clicked (event stops propagation)', () => {
    const onClose = vi.fn()
    render(
      <PlantSheet show onClose={onClose}>
        <div data-testid="content">body</div>
      </PlantSheet>,
    )
    fireEvent.click(screen.getByTestId('content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key while the sheet is open', async () => {
    const onClose = vi.fn()
    render(
      <PlantSheet show onClose={onClose}>
        <div>body</div>
      </PlantSheet>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('locks body scroll while open and restores on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = render(
      <PlantSheet show onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })
})

describe('PlantSheet — multi-snap (#401 PR 3)', () => {
  it('exposes three snap points: 50% / 90% / 100%', () => {
    expect(SNAP_PCT).toEqual([50, 90, 100])
    // Default opens to 90% — the middle stop matches the original PR 1
    // behaviour, so users who never drag perceive no change.
    expect(SNAP_PCT[DEFAULT_SNAP_INDEX]).toBe(90)
  })

  it('renders at the 90% snap by default when opened', () => {
    const { container } = render(
      <PlantSheet show onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    expect(container.querySelector('.plant-sheet')).toHaveAttribute('data-snap-pct', '90')
  })

  it('resets to the 90% snap each time the sheet re-opens', () => {
    // Render closed, then open, then close, then re-open. The data-snap-pct
    // attribute must always read 90 on a fresh open — otherwise the user's
    // last drag would leak across sessions.
    const { rerender, container } = render(
      <PlantSheet show={false} onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    rerender(
      <PlantSheet show onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    expect(container.querySelector('.plant-sheet')).toHaveAttribute('data-snap-pct', '90')

    rerender(
      <PlantSheet show={false} onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    rerender(
      <PlantSheet show onClose={() => {}}>
        <div>body</div>
      </PlantSheet>,
    )
    expect(container.querySelector('.plant-sheet')).toHaveAttribute('data-snap-pct', '90')
  })

  // ── nextSnapFromDrag — pure decision helper ──────────────────────────────
  // jsdom can't simulate a real pointer drag, so the snap logic is hoisted
  // into a pure helper and exhaustively branch-covered here.

  describe('nextSnapFromDrag', () => {
    it('does nothing when neither distance nor velocity crosses the threshold', () => {
      expect(nextSnapFromDrag({ currentSnap: 1, distance: 30, velocity: 100 }))
        .toEqual({ snap: 1 })
      expect(nextSnapFromDrag({ currentSnap: 1, distance: -30, velocity: -100 }))
        .toEqual({ snap: 1 })
    })

    it('drags down → shrinks one snap level', () => {
      expect(nextSnapFromDrag({ currentSnap: 2, distance: 120, velocity: 0 }))
        .toEqual({ snap: 1 })
      expect(nextSnapFromDrag({ currentSnap: 1, distance: 120, velocity: 0 }))
        .toEqual({ snap: 0 })
    })

    it('fast downward flick → shrinks even with small distance', () => {
      expect(nextSnapFromDrag({ currentSnap: 2, distance: 10, velocity: 900 }))
        .toEqual({ snap: 1 })
    })

    it('drags down past the lowest snap → closes', () => {
      expect(nextSnapFromDrag({ currentSnap: 0, distance: 200, velocity: 0 }))
        .toEqual({ close: true })
      expect(nextSnapFromDrag({ currentSnap: 0, distance: 0, velocity: 900 }))
        .toEqual({ close: true })
    })

    it('drags up → grows one snap level', () => {
      expect(nextSnapFromDrag({ currentSnap: 0, distance: -120, velocity: 0 }))
        .toEqual({ snap: 1 })
      expect(nextSnapFromDrag({ currentSnap: 1, distance: -120, velocity: 0 }))
        .toEqual({ snap: 2 })
    })

    it('fast upward flick → grows even with small distance', () => {
      expect(nextSnapFromDrag({ currentSnap: 0, distance: -10, velocity: -900 }))
        .toEqual({ snap: 1 })
    })

    it('drags up at the top snap → stays at top (capped)', () => {
      expect(nextSnapFromDrag({ currentSnap: 2, distance: -200, velocity: 0 }))
        .toEqual({ snap: 2 })
    })

    it('honours custom thresholds for unit-test tuning', () => {
      // Tight threshold: 30px of drag is enough to trigger.
      expect(nextSnapFromDrag({
        currentSnap: 1, distance: 40, velocity: 0, distanceThreshold: 30,
      })).toEqual({ snap: 0 })
      // Loose threshold: 100px doesn't cross.
      expect(nextSnapFromDrag({
        currentSnap: 1, distance: 100, velocity: 0, distanceThreshold: 200,
      })).toEqual({ snap: 1 })
    })
  })
})
