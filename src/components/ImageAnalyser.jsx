import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Card, Spinner, Alert, Badge, Form, InputGroup } from 'react-bootstrap'
import { analyseApi } from '../api/plants.js'

const ANALYSIS_STAGES = [
  'Identifying plant species...',
  'Assessing plant health...',
  'Evaluating maturity...',
  'Calculating care schedule...',
]

const HEALTH_COLORS = {
  Excellent: 'success', Good: 'success', Fair: 'warning', Poor: 'danger',
}

const MATURITY_COLORS = {
  Seedling: 'info', Young: 'info', Mature: 'primary', Established: 'primary',
}

export default function ImageAnalyser({ initialImage, onAnalysisComplete, onImageChange }) {
  const [previewSrc, setPreviewSrc] = useState(initialImage || null)
  const [imageFile, setImageFile] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [stageIndex, setStageIndex] = useState(0)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showSpeciesHint, setShowSpeciesHint] = useState(false)
  const [speciesHint, setSpeciesHint] = useState('')
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }, [])

  useEffect(() => {
    if (!isAnalysing) { setStageIndex(0); return }
    const interval = setInterval(() => setStageIndex((i) => (i + 1) % ANALYSIS_STAGES.length), 3000)
    return () => clearInterval(interval)
  }, [isAnalysing])

  const processFile = useCallback((file) => {
    if (!file?.type.startsWith('image/')) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPreviewSrc(url)
    setImageFile(file)
    setError(null)
    setAnalysisResult(null)
    setShowSpeciesHint(false)
    setSpeciesHint('')
    onImageChange(file)
    runAnalysis(file)
  }, [onImageChange])

  const runAnalysis = useCallback(async (file, hint) => {
    setIsAnalysing(true); setError(null)
    try {
      const result = hint
        ? await analyseApi.analyseWithHint(file, hint)
        : await analyseApi.analyse(file)
      setAnalysisResult(result)
      onAnalysisComplete(result)
      setShowSpeciesHint(false)
      setSpeciesHint('')
    } catch (err) { setError(err.message) }
    finally { setIsAnalysing(false) }
  }, [onAnalysisComplete])

  const handleRemoveImage = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setPreviewSrc(null); setImageFile(null); setAnalysisResult(null); setError(null)
    setShowSpeciesHint(false); setSpeciesHint('')
    onImageChange(null)
  }

  const handleReanalyse = () => { if (imageFile) runAnalysis(imageFile) }

  const handleSubmitHint = () => {
    if (imageFile && speciesHint.trim()) runAnalysis(imageFile, speciesHint.trim())
  }

  return (
    <div>
      <Form.Label className="text-muted text-uppercase fs-xs fw-600 d-block mb-2">Plant Photo</Form.Label>
      {!previewSrc ? (
        <div
          className={`border border-2 border-dashed rounded p-4 text-center cursor-pointer ${isDragging ? 'border-primary bg-primary bg-opacity-10' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
        >
          <svg className="sa-icon sa-icon-2x text-muted mb-2"><use href="/icons/sprite.svg#camera"></use></svg>
          <p className="mb-0 fs-sm">Drop a photo here or click to browse</p>
          <small className="text-muted">AI will analyse automatically</small>
          <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={(e) => processFile(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="position-relative rounded overflow-hidden border">
          <img src={previewSrc} alt="Plant" className="w-100" style={{ height: 160, objectFit: 'contain' }} />
          <Button variant="dark" size="sm" className="position-absolute top-0 end-0 m-1 rounded-circle p-0" style={{ width: 24, height: 24 }} onClick={handleRemoveImage}>
            <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#x"></use></svg>
          </Button>
          {isAnalysing && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="text-center">
                <Spinner size="sm" variant="primary" className="mb-1" />
                <p className="text-white fs-xs mb-0">{ANALYSIS_STAGES[stageIndex]}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mt-2 fs-sm py-2">
          {error}
          {imageFile && <Button variant="link" size="sm" className="p-0 ms-2 text-danger" onClick={handleReanalyse}>Retry</Button>}
        </Alert>
      )}

      {analysisResult && (
        <Card className="mt-2">
          <Card.Body className="py-2">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="d-flex align-items-center gap-1 fs-xs fw-600 text-primary text-uppercase">
                <svg className="sa-icon" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#zap"></use></svg>
                Gemini Analysis
              </span>
              <Button variant="link" size="sm" className="p-0 fs-xs text-muted" onClick={handleReanalyse}>Re-analyse</Button>
            </div>
            {analysisResult.species && (
              <div className="mb-2">
                <p className="fw-500 fs-sm mb-1">{analysisResult.species}</p>
                {!showSpeciesHint && !isAnalysing && (
                  <Button variant="link" size="sm" className="p-0 fs-xs text-muted" onClick={() => setShowSpeciesHint(true)}>
                    Not right? Suggest species
                  </Button>
                )}
              </div>
            )}
            {showSpeciesHint && (
              <InputGroup size="sm" className="mb-2">
                <Form.Control
                  placeholder="e.g. Monstera, Peace Lily..."
                  value={speciesHint}
                  onChange={(e) => setSpeciesHint(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitHint() }}
                  disabled={isAnalysing}
                />
                <Button variant="primary" onClick={handleSubmitHint} disabled={!speciesHint.trim() || isAnalysing}>
                  {isAnalysing ? <Spinner size="sm" /> : 'Re-analyse'}
                </Button>
              </InputGroup>
            )}
            <div className="d-flex flex-wrap gap-2">
              {analysisResult.health && <Badge bg={HEALTH_COLORS[analysisResult.health] || 'secondary'}>Health: {analysisResult.health}</Badge>}
              {analysisResult.maturity && <Badge bg={MATURITY_COLORS[analysisResult.maturity] || 'secondary'}>Maturity: {analysisResult.maturity}</Badge>}
              {analysisResult.frequencyDays && <Badge bg="info">Every {analysisResult.frequencyDays}d</Badge>}
              {analysisResult.waterAmount && <Badge bg="primary">💧 {analysisResult.waterAmount}</Badge>}
              {analysisResult.waterMethod && <Badge bg="secondary">{analysisResult.waterMethod}</Badge>}
            </div>
            {analysisResult.healthReason && <p className="text-muted fs-xs mt-2 mb-0">{analysisResult.healthReason}</p>}
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

