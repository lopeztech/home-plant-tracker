import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ImageAnalyser from '../components/ImageAnalyser.jsx'

const mockAnalyse = vi.fn()
const mockAnalyseWithHint = vi.fn()

vi.mock('../api/plants.js', () => ({
  analyseApi: {
    analyse: (...args) => mockAnalyse(...args),
    analyseWithHint: (...args) => mockAnalyseWithHint(...args),
  },
}))

const analysisResult = {
  species: 'Monstera deliciosa',
  frequencyDays: 7,
  health: 'Good',
  healthReason: 'Healthy green leaves',
  maturity: 'Mature',
  recommendations: ['Indirect light', 'Water weekly', 'Wipe leaves'],
  waterAmount: '250ml',
  waterMethod: 'jug',
}

function createFile(name = 'plant.jpg', type = 'image/jpeg') {
  return new File(['fake-image'], name, { type })
}

describe('ImageAnalyser', () => {
  let onAnalysisComplete, onImageChange

  beforeEach(() => {
    vi.clearAllMocks()
    onAnalysisComplete = vi.fn()
    onImageChange = vi.fn()
    // Default: analysis succeeds
    mockAnalyse.mockResolvedValue(analysisResult)
    mockAnalyseWithHint.mockResolvedValue(analysisResult)
    // URL.createObjectURL not available in jsdom
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('renders the drop zone initially', () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    expect(screen.getByText(/drop a photo here/i)).toBeInTheDocument()
  })

  it('shows image preview and runs analysis after file selection', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })
    expect(onImageChange).toHaveBeenCalledWith(expect.any(File))
    await waitFor(() => expect(mockAnalyse).toHaveBeenCalled())
    await waitFor(() => expect(onAnalysisComplete).toHaveBeenCalledWith(analysisResult))
  })

  it('displays species, health, and maturity badges after analysis', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })
    await waitFor(() => expect(screen.getByText('Monstera deliciosa')).toBeInTheDocument())
    expect(screen.getByText(/health: good/i)).toBeInTheDocument()
    expect(screen.getByText(/maturity: mature/i)).toBeInTheDocument()
  })

  it('shows "Not right? Suggest species" link after analysis', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })
    await waitFor(() => expect(screen.getByText(/not right/i)).toBeInTheDocument())
  })

  it('shows species hint input when "Not right?" is clicked', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })
    await waitFor(() => screen.getByText(/not right/i))
    fireEvent.click(screen.getByText(/not right/i))
    expect(screen.getByPlaceholderText(/monstera/i)).toBeInTheDocument()
  })

  it('calls analyseWithHint when user submits a species correction', async () => {
    const correctedResult = { ...analysisResult, species: 'Peace Lily (Spathiphyllum)' }
    mockAnalyseWithHint.mockResolvedValue(correctedResult)

    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const fileInput = document.querySelector('input[type="file"]')
    fireEvent.change(fileInput, { target: { files: [createFile()] } })

    await waitFor(() => screen.getByText(/not right/i))
    fireEvent.click(screen.getByText(/not right/i))

    const hintInput = screen.getByPlaceholderText(/monstera/i)
    fireEvent.change(hintInput, { target: { value: 'Peace Lily' } })
    // Click the Re-analyse button inside the input group (primary variant)
    const reanalyseBtns = screen.getAllByRole('button', { name: /re-analyse/i })
    fireEvent.click(reanalyseBtns[reanalyseBtns.length - 1])

    await waitFor(() => expect(mockAnalyseWithHint).toHaveBeenCalledWith(expect.any(File), 'Peace Lily'))
    await waitFor(() => expect(screen.getByText('Peace Lily (Spathiphyllum)')).toBeInTheDocument())
  })

  it('submits species hint on Enter key', async () => {
    mockAnalyseWithHint.mockResolvedValue({ ...analysisResult, species: 'Ficus lyrata' })

    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const fileInput = document.querySelector('input[type="file"]')
    fireEvent.change(fileInput, { target: { files: [createFile()] } })

    await waitFor(() => screen.getByText(/not right/i))
    fireEvent.click(screen.getByText(/not right/i))

    const hintInput = screen.getByPlaceholderText(/monstera/i)
    fireEvent.change(hintInput, { target: { value: 'Fiddle Leaf Fig' } })
    fireEvent.keyDown(hintInput, { key: 'Enter' })

    await waitFor(() => expect(mockAnalyseWithHint).toHaveBeenCalledWith(expect.any(File), 'Fiddle Leaf Fig'))
  })

  it('disables Re-analyse button in hint input when hint is empty', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const fileInput = document.querySelector('input[type="file"]')
    fireEvent.change(fileInput, { target: { files: [createFile()] } })

    await waitFor(() => screen.getByText(/not right/i))
    fireEvent.click(screen.getByText(/not right/i))

    // The hint input Re-analyse button (primary variant) should be disabled
    const reanalyseBtns = screen.getAllByRole('button', { name: /re-analyse/i })
    expect(reanalyseBtns[reanalyseBtns.length - 1]).toBeDisabled()
  })

  it('shows error and retry button when analysis fails', async () => {
    mockAnalyse.mockRejectedValue(new Error('Network error'))

    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('clears state when image is removed', async () => {
    render(<ImageAnalyser onAnalysisComplete={onAnalysisComplete} onImageChange={onImageChange} />)
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [createFile()] } })

    await waitFor(() => screen.getByText('Monstera deliciosa'))

    // Click the X remove button
    const removeBtn = screen.getByRole('button', { name: '' })
    fireEvent.click(removeBtn)

    expect(screen.getByText(/drop a photo here/i)).toBeInTheDocument()
    expect(onImageChange).toHaveBeenLastCalledWith(null)
  })
})
