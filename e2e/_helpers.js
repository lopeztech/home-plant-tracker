/**
 * Shared E2E helpers — imported by all spec files.
 *
 * Keeps test setup consistent and avoids duplication across spec files.
 */

export const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /GSI_LOGGER|FedCM|Sign-In|gstatic\.com\/cast\/sdk|accounts\.google/i,
  /Failed to load resource.*(403|401)/i,
  /Download the React DevTools/i,
  /ERR_FAILED.*weather|open-meteo/i,
  /Subscription lookup failed/i,
  /identity-v1.*400/i,
  /\[vite\]/i,
]

export function attachErrorListeners(page) {
  const errors = []
  const isIgnored = (t) => IGNORED_ERROR_PATTERNS.some((rx) => rx.test(t))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    if (!isIgnored(err.message)) errors.push(`pageerror: ${err.message}\n${err.stack || ''}`)
  })
  page.on('requestfailed', (req) => {
    const msg = `requestfailed: ${req.method()} ${req.url()} — ${req.failure()?.errorText || 'unknown'}`
    if (!isIgnored(msg)) errors.push(msg)
  })
  return errors
}

/**
 * Pre-populate localStorage so first-run overlays (GDPR consent banner,
 * "What's new" modal, onboarding modal) don't intercept pointer events in
 * tests that don't explicitly need them.
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

export async function enterGuestMode(page) {
  await dismissFirstRunOverlays(page)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
  await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
  await guestButton.click()
  await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
}
