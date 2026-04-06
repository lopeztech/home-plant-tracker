import { defineConfig } from '@playwright/test'

/**
 * Playwright E2E configuration for smoke tests against
 * the deployed staging/dev environment.
 *
 * Usage:
 *   E2E_BASE_URL=https://plants.lopezcloud.dev npx playwright test
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
