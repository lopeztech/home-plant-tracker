/**
 * Modal / overlay mount tests.
 *
 * Each test opens one component that renders conditionally (based on props,
 * localStorage state, or user interaction) and asserts it becomes visible
 * without console/page errors.
 *
 * All tests use guest mode with the built-in demo plants so no real API
 * contact is needed. Desktop-only tests are annotated where viewport width
 * matters.
 */

import { test, expect } from '@playwright/test'
import { attachErrorListeners, dismissFirstRunOverlays, enterGuestMode } from './_helpers.js'

// ── 1. Onboarding modal ──────────────────────────────────────────────────────
// Shows when plant-tracker-onboarded is NOT set (new user first visit).

test.describe('Onboarding modal', () => {
  test('opens for a first-time user (onboarded key absent)', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Only set consent so the GDPR banner doesn't block; leave onboarded unset.
    await page.addInitScript(() => {
      localStorage.setItem('plant_tracker_consent', JSON.stringify({
        analytics: false, ai: false, decidedAt: new Date().toISOString(),
      }))
      localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
      // plant-tracker-onboarded intentionally NOT set
    })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
    await guestButton.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    // Onboarding mounts inside MainLayout after auth. The first step's title is
    // "Upload a Floorplan" with a "Skip tour" / "Next" footer.
    const modal = page.locator('.modal-content').filter({ hasText: /upload a floorplan|skip tour/i })
    await expect(modal.first()).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 2. WhatsNewModal ─────────────────────────────────────────────────────────
// Shows for returning users (onboarded=1) who haven't seen the current version.

test.describe("What's New modal", () => {
  test("opens for a returning user who hasn't seen the latest release", async ({ page }) => {
    const errors = attachErrorListeners(page)
    await page.addInitScript(() => {
      localStorage.setItem('plant_tracker_consent', JSON.stringify({
        analytics: false, ai: false, decidedAt: new Date().toISOString(),
      }))
      localStorage.setItem('plant-tracker-onboarded', '1')
      // plant-tracker-whats-new-seen intentionally NOT set → TourContext will show it
    })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
    await guestButton.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    const modal = page.locator('.modal-content').filter({ hasText: /what.*new|release|update/i })
    await expect(modal.first()).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 3. ConsentBanner ────────────────────────────────��────────────────────────
// Shows when plant_tracker_consent is not set.

test.describe('ConsentBanner', () => {
  test('shows cookie consent banner when consent has not been given', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Don't set consent key at all
    await page.addInitScript(() => {
      localStorage.setItem('plant-tracker-whats-new-seen', '99.0.0')
      localStorage.setItem('plant-tracker-onboarded', '1')
    })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const guestButton = page.getByRole('button', { name: /continue as guest|try.*guest|guest mode/i })
    await guestButton.waitFor({ state: 'visible', timeout: 10_000 })
    await guestButton.click()
    await page.waitForURL(/\/today|\/$/, { timeout: 10_000 })
    const banner = page.locator('[aria-label="Cookie consent"]')
    await expect(banner).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 4. WateringSheet ──────────────────────────���──────────────────────────────
// Opens from PlantModal Watering tab → "Log Watering" button.
// Desktop-only: plant cards aren't in the list view on narrow viewports.

test.describe('WateringSheet', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  test('opens from the Watering tab in PlantModal', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Switch to list view if a toggle is present
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }

    const firstPlant = page.locator('.plant-card').first()
    await firstPlant.waitFor({ state: 'visible', timeout: 10_000 })
    await firstPlant.click()

    // Navigate to Watering tab
    const wateringTab = page.getByRole('tab', { name: /^watering$/i })
    await wateringTab.waitFor({ state: 'visible', timeout: 5_000 })
    await wateringTab.click()

    // Click "Log Watering" button
    const logBtn = page.getByRole('button', { name: /log watering/i })
    await logBtn.waitFor({ state: 'visible', timeout: 5_000 })
    await logBtn.click()

    // WateringSheet modal should appear
    const sheet = page.locator('.watering-sheet .modal-content')
    await expect(sheet).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 5. CsvImportModal ────────────────────────────────��───────────────────────
// Opened from the import button in PlantListPanel on the Dashboard.

test.describe('CsvImportModal', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  test('opens from the Import button in the plant list', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Import button only renders inside PlantListPanel, which only mounts in
    // FloorplanPanel's list view (not 2D / 3D / Game). Switch first.
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }

    const importBtn = page.locator('[data-testid="import-plants-btn"]')
    await importBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await importBtn.click()

    const modal = page.locator('.modal-content').filter({ hasText: /import|csv|excel|upload/i })
    await expect(modal.first()).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 6. PlantIdentify ─────────────────────────────��───────────────────────────
// Opened from the "Identify from photo" option in the Add Plant chooser screen.

test.describe('PlantIdentify modal', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  test('opens via the Add Plant → Identify from photo flow', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Add Plant button lives in PlantListPanel — only rendered in list view.
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }

    // Click "Add Plant" button in the list panel
    const addBtn = page.getByRole('button', { name: /add plant/i })
    await addBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await addBtn.click()

    // The PlantModal opens in chooser mode; click "Identify from photo"
    const identifyCard = page.locator('.card').filter({ hasText: /identify from photo/i })
    await identifyCard.waitFor({ state: 'visible', timeout: 5_000 })
    await identifyCard.click()

    // PlantIdentify modal content
    const modal = page.locator('.modal-content').filter({ hasText: /identify|photo|camera|species/i })
    await expect(modal.first()).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 7. UnsavedChangesGuard ───────────────────────────────────────────────────
// Shown when the user tries to close PlantModal with unsaved changes.

test.describe('UnsavedChangesGuard', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only')

  // TODO: the name-field locator (`input[name="name"], input[id*="name"], input[placeholder*="name"]`)
  // matches PlantListPanel's search input before reaching the modal's form field,
  // so the dirty state lands on the search filter, not the plant form. Tighten the
  // locator to scope under `.modal-content` / `[role="dialog"]` and re-enable.
  test.fixme(true, 'name-field locator collides with the list-panel search input')

  test('shows discard-changes confirmation when closing a dirty PlantModal', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Switch to list view
    const listToggle = page.getByRole('button', { name: /^list$/i })
    if (await listToggle.isVisible().catch(() => false)) {
      await listToggle.click().catch(() => {})
    }

    const firstPlant = page.locator('.plant-card').first()
    await firstPlant.waitFor({ state: 'visible', timeout: 10_000 })
    await firstPlant.click()

    // Wait for modal + Plant tab to be visible
    const plantTab = page.getByRole('tab', { name: /^plant$/i })
    await plantTab.waitFor({ state: 'visible', timeout: 5_000 })
    await plantTab.click()

    // Edit the name field to set isDirty
    const nameField = page.locator('input[name="name"], input[id*="name"], input[placeholder*="name"]').first()
    await nameField.waitFor({ state: 'visible', timeout: 5_000 })
    await nameField.fill('Modified plant name')

    // Click the modal close button (X) — should trigger unsaved guard
    const closeBtn = page.locator('.modal-header .btn-close').first()
    await closeBtn.waitFor({ state: 'visible', timeout: 5_000 })
    await closeBtn.click()

    // Unsaved-changes overlay should appear
    const guard = page.locator('[role="alertdialog"]').filter({ hasText: /discard|unsaved/i })
    await expect(guard).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 8. FeatureTour ───────────────────────────────────────────────────────────
// Triggered from the Sidebar "Take a tour" menu.

test.describe('FeatureTour', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'desktop-only — sidebar hidden on mobile')

  // TODO: clicking "Take a tour" toggles the menu state, but the rendered
  // <button> children (First-time setup, etc.) aren't found by getByRole on
  // CI runs. Likely they sit in an overflow-auto scroll container at the very
  // bottom of the sidebar and need a scrollIntoViewIfNeeded() before waitFor.
  test.fixme(true, 'tour sub-menu items not found in CI — needs scroll handling')

  test('first step tooltip appears after starting a tour from the sidebar', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Open the "Take a tour" sub-menu in the sidebar
    const tourMenuBtn = page.getByRole('button', { name: /take a tour/i })
    await tourMenuBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await tourMenuBtn.click()

    // Click the first tour option (First-time setup)
    const firstTourOption = page.getByRole('button', { name: /first.time setup/i })
    await firstTourOption.waitFor({ state: 'visible', timeout: 5_000 })
    await firstTourOption.click()

    // react-joyride renders its tooltip — wait for the tooltip element
    const tooltip = page.locator('.__floater__open, [data-test-id="tooltip"], .react-joyride__tooltip')
    await expect(tooltip.first()).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 9. OfflineBanner ─────────────────────────────��───────────────────────────
// Shows when the browser is offline (navigator.onLine === false).

test.describe('OfflineBanner', () => {
  test('shows the offline connectivity banner when navigator.onLine is false', async ({ page }) => {
    const errors = attachErrorListeners(page)
    // Set navigator.onLine = false before any script runs so PlantContext
    // initialises in offline state.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
    })
    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    const banner = page.locator('[role="status"]').filter({ hasText: /offline/i })
    await expect(banner.first()).toBeVisible({ timeout: 8_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 10. WeatherAlertBanner ───────────────────────────────────────────────────
// Shows when buildWeatherAlerts returns at least one alert. We inject a frost
// weather fixture via sessionStorage so no real geolocation / network call
// is needed.

test.describe('WeatherAlertBanner', () => {
  test('shows a frost alert banner when frost weather is injected', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await page.addInitScript(() => {
      // Mock geolocation to return London coordinates immediately.
      const mockPos = { coords: { latitude: 51.5, longitude: -0.1 } }
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition: (success) => success(mockPos) },
        configurable: true,
      })

      // Pre-populate weather cache for those coordinates with frost data.
      // useWeather reads this from sessionStorage to avoid a real API call.
      const today = new Date().toISOString().slice(0, 10)
      const frostWeather = {
        unit: 'celsius',
        current: { temp: -1, code: 71, condition: { label: 'Light snow', sky: 'snowy', emoji: '🌨️' }, isDay: false, precipitation: 0 },
        days: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i)
          return {
            date: d.toISOString().slice(0, 10),
            code: 71,
            condition: { label: 'Light snow', sky: 'snowy', emoji: '🌨️' },
            maxTemp: 1,
            minTemp: -3,
            precipitation: 0,
          }
        }),
        location: { lat: 51.5, lon: -0.1 },
      }
      sessionStorage.setItem('plantTracker_weather', JSON.stringify({
        lat: 51.5, lon: -0.1,
        fetchedAt: Date.now(),
        weather: frostWeather,
      }))
    })

    await enterGuestMode(page)
    await page.goto('/', { waitUntil: 'networkidle' })

    // WeatherAlertBanner renders an Alert with the frost summary
    const frostAlert = page.locator('.alert').filter({ hasText: /frost/i })
    await expect(frostAlert.first()).toBeVisible({ timeout: 10_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 11. FeedRecordModal ──────────────────────────────────────────────────────
// Opens from the "Feed" button on /today when fertilise tasks are due.
// Guest-mode plants carry no fertiliser schedule, so this test is skipped
// unless a Feed button is actually present.

test.describe('FeedRecordModal', () => {
  test('opens when a Feed button is present on /today', async ({ page }) => {
    const errors = attachErrorListeners(page)
    await enterGuestMode(page)
    await page.goto('/today', { waitUntil: 'networkidle' })

    const feedBtn = page.getByRole('button', { name: /^feed$/i }).first()
    const hasFeedTasks = await feedBtn.isVisible().catch(() => false)
    test.skip(!hasFeedTasks, 'No fertilise tasks due in guest fixture — skipping FeedRecordModal test')

    await feedBtn.click()
    const modal = page.locator('.modal-content').filter({ hasText: /feed|fertilise|fertilizer/i })
    await expect(modal.first()).toBeVisible({ timeout: 5_000 })
    expect(errors, `Unexpected errors:\n${errors.join('\n\n')}`).toEqual([])
  })
})

// ── 12. UpgradePrompt ────────────────────────────────────────────────────────
// Requires BILLING_ENABLED=true and a quota-limit hit to surface. Skipped
// here — covered separately when Stripe billing is activated (issue #239).
// TODO: add fixture test once billing is live.
