import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setAccountTypeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../context/ProfileContext.jsx', () => ({
  useProfile: () => ({ accountType: 'household', setAccountType: setAccountTypeMock, loading: false, error: null, refresh: vi.fn() }),
}))

import Onboarding from '../components/Onboarding.jsx'

const STORAGE_KEY = 'plant-tracker-onboarded'

async function advancePastPersona() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Caring for your home garden/i })) })
}

describe('Onboarding', () => {
  beforeEach(() => {
    localStorage.clear()
    setAccountTypeMock.mockClear()
  })

  it('renders the persona picker as the first step', () => {
    render(<Onboarding />)
    expect(screen.getByText(/How will you use Plant Tracker/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Caring for your home garden/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Managing client properties/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /I do both/i })).toBeInTheDocument()
  })

  it('does not render when localStorage indicates onboarding is done', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    render(<Onboarding />)
    expect(screen.queryByText(/How will you use Plant Tracker/i)).not.toBeInTheDocument()
  })

  it('picking a persona persists and advances to the info steps', async () => {
    render(<Onboarding />)
    await advancePastPersona()
    expect(setAccountTypeMock).toHaveBeenCalledWith('household')
    await waitFor(() => expect(screen.getByText('Upload a Floorplan')).toBeInTheDocument())
  })

  it('"I do both" picks the both persona', async () => {
    render(<Onboarding />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /I do both/i })) })
    expect(setAccountTypeMock).toHaveBeenCalledWith('both')
  })

  it('Next advances through info steps after persona is picked', async () => {
    render(<Onboarding />)
    await advancePastPersona()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Add Your Plants')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Track Watering')).toBeInTheDocument()
  })

  it('shows "Get started" on the last step and clicking it dismisses', async () => {
    render(<Onboarding />)
    await advancePastPersona()
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Get started')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Get started'))
    expect(screen.queryByText('Track Watering')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('skip-tour button sets localStorage and hides onboarding from the persona step', () => {
    render(<Onboarding />)
    expect(screen.getByText(/How will you use Plant Tracker/i)).toBeInTheDocument()

    // Persona step shows the X close button (no Skip-tour link in footer)
    fireEvent.click(screen.getByRole('button', { name: /Skip tour/i }))
    expect(screen.queryByText(/How will you use Plant Tracker/i)).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })
})
