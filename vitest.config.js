import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    css: false,
    exclude: ['node_modules/**', 'e2e/**', 'api/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/__tests__/**', 'src/**/*.test.*', 'src/**/*.spec.*',
        'src/data/guestFloorSvgs.js',
        // Canvas/WebGL-heavy view renderers that can't be meaningfully
        // exercised under jsdom without an HTMLCanvasElement polyfill.
        'src/components/FloorplanGame.jsx',
      ],
      thresholds: {
        lines: 35,
        functions: 30,
        branches: 35,
      },
    },
  },
})
