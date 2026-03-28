import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock import.meta.env before importing the module
vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
vi.stubEnv('VITE_API_KEY', 'test-api-key')

// Re-import after env is stubbed
const { plantsApi, floorsApi, analyseApi, imagesApi, setApiCredential } = await import('../api/plants.js')

function makeFetchMock(status = 200, body = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('API client', () => {
  beforeEach(() => {
    setApiCredential(null)
    vi.clearAllMocks()
  })

  // ── Headers ───────────────────────────────────────────────────────────────

  it('always sends x-api-key header', async () => {
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [, opts] = global.fetch.mock.calls[0]
    expect(opts.headers['x-api-key']).toBe('test-api-key')
  })

  it('sends Authorization Bearer header when credential is set', async () => {
    setApiCredential('my-jwt-token')
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [, opts] = global.fetch.mock.calls[0]
    expect(opts.headers['Authorization']).toBe('Bearer my-jwt-token')
  })

  it('does not send Authorization header when no credential is set', async () => {
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [, opts] = global.fetch.mock.calls[0]
    expect(opts.headers['Authorization']).toBeUndefined()
  })

  it('sends Content-Type: application/json', async () => {
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [, opts] = global.fetch.mock.calls[0]
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  // ── URL construction ──────────────────────────────────────────────────────

  it('builds the full URL from BASE_URL + path', async () => {
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [url] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/plants')
  })

  // ── HTTP 204 ──────────────────────────────────────────────────────────────

  it('returns null for 204 No Content responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    const result = await plantsApi.delete('plant-1')
    expect(result).toBeNull()
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('throws with the server error message on non-ok responses', async () => {
    global.fetch = makeFetchMock(400, { error: 'Plant not found' })
    await expect(plantsApi.list()).rejects.toThrow('Plant not found')
  })

  it('throws with "HTTP <status>" when no error body is present', async () => {
    global.fetch = makeFetchMock(500, {})
    await expect(plantsApi.list()).rejects.toThrow('HTTP 500')
  })

  // ── plantsApi ─────────────────────────────────────────────────────────────

  it('plantsApi.list calls GET /plants', async () => {
    global.fetch = makeFetchMock(200, [])
    await plantsApi.list()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/plants')
    expect(opts.method).toBeUndefined() // default GET
  })

  it('plantsApi.create sends POST /plants with body', async () => {
    global.fetch = makeFetchMock(200, { id: 'new' })
    await plantsApi.create({ name: 'Fern' })
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/plants')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ name: 'Fern' })
  })

  it('plantsApi.update sends PUT /plants/:id with body', async () => {
    global.fetch = makeFetchMock(200, { id: 'p1' })
    await plantsApi.update('p1', { name: 'Updated Fern' })
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/plants/p1')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toEqual({ name: 'Updated Fern' })
  })

  it('plantsApi.delete sends DELETE /plants/:id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    await plantsApi.delete('p1')
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/plants/p1')
    expect(opts.method).toBe('DELETE')
  })

  it('plantsApi.water sends POST /plants/:id/water', async () => {
    global.fetch = makeFetchMock(200, { ok: true })
    await plantsApi.water('p2')
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/plants/p2/water')
    expect(opts.method).toBe('POST')
  })

  // ── floorsApi ─────────────────────────────────────────────────────────────

  it('floorsApi.get calls GET /config/floors', async () => {
    global.fetch = makeFetchMock(200, { floors: [] })
    await floorsApi.get()
    const [url] = global.fetch.mock.calls[0]
    expect(url).toContain('/config/floors')
  })

  it('floorsApi.save sends PUT /config/floors with floors array', async () => {
    global.fetch = makeFetchMock(200, { floors: [] })
    const floors = [{ id: 'ground', name: 'Ground' }]
    await floorsApi.save(floors)
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toContain('/config/floors')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toEqual({ floors })
  })

  // ── imagesApi ─────────────────────────────────────────────────────────────

  it('imagesApi.upload calls upload-url endpoint then PUTs to GCS', async () => {
    const uploadUrl = 'https://storage.googleapis.com/bucket/file?sig=abc'
    const publicUrl = 'https://cdn.example.com/file.jpg'

    let callCount = 0
    global.fetch = vi.fn().mockImplementation((url) => {
      callCount++
      if (callCount === 1) {
        // First call: get upload URL (goes through request() → uses text())
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ uploadUrl, publicUrl })) })
      }
      // Second call: PUT directly to GCS (bypasses request(), only checks res.ok)
      return Promise.resolve({ ok: true, status: 200 })
    })

    // FileReader mock
    const mockReadAsDataURL = vi.fn()
    const MockFileReader = vi.fn(() => ({
      readAsDataURL: mockReadAsDataURL,
      set onload(cb) { cb({ target: { result: 'data:image/jpeg;base64,abc123' } }) },
    }))
    global.FileReader = MockFileReader
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await imagesApi.upload(file)

    expect(result).toBe(publicUrl)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    // Second call should be a PUT to the GCS upload URL
    const [gcsUrl, gcsOpts] = global.fetch.mock.calls[1]
    expect(gcsUrl).toBe(uploadUrl)
    expect(gcsOpts.method).toBe('PUT')
  })

  it('imagesApi.upload throws when GCS PUT fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ uploadUrl: 'https://storage.gcs.com/x', publicUrl: 'https://cdn/x.jpg' })),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 })

    global.FileReader = vi.fn(() => ({
      readAsDataURL: vi.fn(),
      set onload(cb) { cb({ target: { result: 'data:image/jpeg;base64,test' } }) },
    }))
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-2' })

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await expect(imagesApi.upload(file)).rejects.toThrow('GCS upload failed')
  })
})
