// Run `iterFn` across `items` with at most `limit` promises in flight at
// once. Rejections are captured per-item — one bad item never stops the
// rest — and `onResult` is called as each completes so callers can render
// live progress.

export async function fanOut(items, iterFn, { limit = 3, onResult } = {}) {
  const results = new Array(items.length)
  let cursor = 0
  const size = Math.min(Math.max(1, limit), items.length)

  const worker = async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      try {
        const value = await iterFn(items[i], i)
        results[i] = { ok: true, value }
        onResult?.(i, { ok: true, value })
      } catch (error) {
        results[i] = { ok: false, error }
        onResult?.(i, { ok: false, error })
      }
    }
  }

  await Promise.all(Array.from({ length: size }, worker))
  return results
}
