import { useState, useRef } from 'react'
import { Modal, Button, Spinner, Alert, Badge } from 'react-bootstrap'
import { analyseApi } from '../api/plants.js'
import { friendlyErrorMessage } from '../utils/errorMessages.js'

/**
 * Camera/photo-first plant identification modal.
 * Calls POST /plants/identify and returns the chosen candidate's careDefaults
 * so the parent can pre-fill a new plant form.
 *
 * Props:
 *   show       – boolean
 *   onHide     – () => void
 *   onIdentified – (candidate) => void  where candidate = { commonName, scientificName, careDefaults, ... }
 */
export default function PlantIdentify({ show, onHide, onIdentified }) {
  const fileRef = useRef(null)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [selected, setSelected] = useState(null)

  function handleFiles(newFiles) {
    const list = Array.from(newFiles).slice(0, 3)
    setFiles(list)
    setPreviews(list.map((f) => URL.createObjectURL(f)))
    setCandidates(null)
    setSelected(null)
    setError(null)
  }

  async function handleIdentify() {
    if (!files.length) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyseApi.identify(files)
      setCandidates(result.candidates || [])
    } catch (err) {
      setError(friendlyErrorMessage(err, { context: 'identifying plant' }))
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(candidate) {
    setSelected(candidate.scientificName)
    onIdentified(candidate)
    handleClose()
  }

  function handleClose() {
    setFiles([])
    setPreviews([])
    setCandidates(null)
    setSelected(null)
    setError(null)
    onHide()
  }

  function confidenceVariant(conf) {
    if (conf >= 0.7) return 'success'
    if (conf >= 0.4) return 'warning'
    return 'secondary'
  }

  return (
    <Modal show={show} onHide={handleClose} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>
          <svg className="sa-icon me-2" style={{ width: 18, height: 18 }}><use href="/icons/sprite.svg#camera" /></svg>
          Identify Plant from Photo
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!candidates ? (
          <>
            <p className="text-muted fs-sm mb-3">
              Take or upload up to 3 photos (leaf, whole plant, flower) for the best identification.
            </p>

            <div
              className="border border-dashed rounded p-4 text-center mb-3"
              style={{ cursor: 'pointer', borderStyle: 'dashed' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
              role="button"
              aria-label="Upload plant photos"
            >
              {previews.length > 0 ? (
                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {previews.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Plant photo ${i + 1}`}
                      style={{ height: 100, width: 100, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <svg className="sa-icon sa-icon-2x text-muted mb-2" style={{ width: 40, height: 40 }}><use href="/icons/sprite.svg#camera" /></svg>
                  <div className="text-muted fs-sm">Click or drag photos here (up to 3)</div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="d-none"
                onChange={(e) => handleFiles(e.target.files)}
                capture="environment"
              />
            </div>

            {error && <Alert variant="danger" className="fs-sm">{error}</Alert>}
          </>
        ) : (
          <>
            <p className="text-muted fs-sm mb-3">Select the best match:</p>
            <div className="d-flex flex-column gap-2">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn text-start border rounded p-3 ${selected === c.scientificName ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                  onClick={() => handleSelect(c)}
                >
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div>
                      <div className="fw-600">{c.commonName}</div>
                      <div className="text-muted fst-italic fs-sm">{c.scientificName}</div>
                      {c.distinguishingFeatures?.length > 0 && (
                        <div className="mt-1">
                          {c.distinguishingFeatures.map((f, j) => (
                            <Badge key={j} bg="secondary" className="me-1 fs-nano fw-400">{f}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge bg={confidenceVariant(c.confidence)} className="flex-shrink-0">
                      {Math.round(c.confidence * 100)}%
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-link text-muted fs-sm mt-2 p-0"
              onClick={() => { setCandidates(null); setFiles([]); setPreviews([]) }}
            >
              ← Try different photos
            </button>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleClose}>
          Skip — enter manually
        </Button>
        {!candidates && (
          <Button
            variant="primary"
            onClick={handleIdentify}
            disabled={!files.length || loading}
          >
            {loading
              ? <><Spinner size="sm" className="me-1" />Identifying…</>
              : <>
                  <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#zap" /></svg>
                  Identify Plant
                </>
            }
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
