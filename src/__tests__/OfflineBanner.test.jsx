import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import OfflineBanner from '../components/OfflineBanner.jsx'
import { PlantContext } from '../context/PlantContext.jsx'

function wrap(ctx, ui) {
  return <PlantContext.Provider value={ctx}>{ui}</PlantContext.Provider>
}

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    const { container } = render(wrap({ isOnline: true, pendingSyncCount: 0 }, <OfflineBanner />))
    expect(container.firstChild).toBeNull()
  })

  it('renders the banner when offline', () => {
    render(wrap({ isOnline: false, pendingSyncCount: 0 }, <OfflineBanner />))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument()
  })

  it('includes the queued-count when pendingSyncCount > 0', () => {
    render(wrap({ isOnline: false, pendingSyncCount: 3 }, <OfflineBanner />))
    expect(screen.getByText(/3 queued/i)).toBeInTheDocument()
  })
})
