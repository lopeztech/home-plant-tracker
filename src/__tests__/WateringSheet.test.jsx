import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import WateringSheet from '../components/WateringSheet.jsx'

const plant = { id: 'p1', name: 'Monstera' }

describe('WateringSheet', () => {
  it('renders when show=true', () => {
    render(<WateringSheet plant={plant} show onHide={vi.fn()} onLog={vi.fn()} />)
    expect(screen.getByText(/Water Monstera/)).toBeTruthy()
  })

  it('does not render when show=false', () => {
    render(<WateringSheet plant={plant} show={false} onHide={vi.fn()} onLog={vi.fn()} />)
    expect(screen.queryByText(/Water Monstera/)).toBeNull()
  })

  it('calls onLog with metadata when Log watering is clicked', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    const onHide = vi.fn()
    render(<WateringSheet plant={plant} show onHide={onHide} onLog={onLog} />)

    // Select method
    fireEvent.click(screen.getByText('Top water'))
    // Select soil state
    fireEvent.click(screen.getByText('Dry'))
    // Set volume
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 250/), { target: { value: '300' } })

    fireEvent.click(screen.getByText('Log watering'))

    await waitFor(() => {
      expect(onLog).toHaveBeenCalledWith('p1', {
        volumeMl: 300,
        method: 'top',
        soilBefore: 'dry',
      })
    })
  })

  it('calls onLog with empty metadata when no options selected', async () => {
    const onLog = vi.fn().mockResolvedValue(undefined)
    render(<WateringSheet plant={plant} show onHide={vi.fn()} onLog={onLog} />)
    fireEvent.click(screen.getByText('Log watering'))
    await waitFor(() => {
      expect(onLog).toHaveBeenCalledWith('p1', {})
    })
  })

  it('calls onHide when Cancel is clicked', () => {
    const onHide = vi.fn()
    render(<WateringSheet plant={plant} show onHide={onHide} onLog={vi.fn()} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onHide).toHaveBeenCalled()
  })

  it('shows drained-cleanly toggle when method is set to top', () => {
    render(<WateringSheet plant={plant} show onHide={vi.fn()} onLog={vi.fn()} />)
    expect(screen.queryByText('Drained cleanly?')).toBeNull()
    fireEvent.click(screen.getByText('Top water'))
    expect(screen.getByText('Drained cleanly?')).toBeTruthy()
  })

  it('does not show drained-cleanly for mist method', () => {
    render(<WateringSheet plant={plant} show onHide={vi.fn()} onLog={vi.fn()} />)
    fireEvent.click(screen.getByText('Mist'))
    expect(screen.queryByText('Drained cleanly?')).toBeNull()
  })
})
