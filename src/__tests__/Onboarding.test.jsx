import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Onboarding from '../components/Onboarding.jsx'

const STORAGE_KEY = 'plant_tracker_onboarding_done'

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders when localStorage has no onboarding key', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload your floorplan')).toBeInTheDocument()
  })

  it('does not render when localStorage indicates onboarding is done', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { container } = render(<Onboarding />)
    expect(container.innerHTML).toBe('')
  })

  it('respects localStorage onboarding key on mount', () => {
    // When key is absent, onboarding shows
    const { unmount } = render(<Onboarding />)
    expect(screen.getByText('Upload your floorplan')).toBeInTheDocument()
    unmount()

    // When key is set, onboarding is hidden
    localStorage.setItem(STORAGE_KEY, 'true')
    const { container } = render(<Onboarding />)
    expect(container.innerHTML).toBe('')
  })

  it('clicking Next advances through steps', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload your floorplan')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Add your plants')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Track watering')).toBeInTheDocument()
  })

  it('shows "Get started" on the last step and clicking it dismisses', () => {
    render(<Onboarding />)

    // Advance to last step
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Get started')).toBeInTheDocument()

    // Click "Get started" — should dismiss and set localStorage
    fireEvent.click(screen.getByText('Get started'))
    expect(screen.queryByText('Track watering')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('Skip tour button sets localStorage and hides onboarding', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload your floorplan')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Skip tour'))
    expect(screen.queryByText('Upload your floorplan')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('X button also dismisses and sets localStorage', () => {
    render(<Onboarding />)
    const closeBtn = screen.getByLabelText('Skip onboarding')
    fireEvent.click(closeBtn)
    expect(screen.queryByText('Upload your floorplan')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })
})
