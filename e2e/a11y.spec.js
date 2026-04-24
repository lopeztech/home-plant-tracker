/**
 * Accessibility smoke tests using axe-core.
 *
 * Runs @axe-core/playwright against every app route in guest mode and fails on
 * violations with impact >= "serious". The first PR introducing this suite
 * treats it as "catalog + allowlist baseline" — known violations are documented
 * in the allowlist below rather than letting them block the build. Fix
 * high-impact violations incrementally in follow-up PRs.
 *
 * Usage:
 *   npm run test:e2e -- --project chromium e2e/a11y.spec.js
 */

import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { enterGuestMode, dismissFirstRunOverlays } from './_helpers.js'

// ── Baseline violation allowlist ─────────────────────────────────────────────
// These are known existing violations that will be fixed in follow-up PRs.
// Each entry maps a rule ID to the reason it's currently allowed.
// Remove entries as fixes land.
const ALLOWED_RULE_IDS = [
  // Bootstrap 5's color-contrast for some muted text tokens is borderline.
  // TODO: audit muted text colors against AA threshold and fix tokens.
  'color-contrast',

  // Several components use overflow:auto containers (WeatherStrip, PlantListPanel,
  // FloorplanPanel floor-tabs, PlantModal photo row) without tabindex="0".
  // TODO: add tabindex="0" to user-scrollable containers; skip decorative ones.
  'scrollable-region-focusable',

  // Smart Admin's layout shell (app-wrap div > header + aside + main) passes
  // landmark checks, but some page-specific content panels and card bodies sit
  // inside generic divs that axe flags under the 'region' rule on certain routes.
  // TODO: audit each flagged route and wrap in an appropriate <section aria-label>.
  'region',
]

const ROUTES = [
  { path: '/today',                label: 'Today' },
  { path: '/',                     label: 'Dashboard' },
  { path: '/propagation',          label: 'Propagation' },
  { path: '/analytics',            label: 'Analytics' },
  { path: '/calendar',             label: 'Calendar' },
  { path: '/forecast',             label: 'Forecast' },
  { path: '/bulk-upload',          label: 'Bulk Upload' },
  { path: '/settings/property',    label: 'Settings: Property' },
  { path: '/settings/preferences', label: 'Settings: Preferences' },
  { path: '/settings/data',        label: 'Settings: Data' },
  { path: '/settings/api-keys',    label: 'Settings: API Keys' },
  { path: '/settings/branding',    label: 'Settings: Branding' },
  { path: '/settings/advanced',    label: 'Settings: Advanced' },
  { path: '/settings/billing',     label: 'Settings: Billing' },
  { path: '/pricing',              label: 'Pricing' },
]

const PUBLIC_ROUTES = [
  { path: '/login',    label: 'Login' },
  { path: '/privacy',  label: 'Privacy' },
  { path: '/terms',    label: 'Terms' },
]

test.describe('Accessibility: public routes', () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`${label} (${path}) — no serious violations`, async ({ page }) => {
      await dismissFirstRunOverlays(page)
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })

      const results = await new AxeBuilder({ page })
        .disableRules(ALLOWED_RULE_IDS)
        .analyze()

      const serious = results.violations.filter((v) =>
        v.impact === 'serious' || v.impact === 'critical',
      )

      expect(
        serious,
        `Serious a11y violations on ${path}:\n` +
        serious.map((v) =>
          `  [${v.impact}] ${v.id}: ${v.description}\n` +
          v.nodes.slice(0, 3).map((n) => `    → ${n.html}`).join('\n'),
        ).join('\n'),
      ).toEqual([])
    })
  }
})

test.describe('Accessibility: authenticated routes (guest mode)', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  for (const { path, label } of ROUTES) {
    test(`${label} (${path}) — no serious violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500) // let deferred renders settle

      const results = await new AxeBuilder({ page })
        .disableRules(ALLOWED_RULE_IDS)
        .analyze()

      const serious = results.violations.filter((v) =>
        v.impact === 'serious' || v.impact === 'critical',
      )

      expect(
        serious,
        `Serious a11y violations on ${path}:\n` +
        serious.map((v) =>
          `  [${v.impact}] ${v.id}: ${v.description}\n` +
          v.nodes.slice(0, 3).map((n) => `    → ${n.html}`).join('\n'),
        ).join('\n'),
      ).toEqual([])
    })
  }
})
