import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Onboarding from '../components/Onboarding.jsx'

const STORAGE_KEY = 'plant-tracker-onboarded'

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders when localStorage has no onboarding key', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload a Floorplan')).toBeInTheDocument()
  })

  it('does not render when localStorage indicates onboarding is done', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    const { container } = render(<Onboarding />)
    expect(screen.queryByText('Upload a Floorplan')).not.toBeInTheDocument()
  })

  it('clicking Next advances through steps', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload a Floorplan')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Add Your Plants')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Track Watering')).toBeInTheDocument()
  })

  it('shows "Get started" on the last step and clicking it dismisses', () => {
    render(<Onboarding />)

    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Get started')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Get started'))
    expect(screen.queryByText('Track Watering')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('Skip tour button sets localStorage and hides onboarding', () => {
    render(<Onboarding />)
    expect(screen.getByText('Upload a Floorplan')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Skip tour'))
    expect(screen.queryByText('Upload a Floorplan')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })
})
