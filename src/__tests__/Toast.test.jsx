import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { ToastProvider, useToast } from '../components/Toast.jsx'

function TestHarness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.success('Explicit success')}>Show Explicit</button>
    </div>
  )
}

function renderWithToast() {
  return render(
    <ToastProvider>
      <TestHarness />
    </ToastProvider>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders a success toast when toast() is called', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('renders an error toast when toast.error() is called', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Error'))
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('renders a success toast when toast.success() is called', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Explicit'))
    expect(screen.getByText('Explicit success')).toBeInTheDocument()
  })

  it('auto-dismisses toast after duration', async () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Success'))
    expect(screen.getByText('Success message')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
  })

  it('dismisses toast when close button is clicked', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Success'))

    // Find the dismiss button (X) inside the toast
    const toast = screen.getByText('Success message').closest('div')
    const closeBtn = toast.querySelector('button')
    fireEvent.click(closeBtn)

    expect(screen.queryByText('Success message')).not.toBeInTheDocument()
  })

  it('can show multiple toasts at once', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Success'))
    fireEvent.click(screen.getByText('Show Error'))

    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('applies exit animation before removal', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('Show Success'))

    // After duration - 300ms, the exit animation should start
    act(() => { vi.advanceTimersByTime(3200) })
    const toast = screen.getByText('Success message').closest('div[class*="transition"]')
    expect(toast.className).toContain('animate-slide-out')
  })
})
