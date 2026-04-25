/**
 * Interaction smoke — triggers global overlays (command palette, help drawer,
 * plant modal) and primary user actions (water a plant). Complements
 * console-smoke.spec.js which only does page-load assertions; these tests
 * catch hook-rule violations, stale closures, provider gaps, and similar
 * bugs that only manifest once a user clicks something.
 *
 * All tests run in guest mode with the built-in demo plants, so no real
 * API contact — safe against preview and prod.
 */

import { test, expect } from '@playwright/test'

const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /GSI_LOGGER|FedCM|Sign-In|gstatic\.com\/cast\/sdk|accounts\.google/i,
  /Failed to load resource.*(403|401)/i,
  /Download the React DevTools/i,
  /ERR_FAILED.*weather|open-meteo/i,
  /Subscription lookup failed/i,
  /identity-v1.*400/i,
  /\[vite\]/i,
  // Code-split chunks (UpgradePrompt, Dropdown, ButtonGroup, …) and the SVG
  // sprite are fetched lazily; if a test navigates or the page tears down
  // before they resolve, the browser cancels the in-flight request and emits
  // a `requestfailed` with net::ERR_ABORTED. That's benign — the chunk is no
  // longer needed. Real failures surface as ERR_FAILED / ERR_NAME_NOT_RESOLVED.
  /net::ERR_ABORTED/i,
]

function attachErrorListeners(page) {
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

// Pre-populate localStorage so first-run overlays (GDPR consent banner,
// "What's new" modal, onboarding modal) don't intercept pointer events in
// our interaction tests.
async function dismissFirstRunOverlays(page) {
  await page.addInitScript(() => {
    localStorage.setItem('plant_tracker_consent', JSON.stringify({
      analytics: false, ai: false, decidedAt: new Date().toISOString(),
    }))
    localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
    localStorage.setItem('plant-tracker-onboarded', '1')
  })
}

async function enterGuestMode(page) {
  await dismissFirstRunOverlays(page)
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
  await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
  await guestButton.click()
  await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
}

test.describe('Global overlays', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  test('Cmd+K opens the command palette', async ({ page, viewport }) => {
    // Mobile viewports don't have a physical keyboard and Pixel 7 emulation
    // doesn't deliver Control+K to window listeners reliably. The shortcut
    // is desktop-only; mobile uses the topbar command-palette button.
    test.skip(!!viewport && viewport.width < 768, 'Keyboard shortcut is desktop-only')

    const errors = attachErrorListeners(page)
    // GlobalKeyboardShortcuts attaches its keydown listener in a useEffect that
    // runs after MainLayout mounts. waitForURL resolves on the first matching
    // navigation, so on slower CI runs the listener may not be attached yet.
    // Wait for the page to settle before firing the shortcut.
    await page.waitForLoadState('networkidle')
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k')
    const dialog = page.getByRole('dialog', { name: /command palette/i })
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    // Typing into the search input exercises filtering (the fuzzy matcher
    // caused previous hook-rule regressions). Don't assert on results — just
    // confirm the input accepts text without crashing.
    await page.locator('input[aria-label="Command palette search"]').fill('settings')
    await page.waitForTimeout(200)
    expect(errors, `Unexpected errors opening command palette:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('Help drawer opens from sidebar / topbar', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Desktop: sidebar button. Mobile: topbar button. Both have the accessible
    // name "Help" or "Open help".
    const helpButton = page
      .getByRole('button', { name: /^(help|open help)$/i })
      .first()
    await helpButton.click({ trial: false })
    const drawer = page.locator('[aria-label="Help centre"]')
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors opening help drawer:\n${errors.join('\n\n')}`).toEqual([])
  })
})

test.describe('PlantModal: open and traverse each tab', () => {
  // The dashboard defaults to the floorplan view on mobile, where plant-card
  // elements aren't visible without a toggle that's layout-dependent. Keep
  // this test desktop-only; the mobile project still exercises every page
  // load plus the overlay tests above.
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })
  })

  test('clicking a plant card opens the modal; every tab renders', async ({ page }) => {
    const errors = attachErrorListeners(page)

    // Dashboard may default to the floorplan view; flip to the list view if
    // there's a toggle so we get clickable .plant-card rows.
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }

    // Click the first card. `.plant-card` is the wrapper in both grid and list
    // views.
    const firstPlant = page.locator('.plant-card').first()
    await firstPlant.waitFor({ state: 'visible', timeout: 10_000 })
    await firstPlant.click()

    // Modal + tablist should mount. Since we're on an existing plant, we get
    // the full tab set including Soil + Health.
    const tablist = page.getByRole('tablist', { name: /plant sections/i })
    await expect(tablist).toBeVisible({ timeout: 5_000 })

    // Base tabs visible on every existing-plant modal.
    const expected = ['Plant', 'Watering', 'Care', 'Growth', 'Journal']
    for (const label of expected) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') })
      await tab.click()
      await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 5_000 })
    }

    // Close modal.
    await page.keyboard.press('Escape')
    expect(errors, `Unexpected errors traversing plant modal:\n${errors.join('\n\n')}`).toEqual([])
  })
})

test.describe('Critical user actions', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  test('water button on Today page does not crash', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await page.goto('/today', { waitUntil: 'networkidle' })

    // PlantListPanel and Today render buttons with aria-label="Water {name}"
    // (e.g. "Water Monstera"). Match the prefix.
    const waterButton = page.locator('button[aria-label^="Water "]').first()

    // Skip silently if no watering tasks are due in the guest fixture — that's
    // a valid empty-state, not a failure.
    const count = await waterButton.count()
    test.skip(count === 0, 'No watering tasks due in the guest fixture today')

    await waterButton.click()
    await page.waitForTimeout(500)
    expect(errors, `Unexpected errors watering a plant:\n${errors.join('\n\n')}`).toEqual([])
  })
})
