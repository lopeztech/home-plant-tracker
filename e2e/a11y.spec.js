/**
 * Accessibility smoke tests using axe-core.
 *
 * Runs `AxeBuilder(page).analyze()` on every route (public + authenticated)
 * and fails on any violation with impact "serious" or "critical".
 *
 * Philosophy:
 *  - Known pre-existing violations from third-party UI framework markup that
 *    can't be fixed immediately are captured in ALLOWLISTED_RULES below with
 *    a TODO explaining the root cause and the path to a proper fix.
 *  - New violations at serious/critical impact will fail CI immediately so
 *    they cannot be accidentally introduced.
 *  - "moderate" and "minor" violations are reported as warnings (console.warn)
 *    but do not fail the test.
 *
 * How to update the allowlist:
 *   1. Run the test locally to see the new violation rule ID.
 *   2. Add it to ALLOWLISTED_RULES with a comment explaining the root cause
 *      and a TODO for the proper fix.
 *   3. Keep the list short — every entry represents a real accessibility debt.
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ── Allowlisted rule IDs ──────────────────────────────────────────────────────
// These are pre-existing violations in Smart Admin's base HTML that cannot be
// fixed in a single pass without forking the template.  Each entry MUST have a
// comment explaining the root cause and a TODO for the real fix.

const ALLOWLISTED_RULES = [
  // Smart Admin wraps nav items in <li> inside a <ul> that lacks a landmark
  // role; axe flags the list as not having a meaningful accessible name.
  // TODO: Add aria-label="Primary navigation" to the <nav> wrapper in Sidebar.jsx
  'region',

  // The Smart Admin SVG sprite icon <use> elements don't carry aria-hidden or
  // a title; axe flags them as images without alt text on decorative icons.
  // TODO: Add aria-hidden="true" to decorative <svg> icons site-wide.
  'svg-img-alt',

  // Bootstrap 5 default muted text color (#6c757d) and several Smart Admin
  // theme palette accent colors fail the 4.5:1 AA contrast ratio against
  // their default backgrounds. Fixing requires a theme-wide token audit.
  // TODO: Audit color tokens in DESIGN.md and lift muted/secondary colors
  //       to meet WCAG 2.1 AA (4.5:1 normal text, 3:1 large text).
  'color-contrast',

  // Several Smart Admin form controls (e.g. the <input type="color"> in
  // Settings → Branding) and some React-Bootstrap generated elements lack an
  // explicit <label> or aria-labelledby association that axe can detect.
  // TODO: Audit all Form.Control/Form.Select usages and add htmlFor/
  //       aria-labelledby where the visual label is not programmatically linked.
  'label',

  // Icon-only buttons throughout the app (<button><svg>…</svg></button>)
  // lack aria-label or visually-hidden text.  Affects calendar prev/next,
  // toolbar actions, and similar patterns from Smart Admin's design.
  // TODO: Add aria-label or <span className="visually-hidden"> to every
  //       icon-only button.
  'button-name',

  // Bootstrap / Smart Admin strips link underlines via text-decoration:none
  // in several nav and body-copy contexts.  WCAG SC 1.4.1 requires links
  // to be distinguishable from surrounding text without relying on color alone.
  // TODO: Re-enable text-decoration on body-copy links or ensure 3:1 contrast
  //       ratio between link and surrounding text color per WCAG SC 1.4.1.
  'link-in-text-block',
]

// ── Route lists (copied from console-smoke.spec.js) ──────────────────────────

const ROUTES = [
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildAxeBuilder(page) {
  // Disable allowlisted rules via the axe options.rules map — more reliable
  // than chaining .disableRules() which can be reset by a subsequent .options()
  // call depending on the axe-core version.
  const ruleOverrides = Object.fromEntries(
    ALLOWLISTED_RULES.map((r) => [r, { enabled: false }]),
  )
  return new AxeBuilder({ page })
    .options({
      resultTypes: ['violations'],
      rules: ruleOverrides,
    })
}

function assertNoSeriousViolations(results, routePath) {
  // Belt-and-suspenders: also filter allowlisted rule IDs here so an axe
  // version skew cannot inadvertently re-enable them.
  const serious = results.violations.filter(
    (v) =>
      (v.impact === 'serious' || v.impact === 'critical') &&
      !ALLOWLISTED_RULES.includes(v.id),
  )

  // Warn on moderate/minor violations so they appear in the report without
  // blocking CI — they represent debt but not blockers.
  const moderate = results.violations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor',
  )
  if (moderate.length > 0) {
    const summary = moderate
      .map((v) => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`)
      .join('\n')
    console.warn(`\nA11y moderate/minor on ${routePath}:\n${summary}\n`)
  }

  if (serious.length === 0) return

  const detail = serious
    .map((v) => {
      const nodeInfo = v.nodes
        .slice(0, 3)
        .map((n) => `      • ${n.target.join(', ')}: ${n.failureSummary}`)
        .join('\n')
      return `  [${v.impact}] ${v.id}: ${v.description}\n${nodeInfo}`
    })
    .join('\n')

  expect.soft(serious, `Serious/critical a11y violations on ${routePath}:\n${detail}`).toHaveLength(0)
}

// ── Public routes ─────────────────────────────────────────────────────────────

test.describe('A11y — public routes', () => {
  for (const { path, label } of PUBLIC_ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(300)
      const results = await buildAxeBuilder(page).analyze()
      assertNoSeriousViolations(results, path)
    })
  }
})

// ── Authenticated routes (guest mode) ─────────────────────────────────────────

test.describe('A11y — authenticated routes (guest mode)', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page)
  })

  for (const { path, label } of ROUTES) {
    test(`${label} (${path})`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 20_000 })
      await page.waitForTimeout(500)
      const results = await buildAxeBuilder(page).analyze()
      assertNoSeriousViolations(results, path)
    })
  }
})
