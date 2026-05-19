import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlantSheet from '../components/PlantSheet.jsx'

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
