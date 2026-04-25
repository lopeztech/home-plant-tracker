import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration.
 *
 * Default mode: builds the frontend and runs against a local `vite preview`
 * server (http://localhost:4173). Same bundle Firebase Hosting would serve.
 *
 *   npm run test:e2e
 *
 * Point at a deployed environment by setting E2E_BASE_URL — the webServer
 * block auto-disables when an external URL is provided:
 *
 *   E2E_BASE_URL=https://plants.lopezcloud.dev npm run test:e2e
 */

const PORT = 4173
const externalBaseUrl = process.env.E2E_BASE_URL
const baseURL = externalBaseUrl || `http://localhost:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile viewport — catches responsive regressions like the April 24
    // sidebar-hogs-half-the-screen bug that a desktop-only run missed.
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    // Firefox and webkit run cross-browser smoke + a11y only.
    // Interaction-heavy specs (modals.spec.js, interactions.spec.js) are kept
    // Chromium-gated until those tests are hardened for cross-browser quirks.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/console-smoke.spec.js', '**/a11y.spec.js'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/console-smoke.spec.js', '**/a11y.spec.js'],
    },
  ],
  // Only auto-start a preview server when we're testing the local build.
  webServer: externalBaseUrl ? undefined : {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
