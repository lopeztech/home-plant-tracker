/**
 * Integration tests — run against the LIVE deployed API.
 *
 * Required env vars:
 *   INTEGRATION_API_URL    e.g. https://your-gateway-id.uc.gateway.dev
 *   INTEGRATION_API_KEY    the API Gateway key
 *   INTEGRATION_AUTH_TOKEN a Google identity token
 *                          → gcloud auth print-identity-token
 *
 * Optional images (drop in integration/images/):
 *   plant.jpg     a real plant photo  (enables /analyse tests)
 *   floorplan.jpg a real floor plan   (enables /analyse-floorplan tests)
 *
 * See integration/README.md for full setup instructions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL   = process.env.INTEGRATION_API_URL   ?? ''
const API_KEY    = process.env.INTEGRATION_API_KEY   ?? ''
const AUTH_TOKEN = process.env.INTEGRATION_AUTH_TOKEN ?? ''

const configured = Boolean(BASE_URL && API_KEY && AUTH_TOKEN)

const PLANT_IMG_PATH     = resolve(__dirname, 'images/plant.jpg')
const FLOORPLAN_IMG_PATH = resolve(__dirname, 'images/floorplan.jpg')
const hasPlantImage     = existsSync(PLANT_IMG_PATH)
const hasFloorplanImage = existsSync(FLOORPLAN_IMG_PATH)

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** All headers that every authenticated request needs. */
function authHeaders(extra = {}) {
  return {
    'Content-Type':  'application/json',
    'x-api-key':     API_KEY,
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    ...extra,
  }
}

/** Headers for unauthenticated requests (no Bearer token). */
function anonHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-api-key':    API_KEY,
    ...extra,
  }
}

async function get(path, auth = true) {
  return fetch(`${BASE_URL}${path}`, {
    headers: auth ? authHeaders() : anonHeaders(),
  })
}

async function post(path, body, auth = true) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: auth ? authHeaders() : anonHeaders(),
    body:    JSON.stringify(body),
  })
}

async function put(path, body, auth = true) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'PUT',
    headers: auth ? authHeaders() : anonHeaders(),
    body:    JSON.stringify(body),
  })
}

async function del(path) {
  return fetch(`${BASE_URL}${path}`, {
    method:  'DELETE',
    headers: authHeaders(),
  })
}

async function json(res) {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

// ── Cleanup registry ──────────────────────────────────────────────────────────

/** Plant IDs created during the test run — deleted in afterAll. */
const createdPlantIds = []

// ── Saved floors config — restored after tests that modify it ─────────────────

let savedFloors = null

// ══════════════════════════════════════════════════════════════════════════════
// 0. Pre-flight diagnostics (always runs, even without config)
// ══════════════════════════════════════════════════════════════════════════════

describe('Integration test configuration', () => {
  it('prints the target URL', () => {
    console.log('  API URL  :', BASE_URL || '(not set — tests will be skipped)')
    console.log('  API KEY  :', API_KEY  ? `${API_KEY.slice(0, 6)}…`  : '(not set)')
    console.log('  AUTH     :', AUTH_TOKEN ? `${AUTH_TOKEN.slice(0, 20)}…` : '(not set)')
    console.log('  plant.jpg:', hasPlantImage     ? PLANT_IMG_PATH     : '(not found — /analyse tests skip)')
    console.log('  floor.jpg:', hasFloorplanImage ? FLOORPLAN_IMG_PATH : '(not found — /analyse-floorplan tests skip)')
  })

  it('warns when env vars are missing', () => {
    if (!configured) {
      console.warn(
        '\n  ⚠  INTEGRATION_API_URL / INTEGRATION_API_KEY / INTEGRATION_AUTH_TOKEN not set.\n' +
        '     All integration tests will be skipped.\n' +
        '     See api/plants/integration/README.md for setup.',
      )
    }
    // Always passes — this is informational only.
    expect(true).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 1. Health check (no auth required)
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('GET /health', () => {
  it('returns 200 { status: "ok" }', async () => {
    const res  = await get('/health', false)
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Authentication
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('Authentication', () => {
  // The API Gateway only validates x-api-key (not JWT). Requests without a Bearer
  // token still reach the Cloud Run function; the function uses the Gateway's
  // service-to-service JWT as the user sub, so /plants returns 200 (empty list).
  it('returns 200 with only x-api-key (no Bearer token)', async () => {
    const res  = await get('/plants', false)
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns 200 with a valid Bearer token', async () => {
    const res = await get('/plants', true)
    expect(res.status).toBe(200)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. Plants CRUD
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('Plants CRUD', () => {
  let plantId = null

  it('POST /plants — creates a plant and returns 201', async () => {
    const res  = await post('/plants', {
      name:    '[integration-test] Fern',
      species: 'Nephrolepis exaltata',
      notes:   'Created by integration test',
    })
    const body = await json(res)
    expect(res.status).toBe(201)
    expect(body.id).toBeTruthy()
    expect(body.name).toBe('[integration-test] Fern')
    expect(body.createdAt).toBeTruthy()
    plantId = body.id
    createdPlantIds.push(plantId)
  })

  it('GET /plants — lists plants (includes the one we just created)', async () => {
    const res   = await get('/plants')
    const body  = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    const found = body.find(p => p.id === plantId)
    expect(found).toBeDefined()
    expect(found.name).toBe('[integration-test] Fern')
  })

  it('GET /plants/:id — retrieves the plant by ID', async () => {
    const res  = await get(`/plants/${plantId}`)
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.id).toBe(plantId)
  })

  it('GET /plants/:id — returns 404 for a non-existent ID', async () => {
    const res = await get('/plants/does-not-exist-xyz')
    expect(res.status).toBe(404)
  })

  it('PUT /plants/:id — updates the plant and returns 200', async () => {
    const res  = await put(`/plants/${plantId}`, { notes: 'Updated by integration test' })
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.notes).toBe('Updated by integration test')
    expect(body.updatedAt).toBeTruthy()
  })

  it('POST /plants/:id/water — records a watering and returns 200', async () => {
    const res  = await post(`/plants/${plantId}/water`, {})
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.lastWatered).toBeTruthy()
    expect(Array.isArray(body.wateringLog)).toBe(true)
    expect(body.wateringLog.length).toBeGreaterThan(0)
  })

  it('DELETE /plants/:id — deletes the plant and returns 204', async () => {
    const res = await del(`/plants/${plantId}`)
    expect(res.status).toBe(204)
    // Remove from cleanup list since we already deleted it
    const idx = createdPlantIds.indexOf(plantId)
    if (idx !== -1) createdPlantIds.splice(idx, 1)
  })

  it('GET /plants/:id — returns 404 after deletion', async () => {
    const res = await get(`/plants/${plantId}`)
    expect(res.status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. Image upload — signed URL + real GCS PUT
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('POST /images/upload-url', () => {
  it('returns a signed uploadUrl and publicUrl for a plants/ key', async () => {
    const res  = await post('/images/upload-url', {
      filename:    'plants/integration-test-probe.jpg',
      contentType: 'image/jpeg',
    })
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.uploadUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(body.publicUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(body.publicUrl).toContain('integration-test-probe.jpg')
  })

  it('returns a signed uploadUrl for a floorplans/ key', async () => {
    const res  = await post('/images/upload-url', {
      filename:    'floorplans/integration-test-probe.jpg',
      contentType: 'image/jpeg',
    })
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.uploadUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(body.publicUrl).toContain('floorplans/')
  })

  it('returns 400 when filename is missing', async () => {
    const res = await post('/images/upload-url', { contentType: 'image/jpeg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when contentType is missing', async () => {
    const res = await post('/images/upload-url', { filename: 'plants/test.jpg' })
    expect(res.status).toBe(400)
  })

  it.skipIf(!hasPlantImage)(
    'PUT to the signed URL with a real JPEG succeeds (HTTP 200)',
    async () => {
      const bytes = readFileSync(PLANT_IMG_PATH)

      // Step 1: get signed URL
      const filename = `plants/integration-test-${Date.now()}.jpg`
      const urlRes   = await post('/images/upload-url', { filename, contentType: 'image/jpeg' })
      const { uploadUrl } = await json(urlRes)
      expect(urlRes.status).toBe(200)
      expect(uploadUrl).toBeTruthy()

      // Step 2: PUT directly to GCS (no API key — signed URL is its own auth)
      const putRes = await fetch(uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body:    bytes,
      })
      expect(putRes.status).toBe(200)
    },
  )
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. Plant photo analysis via Gemini
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured || !hasPlantImage)(
  'POST /analyse — real plant image (Gemini)',
  () => {
    let result = null

    beforeAll(async () => {
      const bytes      = readFileSync(PLANT_IMG_PATH)
      const imageBase64 = bytes.toString('base64')
      const res        = await post('/analyse', { imageBase64, mimeType: 'image/jpeg' })
      result = await json(res)
      if (res.status !== 200) {
        console.error('  /analyse response:', result)
      }
    })

    it('returns HTTP 200', async () => {
      const bytes      = readFileSync(PLANT_IMG_PATH)
      const imageBase64 = bytes.toString('base64')
      const res        = await post('/analyse', { imageBase64, mimeType: 'image/jpeg' })
      expect(res.status).toBe(200)
    })

    it('returns a species string', () => {
      expect(typeof result?.species).toBe('string')
      expect(result.species.length).toBeGreaterThan(0)
    })

    it('returns frequencyDays as a positive integer', () => {
      expect(Number.isInteger(result?.frequencyDays)).toBe(true)
      expect(result.frequencyDays).toBeGreaterThan(0)
    })

    it('returns health as one of the allowed values', () => {
      expect(['Excellent', 'Good', 'Fair', 'Poor']).toContain(result?.health)
    })

    it('returns a healthReason string', () => {
      expect(typeof result?.healthReason).toBe('string')
      expect(result.healthReason.length).toBeGreaterThan(0)
    })

    it('returns maturity as one of the allowed values', () => {
      expect(['Seedling', 'Young', 'Mature', 'Established']).toContain(result?.maturity)
    })

    it('returns recommendations as an array of 3 strings', () => {
      expect(Array.isArray(result?.recommendations)).toBe(true)
      expect(result.recommendations).toHaveLength(3)
      result.recommendations.forEach(r => expect(typeof r).toBe('string'))
    })
  },
)

describe.skipIf(!configured)('POST /analyse — error cases', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const res = await post('/analyse', { mimeType: 'image/jpeg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when mimeType is missing', async () => {
    const res = await post('/analyse', { imageBase64: 'abc' })
    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. Floorplan analysis via Gemini
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured || !hasFloorplanImage)(
  'POST /analyse-floorplan — real floorplan image (Gemini)',
  () => {
    let result = null

    beforeAll(async () => {
      const bytes      = readFileSync(FLOORPLAN_IMG_PATH)
      const imageBase64 = bytes.toString('base64')
      const res        = await post('/analyse-floorplan', { imageBase64, mimeType: 'image/jpeg' })
      result = await json(res)
      if (res.status !== 200) {
        console.error('  /analyse-floorplan response:', result)
      }
    })

    it('returns HTTP 200', async () => {
      const bytes      = readFileSync(FLOORPLAN_IMG_PATH)
      const imageBase64 = bytes.toString('base64')
      const res        = await post('/analyse-floorplan', { imageBase64, mimeType: 'image/jpeg' })
      expect(res.status).toBe(200)
    })

    it('returns a floors array with at least one floor', () => {
      expect(Array.isArray(result?.floors)).toBe(true)
      expect(result.floors.length).toBeGreaterThan(0)
    })

    it('each floor has required fields (id, name, type, order, rooms)', () => {
      result.floors.forEach(floor => {
        expect(typeof floor.id).toBe('string')
        expect(typeof floor.name).toBe('string')
        expect(['interior', 'outdoor']).toContain(floor.type)
        expect(typeof floor.order).toBe('number')
        expect(Array.isArray(floor.rooms)).toBe(true)
      })
    })

    it('each room has name and bounding box (x, y, width, height) in 0–100', () => {
      result.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          expect(typeof room.name).toBe('string')
          ;['x', 'y', 'width', 'height'].forEach(prop => {
            expect(typeof room[prop]).toBe('number')
            expect(room[prop]).toBeGreaterThanOrEqual(0)
            expect(room[prop]).toBeLessThanOrEqual(100)
          })
        })
      })
    })
  },
)

describe.skipIf(!configured)('POST /analyse-floorplan — error cases', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const res = await post('/analyse-floorplan', { mimeType: 'image/jpeg' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when mimeType is missing', async () => {
    const res = await post('/analyse-floorplan', { imageBase64: 'abc' })
    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. Care recommendations via Gemini
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('POST /recommend', () => {
  it('returns structured care advice for a named plant', async () => {
    const res  = await post('/recommend', { name: 'Boston Fern', species: 'Nephrolepis exaltata' })
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(typeof body.summary).toBe('string')
    expect(typeof body.watering).toBe('string')
    expect(typeof body.light).toBe('string')
    expect(typeof body.humidity).toBe('string')
    expect(typeof body.soil).toBe('string')
    expect(typeof body.temperature).toBe('string')
    expect(typeof body.fertilising).toBe('string')
    expect(Array.isArray(body.commonIssues)).toBe(true)
    expect(body.commonIssues.length).toBeGreaterThanOrEqual(2)
    expect(Array.isArray(body.tips)).toBe(true)
    expect(body.tips.length).toBeGreaterThanOrEqual(2)
  })

  it('returns 400 when name is missing', async () => {
    const res = await post('/recommend', {})
    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. Config — floors
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!configured)('Config floors', () => {
  beforeAll(async () => {
    // Snapshot the current floors config so we can restore it after the tests
    const res = await get('/config/floors')
    if (res.status === 200) {
      const body = await json(res)
      // Strip signed read URLs so we save the raw GCS paths (or null)
      savedFloors = (body.floors ?? []).map(f => ({
        ...f,
        imageUrl: null,  // signed URLs expire; don't try to restore them
      }))
    }
  })

  afterAll(async () => {
    // Restore the original floors config
    if (savedFloors !== null) {
      await put('/config/floors', { floors: savedFloors })
    }
  })

  it('GET /config/floors — returns floors array', async () => {
    const res  = await get('/config/floors')
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body.floors)).toBe(true)
  })

  it('PUT /config/floors — saves a custom floors config and returns it', async () => {
    const customFloors = [
      { id: 'test-ground', name: 'Test Ground', type: 'interior', order: 0, rooms: [], imageUrl: null },
      { id: 'test-garden', name: 'Test Garden', type: 'outdoor',  order: -1, rooms: [], imageUrl: null },
    ]
    const res  = await put('/config/floors', { floors: customFloors })
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(body.floors)).toBe(true)
    expect(body.floors[0].id).toBe('test-ground')
    expect(body.floors[1].id).toBe('test-garden')
  })

  it('GET /config/floors — reflects the saved config', async () => {
    const res  = await get('/config/floors')
    const body = await json(res)
    expect(res.status).toBe(200)
    expect(body.floors[0].id).toBe('test-ground')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ══════════════════════════════════════════════════════════════════════════════

afterAll(async () => {
  if (!configured) return
  for (const id of createdPlantIds) {
    try {
      await del(`/plants/${id}`)
    } catch {
      console.warn(`  cleanup: failed to delete plant ${id}`)
    }
  }
  if (createdPlantIds.length) {
    console.log(`  cleanup: deleted ${createdPlantIds.length} integration-test plant(s)`)
  }
})
