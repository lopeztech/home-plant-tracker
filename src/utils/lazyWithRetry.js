import { lazy } from 'react'

// After a new deploy, the user's cached index.html still references old chunk
// filenames (e.g. AnalyticsPage-<hash>.js) that no longer exist on the server,
// so React.lazy() throws "Failed to fetch dynamically imported module" the
// first time that route is navigated to. Reloading fetches a fresh index.html
// and resolves the new hashed chunks; sessionStorage guards against a reload
// loop if the import is genuinely broken.

const RELOAD_KEY = 'plantTracker_chunkReloadAt'
const RELOAD_WINDOW_MS = 10_000

function isChunkLoadError(err) {
  const msg = err && (err.message || String(err)) || ''
  return (
    err?.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

export function lazyWithRetry(importer) {
  return lazy(() =>
    importer().catch((err) => {
      if (!isChunkLoadError(err)) throw err

      const now = Date.now()
      let last = 0
      try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0) } catch {}
      if (now - last < RELOAD_WINDOW_MS) throw err

      try { sessionStorage.setItem(RELOAD_KEY, String(now)) } catch {}
      window.location.reload()
      return new Promise(() => {})
    }),
  )
}
