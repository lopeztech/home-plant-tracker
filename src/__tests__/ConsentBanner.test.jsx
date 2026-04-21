import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, Link: ({ children, to }) => <a href={to}>{children}</a> }
})

import ConsentBanner from '../components/ConsentBanner.jsx'

const STORAGE_KEY = 'plant_tracker_consent'

function renderBanner() {
  return render(
    <MemoryRouter>
      <ConsentBanner />
    </MemoryRouter>,
  )
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the banner when no consent has been recorded', () => {
    renderBanner()
    expect(screen.getByRole('dialog', { name: /cookie consent/i })).toBeInTheDocument()
  })

  it('does not show the banner when consent is already stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: true, ai: true, decidedAt: '2024-01-01' }))
    renderBanner()
    expect(screen.queryByRole('dialog', { name: /cookie consent/i })).toBeNull()
  })

  it('hides the banner after accepting', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }))
    expect(screen.queryByRole('dialog', { name: /cookie consent/i })).toBeNull()
  })

  it('stores analytics=true when accepting all', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.analytics).toBe(true)
    expect(stored.ai).toBe(true)
  })

  it('hides the banner after declining', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /essential only/i }))
    expect(screen.queryByRole('dialog', { name: /cookie consent/i })).toBeNull()
  })

  it('stores analytics=false when choosing essential only', () => {
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /essential only/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.analytics).toBe(false)
    expect(stored.ai).toBe(false)
  })

  it('contains a link to the privacy policy', () => {
    renderBanner()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
  })
})
