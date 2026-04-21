import { enqueue as enqueueMutation, flush as flushQueue } from '../utils/offlineQueue.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const API_KEY = import.meta.env.VITE_API_KEY

let _credential = null

export function setApiCredential(credential) {
  _credential = credential
}

export class OfflineQueuedError extends Error {
  constructor(type) {
    super(`Mutation queued for offline replay: ${type}`)
    this.name = 'OfflineQueuedError'
    this.type = type
  }
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function headers() {
  const h = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  }
  if (_credential) h['Authorization'] = `Bearer ${_credential}`
  return h
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) throw new Error(`Empty response from server (HTTP ${res.status})`)
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`Unexpected response from server (HTTP ${res.status})`)
  }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

export const plantsApi = {
  list: () => request('/plants'),
  create: (data) => request('/plants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/plants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/plants/${id}`, { method: 'DELETE' }),
  water: (id) => {
    if (isOffline()) {
      enqueueMutation({ type: 'water', payload: { id } })
      throw new OfflineQueuedError('water')
    }
    return request(`/plants/${id}/water`, { method: 'POST' })
  },
  moisture: (id, reading, note) => {
    if (isOffline()) {
      enqueueMutation({ type: 'moisture', payload: { id, reading, note } })
      throw new OfflineQueuedError('moisture')
    }
    return request(`/plants/${id}/moisture`, { method: 'POST', body: JSON.stringify({ reading, note }) })
  },
  fertilise: (id, fields = {}) => {
    if (isOffline()) {
      enqueueMutation({ type: 'fertilise', payload: { id, fields } })
      throw new OfflineQueuedError('fertilise')
    }
    return request(`/plants/${id}/fertilise`, { method: 'POST', body: JSON.stringify(fields) })
  },
  wateringPattern: (id) => request(`/plants/${id}/watering-pattern`),
  wateringRecommendation: (id) => request(`/plants/${id}/watering-recommendation`),
  healthPrediction: (id) => request(`/plants/${id}/health-prediction`),
  anomaly: (id) => request(`/plants/${id}/anomaly`),
  diagnostic: async (id, file) => {
    const base64 = await fileToBase64(file)
    const [, data] = base64.split(',')
    return request(`/plants/${id}/diagnostic`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64: data, mimeType: file.type }),
    })
  },
  deletePhoto: (id, url) => request(`/plants/${id}/photos`, { method: 'DELETE', body: JSON.stringify({ url }) }),
  seasonalAdjustment: (id) => request(`/plants/${id}/seasonal-adjustment`),
  speciesCluster: (name) => request(`/species/${encodeURIComponent(name)}/cluster`),
  careScore: (id) => request(`/plants/${id}/care-score`),
  careScores: () => request('/ml/care-scores'),
  recalculateFrequencies: (params) => request('/plants/recalculate-frequencies', { method: 'POST', body: JSON.stringify(params || {}) }),
  getFloorplan: () => request('/config/floorplan'),
  saveFloorplan: (imageUrl) => request('/config/floorplan', { method: 'PUT', body: JSON.stringify({ imageUrl }) }),
}

export const floorsApi = {
  get: () => request('/config/floors'),
  save: (floors) => request('/config/floors', { method: 'PUT', body: JSON.stringify({ floors }) }),
}

/**
 * Replay queued offline mutations against the live API. Stops at the first
 * failure so items remain in FIFO order for a later retry. Returns the
 * flush result from the offline-queue module.
 */
export function flushOfflineMutations() {
  if (isOffline()) return Promise.resolve({ flushed: 0, remaining: undefined, errors: 0 })
  return flushQueue(async (item) => {
    const { type, payload } = item
    if (type === 'water') {
      return request(`/plants/${payload.id}/water`, { method: 'POST' })
    }
    if (type === 'moisture') {
      return request(`/plants/${payload.id}/moisture`, {
        method: 'POST',
        body: JSON.stringify({ reading: payload.reading, note: payload.note }),
      })
    }
    if (type === 'fertilise') {
      return request(`/plants/${payload.id}/fertilise`, {
        method: 'POST',
        body: JSON.stringify(payload.fields || {}),
      })
    }
    throw new Error(`Unknown queued mutation type: ${type}`)
  })
}

async function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

export const analyseApi = {
  async analyse(file) {
    const base64 = await fileToBase64(file)
    const [, data] = base64.split(',')
    return request('/analyse', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: data, mimeType: file.type }),
    })
  },
  async analyseWithHint(file, speciesHint) {
    const base64 = await fileToBase64(file)
    const [, data] = base64.split(',')
    return request('/analyse-with-hint', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: data, mimeType: file.type, speciesHint }),
    })
  },
  async analyseFloorplan(file) {
    const base64 = await fileToBase64(file)
    const [, data] = base64.split(',')
    return request('/analyse-floorplan', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: data, mimeType: file.type }),
    })
  },
}

export const recommendApi = {
  get: (name, species, { plantedIn, isOutdoor, location, tempUnit } = {}) => request('/recommend', {
    method: 'POST',
    body: JSON.stringify({ name, species, plantedIn, isOutdoor, location, tempUnit }),
  }),
  getWatering: (params) => request('/recommend-watering', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getFertiliser: (params) => request('/recommend-fertiliser', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
}

export const measurementsApi = {
  list: (id) => request(`/plants/${id}/measurements`),
  add: (id, data) => request(`/plants/${id}/measurements`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id, measurementId) => request(`/plants/${id}/measurements/${measurementId}`, { method: 'DELETE' }),
}

export const phenologyApi = {
  list: (id) => request(`/plants/${id}/phenology`),
  add: (id, data) => request(`/plants/${id}/phenology`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id, eventId) => request(`/plants/${id}/phenology/${eventId}`, { method: 'DELETE' }),
}

export const journalApi = {
  list: (id) => request(`/plants/${id}/journal`),
  add: (id, data) => request(`/plants/${id}/journal`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, entryId, data) => request(`/plants/${id}/journal/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id, entryId) => request(`/plants/${id}/journal/${entryId}`, { method: 'DELETE' }),
}

export const harvestApi = {
  list: (id) => request(`/plants/${id}/harvests`),
  add: (id, data) => request(`/plants/${id}/harvests`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id, harvestId) => request(`/plants/${id}/harvests/${harvestId}`, { method: 'DELETE' }),
}

export const qrApi = {
  getShortCode: (id) => request(`/plants/${id}/short-code`),
  scan: (shortCode) => request(`/scan/${encodeURIComponent(shortCode)}`),
}

export const incidentApi = {
  list: (id) => request(`/plants/${id}/incidents`),
  add: (id, data) => request(`/plants/${id}/incidents`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, incidentId, data) => request(`/plants/${id}/incidents/${incidentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  addTreatment: (id, incidentId, data) => request(`/plants/${id}/incidents/${incidentId}/treatments`, { method: 'POST', body: JSON.stringify(data) }),
  resolve: (id, incidentId, data) => request(`/plants/${id}/incidents/${incidentId}/resolve`, { method: 'POST', body: JSON.stringify(data || {}) }),
  delete: (id, incidentId) => request(`/plants/${id}/incidents/${incidentId}`, { method: 'DELETE' }),
}

export const outbreakApi = {
  list: () => request('/outbreaks'),
  bulkTreat: (outbreakId, data) => request(`/outbreaks/${outbreakId}/treat`, { method: 'POST', body: JSON.stringify(data) }),
  bulkResolve: (outbreakId, data) => request(`/outbreaks/${outbreakId}/resolve`, { method: 'POST', body: JSON.stringify(data || {}) }),
}

export const propagationApi = {
  list: () => request('/propagations'),
  create: (data) => request('/propagations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/propagations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  promote: (id, data) => request(`/propagations/${id}/promote`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/propagations/${id}`, { method: 'DELETE' }),
  recommend: (data) => request('/recommend-propagation', { method: 'POST', body: JSON.stringify(data) }),
}

export const accountApi = {
  deleteAccount: () => request('/account', { method: 'DELETE' }),
  exportData: () => request('/account/export'),
}

export const billingApi = {
  getSubscription: () => request('/billing/subscription'),
  createCheckoutSession: (tier, interval = 'month') => request('/billing/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  }),
  createPortalSession: () => request('/billing/create-portal-session', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
}

export const imagesApi = {
  async upload(file, prefix = 'plants') {
    const ext = file.name.split('.').pop()
    const filename = `${prefix}/${crypto.randomUUID()}.${ext}`

    const { uploadUrl, publicUrl } = await request('/images/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType: file.type }),
    })

    // PUT directly to GCS — no API key header, only Content-Type
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!res.ok) throw new Error(`GCS upload failed: ${res.status}`)

    return publicUrl
  },
}
