import { useState, useCallback, useRef } from 'react'
import { Modal, Button, Table, Alert, Badge, ProgressBar, Form } from 'react-bootstrap'
import Papa from 'papaparse'
import { importApi } from '../api/plants.js'

const EXPECTED_HEADERS = ['name', 'species', 'room', 'floor', 'health', 'frequencyDays', 'potSize', 'soilType', 'notes']
const REQUIRED_HEADERS = ['name']

const HEADER_ALIASES = {
  name: ['name', 'plant name', 'plant'],
  species: ['species', 'type'],
  room: ['room', 'location'],
  floor: ['floor', 'level'],
  health: ['health', 'condition'],
  frequencyDays: ['frequencydays', 'frequency days', 'frequency', 'water every'],
  potSize: ['potsize', 'pot size'],
  soilType: ['soiltype', 'soil type'],
  notes: ['notes', 'note', 'comments'],
}

function fuzzyMatch(header) {
  const norm = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) return field
  }
  return header
}

export default function CsvImportModal({ show, onHide, onImported }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const reset = useCallback(() => {
    setPreview(null)
    setFile(null)
    setResult(null)
    setError(null)
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onHide()
  }, [reset, onHide])

  const parseFileForPreview = useCallback((f) => {
    setError(null)
    setResult(null)
    setFile(f)

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
        if (rows.length === 0) {
          setError('File is empty or has no data rows.')
          setPreview(null)
          return
        }
        const rawHeaders = results.meta.fields || []
        const mappedHeaders = rawHeaders.map(h => ({ raw: h, field: fuzzyMatch(h) }))
        const missingRequired = REQUIRED_HEADERS.filter(r =>
          !mappedHeaders.some(m => m.field === r)
        )
        setPreview({ rows: rows.slice(0, 10), rawHeaders, mappedHeaders, total: rows.length, missingRequired })
      },
      error: () => {
        setError('Could not parse the file. Make sure it is a valid CSV.')
        setPreview(null)
      },
    })
  }, [])

  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Only .csv and .xlsx/.xls files are supported.')
      return
    }
    if (ext === 'csv') {
      parseFileForPreview(f)
    } else {
      // XLSX — can't preview without SheetJS, just show filename and trust backend
      setFile(f)
      setPreview({ rows: [], rawHeaders: [], mappedHeaders: [], total: '?', missingRequired: [] })
      setError(null)
    }
  }, [parseFileForPreview])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleFileInput = useCallback((e) => {
    const f = e.target.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleImport = useCallback(async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const res = await importApi.importPlants(file)
      setResult(res)
      if (onImported) onImported(res)
    } catch (err) {
      setError(err.message || 'Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }, [file, onImported])

  const canImport = file && preview && preview.missingRequired.length === 0 && !importing && !result

  return (
    <Modal show={show} onHide={handleClose} size="lg" aria-labelledby="csv-import-modal-title">
      <Modal.Header closeButton>
        <Modal.Title id="csv-import-modal-title">Import Plants from CSV / Excel</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Template download */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <small className="text-muted">
            Columns: <code>{EXPECTED_HEADERS.join(', ')}</code>. Only <strong>name</strong> is required.
          </small>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => importApi.downloadTemplate()}
            data-testid="download-template-btn"
          >
            <svg className="sa-icon me-1"><use href="/icons/sprite.svg#download"></use></svg>
            Download template
          </Button>
        </div>

        {/* Drop zone */}
        {!result && (
          <div
            data-testid="drop-zone"
            className={`border rounded p-4 text-center mb-3 ${isDragging ? 'bg-primary bg-opacity-10 border-primary' : 'border-dashed'}`}
            style={{ cursor: 'pointer', minHeight: 100 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div>
                <svg className="sa-icon sa-icon-2x mb-2 text-success"><use href="/icons/sprite.svg#file-text"></use></svg>
                <p className="mb-0"><strong>{file.name}</strong></p>
                {preview && preview.total !== '?' && (
                  <small className="text-muted">{preview.total} row{preview.total !== 1 ? 's' : ''} detected</small>
                )}
              </div>
            ) : (
              <div>
                <svg className="sa-icon sa-icon-2x mb-2 text-muted"><use href="/icons/sprite.svg#upload"></use></svg>
                <p className="mb-1 fw-semibold">Drop a CSV or Excel file here</p>
                <small className="text-muted">or click to browse</small>
              </div>
            )}
            <Form.Control
              type="file"
              accept=".csv,.xlsx,.xls"
              ref={fileInputRef}
              onChange={handleFileInput}
              style={{ display: 'none' }}
              data-testid="file-input"
            />
          </div>
        )}

        {/* Error */}
        {error && <Alert variant="danger" data-testid="import-error">{error}</Alert>}

        {/* Missing required header warning */}
        {preview && preview.missingRequired.length > 0 && (
          <Alert variant="warning" data-testid="missing-headers-alert">
            Missing required column{preview.missingRequired.length > 1 ? 's' : ''}: <strong>{preview.missingRequired.join(', ')}</strong>.
            Please add the column to your file and re-upload.
          </Alert>
        )}

        {/* Preview table */}
        {preview && preview.rows.length > 0 && !result && (
          <div data-testid="preview-table">
            <h6 className="mb-2">Preview (first {preview.rows.length} of {preview.total} rows)</h6>
            <div style={{ overflowX: 'auto' }}>
              <Table bordered size="sm" className="small">
                <thead>
                  <tr>
                    {preview.mappedHeaders.map((h) => (
                      <th key={h.raw}>
                        {h.field !== h.raw ? (
                          <span title={`Mapped from "${h.raw}"`}>{h.field}</span>
                        ) : h.field}
                        {REQUIRED_HEADERS.includes(h.field) && (
                          <Badge bg="danger" className="ms-1" style={{ fontSize: '0.6rem' }}>req</Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.rawHeaders.map(h => (
                        <td key={h} className="text-truncate" style={{ maxWidth: 140 }}>{row[h] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {/* Importing progress */}
        {importing && (
          <div className="text-center py-3" data-testid="importing-indicator">
            <ProgressBar animated now={100} className="mb-2" />
            <small className="text-muted">Importing plants…</small>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div data-testid="import-result">
            <Alert variant={result.errors.length > 0 ? 'warning' : 'success'}>
              <strong>{result.imported} plant{result.imported !== 1 ? 's' : ''} imported</strong>
              {result.skipped > 0 && `, ${result.skipped} skipped`}
            </Alert>
            {result.errors.length > 0 && (
              <div>
                <h6>Row errors</h6>
                <ul className="list-unstyled small">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-danger">Row {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!canImport}
            data-testid="import-btn"
          >
            {importing ? 'Importing…' : `Import${preview ? ` ${preview.total !== '?' ? preview.total : ''} plants` : ''}`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
