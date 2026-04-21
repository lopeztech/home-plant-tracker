import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ErrorAlert from '../components/ErrorAlert.jsx'

describe('ErrorAlert', () => {
  it('renders nothing when error is falsy', () => {
    const { container } = render(<ErrorAlert error={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a title and recovery message from a raw error', () => {
    render(<ErrorAlert error={new Error('Failed to fetch')} />)
    // title is bold element
    expect(screen.getByText(/couldn.t reach the server/i)).toBeInTheDocument()
    expect(screen.getByText(/check your connection/i)).toBeInTheDocument()
  })

  it('calls onRetry when the retry button is clicked (retryable kind)', () => {
    const onRetry = vi.fn()
    render(<ErrorAlert error={new Error('Failed to fetch')} onRetry={onRetry} />)
    const btn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides the retry button for non-retryable errors', () => {
    const onRetry = vi.fn()
    render(<ErrorAlert error={new Error('HTTP 401')} onRetry={onRetry} />)
    // action for auth is "Sign in again" — but isRetryable=false means
    // the retry button shouldn't render even when onRetry is passed.
    expect(screen.queryByRole('button', { name: /sign in again/i })).toBeNull()
  })

  it('shows a Report button when onReport is provided and rawCode exists', () => {
    const onReport = vi.fn()
    render(<ErrorAlert error={new Error('Failed to fetch')} onReport={onReport} />)
    const btn = screen.getByRole('button', { name: /report this/i })
    fireEvent.click(btn)
    expect(onReport).toHaveBeenCalledTimes(1)
    expect(onReport).toHaveBeenCalledWith('Failed to fetch')
  })

  it('renders a dismiss control when onDismiss is provided', () => {
    const onDismiss = vi.fn()
    render(<ErrorAlert error={new Error('oops')} onDismiss={onDismiss} />)
    const close = screen.getByLabelText(/close/i)
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('passes context through to the friendly copy', () => {
    render(<ErrorAlert error={new Error('HTTP 404')} context="plant" />)
    expect(screen.getByText(/plant/i)).toBeInTheDocument()
  })

  it('accepts an already-friendly error object', () => {
    const friendly = {
      title: 'Custom title', message: 'Custom message', action: 'Do it',
      kind: 'transient', isRetryable: true, rawCode: 'x',
    }
    const onRetry = vi.fn()
    render(<ErrorAlert error={friendly} onRetry={onRetry} />)
    expect(screen.getByText('Custom title')).toBeInTheDocument()
    expect(screen.getByText('Custom message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /do it/i })).toBeInTheDocument()
  })
})
