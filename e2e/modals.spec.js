/**
 * Modal / overlay smoke tests.
 *
 * Opens every major overlay once in guest mode and confirms it becomes visible
 * without console or page errors. These tests catch provider/hook-chain breaks
 * that only manifest at mount time — a class of bug that unit tests in jsdom
 * miss but the real browser surfaces immediately.
 *
 * Pattern:
 *  - Use dismissFirstRunOverlays() for tests that navigate the normal app flow
 *    (prevents GDPR consent / Onboarding / WhatsNew from intercepting clicks).
 *  - Use attachErrorListeners() to capture console.error and pageerror.
 *  - Assert dialog/overlay is visible; fail on any unexpected errors.
 */

import { test, expect } from '@playwright/test'

// ── Shared helpers ────────────────────────────────────────────────────────────

const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /GSI_LOGGER|FedCM|Sign-In|gstatic\.com\/cast\/sdk|accounts\.google/i,
  /Failed to load resource.*(403|401)/i,
  /Download the React DevTools/i,
  /ERR_FAILED.*weather|open-meteo/i,
  /Subscription lookup failed/i,
  /identity-v1.*400/i,
  /\[vite\]/i,
  /Failed to load resource.*404/i,
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
    const msg = `requestfailed: ${req.method()} ${req.url()} — ${req.failure()?.errorText || ''}`
    if (!isIgnored(msg)) errors.push(msg)
  })
  return errors
}

/** Pre-populate localStorage so first-run overlays don't intercept clicks. */
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

// ── First-run overlays (clear localStorage key → reload → visible) ────────────

test.describe('First-run overlays', () => {
  test('ConsentBanner — shows when consent has not been given', async ({ page }) => {
    // Do NOT call dismissFirstRunOverlays so consent is absent.
    const errors = attachErrorListeners(page)
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const banner = page.getByRole('dialog', { name: /cookie consent/i })
    await expect(banner).toBeVisible({ timeout: 10_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('Onboarding modal — shows on first visit after consent', async ({ page }) => {
    // Provide consent but no onboarded flag.
    await page.addInitScript(() => {
      localStorage.setItem('plant_tracker_consent', JSON.stringify({
        analytics: false, ai: false, decidedAt: new Date().toISOString(),
      }))
      localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
      // intentionally NOT setting plant-tracker-onboarded
    })
    const errors = attachErrorListeners(page)
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestBtn = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await guestBtn.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    // The onboarding modal uses a Bootstrap Modal — wait for the .modal.show element
    const modal = page.locator('.modal.show')
    await expect(modal).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('WhatsNew modal — shows when opened from sidebar', async ({ page }) => {
    await enterGuestMode(page)
    const errors = attachErrorListeners(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    // The "What's new" sidebar button opens the modal programmatically
    const whatsNewBtn = page.getByRole('button', { name: /what.?s new/i })
    await whatsNewBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await whatsNewBtn.click()
    const modal = page.locator('.modal.show')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── Connectivity ──────────────────────────────────────────────────────────────

test.describe('Offline state', () => {
  test('OfflineBanner — shows when network is offline', async ({ page, context }) => {
    await enterGuestMode(page)
    const errors = attachErrorListeners(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    // Go offline so `offline` event fires and PlantContext sets isOnline=false
    await context.setOffline(true)
    // Small wait for the React state update to propagate
    await page.waitForTimeout(300)
    const banner = page.locator('[role="status"]', { hasText: /you.?re offline/i })
    await expect(banner).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── Sidebar overlays ──────────────────────────────────────────────────────────

test.describe('Sidebar overlays', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only (sidebar hidden on mobile)')

  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })
  })

  test('FeatureTour — first step visible after clicking Take a tour', async ({ page }) => {
    const errors = attachErrorListeners(page)
    const tourBtn = page.getByRole('button', { name: /take a tour/i })
    await tourBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await tourBtn.click()
    // The sub-menu lists tours — click the first one
    const firstTourOption = page.locator('ul.list-unstyled button').first()
    await firstTourOption.waitFor({ state: 'visible', timeout: 5_000 })
    await firstTourOption.click()
    // react-joyride renders a tooltip/dialog for the first step
    const step = page.locator('[data-test-id="tooltip"], .react-joyride__tooltip, [class*="joyride"]').first()
    await expect(step).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── Dashboard modals ──────────────────────────────────────────────────────────

test.describe('Dashboard modals', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })
  })

  test('CsvImportModal — opens from Import button in plant list', async ({ page }) => {
    const errors = attachErrorListeners(page)
    const importBtn = page.locator('[data-testid="import-plants-btn"]')
    await importBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await importBtn.click()
    const modal = page.locator('.modal.show')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('PlantModal opens and tabs render', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Switch to list view if a toggle exists
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }
    const firstCard = page.locator('.plant-card').first()
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 })
    await firstCard.click()
    const tablist = page.getByRole('tablist', { name: /plant sections/i })
    await expect(tablist).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('WateringSheet — opens from Log Watering button in PlantModal', async ({ page }) => {
    const errors = attachErrorListeners(page)
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }
    const firstCard = page.locator('.plant-card').first()
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 })
    await firstCard.click()
    // Navigate to the Watering tab
    const wateringTab = page.getByRole('tab', { name: /^watering$/i })
    await wateringTab.waitFor({ state: 'visible', timeout: 5_000 })
    await wateringTab.click()
    // Click the "Log Watering" button
    const logWateringBtn = page.getByRole('button', { name: /log watering/i })
    await logWateringBtn.waitFor({ state: 'visible', timeout: 5_000 })
    await logWateringBtn.click()
    // WateringSheet renders as a Modal
    const sheet = page.locator('.modal.show').nth(1)
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('UnsavedChangesGuard — shows when closing modal with unsaved edits', async ({ page }) => {
    const errors = attachErrorListeners(page)
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }
    const firstCard = page.locator('.plant-card').first()
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 })
    await firstCard.click()
    // Modify the plant name to mark the form dirty
    const nameField = page.locator('input[placeholder*="name" i], input[id*="name" i]').first()
    await nameField.waitFor({ state: 'visible', timeout: 5_000 })
    await nameField.fill('Dirty edit test plant name XYZ')
    // Attempt to close — should trigger unsaved-changes guard
    await page.keyboard.press('Escape')
    const guard = page.locator('[aria-labelledby="unsaved-guard-title"]')
    await expect(guard).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('PlantIdentify — opens from Identify from photo option on new-plant modal', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Click "Add Plant" to open a new-plant modal
    const addPlantBtn = page.getByRole('button', { name: /add plant/i }).first()
    await addPlantBtn.waitFor({ state: 'visible', timeout: 8_000 })
    await addPlantBtn.click()
    const modal = page.locator('.modal.show')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    // New-plant mode shows choice cards — click "Identify from photo"
    const identifyCard = page.getByRole('button', { name: /identify from photo/i })
    await identifyCard.waitFor({ state: 'visible', timeout: 5_000 })
    await identifyCard.click()
    // PlantIdentify renders its own modal
    const identifyModal = page.locator('.modal.show')
    await expect(identifyModal).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── Today page modals ─────────────────────────────────────────────────────────

test.describe('Today page modals', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
    await page.goto('/today', { waitUntil: 'networkidle' })
  })

  test('FeedRecordModal — opens from Feed button in Today page', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Feed button exists only if there are fertilise tasks due today
    const feedBtn = page.getByRole('button', { name: /^feed$/i }).first()
    const count = await feedBtn.count()
    test.skip(count === 0, 'No fertilise tasks due in the guest fixture today')
    await feedBtn.click()
    const modal = page.locator('.modal.show')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── Weather alert ─────────────────────────────────────────────────────────────

test.describe('Weather alerts', () => {
  test('WeatherAlertBanner — shows for extreme forecast (mocked)', async ({ page }) => {
    // Mock Open-Meteo to return a forecast with sub-zero overnight temperature
    // so buildWeatherAlerts produces a frost alert.
    await page.route('**/api.open-meteo.com/**', (route) => {
      const today = new Date().toISOString().slice(0, 10)
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: {
            temperature_2m: 5,
            precipitation: 0,
            weathercode: 0,
            is_day: 1,
          },
          daily: {
            time: [today],
            weathercode: [71],   // Light snow — ensures condition !== sunny
            temperature_2m_max: [5],
            temperature_2m_min: [-2],  // Below 3°C triggers frost alert
            precipitation_sum: [0],
          },
        }),
      })
    })
    await dismissFirstRunOverlays(page)
    const errors = attachErrorListeners(page)
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestBtn = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await guestBtn.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    await page.goto('/', { waitUntil: 'networkidle' })
    const alertBanner = page.locator('[class*="alert"]', { hasText: /frost|snow|cold|heatwave|extreme/i })
    await expect(alertBanner).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})
