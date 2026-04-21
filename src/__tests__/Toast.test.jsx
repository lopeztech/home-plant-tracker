import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToastProvider, useToast } from '../components/Toast.jsx'

function Trigger({ run }) {
  const toast = useToast()
  return <button onClick={() => run(toast)}>trigger</button>
}

function renderWithProvider(onCall) {
  render(
    <ToastProvider>
      <Trigger run={onCall} />
    </ToastProvider>,
  )
  return screen.getByText('trigger')
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a success toast with the supplied message', () => {
    const button = renderWithProvider((toast) => toast('Saved!'))
    act(() => button.click())
    expect(screen.getByText('Saved!')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('renders an error toast via toast.error', () => {
    const button = renderWithProvider((toast) => toast.error('Boom'))
    act(() => button.click())
    expect(screen.getByText('Boom')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders a success toast via toast.success', () => {
    const button = renderWithProvider((toast) => toast.success('Yay'))
    act(() => button.click())
    expect(screen.getByText('Yay')).toBeInTheDocument()
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('auto-dismisses the toast after its duration elapses', () => {
    const button = renderWithProvider((toast) => toast('Soon gone'))
    act(() => button.click())
    expect(screen.getByText('Soon gone')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3500)
    })
    // react-bootstrap waits for the fade-out; advance again to let it finish
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(screen.queryByText('Soon gone')).not.toBeInTheDocument()
  })

  it('stacks multiple toasts', () => {
    const button = renderWithProvider((toast) => {
      toast('First')
      toast.error('Second')
    })
    act(() => button.click())
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('useToast returns null outside the provider', () => {
    let received
    function Probe() {
      received = useToast()
      return null
    }
    render(<Probe />)
    expect(received).toBeNull()
  })

  it('announces success toasts to screen readers via role=status', () => {
    const button = renderWithProvider((toast) => toast('Saved!'))
    act(() => button.click())
    const live = screen.getByRole('status')
    expect(live).toHaveTextContent('Saved!')
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('announces error toasts assertively via role=alert', () => {
    const button = renderWithProvider((toast) => toast.error('Boom'))
    act(() => button.click())
    const live = screen.getByRole('alert')
    expect(live).toHaveTextContent('Boom')
    expect(live).toHaveAttribute('aria-live', 'assertive')
  })
})
