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
import { attachErrorListeners, enterGuestMode } from './_helpers.js'

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

// Chromium logs every failed fetch (4xx/5xx) as a console.error with no URL
// context, which is pure noise when the test is exercising a "not found" code
// path. Widen the ignore list only for those opted-in routes.
const NOT_FOUND_CONSOLE_NOISE = /Failed to load resource.*(404|Not Found)/i

test.describe('Public routes: no console errors on load', () => {
  for (const { path, label, stubApi } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      if (stubApi) await stubApiCalls(page)
      const extraIgnore = stubApi ? [NOT_FOUND_CONSOLE_NOISE] : []
      const errors = attachErrorListeners(page, extraIgnore)

      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)

      expect(errors, `Unexpected browser errors on ${path}:\n${errors.join('\n\n')}`).toEqual([])
    })
  }
})

test.describe('Authenticated routes: guest mode, no console errors', () => {
  // Authenticated routes fan out to weather, billing, propagation, branding,
  // etc. Those calls produce browser-specific console.warn/error noise that we
  // can't reliably suppress without a Firefox/WebKit reproduction environment.
  // Cross-browser smoke for these routes is gated on Chromium + mobile Chrome
  // until we can debug the WebKit/Firefox failures with the actual browsers.
  // See PR #346 / #348 history.
  test.skip(
    ({ browserName }) => browserName === 'firefox' || browserName === 'webkit',
    'authenticated console smoke runs on chromium-family only — see e2e/console-smoke.spec.js',
  )

  test.beforeEach(async ({ page }) => {
    // No first-run overlay dismissal here — the console-load checks should
    // see the same DOM real users do, including any first-paint side effects
    // of those overlays mounting.
    await enterGuestMode(page, { dismissOverlays: false })
  })

  for (const { path, label } of ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      // Start listening AFTER guest-mode bootstrap so we don't catch any
      // login-page transient noise. requestfailed off — these routes fan out
      // to weather / billing / plants and cancellation is too noisy to police.
      const errors = attachErrorListeners(page, [], { requestFailed: false })

      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)

      expect(errors, `Unexpected browser errors on ${path}:\n${errors.join('\n\n')}`).toEqual([])
    })
  }
})
