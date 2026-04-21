import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi } from 'vitest'
import EmptyState from '../components/EmptyState.jsx'

function renderInRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('EmptyState', () => {
  it('renders the title and description', () => {
    renderInRouter(
      <EmptyState
        icon="feather"
        title="No plants yet"
        description="Add your first plant to get started."
      />,
    )
    expect(screen.getByText('No plants yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first plant to get started.')).toBeInTheDocument()
  })

  it('omits the description when not provided', () => {
    const { container } = renderInRouter(
      <EmptyState icon="inbox" title="Nothing here" />,
    )
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders an onClick action button and calls the handler', () => {
    const onClick = vi.fn()
    renderInRouter(
      <EmptyState
        icon="feather"
        title="Empty"
        actions={[{ label: 'Add a plant', icon: 'plus', onClick }]}
      />,
    )
    const btn = screen.getByRole('button', { name: /add a plant/i })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an anchor element for href-based actions pointing to the given path', () => {
    const { container } = renderInRouter(
      <EmptyState
        icon="layers"
        title="No floors"
        actions={[{ label: 'Set up floors', icon: 'layers', href: '/settings' }]}
      />,
    )
    const anchor = container.querySelector('a[href="/settings"]')
    expect(anchor).not.toBeNull()
    expect(anchor.textContent).toMatch(/set up floors/i)
  })

  it('first action gets primary variant, second gets outline-secondary', () => {
    const onClick1 = vi.fn()
    const onClick2 = vi.fn()
    renderInRouter(
      <EmptyState
        icon="inbox"
        title="Empty"
        actions={[
          { label: 'Primary action', onClick: onClick1 },
          { label: 'Secondary action', onClick: onClick2 },
        ]}
      />,
    )
    const primary = screen.getByRole('button', { name: /primary action/i })
    const secondary = screen.getByRole('button', { name: /secondary action/i })
    expect(primary.className).toMatch(/btn-primary/)
    expect(secondary.className).toMatch(/btn-outline-secondary/)
  })

  it('renders no action buttons when actions array is empty', () => {
    renderInRouter(<EmptyState icon="inbox" title="Empty" actions={[]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
