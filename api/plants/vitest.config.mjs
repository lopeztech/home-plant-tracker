import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['index.js', 'vertexai.js', 'climate.js'],
      exclude: ['*.test.*', 'integration/**', 'node_modules/**'],
      // v8 instrumentation drifts ~0.5% between CI runs on identical code
      // (most visibly across Node 20 patch versions on setup-node@v6), so
      // each threshold sits a point below the observed floor to absorb the
      // jitter. Tighten when /notifications/dispatch tail coverage lands
      // (uncovered: index.js lines ~7672-7726).
      thresholds: {
        statements: 79,
        branches: 65,
        functions: 80,
        lines: 80,
      },
    },
  },
})
