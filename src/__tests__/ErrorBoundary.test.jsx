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
    function Controlled({ state }) {
      return (
        <ErrorBoundary>
          <Boom shouldThrow={state.throw} />
        </ErrorBoundary>
      )
    }
    const state = { throw: true }
    const { rerender } = render(<Controlled state={state} />)
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument()

    state.throw = false
    // Reset boundary state by clicking the primary action.
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    rerender(<Controlled state={state} />)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
