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
}
