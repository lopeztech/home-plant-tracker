import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import EmptyState from '../components/EmptyState.jsx'

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('EmptyState', () => {
  it('renders title and description', () => {
    renderWithRouter(
      <EmptyState title="Your greenhouse is empty" description="Add your first plant." />,
    )
    expect(screen.getByRole('heading', { name: /greenhouse is empty/i })).toBeInTheDocument()
    expect(screen.getByText(/add your first plant/i)).toBeInTheDocument()
  })

  it('exposes a polite live region so screen readers announce the state', () => {
    renderWithRouter(<EmptyState title="Nothing here" />)
    const live = screen.getByRole('status')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('Nothing here')
  })

  it('renders an onClick CTA as a button and fires the handler', () => {
    const onClick = vi.fn()
    renderWithRouter(
      <EmptyState
        title="Empty"
        actions={[{ label: 'Add a plant', onClick, variant: 'primary', icon: 'plus' }]}
      />,
    )
    const cta = screen.getByRole('button', { name: /add a plant/i })
    fireEvent.click(cta)
    expect(onClick).toHaveBeenCalled()
  })

  it('renders a `to` CTA as a link for react-router navigation', () => {
    renderWithRouter(
      <EmptyState title="Empty" actions={[{ label: 'Go to Settings', to: '/settings' }]} />,
    )
    const link = screen.getByRole('link', { name: /go to settings/i })
    expect(link).toHaveAttribute('href', '/settings')
  })

  it('hides the decorative icon from assistive tech', () => {
    const { container } = renderWithRouter(<EmptyState icon="feather" title="Empty" />)
    const svg = container.querySelector('svg.sa-icon')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('supports multiple stacked CTAs', () => {
    renderWithRouter(
      <EmptyState
        title="Welcome"
        actions={[
          { label: 'Upload a floorplan', to: '/settings' },
          { label: 'Add plants first', onClick: () => {} },
          { label: 'Sign in to save', to: '/login' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: /upload a floorplan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add plants first/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in to save/i })).toBeInTheDocument()
  })
})
