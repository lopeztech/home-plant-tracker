import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/plants.js', () => ({
  importApi: {
    importPlants: vi.fn(),
    downloadTemplate: vi.fn(),
  },
}))

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file, options) => {
      options.complete({
        data: [
          { name: 'Monstera', species: 'Monstera deliciosa', room: 'Living Room', health: 'Good', frequencyDays: '7' },
          { name: 'Fern', species: 'Nephrolepis', room: 'Bathroom', health: 'Excellent', frequencyDays: '5' },
        ],
        meta: { fields: ['name', 'species', 'room', 'health', 'frequencyDays'] },
        errors: [],
      })
    }),
  },
}))

import { importApi } from '../api/plants.js'
import Papa from 'papaparse'
import CsvImportModal from '../components/CsvImportModal.jsx'

const DEFAULT_PROPS = {
  show: true,
  onHide: vi.fn(),
  onImported: vi.fn(),
}

function makeCsvFile(name = 'plants.csv') {
  return new File(['name,species\nMonstera,Monstera deliciosa'], name, { type: 'text/csv' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CsvImportModal', () => {
  it('renders the modal with title and template download button', () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    expect(screen.getByText('Import Plants from CSV / Excel')).toBeInTheDocument()
    expect(screen.getByTestId('download-template-btn')).toBeInTheDocument()
  })

  it('calls downloadTemplate when template button is clicked', () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByTestId('download-template-btn'))
    expect(importApi.downloadTemplate).toHaveBeenCalledOnce()
  })

  it('renders the drop zone initially', () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument()
    expect(screen.getByText(/Drop a CSV or Excel file/)).toBeInTheDocument()
  })

  it('import button is disabled initially', () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('import-btn')).toBeDisabled()
  })

  it('shows preview table after CSV file is selected', async () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('preview-table')).toBeInTheDocument())
    expect(Papa.parse).toHaveBeenCalled()
  })

  it('enables import button after valid CSV is loaded', async () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())
  })

  it('shows error for unsupported file type', async () => {
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    const pdfFile = new File(['...'], 'plants.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdfFile] } })
    await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument())
    expect(screen.getByText(/Only .csv and .xlsx/)).toBeInTheDocument()
  })

  it('shows missing header warning when name column is absent', async () => {
    Papa.parse.mockImplementationOnce((file, options) => {
      options.complete({
        data: [{ color: 'green', size: 'small' }],
        meta: { fields: ['color', 'size'] },
        errors: [],
      })
    })
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('missing-headers-alert')).toBeInTheDocument())
    expect(screen.getByTestId('missing-headers-alert')).toBeInTheDocument()
  })

  it('calls importApi.importPlants and shows result on success', async () => {
    importApi.importPlants.mockResolvedValue({ imported: 2, skipped: 0, errors: [] })
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())

    fireEvent.click(screen.getByTestId('import-btn'))
    await waitFor(() => expect(screen.getByTestId('import-result')).toBeInTheDocument())
    expect(screen.getByText(/2 plants imported/)).toBeInTheDocument()
    expect(importApi.importPlants).toHaveBeenCalledOnce()
  })

  it('calls onImported callback after successful import', async () => {
    importApi.importPlants.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    const onImported = vi.fn()
    render(<CsvImportModal {...DEFAULT_PROPS} onImported={onImported} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('import-btn'))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
  })

  it('shows error when importApi throws', async () => {
    importApi.importPlants.mockRejectedValue(new Error('Server error'))
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('import-btn'))
    await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument())
    expect(screen.getByText('Server error')).toBeInTheDocument()
  })

  it('shows row errors in result summary', async () => {
    importApi.importPlants.mockResolvedValue({
      imported: 1,
      skipped: 1,
      errors: [{ row: 2, reason: 'Invalid health value "Amazing"' }],
    })
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('import-btn'))
    await waitFor(() => expect(screen.getByTestId('import-result')).toBeInTheDocument())
    expect(screen.getByText(/Row 2: Invalid health value/)).toBeInTheDocument()
  })

  it('shows Close button after successful import (not Cancel)', async () => {
    importApi.importPlants.mockResolvedValue({ imported: 1, skipped: 0, errors: [] })
    render(<CsvImportModal {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [makeCsvFile()] } })
    await waitFor(() => expect(screen.getByTestId('import-btn')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('import-btn'))
    await waitFor(() => expect(screen.getByText('Close')).toBeInTheDocument())
    // Import button should be gone after success
    expect(screen.queryByTestId('import-btn')).not.toBeInTheDocument()
  })

  it('calls onHide when Cancel/Close is clicked', async () => {
    const onHide = vi.fn()
    render(<CsvImportModal {...DEFAULT_PROPS} onHide={onHide} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onHide).toHaveBeenCalled()
  })
})
