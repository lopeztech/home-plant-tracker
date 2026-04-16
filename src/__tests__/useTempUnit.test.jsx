import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useTempUnit } from '../hooks/useTempUnit.js'

const STORAGE_KEY = 'plantTracker_tempUnit'

describe('useTempUnit', () => {
  let langSpy

  beforeEach(() => {
    localStorage.clear()
    // Default jsdom navigator.language is en-US. Force a deterministic non-US
    // locale so the default-detection branch returns celsius unless a test
    // opts into the other locale explicitly.
    langSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
  })

  afterEach(() => {
    langSpy.mockRestore()
  })

  it('defaults to celsius for non-US locales', () => {
    const { result } = renderHook(() => useTempUnit())
    expect(result.current.unit).toBe('celsius')
    expect(result.current.symbol).toBe('\u00B0C')
  })

  it('defaults to fahrenheit for en-US locale', () => {
    langSpy.mockReturnValue('en-US')
    const { result } = renderHook(() => useTempUnit())
    expect(result.current.unit).toBe('fahrenheit')
    expect(result.current.symbol).toBe('\u00B0F')
  })

  it('defaults to fahrenheit for en-LR and my locales', () => {
    langSpy.mockReturnValue('en-LR')
    const { result: lr } = renderHook(() => useTempUnit())
    expect(lr.current.unit).toBe('fahrenheit')

    langSpy.mockReturnValue('my')
    const { result: my } = renderHook(() => useTempUnit())
    expect(my.current.unit).toBe('fahrenheit')
  })

  it('reads a stored preference over the locale default', () => {
    localStorage.setItem(STORAGE_KEY, 'fahrenheit')
    const { result } = renderHook(() => useTempUnit())
    expect(result.current.unit).toBe('fahrenheit')
  })

  it('ignores unrecognised stored values and falls back to the locale default', () => {
    localStorage.setItem(STORAGE_KEY, 'kelvin')
    const { result } = renderHook(() => useTempUnit())
    expect(result.current.unit).toBe('celsius')
  })

  it('setUnit persists to localStorage and updates the returned unit', () => {
    const { result } = renderHook(() => useTempUnit())

    act(() => result.current.setUnit('fahrenheit'))

    expect(result.current.unit).toBe('fahrenheit')
    expect(result.current.symbol).toBe('\u00B0F')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('fahrenheit')
  })

  it('toggle flips between celsius and fahrenheit', () => {
    const { result } = renderHook(() => useTempUnit())

    act(() => result.current.toggle())
    expect(result.current.unit).toBe('fahrenheit')

    act(() => result.current.toggle())
    expect(result.current.unit).toBe('celsius')
  })

  it('survives navigator access throwing', () => {
    langSpy.mockImplementation(() => { throw new Error('nope') })
    const { result } = renderHook(() => useTempUnit())
    expect(result.current.unit).toBe('celsius')
  })
})
