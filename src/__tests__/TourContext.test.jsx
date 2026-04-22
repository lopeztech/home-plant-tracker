import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TourProvider, useTour, TOURS } from '../context/TourContext.jsx'

// Consumer component for testing
function TourConsumer() {
  const { activeTour, showWhatsNew, startTour, completeTour, isTourCompleted, openWhatsNew, closeWhatsNew, LATEST_VERSION } = useTour()
  return (
    <div>
      <span data-testid="active-tour">{activeTour ?? 'none'}</span>
      <span data-testid="show-whats-new">{showWhatsNew ? 'yes' : 'no'}</span>
      <span data-testid="latest-version">{LATEST_VERSION}</span>
      <span data-testid="setup-done">{isTourCompleted('setup') ? 'yes' : 'no'}</span>
      <button onClick={() => startTour('setup')}>Start setup</button>
      <button onClick={() => completeTour('setup')}>Complete setup</button>
      <button onClick={openWhatsNew}>Open whats new</button>
      <button onClick={closeWhatsNew}>Close whats new</button>
    </div>
  )
}

function renderConsumer() {
  return render(
    <TourProvider>
      <TourConsumer />
    </TourProvider>
  )
}

describe('TourContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('exposes TOURS constant with expected tour ids', () => {
    expect(TOURS.map((t) => t.id)).toEqual(['setup', 'floorplan', 'analytics', 'bulk-upload'])
  })

  it('activeTour is null initially', () => {
    renderConsumer()
    expect(screen.getByTestId('active-tour').textContent).toBe('none')
  })

  it('startTour sets activeTour', () => {
    renderConsumer()
    act(() => {
      screen.getByText('Start setup').click()
    })
    expect(screen.getByTestId('active-tour').textContent).toBe('setup')
  })

  it('completeTour clears activeTour and persists to localStorage', () => {
    renderConsumer()
    act(() => { screen.getByText('Start setup').click() })
    act(() => { screen.getByText('Complete setup').click() })
    expect(screen.getByTestId('active-tour').textContent).toBe('none')
    expect(localStorage.getItem('plant-tracker-tour-done-setup')).toBe('1')
  })

  it('isTourCompleted reflects localStorage', () => {
    localStorage.setItem('plant-tracker-tour-done-setup', '1')
    renderConsumer()
    expect(screen.getByTestId('setup-done').textContent).toBe('yes')
  })

  it('does not auto-show whats-new for first-time users', () => {
    // No 'plant-tracker-onboarded' key → first-time user
    renderConsumer()
    expect(screen.getByTestId('show-whats-new').textContent).toBe('no')
  })

  it('auto-shows whats-new for returning users who have not seen latest version', () => {
    localStorage.setItem('plant-tracker-onboarded', '1')
    // No whats-new-seen key → should auto-show
    renderConsumer()
    expect(screen.getByTestId('show-whats-new').textContent).toBe('yes')
  })

  it('does not auto-show whats-new if latest version already seen', () => {
    localStorage.setItem('plant-tracker-onboarded', '1')
    localStorage.setItem('plant-tracker-whats-new-seen', '9.9.9') // higher than any real version
    renderConsumer()
    expect(screen.getByTestId('show-whats-new').textContent).toBe('no')
  })

  it('openWhatsNew shows the modal', () => {
    renderConsumer()
    expect(screen.getByTestId('show-whats-new').textContent).toBe('no')
    act(() => { screen.getByText('Open whats new').click() })
    expect(screen.getByTestId('show-whats-new').textContent).toBe('yes')
  })

  it('closeWhatsNew hides the modal and saves seen version', () => {
    localStorage.setItem('plant-tracker-onboarded', '1')
    renderConsumer()
    act(() => { screen.getByText('Close whats new').click() })
    expect(screen.getByTestId('show-whats-new').textContent).toBe('no')
    expect(localStorage.getItem('plant-tracker-whats-new-seen')).toBeTruthy()
  })

  it('throws when useTour is used outside TourProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TourConsumer />)).toThrow('useTour must be used inside TourProvider')
    spy.mockRestore()
  })
})
