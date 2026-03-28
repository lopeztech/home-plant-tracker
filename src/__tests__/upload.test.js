import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── JPEG fixture ───────────────────────────────────────────────────────────────
// Loaded as a real binary file so the base64 encoding is tested against actual
// JPEG bytes, not a synthetic stub string.

const PLANT_JPG_BUF   = readFileSync(resolve(__dirname, 'fixtures/plant.jpg'))
const PLANT_JPG_B64   = PLANT_JPG_BUF.toString('base64')
const PLANT_DATA_URL  = `data:image/jpeg;base64,${PLANT_JPG_B64}`

// ── Env stubs & module import ──────────────────────────────────────────────────

vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
vi.stubEnv('VITE_API_KEY', 'test-key')

const { imagesApi, analyseApi, setApiCredential } =
  await import('../api/plants.js')

// ── Mock helpers ───────────────────────────────────────────────────────────────

/** Build a fetch mock that returns JSON via text() (matching the request() impl). */
function fetchOk(body) {
  return Promise.resolve({
    ok:     true,
    status: 200,
    text:   () => Promise.resolve(JSON.stringify(body)),
  })
}

function fetchFail(status, body = {}) {
  return Promise.resolve({
    ok:     false,
    status,
    text:   () => Promise.resolve(JSON.stringify(body)),
  })
}

/** Stub FileReader to immediately fire onload with the given dataURL. */
function stubFileReader(dataURL) {
  global.FileReader = vi.fn(() => ({
    readAsDataURL: vi.fn(),
    set onload(cb) { cb({ target: { result: dataURL } }) },
  }))
}

/** Create a File backed by the real JPEG fixture bytes. */
function makeJpegFile(name = 'photo.jpg') {
  return new File([PLANT_JPG_BUF], name, { type: 'image/jpeg' })
}

beforeEach(() => {
  setApiCredential(null)
  vi.clearAllMocks()
  vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Fixture sanity
// ═══════════════════════════════════════════════════════════════════════════════

describe('JPEG fixture (frontend)', () => {
  it('starts with JPEG magic bytes FF D8', () => {
    expect(PLANT_JPG_BUF[0]).toBe(0xFF)
    expect(PLANT_JPG_BUF[1]).toBe(0xD8)
  })

  it('ends with JPEG EOI marker FF D9', () => {
    expect(PLANT_JPG_BUF[PLANT_JPG_BUF.length - 2]).toBe(0xFF)
    expect(PLANT_JPG_BUF[PLANT_JPG_BUF.length - 1]).toBe(0xD9)
  })

  it('base64 round-trips back to the original bytes', () => {
    const decoded = Buffer.from(PLANT_JPG_B64, 'base64')
    expect(decoded.equals(PLANT_JPG_BUF)).toBe(true)
  })

  it('data URL has the correct prefix', () => {
    expect(PLANT_DATA_URL.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// imagesApi.upload — plant photo upload
// ═══════════════════════════════════════════════════════════════════════════════

describe('imagesApi.upload — with real JPEG fixture', () => {
  it('requests a signed upload URL then PUTs to GCS', async () => {
    const uploadUrl = 'https://storage.googleapis.com/bucket/plants/test-uuid-1234.jpg?sig=abc'
    const publicUrl = 'https://storage.googleapis.com/bucket/plants/test-uuid-1234.jpg'

    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return fetchOk({ uploadUrl, publicUrl })
      }
      return Promise.resolve({ ok: true, status: 200 })
    })
    stubFileReader(PLANT_DATA_URL)

    const file   = makeJpegFile()
    const result = await imagesApi.upload(file, 'plants')

    expect(result).toBe(publicUrl)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('calls upload-url endpoint with the correct filename and contentType', async () => {
    const uploadUrl = 'https://storage.googleapis.com/bucket/plants/test-uuid-1234.jpg?sig=1'
    global.fetch = vi.fn()
      .mockResolvedValueOnce(fetchOk({ uploadUrl, publicUrl: uploadUrl.split('?')[0] }))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    stubFileReader(PLANT_DATA_URL)

    const file = makeJpegFile('my-plant.jpg')
    await imagesApi.upload(file, 'plants')

    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/images/upload-url')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.filename).toBe('plants/test-uuid-1234.jpg')
    expect(body.contentType).toBe('image/jpeg')
  })

  it('PUTs the file directly to the GCS signed URL with only Content-Type', async () => {
    const uploadUrl = 'https://storage.googleapis.com/bucket/plants/p.jpg?sig=2'
    global.fetch = vi.fn()
      .mockResolvedValueOnce(fetchOk({ uploadUrl, publicUrl: 'https://storage.googleapis.com/bucket/plants/p.jpg' }))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    stubFileReader(PLANT_DATA_URL)

    const file = makeJpegFile()
    await imagesApi.upload(file, 'plants')

    const [gcsUrl, gcsOpts] = global.fetch.mock.calls[1]
    expect(gcsUrl).toBe(uploadUrl)
    expect(gcsOpts.method).toBe('PUT')
    expect(gcsOpts.headers['Content-Type']).toBe('image/jpeg')
    // No API key or Auth header on the GCS call
    expect(gcsOpts.headers['x-api-key']).toBeUndefined()
    expect(gcsOpts.headers['Authorization']).toBeUndefined()
  })

  it('uses the floorplans/ prefix for floorplan uploads', async () => {
    const uploadUrl = 'https://storage.googleapis.com/bucket/floorplans/test-uuid-1234.jpg?sig=3'
    global.fetch = vi.fn()
      .mockResolvedValueOnce(fetchOk({ uploadUrl, publicUrl: 'https://storage.googleapis.com/bucket/floorplans/test-uuid-1234.jpg' }))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    stubFileReader(PLANT_DATA_URL)

    const file = makeJpegFile('floor.jpg')
    await imagesApi.upload(file, 'floorplans')

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.filename).toMatch(/^floorplans\//)
  })

  it('throws "GCS upload failed" when the GCS PUT returns non-ok', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(
        fetchOk({ uploadUrl: 'https://storage.gcs.com/x', publicUrl: 'https://cdn/x.jpg' }),
      )
      .mockResolvedValueOnce({ ok: false, status: 403 })
    stubFileReader(PLANT_DATA_URL)

    await expect(imagesApi.upload(makeJpegFile())).rejects.toThrow('GCS upload failed')
  })

  it('throws when the upload-url endpoint returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchFail(500, { error: 'Bucket not found' }))
    stubFileReader(PLANT_DATA_URL)

    await expect(imagesApi.upload(makeJpegFile())).rejects.toThrow('Bucket not found')
  })

  it('throws "Empty response from server" when upload-url returns empty body', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, text: () => Promise.resolve(''),
    })
    stubFileReader(PLANT_DATA_URL)

    await expect(imagesApi.upload(makeJpegFile())).rejects.toThrow('Empty response from server')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// analyseApi.analyse — plant photo AI analysis
// ═══════════════════════════════════════════════════════════════════════════════

const ANALYSIS_RESULT = {
  species:         'Nephrolepis exaltata',
  frequencyDays:   7,
  health:          'Good',
  healthReason:    'Vibrant fronds.',
  maturity:        'Mature',
  recommendations: ['Mist daily', 'Indirect light', 'Repot in spring'],
}

describe('analyseApi.analyse — with real JPEG fixture', () => {
  it('sends POST /analyse with imageBase64 stripped from the data URL prefix', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(ANALYSIS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    const file = makeJpegFile()
    await analyseApi.analyse(file)

    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/analyse')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    // Must not include the 'data:image/jpeg;base64,' prefix
    expect(body.imageBase64).toBe(PLANT_JPG_B64)
    expect(body.imageBase64.startsWith('data:')).toBe(false)
  })

  it('sends the correct mimeType from the File object', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(ANALYSIS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    await analyseApi.analyse(makeJpegFile())

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.mimeType).toBe('image/jpeg')
  })

  it('the imageBase64 decodes back to the original JPEG bytes', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(ANALYSIS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    await analyseApi.analyse(makeJpegFile())

    const body    = JSON.parse(global.fetch.mock.calls[0][1].body)
    const decoded = Buffer.from(body.imageBase64, 'base64')
    expect(decoded.equals(PLANT_JPG_BUF)).toBe(true)
  })

  it('returns the full analysis result from the API', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(ANALYSIS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    const result = await analyseApi.analyse(makeJpegFile())

    expect(result.species).toBe('Nephrolepis exaltata')
    expect(result.frequencyDays).toBe(7)
    expect(result.health).toBe('Good')
    expect(result.recommendations).toHaveLength(3)
  })

  it('throws when the /analyse endpoint returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      fetchFail(500, { error: 'Empty response from AI' }),
    )
    stubFileReader(PLANT_DATA_URL)

    await expect(analyseApi.analyse(makeJpegFile())).rejects.toThrow('Empty response from AI')
  })

  it('throws "Empty response from server" when /analyse returns empty body', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, text: () => Promise.resolve(''),
    })
    stubFileReader(PLANT_DATA_URL)

    await expect(analyseApi.analyse(makeJpegFile())).rejects.toThrow('Empty response from server')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// analyseApi.analyseFloorplan — floorplan AI analysis
// ═══════════════════════════════════════════════════════════════════════════════

const FLOORS_RESULT = {
  floors: [
    {
      id: 'ground-floor', name: 'Ground Floor', type: 'interior', order: 0,
      rooms: [{ name: 'Living Room', x: 0, y: 0, width: 60, height: 50 }],
      imageUrl: null,
    },
    {
      id: 'garden', name: 'Garden', type: 'outdoor', order: -1,
      rooms: [], imageUrl: null,
    },
  ],
}

describe('analyseApi.analyseFloorplan — with real JPEG fixture', () => {
  it('sends POST /analyse-floorplan with imageBase64 and mimeType', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(FLOORS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    const file = new File([PLANT_JPG_BUF], 'floorplan.jpg', { type: 'image/jpeg' })
    await analyseApi.analyseFloorplan(file)

    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/analyse-floorplan')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.imageBase64).toBe(PLANT_JPG_B64)
    expect(body.mimeType).toBe('image/jpeg')
  })

  it('does not include the data URL prefix in imageBase64', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(FLOORS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    await analyseApi.analyseFloorplan(makeJpegFile())

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.imageBase64.startsWith('data:')).toBe(false)
  })

  it('returns the floors result from the API', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(fetchOk(FLOORS_RESULT))
    stubFileReader(PLANT_DATA_URL)

    const result = await analyseApi.analyseFloorplan(makeJpegFile())

    expect(result.floors).toHaveLength(2)
    expect(result.floors[0].id).toBe('ground-floor')
    expect(result.floors[1].id).toBe('garden')
  })

  it('throws when /analyse-floorplan returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      fetchFail(500, { error: 'Empty response from AI' }),
    )
    stubFileReader(PLANT_DATA_URL)

    await expect(analyseApi.analyseFloorplan(makeJpegFile()))
      .rejects.toThrow('Empty response from AI')
  })
})
