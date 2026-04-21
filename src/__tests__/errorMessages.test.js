import { describe, it, expect } from 'vitest'
import { toFriendlyError, friendlyErrorMessage } from '../utils/errorMessages.js'

describe('toFriendlyError', () => {
  it('returns offline kind when navigator is offline', () => {
    const result = toFriendlyError(new Error('anything'), { online: false })
    expect(result.kind).toBe('offline')
    expect(result.isRetryable).toBe(true)
    expect(result.title).toMatch(/offline/i)
  })

  it('maps network failures to transient kind', () => {
    const result = toFriendlyError(new Error('Failed to fetch'), { online: true })
    expect(result.kind).toBe('transient')
    expect(result.isRetryable).toBe(true)
    expect(result.title).not.toMatch(/failed to fetch/i)
    expect(result.rawCode).toBe('Failed to fetch')
  })

  it('maps 401 / unauthenticated to auth kind', () => {
    const a = toFriendlyError(new Error('HTTP 401'), { online: true })
    const b = toFriendlyError(new Error('Request unauthenticated'), { online: true })
    expect(a.kind).toBe('auth')
    expect(b.kind).toBe('auth')
    expect(a.isRetryable).toBe(false)
    expect(a.action).toMatch(/sign in/i)
  })

  it('maps 403 / permission denied to permission kind', () => {
    const result = toFriendlyError(new Error('PERMISSION_DENIED'), { online: true })
    expect(result.kind).toBe('permission')
    expect(result.isRetryable).toBe(false)
  })

  it('interpolates the context into permission copy', () => {
    const result = toFriendlyError(new Error('Forbidden'), { context: 'delete this plant', online: true })
    expect(result.message).toMatch(/delete this plant/)
  })

  it('maps 429 / quota / RESOURCE_EXHAUSTED to quota kind', () => {
    const a = toFriendlyError(new Error('HTTP 429 rate limit'), { online: true })
    const b = toFriendlyError(new Error('RESOURCE_EXHAUSTED: quota'), { online: true })
    expect(a.kind).toBe('quota')
    expect(b.kind).toBe('quota')
    expect(a.isRetryable).toBe(true)
  })

  it('maps Gemini overload and 503 to transient', () => {
    const a = toFriendlyError(new Error('model overloaded'), { online: true })
    const b = toFriendlyError(new Error('HTTP 503 Service Unavailable'), { online: true })
    expect(a.kind).toBe('transient')
    expect(b.kind).toBe('transient')
  })

  it('maps 502/504 gateway/timeout to transient', () => {
    const a = toFriendlyError(new Error('HTTP 504 Gateway Timeout'), { online: true })
    const b = toFriendlyError(new Error('request timed out'), { online: true })
    expect(a.kind).toBe('transient')
    expect(b.kind).toBe('transient')
  })

  it('maps generic 5xx to transient', () => {
    const result = toFriendlyError(new Error('HTTP 500 internal server error'), { online: true })
    expect(result.kind).toBe('transient')
    expect(result.isRetryable).toBe(true)
  })

  it('maps Gemini JSON parse errors to transient with recovery copy', () => {
    const result = toFriendlyError(new Error('Object key expected at position 15'), { online: true })
    expect(result.kind).toBe('transient')
    expect(result.title).toMatch(/AI/i)
  })

  it('maps 400-style validation errors to input kind', () => {
    const result = toFriendlyError(new Error('HTTP 400 name is required'), { online: true })
    expect(result.kind).toBe('input')
    expect(result.isRetryable).toBe(false)
  })

  it('maps 404 to input kind with context in copy', () => {
    const result = toFriendlyError(new Error('HTTP 404 not found'), { context: 'plant', online: true })
    expect(result.kind).toBe('input')
    expect(result.message).toMatch(/plant/)
  })

  it('maps GCS upload failures to transient', () => {
    const result = toFriendlyError(new Error('GCS upload failed: 403'), { online: true })
    expect(result.kind).toBe('transient')
    expect(result.action).toMatch(/retry/i)
  })

  it('falls back to unknown for unmatched errors', () => {
    const result = toFriendlyError(new Error('weird novel error'), { online: true })
    expect(result.kind).toBe('unknown')
    expect(result.isRetryable).toBe(true)
    expect(result.rawCode).toBe('weird novel error')
  })

  it('accepts strings and nullish inputs without throwing', () => {
    expect(toFriendlyError('Failed to fetch', { online: true }).kind).toBe('transient')
    expect(toFriendlyError(null, { online: true }).kind).toBe('unknown')
    expect(toFriendlyError(undefined, { online: true }).kind).toBe('unknown')
  })

  it('never surfaces a raw stack trace in the user-facing title/message', () => {
    const stack = 'TypeError: x is not a function\n    at foo (file.js:12:34)'
    const result = toFriendlyError({ message: stack }, { online: true })
    expect(result.title).not.toMatch(/TypeError/)
    expect(result.message).not.toMatch(/at foo/)
  })
})

describe('friendlyErrorMessage', () => {
  it('returns just the friendly message string', () => {
    const result = friendlyErrorMessage(new Error('Failed to fetch'), { online: true })
    expect(typeof result).toBe('string')
    expect(result).toMatch(/connection/i)
  })
})
