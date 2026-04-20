import { describe, it, expect, vi } from 'vitest'
import { fanOut } from '../utils/concurrency.js'

describe('fanOut', () => {
  it('runs every item through the task fn', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await fanOut(items, async (n) => n * 2, { limit: 2 })
    expect(results.map((r) => r.value)).toEqual([2, 4, 6, 8, 10])
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('preserves result order even when tasks finish out of order', async () => {
    const items = [50, 10, 30, 5]
    const results = await fanOut(items, async (ms) => {
      await new Promise((res) => setTimeout(res, ms))
      return ms
    }, { limit: 3 })
    expect(results.map((r) => r.value)).toEqual([50, 10, 30, 5])
  })

  it('never runs more than `limit` tasks in flight at once', async () => {
    let inFlight = 0
    let peak = 0
    const items = Array.from({ length: 10 }, (_, i) => i)
    await fanOut(items, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((res) => setTimeout(res, 10))
      inFlight--
    }, { limit: 3 })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('captures a rejected task without stopping the rest', async () => {
    const items = ['a', 'b', 'c', 'd']
    const results = await fanOut(items, async (x) => {
      if (x === 'b') throw new Error('bad')
      return x.toUpperCase()
    }, { limit: 2 })
    expect(results[0]).toEqual({ ok: true, value: 'A' })
    expect(results[1].ok).toBe(false)
    expect(results[1].error.message).toBe('bad')
    expect(results[2]).toEqual({ ok: true, value: 'C' })
    expect(results[3]).toEqual({ ok: true, value: 'D' })
  })

  it('emits onResult for every item in completion order', async () => {
    const items = [20, 5, 15]
    const onResult = vi.fn()
    await fanOut(items, async (ms) => {
      await new Promise((res) => setTimeout(res, ms))
      return ms
    }, { limit: 3, onResult })
    expect(onResult).toHaveBeenCalledTimes(3)
    const indicesInCallOrder = onResult.mock.calls.map((c) => c[0])
    // The 5ms task (index 1) completes first
    expect(indicesInCallOrder[0]).toBe(1)
  })

  it('handles an empty items array without throwing', async () => {
    const results = await fanOut([], async () => 'x', { limit: 4 })
    expect(results).toEqual([])
  })
})
