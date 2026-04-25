/**
 * Modal / overlay smoke — opens every panel, modal, and overlay in guest mode
 * and asserts it becomes visible without unexpected console errors.
 *
 * Covers acceptance criteria from issue #336 (cluster 1: ~12 modal tests).
 * Uses the shared helpers from e2e/_helpers.js.
 */

import { test, expect } from '@playwright/test'
import { attachErrorListeners, enterGuestMode } from './_helpers.js'

// ---------------------------------------------------------------------------
// First-run overlays — triggered by missing localStorage keys
// ---------------------------------------------------------------------------

test.describe('First-run overlays', () => {
  test('ConsentBanner appears when consent key is absent', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Set onboarded + whatsNewSeen so only the consent banner shows.
    await enterGuestMode(page, { consent: false, onboarded: true, whatsNewSeen: true })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const banner = page.locator('[role="dialog"][aria-label="Cookie consent"]')
    await expect(banner).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors on ConsentBanner:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('Onboarding modal appears for first-time users', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Set consent + whatsNewSeen; leave onboarded unset → Onboarding shows.
    await enterGuestMode(page, { consent: true, onboarded: false, whatsNewSeen: true })
    await page.goto('/', { waitUntil: 'networkidle' })
    // Onboarding is a Bootstrap modal; step 1 title is "Upload a Floorplan".
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    await expect(dialog).toContainText('Upload a Floorplan')
    expect(errors, `Unexpected errors on Onboarding:\n${errors.join('\n\n')}`).toEqual([])
  })

  test("What's new modal appears for returning users", async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Set consent + onboarded; leave whatsNewSeen unset → WhatsNew shows.
    await enterGuestMode(page, { consent: true, onboarded: true, whatsNewSeen: false })
    await page.goto('/', { waitUntil: 'networkidle' })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    await expect(dialog).toContainText(/what.?s new/i)
    expect(errors, `Unexpected errors on WhatsNew:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Network-state overlays
// ---------------------------------------------------------------------------

test.describe('Network-state overlays', () => {
  test('OfflineBanner appears when browser goes offline', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })
    // Dispatch the offline event so PlantContext's listener fires without
    // actually severing the network (avoids page-load failures on navigate).
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 5_000 })
    await expect(banner).toContainText(/offline/i)
    expect(errors, `Unexpected errors on OfflineBanner:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Weather alerts — requires a mocked open-meteo response with frost data
// ---------------------------------------------------------------------------

test.describe('Weather alerts', () => {
  test('WeatherAlertBanner shows frost alert when outdoor plants are at risk', async ({ page }) => {
    const errors = attachErrorListeners(page)

    // Inject a saved location so useWeather skips the geolocation prompt and
    // goes straight to the API fetch.
    await page.addInitScript(() => {
      localStorage.setItem('plantTracker_location', JSON.stringify({
        lat: 40.7128, lon: -74.0060, name: 'New York',
      }))
      localStorage.setItem('plant_tracker_consent', JSON.stringify({
        analytics: false, ai: false, decidedAt: new Date().toISOString(),
      }))
      localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
      localStorage.setItem('plant-tracker-onboarded', '1')
    })

    // Stub open-meteo with frost temperatures (-3 °C min) so the banner fires.
    const today = new Date()
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    await page.route('https://api.open-meteo.com/v1/forecast**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: { temperature_2m: -1, precipitation: 0, rain: 0, weathercode: 71, is_day: 0 },
        daily: {
          time: dates,
          weathercode: Array(7).fill(71),
          temperature_2m_max: Array(7).fill(2),
          temperature_2m_min: Array(7).fill(-3),
          precipitation_sum: Array(7).fill(0),
        },
      }),
    }))

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
    await guestButton.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    await page.goto('/', { waitUntil: 'networkidle' })

    // The Lavender guest plant is in the Garden Bed (outdoor room) and will
    // trigger a frost alert when minTemp < 2 °C.
    const alertBanner = page.locator('.alert-danger, .alert-warning').filter({ hasText: /frost|heatwave|rain|drought/i })
    await expect(alertBanner).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors on WeatherAlertBanner:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Action-triggered modals — require navigating to a page and clicking UI
// ---------------------------------------------------------------------------

test.describe('Action-triggered modals', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  test('CsvImportModal opens from the plant list import button', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Navigate with ?view=list so PlantListPanel (and its import button) renders.
    await page.goto('/?view=list', { waitUntil: 'networkidle' })

    const importBtn = page.locator('[data-testid="import-plants-btn"]')
    await importBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await importBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText(/import plants from csv/i)
    expect(errors, `Unexpected errors on CsvImportModal:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('FeedRecordModal opens from a feeding task on the Today page', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await page.goto('/today', { waitUntil: 'networkidle' })

    // Guest plants have no lastFed date → all show as due. Skip silently if
    // no tasks appear (e.g. all plants are in winter dormancy).
    const feedButton = page.getByRole('button', { name: /^Feed$/i }).first()
    const count = await feedButton.count()
    test.skip(count === 0, 'No feeding tasks in guest fixture')

    await feedButton.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText(/^Feed /i)
    expect(errors, `Unexpected errors on FeedRecordModal:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('WateringSheet opens from the Watering tab in PlantModal', async ({ page, viewport }) => {
    // Plant cards are not exposed on mobile — the floorplan dominates.
    test.skip(!!viewport && viewport.width < 768, 'desktop-only')

    const errors = attachErrorListeners(page)
    // Use ?view=list so PlantListPanel renders and plant cards are accessible.
    await page.goto('/?view=list', { waitUntil: 'networkidle' })

    const firstCard = page.locator('.plant-card').first()
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 })
    await firstCard.click()

    // PlantModal opens; wait for tablist, then click Watering tab.
    const tablist = page.getByRole('tablist', { name: /plant sections/i })
    await expect(tablist).toBeVisible({ timeout: 5_000 })
    await page.getByRole('tab', { name: /^Watering$/i }).click()
    await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 3_000 })

    // Log Watering button only renders when onWater prop is provided (always
    // true in guest mode via PlantContext).
    const logBtn = page.getByRole('button', { name: /Log Watering/i })
    await expect(logBtn).toBeVisible({ timeout: 3_000 })
    await logBtn.click()

    const sheet = page.locator('.watering-sheet')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors on WateringSheet:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('PlantIdentify modal opens from the Add Plant mode selector', async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, 'desktop-only')

    const errors = attachErrorListeners(page)
    // Use ?view=list so PlantListPanel header (Add Plant button) is rendered.
    await page.goto('/?view=list', { waitUntil: 'networkidle' })

    // "Add Plant" button is in the PlantListPanel header.
    const addBtn = page.getByRole('button', { name: /Add Plant/i })
    await addBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await addBtn.click()

    // PlantModal opens in mode-selector state (no mode chosen yet).
    // Click the "Identify from photo" card.
    const identifyCard = page.getByText(/Identify from photo/i).first()
    await expect(identifyCard).toBeVisible({ timeout: 5_000 })
    await identifyCard.click()

    // PlantIdentify is a separate Bootstrap modal on top of PlantModal.
    const dialog = page.getByRole('dialog', { name: /Identify Plant/i })
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors on PlantIdentify:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('UnsavedChangesGuard appears when closing a dirty PlantModal', async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, 'desktop-only')

    const errors = attachErrorListeners(page)
    // Use ?view=list so PlantListPanel renders and plant cards are accessible.
    await page.goto('/?view=list', { waitUntil: 'networkidle' })

    const firstCard = page.locator('.plant-card').first()
    await firstCard.waitFor({ state: 'visible', timeout: 10_000 })
    await firstCard.click()

    const tablist = page.getByRole('tablist', { name: /plant sections/i })
    await expect(tablist).toBeVisible({ timeout: 5_000 })

    // Editing the species field sets isDirty=true via the update() callback.
    const speciesInput = page.locator('#plant-species-input')
    await speciesInput.waitFor({ state: 'visible', timeout: 5_000 })
    const curSpecies = await speciesInput.inputValue()
    await speciesInput.fill(curSpecies + ' x')  // fill() reliably triggers React onChange

    // Click the modal X button — handleCloseRequest checks isDirty and shows
    // the custom alertdialog (not a Bootstrap modal, just a positioned div).
    const closeBtn = page.locator('.modal-header .btn-close').first()
    await closeBtn.click()

    const guard = page.locator('[role="alertdialog"]')
    await expect(guard).toBeVisible({ timeout: 5_000 })
    await expect(guard).toContainText(/Discard unsaved changes/i)
    expect(errors, `Unexpected errors on UnsavedChangesGuard:\n${errors.join('\n\n')}`).toEqual([])
  })

  test('FeatureTour starts from the sidebar Take-a-tour menu', async ({ page, viewport }) => {
    // The sidebar nav is collapsed on mobile; "Take a tour" is not accessible.
    test.skip(!!viewport && viewport.width < 768, 'desktop-only')

    const errors = attachErrorListeners(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Click "Take a tour" to expand the tour submenu.
    const tourNavBtn = page.getByRole('button', { name: /Take a tour/i })
    await tourNavBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await tourNavBtn.click()

    // Click the first tour ("First-time setup").
    const firstTour = page.getByRole('button', { name: /First-time setup/i })
    await expect(firstTour).toBeVisible({ timeout: 3_000 })
    await firstTour.click()

    // React-Joyride renders a tooltip element once the tour starts.
    // Wait briefly for the portal to mount before asserting visibility.
    await page.waitForTimeout(300)
    const tooltip = page.locator('.react-joyride__tooltip')
    await expect(tooltip).toBeVisible({ timeout: 10_000 })
    expect(errors, `Unexpected errors on FeatureTour:\n${errors.join('\n\n')}`).toEqual([])
  })

  // UpgradePrompt returns null when BILLING_ENABLED is not set (default in
  // preview builds), so it cannot be exercised in standard E2E. Covered by
  // unit tests in src/__tests__/UpgradePrompt.test.jsx.
  test.skip('UpgradePrompt — skipped: billingEnabled=false in preview builds', () => {})
})
