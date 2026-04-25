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
import { attachErrorListeners, enterGuestMode, waitForLayoutReady } from './_helpers.js'

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
    // Wait for MainLayout (and GlobalKeyboardShortcuts' useEffect) to mount —
    // the Topbar palette button is the deterministic mount signal.
    await waitForLayoutReady(page)
    const dialog = page.getByRole('dialog', { name: /command palette/i })
    // Re-press the shortcut on the auto-retry: on slower CI runners the
    // keydown handler can attach a tick after the button paints, so a single
    // keypress can race the listener registration. expect.toPass retries the
    // whole block (press + visibility check) until either succeeds or 5s.
    const isMac = process.platform === 'darwin'
    await expect(async () => {
      await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k')
      await expect(dialog).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 5_000 })
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
