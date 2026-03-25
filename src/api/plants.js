const BASE_URL = import.meta.env.VITE_API_BASE_URL
const API_KEY = import.meta.env.VITE_API_KEY

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  })
  if (res.status === 204) return null
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

export const plantsApi = {
  list: () => request('/plants'),
  create: (data) => request('/plants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/plants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/plants/${id}`, { method: 'DELETE' }),
  getFloorplan: () => request('/config/floorplan'),
  saveFloorplan: (imageUrl) => request('/config/floorplan', { method: 'PUT', body: JSON.stringify({ imageUrl }) }),
}

export const floorsApi = {
  get: () => request('/config/floors'),
  save: (floors) => request('/config/floors', { method: 'PUT', body: JSON.stringify({ floors }) }),
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
