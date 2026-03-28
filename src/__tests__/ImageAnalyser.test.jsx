import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImageAnalyser from '../components/ImageAnalyser.jsx'

vi.mock('../api/plants.js', () => ({
  analyseApi: { analyse: vi.fn() },
}))

import { analyseApi } from '../api/plants.js'

// jsdom lacks URL.createObjectURL / revokeObjectURL
const fakeUrl = 'blob:http://localhost/fake-image'
globalThis.URL.createObjectURL = vi.fn(() => fakeUrl)
globalThis.URL.revokeObjectURL = vi.fn()

function makeFile(name = 'plant.jpg', type = 'image/jpeg') {
  return new File(['pixels'], name, { type })
}

const analysisResult = {
  species: 'Monstera deliciosa',
  health: 'Good',
  healthReason: 'Healthy leaves with good color',
  maturity: 'Mature',
  frequencyDays: 7,
  recommendations: ['Indirect light', 'Water weekly', 'Mist leaves'],
}

function renderAnalyser(props = {}) {
  return render(
    <ImageAnalyser
      initialImage={props.initialImage ?? null}
      onAnalysisComplete={props.onAnalysisComplete ?? vi.fn()}
      onImageChange={props.onImageChange ?? vi.fn()}
    />
  )
}

describe('ImageAnalyser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analyseApi.analyse.mockResolvedValue(analysisResult)
  })

  // ── Initial render ──────────────────────────────────────────────────────

  it('shows the drop zone when no image is set', () => {
    renderAnalyser()
    expect(screen.getByText('Drop a photo here')).toBeInTheDocument()
  })

  it('shows the image preview when initialImage is set', () => {
    renderAnalyser({ initialImage: 'https://example.com/plant.jpg' })
    expect(screen.getByAltText('Plant')).toBeInTheDocument()
    expect(screen.queryByText('Drop a photo here')).not.toBeInTheDocument()
  })

  // ── File selection ──────────────────────────────────────────────────────

  it('shows image preview after file input change', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })
    expect(screen.getByAltText('Plant')).toBeInTheDocument()
  })

  it('calls onImageChange when a file is selected', () => {
    const onImageChange = vi.fn()
    renderAnalyser({ onImageChange })
    const input = document.querySelector('input[type="file"]')
    const file = makeFile()
    fireEvent.change(input, { target: { files: [file] } })
    expect(onImageChange).toHaveBeenCalledWith(file)
  })

  it('rejects non-image files with error message', () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [textFile] } })
    expect(screen.getByText('Please upload a valid image file.')).toBeInTheDocument()
  })

  it('triggers analysis automatically when a valid file is selected', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })
    await waitFor(() => expect(analyseApi.analyse).toHaveBeenCalled())
  })

  // ── Drag-and-drop ──────────────────────────────────────────────────────

  it('applies active state on drag over', () => {
    renderAnalyser()
    const dropZone = screen.getByText('Drop a photo here').closest('div[class*="border-dashed"]')
    fireEvent.dragOver(dropZone)
    expect(dropZone.className).toContain('border-emerald-500')
  })

  it('removes active state on drag leave', () => {
    renderAnalyser()
    const dropZone = screen.getByText('Drop a photo here').closest('div[class*="border-dashed"]')
    fireEvent.dragOver(dropZone)
    fireEvent.dragLeave(dropZone)
    expect(dropZone.className).not.toContain('border-emerald-500')
  })

  it('shows preview and triggers analysis on drop with valid image', async () => {
    renderAnalyser()
    const dropZone = screen.getByText('Drop a photo here').closest('div[class*="border-dashed"]')
    const file = makeFile()
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })
    expect(screen.getByAltText('Plant')).toBeInTheDocument()
    await waitFor(() => expect(analyseApi.analyse).toHaveBeenCalledWith(file))
  })

  it('rejects non-image file on drop', () => {
    renderAnalyser()
    const dropZone = screen.getByText('Drop a photo here').closest('div[class*="border-dashed"]')
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [textFile] } })
    expect(screen.getByText('Please upload a valid image file.')).toBeInTheDocument()
  })

  // ── Analysis flow ──────────────────────────────────────────────────────

  it('shows loading state with time estimate during analysis', async () => {
    let resolveAnalysis
    analyseApi.analyse.mockReturnValue(new Promise(r => { resolveAnalysis = r }))

    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    expect(screen.getByText('Identifying species…')).toBeInTheDocument()
    expect(screen.getByText(/usually takes/i)).toBeInTheDocument()

    resolveAnalysis(analysisResult)
    await waitFor(() => expect(screen.queryByText(/usually takes/i)).not.toBeInTheDocument())
  })

  it('renders analysis results with badges after success', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Gemini Analysis')).toBeInTheDocument())
    expect(screen.getByText('Monstera deliciosa')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Mature')).toBeInTheDocument()
    expect(screen.getByText('Every 7d')).toBeInTheDocument()
    expect(screen.getByText('Healthy leaves with good color')).toBeInTheDocument()
  })

  it('renders care recommendations', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Care recommendations:')).toBeInTheDocument())
    expect(screen.getByText('Indirect light')).toBeInTheDocument()
    expect(screen.getByText('Water weekly')).toBeInTheDocument()
    expect(screen.getByText('Mist leaves')).toBeInTheDocument()
  })

  it('calls onAnalysisComplete with the result', async () => {
    const onAnalysisComplete = vi.fn()
    renderAnalyser({ onAnalysisComplete })
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(onAnalysisComplete).toHaveBeenCalledWith(analysisResult))
  })

  it('shows error message when analysis fails', async () => {
    analyseApi.analyse.mockRejectedValue(new Error('Network error'))
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
  })

  it('shows error when AI returns incomplete response', async () => {
    analyseApi.analyse.mockResolvedValue({ species: 'Fern' }) // missing health, maturity, frequencyDays
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Incomplete response from AI')).toBeInTheDocument())
  })

  it('shows retry button after an error', async () => {
    analyseApi.analyse.mockRejectedValueOnce(new Error('Timeout'))
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Retry analysis')).toBeInTheDocument())
  })

  it('retries analysis when retry button is clicked', async () => {
    analyseApi.analyse.mockRejectedValueOnce(new Error('Timeout'))
    analyseApi.analyse.mockResolvedValueOnce(analysisResult)

    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Retry analysis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Retry analysis'))

    await waitFor(() => expect(screen.getByText('Gemini Analysis')).toBeInTheDocument())
    expect(analyseApi.analyse).toHaveBeenCalledTimes(2)
  })

  // ── Remove image ──────────────────────────────────────────────────────

  it('clears preview and results when remove button is clicked', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Gemini Analysis')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Remove image'))

    expect(screen.getByText('Drop a photo here')).toBeInTheDocument()
    expect(screen.queryByText('Gemini Analysis')).not.toBeInTheDocument()
  })

  it('calls onImageChange(null) when image is removed', async () => {
    const onImageChange = vi.fn()
    renderAnalyser({ onImageChange })
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Remove image'))

    expect(onImageChange).toHaveBeenLastCalledWith(null)
  })

  it('revokes object URL when image is removed', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByTitle('Remove image')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Remove image'))

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl)
  })

  // ── Re-analyse ────────────────────────────────────────────────────────

  it('shows re-analyse button after successful analysis', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Re-analyse')).toBeInTheDocument())
  })

  it('re-runs analysis when re-analyse is clicked', async () => {
    renderAnalyser()
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile()] } })

    await waitFor(() => expect(screen.getByText('Re-analyse')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Re-analyse'))

    await waitFor(() => expect(analyseApi.analyse).toHaveBeenCalledTimes(2))
  })
})
