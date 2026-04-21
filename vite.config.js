import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { execSync } from 'child_process'

let commitHash = process.env.COMMIT_SHA || 'unknown'
try { commitHash = execSync('git rev-parse --short HEAD').toString().trim() } catch {}
if (commitHash.length > 7) commitHash = commitHash.substring(0, 7)
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/sprite.svg', 'icons/app-icon.svg', 'icons/app-icon-maskable.svg'],
      manifest: {
        name: 'Plant Tracker',
        short_name: 'Plants',
        description: 'Track every plant in your home — watering, health, floorplan, and AI care recommendations.',
        theme_color: '#5d623b',
        background_color: '#f4f6ea',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/app-icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'plant-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/plants($|\?)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'plants-api',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/config\/(floorplan|floors)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'config-api',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
