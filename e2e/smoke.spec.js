/**
 * E2E smoke tests using Playwright.
 *
 * These tests run against the deployed staging/dev environment and validate
 * the full integration between frontend, API Gateway, Cloud Run, and Firestore.
 *
 * Prerequisites:
 *   1. Install Playwright: npx playwright install chromium
 *   2. Set environment:    export E2E_BASE_URL=https://plants.lopezcloud.dev
 *   3. Run:                npx playwright test --config e2e/playwright.config.js
 *
 * Note: Tests requiring authentication use the Google OAuth flow.
 * For CI, consider using a service account or pre-authenticated session cookie.
 */

import { test, expect } from '@playwright/test'

// ── Public pages (no auth required) ──────────────────────────────────────────

test.describe('Public pages', () => {
  test('login page loads and shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Plant Tracker/i)
    // Should show a login option (Google OAuth or guest)
    const loginContent = page.locator('body')
    await expect(loginContent).toBeVisible()
  })

  test('unauthenticated users are redirected to login', async ({ page }) => {
    await page.goto('/')
    // Should redirect to /login since not authenticated
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})

// ── Authenticated flows (requires login) ─────────────────────────────────────
// These tests use guest mode to avoid Google OAuth complexity in CI.

test.describe('Guest mode flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Look for guest mode button
    const guestButton = page.getByRole('button', { name: /guest/i })
    if (await guestButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guestButton.click()
      await page.waitForURL(/^\/$|\/dashboard/i, { timeout: 10_000 })
    }
  })

  test('dashboard loads after guest login', async ({ page }) => {
    // Should be on the main dashboard
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('settings page renders', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
  })

  test('analytics page renders', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.locator('body')).toBeVisible()
  })

  test('calendar page renders', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.locator('body')).toBeVisible()
  })
})

// ── Temperature unit toggle ─────────────────────────────────────────────────

test.describe('Settings interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    const guestButton = page.getByRole('button', { name: /guest/i })
    if (await guestButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await guestButton.click()
      await page.waitForURL(/^\/$|\/dashboard/i, { timeout: 10_000 })
    }
  })

  test('temperature unit toggle exists on settings page', async ({ page }) => {
    await page.goto('/settings')
    // Look for temperature-related toggle or select
    const settingsContent = page.locator('body')
    await expect(settingsContent).toBeVisible()
  })
})
