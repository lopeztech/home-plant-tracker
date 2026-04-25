/**
 * Shared E2E helpers.
 *
 * Single source of truth for the ignore list, error listener wiring, and
 * guest-mode bootstrap used by every spec in this directory. Adding a new
 * benign-error pattern (lazy-chunk aborts, third-party iframe noise, etc.)
 * happens here once — previously the same pattern had to land in both
 * console-smoke.spec.js and interactions.spec.js, and CI broke whenever a
 * patch updated only one.
 */

// Errors that are expected on every load. Keep this list tight — noise here
// masks real regressions.
export const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /GSI_LOGGER|FedCM|Sign-In|gstatic\.com\/cast\/sdk|accounts\.google/i,    // Google OAuth in preview
  /Failed to load resource.*(403|401)/i,                                    // Google auth 403s
  /Download the React DevTools/i,
  /ERR_FAILED.*weather|open-meteo/i,                                        // geolocation flakes
  /Subscription lookup failed/i,                                            // billingApi has graceful fallback
  /identity-v1.*400/i,
  /\[vite\]/i,                                                              // Vite HMR / preview messages
  // Code-split chunks (UpgradePrompt, Dropdown, ButtonGroup, …) and the SVG
  // sprite are fetched lazily; if a test navigates or the page tears down
  // before they resolve, the browser cancels the in-flight request and emits
  // a `requestfailed` with net::ERR_ABORTED. That's benign — the chunk is no
  // longer needed. Real failures surface as ERR_FAILED / ERR_NAME_NOT_RESOLVED.
  /net::ERR_ABORTED/i,
]

export function isIgnoredError(text, extraPatterns = []) {
  return [...IGNORED_ERROR_PATTERNS, ...extraPatterns].some((rx) => rx.test(text))
}

/**
 * Attach console.error / pageerror / (optional) requestfailed listeners and
 * return the collected errors array. Pass `extraIgnore` for route-specific
 * noise (e.g. 404s on opted-in "not found" smoke routes). Set
 * `requestFailed:false` for authenticated-route smoke where in-flight fetches
 * (weather, billing, plants) commonly cancel mid-navigation.
 */
export function attachErrorListeners(page, extraIgnore = [], { requestFailed = true } = {}) {
  const errors = []
  const isNoisy = (text) => isIgnoredError(text, extraIgnore)
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isNoisy(msg.text())) errors.push(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    if (!isNoisy(err.message)) errors.push(`pageerror: ${err.message}\n${err.stack || ''}`)
  })
  if (requestFailed) {
    page.on('requestfailed', (req) => {
      const msg = `requestfailed: ${req.method()} ${req.url()} — ${req.failure()?.errorText || 'unknown'}`
      if (!isNoisy(msg)) errors.push(msg)
    })
  }
  return errors
}

/**
 * Pre-populate localStorage so first-run overlays (GDPR consent banner,
 * "What's new" modal, onboarding modal) don't intercept pointer events.
 */
export async function dismissFirstRunOverlays(page) {
  await page.addInitScript(() => {
    localStorage.setItem('plant_tracker_consent', JSON.stringify({
      analytics: false, ai: false, decidedAt: new Date().toISOString(),
    }))
    localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
    localStorage.setItem('plant-tracker-onboarded', '1')
  })
}

/**
 * Land on /login, click "Continue as guest", and wait for the post-login
 * redirect to settle. Skips first-run overlays unless `dismissOverlays:false`.
 */
export async function enterGuestMode(page, { dismissOverlays = true } = {}) {
  if (dismissOverlays) await dismissFirstRunOverlays(page)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
  await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
  await guestButton.click()
  // AuthLayout redirect lands on /today (PR #317).
  await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
}

/**
 * Wait for MainLayout to be fully interactive — i.e. the Topbar has mounted
 * and `GlobalKeyboardShortcuts`' useEffect has had a chance to attach its
 * keydown listener. Use this before firing global keyboard shortcuts; it's
 * deterministic where `waitForLoadState('networkidle')` is racey on CI.
 */
export async function waitForLayoutReady(page) {
  await page.getByRole('button', { name: /open command palette/i }).waitFor({
    state: 'visible',
    timeout: 10_000,
  })
}
