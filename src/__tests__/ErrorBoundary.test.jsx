import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error('Failed to fetch')
  return <div>all good</div>
}

describe('ErrorBoundary', () => {
  let errSpy
  beforeAll(() => {
    // React logs errors from caught boundaries — keep test output clean.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterAll(() => {
    errSpy.mockRestore()
  })

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders the friendly fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument()
  })

  it('allows recovery by clicking the action button', () => {
    function Controlled({ shouldThrow }) {
      return (
        <ErrorBoundary>
          <Boom shouldThrow={shouldThrow} />
        </ErrorBoundary>
      )
    }
    const { rerender } = render(<Controlled shouldThrow={true} />)
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument()

    // Re-render with non-throwing children BEFORE clicking — otherwise the
    // stale captured element still throws on the boundary's reset render.
    rerender(<Controlled shouldThrow={false} />)
    // Boundary is still showing the fallback until we explicitly reset its
    // internal error state via the action button.
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
