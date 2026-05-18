#!/usr/bin/env node
/**
 * A11y contrast audit — Phase 1 of issue #399.
 *
 * Builds the SPA (if dist/ is missing), serves it via `vite preview`, then runs
 * axe-core against /login for each theme × {light, dark}. Writes
 * docs/a11y-baseline.json with contrast violations per (theme, mode) so future
 * regressions are diff-able. Non-blocking: exits 0 even when violations are
 * present so the CI workflow can post a sticky diff instead of failing the build.
 *
 * Usage: npm run audit:a11y
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

const PORT = Number(process.env.A11Y_PORT || 4173)
const ORIGIN = `http://localhost:${PORT}`
const ROUTE = '/login'
const THEMES = ['olive', 'earth', 'aurora', 'lunar', 'nebula', 'night', 'solar', 'storm', 'flare']
const MODES = ['light', 'dark']
const OUT_DIR = path.join(REPO_ROOT, 'docs')
const OUT_PATH = path.join(OUT_DIR, 'a11y-baseline.json')

async function ensureBuilt() {
  if (existsSync(path.join(REPO_ROOT, 'dist', 'index.html'))) return
  console.log('• dist/ missing — running `npm run build`')
  await new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))))
  })
}

async function startPreview() {
  console.log(`• Starting vite preview on :${PORT}`)
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ORIGIN}${ROUTE}`)
      if (res.status < 500) return proc
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  proc.kill()
  throw new Error(`preview never responded on ${ORIGIN}`)
}

async function auditOne(page, theme, mode) {
  await page.evaluate(
    ({ theme, mode }) => {
      localStorage.setItem(
        '__PLANT_TRACKER_LAYOUT__',
        JSON.stringify({ theme: mode, themeMode: mode, selectedTheme: theme }),
      )
    },
    { theme, mode },
  )
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(400) // theme CSS swap + webfonts

  const results = await new AxeBuilder({ page })
    .options({ runOnly: { type: 'rule', values: ['color-contrast'] } })
    .analyze()

  const contrast = results.violations.filter((v) => v.id === 'color-contrast')
  return contrast.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodeCount: v.nodes.length,
    samples: v.nodes.slice(0, 5).map((n) => ({
      target: n.target.join(' '),
      failureSummary: n.failureSummary,
    })),
  }))
}

async function run() {
  await ensureBuilt()
  const preview = await startPreview()
  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await page.goto(`${ORIGIN}${ROUTE}`, { waitUntil: 'networkidle' })

    const baseline = {
      generatedAt: new Date().toISOString(),
      route: ROUTE,
      themes: THEMES,
      modes: MODES,
      results: {},
    }
    let total = 0

    console.log('')
    for (const theme of THEMES) {
      baseline.results[theme] = {}
      for (const mode of MODES) {
        const violations = await auditOne(page, theme, mode)
        const nodeCount = violations.reduce((s, v) => s + v.nodeCount, 0)
        baseline.results[theme][mode] = {
          violationCount: violations.length,
          nodeCount,
          violations,
        }
        total += nodeCount
        console.log(
          `  ${theme.padEnd(8)} ${mode.padEnd(5)} ${String(violations.length).padStart(2)} rule(s), ${String(nodeCount).padStart(3)} node(s)`,
        )
      }
    }

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(OUT_PATH, JSON.stringify(baseline, null, 2) + '\n')

    console.log(`\nWrote ${path.relative(REPO_ROOT, OUT_PATH)}`)
    console.log(`Total contrast-violation nodes across ${THEMES.length * MODES.length} permutations: ${total}`)
  } finally {
    await browser.close()
    preview.kill()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
