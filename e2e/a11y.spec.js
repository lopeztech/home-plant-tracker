/**
 * Accessibility smoke — runs axe-core against every route in guest mode and
 * fails on any *critical* violation. Serious / moderate / minor violations
 * are logged to the test output as a catalog; file follow-up issues to fix
 * them rather than letting them block the build on first introduction.
 *
 * Covers acceptance criteria from issue #336 (cluster 2).
 *
 * Impact levels (highest → lowest): critical › serious › moderate › minor
 * We fail on `critical` only for the initial pass.
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { enterGuestMode } from './_helpers.js'

// Same route lists as console-smoke.spec.js
const AUTHENTICATED_ROUTES = [
  { path: '/today',                label: 'Today (daily tasks)' },
  { path: '/',                     label: 'Dashboard (Garden)' },
  { path: '/propagation',          label: 'Propagation' },
  { path: '/analytics',            label: 'Analytics' },
  { path: '/calendar',             label: 'Care Calendar' },
  { path: '/forecast',             label: 'Forecast' },
  { path: '/bulk-upload',          label: 'Bulk Upload' },
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
  { path: '/login',    label: 'Login' },
  { path: '/privacy',  label: 'Privacy policy' },
  { path: '/terms',    label: 'Terms of service' },
]

// Rules that are known to fire on third-party elements we don't control
// (Google OAuth button, Bootstrap focus-ring differences, SVG sprite usage).
// Each entry should have a comment explaining the exception so we can remove
// it once the underlying issue is fixed.
const GLOBAL_DISABLE_RULES = [
  // Google Identity Services iframe is injected by gsi/client.js — we don't
  // control its markup. Filed as deferred in issue #221.
  'frame-title',
]

function formatViolations(violations) {
  return violations.map((v) =>
    `[${v.impact}] ${v.id}: ${v.description}\n` +
    v.nodes.slice(0, 2).map((n) => `  → ${n.html}`).join('\n'),
  ).join('\n\n')
}

test.describe('Public routes: axe critical checks', () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page })
        .disableRules(GLOBAL_DISABLE_RULES)
        .analyze()

      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      const critical = results.violations.filter((v) => v.impact === 'critical')

      if (serious.length > 0) {
        // Log serious violations as a catalog without failing — follow-up issues
        // should narrow this to zero. See issue #221 for the a11y backlog.
        console.info(`[a11y catalog] ${path} — ${serious.length} serious/critical violation(s):\n${formatViolations(serious)}`)
      }

      expect(
        critical,
        `axe CRITICAL violations on ${path}:\n${formatViolations(critical)}`,
      ).toHaveLength(0)
    })
  }
})

test.describe('Authenticated routes: axe critical checks', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  for (const { path, label } of AUTHENTICATED_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page })
        .disableRules(GLOBAL_DISABLE_RULES)
        .analyze()

      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      const critical = results.violations.filter((v) => v.impact === 'critical')

      if (serious.length > 0) {
        console.info(`[a11y catalog] ${path} — ${serious.length} serious/critical violation(s):\n${formatViolations(serious)}`)
      }

      expect(
        critical,
        `axe CRITICAL violations on ${path}:\n${formatViolations(critical)}`,
      ).toHaveLength(0)
    })
  }
})
