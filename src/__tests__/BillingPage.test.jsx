import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createCheckoutSession = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.example/123' })
const createPortalSession = vi.fn().mockResolvedValue({ url: 'https://portal.stripe.example/abc' })

vi.mock('../api/plants.js', () => ({
  billingApi: {
    createCheckoutSession: (...args) => createCheckoutSession(...args),
    createPortalSession: (...args) => createPortalSession(...args),
  },
}))

vi.mock('../components/Toast.jsx', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}))

let snapshot
vi.mock('../context/SubscriptionContext.jsx', () => ({
  useSubscription: () => snapshot,
}))

import BillingPage from '../pages/BillingPage.jsx'

const baseSnapshot = {
  billingEnabled: true,
  tier: 'home_pro',
  status: 'active',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  isTrial: false,
  hasStripeCustomer: false,
  quotas: { plants: 100, ai_analyses: 100, photo_storage_mb: 2048 },
  usage: { plants: 0, ai_analyses: 0, photo_storage_mb: 0 },
  refresh: vi.fn(),
}

beforeEach(() => {
  snapshot = { ...baseSnapshot }
  createCheckoutSession.mockClear()
  createPortalSession.mockClear()
  // jsdom doesn't implement window.location.assign
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: vi.fn() },
  })
})

describe('BillingPage — manage vs add payment method', () => {
  it('shows "Manage subscription" when the user has a Stripe customer', () => {
    snapshot.hasStripeCustomer = true
    render(<MemoryRouter><BillingPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /^Manage subscription$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Add payment method$/i })).toBeNull()
  })

  it('shows "Add payment method" instead of "Manage subscription" for pro-tier trial users', () => {
    snapshot.isTrial = true
    snapshot.status = 'trialing'
    render(<MemoryRouter><BillingPage /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /^Manage subscription$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Add payment method$/i })).toBeInTheDocument()
    expect(screen.getByText(/free trial/i)).toBeInTheDocument()
  })

  it('shows the upgrade buttons (not Manage subscription) for free-tier users', () => {
    snapshot.tier = 'free'
    snapshot.status = 'free'
    render(<MemoryRouter><BillingPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /Upgrade to Home Pro/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Manage subscription$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add payment method$/i })).toBeNull()
  })

  it('clicking Manage subscription calls createPortalSession', async () => {
    snapshot.hasStripeCustomer = true
    render(<MemoryRouter><BillingPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /^Manage subscription$/i }))
    await waitFor(() => expect(createPortalSession).toHaveBeenCalled())
  })

  it('clicking Add payment method routes through createCheckoutSession for the current tier', async () => {
    snapshot.isTrial = true
    snapshot.tier = 'home_pro'
    render(<MemoryRouter><BillingPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /^Add payment method$/i }))
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledWith('home_pro', 'month'))
  })
})
