import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { execSync } from 'child_process'

let commitHash = process.env.VITE_APP_VERSION || 'unknown'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch { /* git not available (e.g. Docker build) */ }
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
