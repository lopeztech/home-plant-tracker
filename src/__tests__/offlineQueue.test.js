import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueue,
  getAll,
  size,
  remove,
  clear,
  subscribe,
  flush,
} from '../utils/offlineQueue.js'

describe('offlineQueue', () => {
  beforeEach(() => {
    clear()
  })

  it('enqueue adds mutation with id and enqueuedAt', () => {
    const item = enqueue({ type: 'water', payload: { id: 'p1' } })
    expect(item.id).toBeTruthy()
    expect(item.enqueuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(item.type).toBe('water')
    expect(item.payload).toEqual({ id: 'p1' })
    expect(size()).toBe(1)
  })

  it('enqueue throws when mutation.type is missing', () => {
    expect(() => enqueue({})).toThrow(/type required/)
  })

  it('getAll returns items in FIFO order', () => {
    enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })
    enqueue({ type: 'moisture', payload: { id: 'c', reading: 5 } })
    const all = getAll()
    expect(all).toHaveLength(3)
    expect(all.map((i) => i.payload.id)).toEqual(['a', 'b', 'c'])
  })

  it('remove deletes an item by id', () => {
    const a = enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })
    remove(a.id)
    const ids = getAll().map((i) => i.payload.id)
    expect(ids).toEqual(['b'])
  })

  it('clear empties the queue', () => {
    enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })
    clear()
    expect(size()).toBe(0)
  })

  it('subscribe emits current size and on every change', () => {
    const listener = vi.fn()
    const unsub = subscribe(listener)
    expect(listener).toHaveBeenLastCalledWith(0)
    enqueue({ type: 'water', payload: { id: 'a' } })
    expect(listener).toHaveBeenLastCalledWith(1)
    enqueue({ type: 'water', payload: { id: 'b' } })
    expect(listener).toHaveBeenLastCalledWith(2)
    unsub()
    enqueue({ type: 'water', payload: { id: 'c' } })
    expect(listener).toHaveBeenLastCalledWith(2) // no further calls after unsub
  })

  // ── flush() behaviour ──────────────────────────────────────────────────────

  it('flush replays items in FIFO order and removes each on success', async () => {
    enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })
    enqueue({ type: 'water', payload: { id: 'c' } })

    const seen = []
    const executor = vi.fn(async (item) => { seen.push(item.payload.id) })

    const result = await flush(executor)
    expect(seen).toEqual(['a', 'b', 'c'])
    expect(result).toEqual({ flushed: 3, remaining: 0, errors: 0 })
    expect(size()).toBe(0)
  })

  it('flush stops at the first failure and leaves remaining items', async () => {
    enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })
    enqueue({ type: 'water', payload: { id: 'c' } })

    const executor = vi.fn(async (item) => {
      if (item.payload.id === 'b') throw new Error('network error')
    })

    const result = await flush(executor)
    expect(executor).toHaveBeenCalledTimes(2)
    expect(result.flushed).toBe(1)
    expect(result.remaining).toBe(2)
    expect(result.errors).toBe(1)

    // 'a' removed, 'b' and 'c' still queued in order
    const ids = getAll().map((i) => i.payload.id)
    expect(ids).toEqual(['b', 'c'])
  })

  it('flush throws when executor is not a function', async () => {
    await expect(flush(null)).rejects.toThrow(/executor required/)
  })

  it('flush on an empty queue returns zero counts', async () => {
    const executor = vi.fn()
    const result = await flush(executor)
    expect(executor).not.toHaveBeenCalled()
    expect(result).toEqual({ flushed: 0, remaining: 0, errors: 0 })
  })

  it('flush can resume after failure on a subsequent retry', async () => {
    enqueue({ type: 'water', payload: { id: 'a' } })
    enqueue({ type: 'water', payload: { id: 'b' } })

    let fail = true
    const executor = vi.fn(async () => {
      if (fail) { fail = false; throw new Error('first attempt fails') }
    })

    const first = await flush(executor)
    expect(first.flushed).toBe(0)
    expect(first.remaining).toBe(2)

    const second = await flush(executor)
    expect(second.flushed).toBe(2)
    expect(second.remaining).toBe(0)
  })
})
