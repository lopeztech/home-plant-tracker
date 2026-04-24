/**
 * Console-error smoke test.
 *
 * Visits every main route in guest mode with a listener on `console.error`
 * and `pageerror`, failing the build on any unexpected error. Aimed at
 * bundle-load / import regressions — the classes of bug that slipped through
 * vitest+jsdom but failed the production `vite build`:
 *
 *   - Sass function shadowing a CSS filter (#316)
 *   - Missing named export from a major-version-bumped dep (#316)
 *   - React provider chain broken by a refactor
 *
 * Runs against `npm run preview` which serves the production bundle — same
 * artefact that Firebase Hosting would serve. The Playwright config auto-
 * starts the preview server, so locally you can run `npm run test:e2e` with
 * no extra setup.
 */

import { test, expect } from '@playwright/test'

// Errors that are expected on every load (Google Identity Services rejecting
// the placeholder client ID in preview builds, geolocation flakes, etc.).
// Keep this list tight — noise here masks real regressions.
const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /GSI_LOGGER|FedCM|Sign-In|gstatic\.com\/cast\/sdk|accounts\.google/i,  // Google OAuth in preview
  /Failed to load resource.*(403|401)/i,                                 // Google auth 403s
  /Download the React DevTools/i,
  /ERR_FAILED.*weather|open-meteo/i,                                      // geolocation flakes
  /Subscription lookup failed/i,                                          // billingApi has graceful fallback
  /identity-v1.*400/i,
  /\[vite\]/i,                                                            // Vite HMR / preview messages
]

const ROUTES = [
  { path: '/today',        label: 'Today (daily tasks)' },
  { path: '/',             label: 'Dashboard (Garden)' },
  { path: '/propagation',  label: 'Propagation' },
  { path: '/analytics',    label: 'Analytics' },
  { path: '/calendar',     label: 'Care Calendar' },
  { path: '/forecast',     label: 'Forecast' },
  { path: '/bulk-upload',  label: 'Bulk Upload' },
  { path: '/settings',     label: 'Settings' },
  { path: '/pricing',      label: 'Pricing' },
]

const PUBLIC_ROUTES = [
  { path: '/login',   label: 'Login' },
  { path: '/privacy', label: 'Privacy policy' },
  { path: '/terms',   label: 'Terms of service' },
]

function isIgnored(text) {
  return IGNORED_ERROR_PATTERNS.some((rx) => rx.test(text))
}

async function enterGuestMode(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
  await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
  await guestButton.click()
  // Post-login redirect lands on /today (AuthLayout change in PR #317).
  await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
}

test.describe('Public routes: no console errors on load', () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      const errors = []
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(`console.error: ${msg.text()}`)
      })
      page.on('pageerror', (err) => {
        if (!isIgnored(err.message)) errors.push(`pageerror: ${err.message}\n${err.stack || ''}`)
      })

      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })

      // Give any deferred render-time errors a moment to fire.
      await page.waitForTimeout(500)

      expect(errors, `Unexpected browser errors on ${path}:\n${errors.join('\n\n')}`).toEqual([])
    })
  }
})

test.describe('Authenticated routes: guest mode, no console errors', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  for (const { path, label } of ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      const errors = []
      // Start listening AFTER guest-mode bootstrap so we don't catch any
      // login-page transient noise.
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(`console.error: ${msg.text()}`)
      })
      page.on('pageerror', (err) => {
        if (!isIgnored(err.message)) errors.push(`pageerror: ${err.message}\n${err.stack || ''}`)
      })

      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)

      expect(errors, `Unexpected browser errors on ${path}:\n${errors.join('\n\n')}`).toEqual([])
    })
  }
})
