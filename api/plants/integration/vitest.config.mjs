import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 120_000,   // Gemini can be slow
    hookTimeout: 60_000,
    // Run suites sequentially — integration tests have side effects (Firestore writes)
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    reporters: ['verbose'],
  },
})
