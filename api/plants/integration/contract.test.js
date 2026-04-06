/**
 * API contract / smoke tests for deployed endpoints.
 *
 * A lightweight test suite that validates the deployed API Gateway
 * behaves correctly for security, CORS, and rate limiting.
 *
 * Required env vars:
 *   INTEGRATION_API_URL    e.g. https://your-gateway-id.uc.gateway.dev
 *   INTEGRATION_API_KEY    the API Gateway key
 *   INTEGRATION_AUTH_TOKEN a Google identity token
 *
 * Run:
 *   cd api/plants && npx vitest run --config integration/vitest.config.mjs integration/contract.test.js
 */

import { describe, it, expect } from 'vitest'

const BASE_URL   = process.env.INTEGRATION_API_URL   ?? ''
const API_KEY    = process.env.INTEGRATION_API_KEY   ?? ''
const AUTH_TOKEN = process.env.INTEGRATION_AUTH_TOKEN ?? ''

const configured = Boolean(BASE_URL && API_KEY && AUTH_TOKEN)
const ALLOWED_ORIGIN = 'https://plants.lopezcloud.dev'

// ── Health endpoint ──────────────────────────────────────────────────────────

describe.skipIf(!configured)('Health endpoint contract', () => {
  it('GET /health returns 200 with { status: "ok" }', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-api-key': API_KEY },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('GET /health returns security headers', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-api-key': API_KEY },
    })
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })
})

// ── Authentication failure ───────────────────────────────────────────────────

describe.skipIf(!configured)('Authentication failure handling', () => {
  it('returns 401 when Bearer token is missing on protected route', async () => {
    const res = await fetch(`${BASE_URL}/plants`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    })
    // API Gateway or backend should reject — expect 401 or 403
    expect([401, 403]).toContain(res.status)
  })

  it('returns 401 when Bearer token is invalid', async () => {
    const res = await fetch(`${BASE_URL}/plants`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Authorization': 'Bearer invalid.token.here',
      },
    })
    expect([401, 403]).toContain(res.status)
  })
})

// ── API key validation ───────────────────────────────────────────────────────

describe.skipIf(!configured)('API key validation', () => {
  it('rejects requests without an API key', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    // API Gateway should reject without x-api-key
    expect([401, 403]).toContain(res.status)
  })

  it('rejects requests with an invalid API key', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-api-key': 'invalid-key-12345' },
    })
    expect([401, 403]).toContain(res.status)
  })
})

// ── CORS headers ─────────────────────────────────────────────────────────────

describe.skipIf(!configured)('CORS headers', () => {
  it('returns correct CORS headers for allowed origin', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: {
        'x-api-key': API_KEY,
        'Origin': ALLOWED_ORIGIN,
      },
    })
    const allowOrigin = res.headers.get('access-control-allow-origin')
    // Should echo back the allowed origin or use *
    expect(allowOrigin).toBeTruthy()
    expect([ALLOWED_ORIGIN, '*']).toContain(allowOrigin)
  })

  it('handles preflight OPTIONS request', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,x-api-key',
      },
    })
    // Preflight should succeed (200 or 204)
    expect([200, 204]).toContain(res.status)
  })

  it('rejects CORS from unauthorized origin', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: {
        'x-api-key': API_KEY,
        'Origin': 'https://evil-site.example.com',
      },
    })
    const allowOrigin = res.headers.get('access-control-allow-origin')
    // Should NOT echo back the evil origin (may be null, absent, or allowed origin only)
    if (allowOrigin) {
      expect(allowOrigin).not.toBe('https://evil-site.example.com')
    }
  })
})

// ── Rate limiting headers ────────────────────────────────────────────────────

describe.skipIf(!configured)('Rate limiting', () => {
  it('includes rate limit headers in response', async () => {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-api-key': API_KEY },
    })
    // express-rate-limit with standardHeaders: true sends RateLimit-* headers
    const rateLimitLimit = res.headers.get('ratelimit-limit')
    const rateLimitRemaining = res.headers.get('ratelimit-remaining')
    // At least one rate limit header should be present
    const hasRateLimitHeaders = rateLimitLimit || rateLimitRemaining
    expect(hasRateLimitHeaders).toBeTruthy()
  })
})
