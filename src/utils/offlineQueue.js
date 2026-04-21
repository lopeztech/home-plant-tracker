const STORAGE_KEY = 'plant-tracker-offline-queue'
const listeners = new Set()

function safeStorage() {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null
    return globalThis.localStorage
  } catch {
    return null
  }
}

function readRaw() {
  const s = safeStorage()
  if (!s) return []
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(items) {
  const s = safeStorage()
  if (!s) return
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // quota exceeded or storage disabled — silently drop
  }
  notify()
}

function notify() {
  const size = readRaw().length
  for (const fn of listeners) {
    try { fn(size) } catch { /* ignore listener errors */ }
  }
}

export function enqueue(mutation) {
  if (!mutation || !mutation.type) throw new Error('mutation.type required')
  const item = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: new Date().toISOString(),
    type: mutation.type,
    payload: mutation.payload ?? null,
  }
  const items = readRaw()
  items.push(item)
  writeRaw(items)
  return item
}

export function getAll() {
  return readRaw()
}

export function size() {
  return readRaw().length
}

export function remove(id) {
  const items = readRaw().filter((i) => i.id !== id)
  writeRaw(items)
}

export function clear() {
  writeRaw([])
}

export function subscribe(listener) {
  listeners.add(listener)
  try { listener(readRaw().length) } catch { /* ignore */ }
  return () => { listeners.delete(listener) }
}

/**
 * Flush the queue by invoking `executor(item)` for each pending mutation in
 * FIFO order. A successful executor (no throw) removes the item. On the first
 * failure we stop and leave the remaining items intact so a later retry can
 * resume in order.
 *
 * Returns { flushed, remaining, errors } — errors is typically 0 or 1 since
 * we stop on the first failure.
 */
export async function flush(executor) {
  if (typeof executor !== 'function') throw new Error('executor required')
  const items = readRaw()
  let flushed = 0
  const errors = []
  for (const item of items) {
    try {
      await executor(item)
      remove(item.id)
      flushed++
    } catch (err) {
      errors.push({ id: item.id, error: err })
      break
    }
  }
  return { flushed, remaining: readRaw().length, errors: errors.length }
}
