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
  // Lazily loaded chunks aborted by a subsequent navigation (benign — the
  // chunk is no longer needed). Real network errors surface as ERR_FAILED.
  /net::ERR_ABORTED/i,
]

const ROUTES = [
  { path: '/today',                label: 'Today (daily tasks)' },
  { path: '/',                     label: 'Dashboard (Garden)' },
  { path: '/propagation',          label: 'Propagation' },
  { path: '/analytics',            label: 'Analytics' },
  { path: '/calendar',             label: 'Care Calendar' },
  { path: '/forecast',             label: 'Forecast' },
  { path: '/bulk-upload',          label: 'Bulk Upload' },
  // Settings sub-tabs — each mounts a different tab component and may
  // trigger its own API calls. Bugs on one tab (e.g. API Keys unguarded
  // fetch in guest mode, catching a NetworkError) won't surface if we only
  // hit `/settings` since that redirects to `/settings/property`.
  { path: '/settings/property',    label: 'Settings → Property' },
  { path: '/settings/preferences', label: 'Settings → Preferences' },
  { path: '/settings/data',        label: 'Settings → Data & export' },
  { path: '/settings/api-keys',    label: 'Settings → API Keys' },
  { path: '/settings/branding',    label: 'Settings → Branding' },
  { path: '/settings/advanced',    label: 'Settings → Advanced' },
  { path: '/settings/billing',     label: 'Settings → Billing' },
  { path: '/pricing',              label: 'Pricing' },
]

const PUBLIC_ROUTES = [
  { path: '/login',               label: 'Login' },
  { path: '/privacy',             label: 'Privacy policy' },
  { path: '/terms',               label: 'Terms of service' },
  // Param routes that hit the API on mount. The test stubs the API to 404 so
  // we exercise the graceful "not found" render path without tripping CORS
  // against the real gateway. See `stubApi` below.
  { path: '/scan/invalid-code',   label: 'Scan (invalid short code)', stubApi: true },
  { path: '/portal/invalid-tok',  label: 'Portal (invalid token)',    stubApi: true },
]

function isIgnored(text) {
  return IGNORED_ERROR_PATTERNS.some((rx) => rx.test(text))
}

// Stub the API endpoints that /scan/:code and /portal/:token fetch on mount
// with a 404 so we can exercise the graceful "not found" render path without
// the test hitting the real prod gateway (CORS) or a placeholder host (DNS).
// Selective on purpose — we don't want to also stub Google Fonts or similar.
async function stubApiCalls(page) {
  const stubPaths = [/\/scan\/[^/]+$/, /\/portal\/[^/]+$/]
  await page.route((url) => {
    if (url.host === 'localhost:4173') return false
    return stubPaths.some((rx) => rx.test(url.pathname))
  }, (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not_found' }),
  }))
}

async function enterGuestMode(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
  await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
  await guestButton.click()
  // Post-login redirect lands on /today (AuthLayout change in PR #317).
  await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
}

// Chromium logs every failed fetch (4xx/5xx) as a console.error with no URL
// context, which is pure noise when the test is exercising a "not found" code
// path. Widen the ignore list only for those opted-in routes.
const NOT_FOUND_CONSOLE_NOISE = /Failed to load resource.*(404|Not Found)/i

test.describe('Public routes: no console errors on load', () => {
  for (const { path, label, stubApi } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      if (stubApi) await stubApiCalls(page)
      const extraIgnore = stubApi ? [NOT_FOUND_CONSOLE_NOISE] : []
      const errors = []
      const isNoisy = (text) => isIgnored(text) || extraIgnore.some((rx) => rx.test(text))
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isNoisy(msg.text())) errors.push(`console.error: ${msg.text()}`)
      })
      page.on('pageerror', (err) => {
        if (!isNoisy(err.message)) errors.push(`pageerror: ${err.message}\n${err.stack || ''}`)
      })
      page.on('requestfailed', (req) => {
        const url = req.url()
        const failure = req.failure()?.errorText || 'unknown'
        const msg = `requestfailed: ${req.method()} ${url} — ${failure}`
        if (!isNoisy(msg)) errors.push(msg)
      })

      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
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
