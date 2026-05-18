import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { Suspense } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { lazyWithRetry } from '../utils/lazyWithRetry.js'

class Catch extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() { return this.state.err ? <div>caught</div> : this.props.children }
}

const RELOAD_KEY = 'plantTracker_chunkReloadAt'

beforeEach(() => {
  sessionStorage.clear()
  // jsdom location.reload isn't writable by default — replace it.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  })
})

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function Boom({ children }) {
  return <Suspense fallback={<div>loading</div>}>{children}</Suspense>
}

describe('lazyWithRetry', () => {
  it('renders the imported component on success', async () => {
    const Lazy = lazyWithRetry(() =>
      Promise.resolve({ default: () => <div>OK</div> }),
    )
    render(<Boom><Lazy /></Boom>)
    await waitFor(() => expect(screen.getByText('OK')).toBeInTheDocument())
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('reloads the page when a chunk fails to fetch (stale deploy)', async () => {
    const Lazy = lazyWithRetry(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/Foo.js')),
    )
    render(<Boom><Lazy /></Boom>)
    await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeTruthy()
  })

  it('does not reload twice in quick succession (guards against loops)', async () => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    const Lazy = lazyWithRetry(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    )
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Catch><Boom><Lazy /></Boom></Catch>)
    await waitFor(() => expect(screen.getByText('caught')).toBeInTheDocument())
    expect(window.location.reload).not.toHaveBeenCalled()
    consoleErr.mockRestore()
  })

  it('rethrows non-chunk errors without reloading', async () => {
    const Lazy = lazyWithRetry(() =>
      Promise.reject(new Error('boom: not a chunk problem')),
    )
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Catch><Boom><Lazy /></Boom></Catch>)
    await waitFor(() => expect(screen.getByText('caught')).toBeInTheDocument())
    expect(window.location.reload).not.toHaveBeenCalled()
    consoleErr.mockRestore()
  })
})
