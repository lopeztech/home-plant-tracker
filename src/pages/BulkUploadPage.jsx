import { useState, useCallback, useRef, useEffect } from 'react'
import { Button, Row, Col, Badge, ProgressBar, Form } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { analyseApi, imagesApi } from '../api/plants.js'
import BulkPlantCard from '../components/BulkPlantCard.jsx'

const CONCURRENCY = 3

function getRoomsFromFloors(floors) {
  const rooms = []
  for (const floor of (floors || [])) {
    for (const room of (floor.rooms || [])) {
      if (room.name && !rooms.includes(room.name)) rooms.push(room.name)
    }
  }
  return rooms.length > 0 ? rooms : ['Living Room', 'Kitchen', 'Bedroom', 'Other']
}

async function withConcurrency(items, fn, limit) {
  const results = []
  const executing = new Set()
  for (const item of items) {
    const p = fn(item).then(
      (val) => { executing.delete(p); return { status: 'fulfilled', value: val } },
      (err) => { executing.delete(p); return { status: 'rejected', reason: err } },
    )
    executing.add(p)
    results.push(p)
    if (executing.size >= limit) await Promise.race(executing)
  }
  return Promise.all(results)
}

export default function BulkUploadPage() {
  const { floors, activeFloorId, handleBulkCreatePlants } = usePlantContext()
  const [entries, setEntries] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadHint, setUploadHint] = useState('')
  const fileInputRef = useRef(null)
  const stageTimerRef = useRef(null)

  const rooms = getRoomsFromFloors(floors)
  const defaultFloor = activeFloorId || floors?.[0]?.id || ''
  // Use rooms from active floor so bulk uploads default to a room on the current floor
  const activeFloorRooms = defaultFloor
    ? (floors.find((f) => f.id === defaultFloor)?.rooms || []).map((r) => r.name).filter(Boolean)
    : rooms
  const defaultRoom = activeFloorRooms[0] || rooms[0] || ''

  // Rotate analysis stage text for entries being analysed
  useEffect(() => {
    const analysing = entries.some((e) => e.status === 'analysing')
    if (!analysing) return
    stageTimerRef.current = setInterval(() => {
      setEntries((prev) => prev.map((e) =>
        e.status === 'analysing' ? { ...e, stageIndex: (e.stageIndex || 0) + 1 } : e,
      ))
    }, 3000)
    return () => clearInterval(stageTimerRef.current)
  }, [entries.some((e) => e.status === 'analysing')])

  const addFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    const hint = uploadHint.trim()
    const newEntries = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      stageIndex: 0,
      error: null,
      form: {
        name: '', species: '', room: defaultRoom, floor: defaultFloor,
        frequencyDays: 7, health: '', maturity: '', plantedIn: 'pot',
        waterAmount: '', waterMethod: '', potSize: '', soilType: '',
        lastWatered: new Date().toISOString().split('T')[0],
      },
    }))

    setEntries((prev) => [...prev, ...newEntries])
    runAnalysis(newEntries, hint)
  }, [defaultFloor, defaultRoom, uploadHint])

  const runAnalysis = useCallback(async (newEntries, hint = '') => {
    // Mark them as analysing
    const ids = new Set(newEntries.map((e) => e.id))
    setEntries((prev) => prev.map((e) => ids.has(e.id) ? { ...e, status: 'analysing' } : e))

    await withConcurrency(newEntries, async (entry) => {
      try {
        const result = hint
          ? await analyseApi.analyseWithHint(entry.file, hint)
          : await analyseApi.analyse(entry.file)
        const species = result.species || ''
        const shortSpecies = species ? species.split('(')[0].split(',')[0].trim() : ''

        setEntries((prev) => prev.map((e) => {
          if (e.id !== entry.id) return e
          const roomLabel = e.form.room || defaultRoom
          const autoName = shortSpecies ? `${shortSpecies} - ${roomLabel}` : ''
          return {
          ...e,
          status: 'ready',
          analysisRecommendations: result.recommendations || [],
          form: {
            ...e.form,
            name: autoName,
            species,
            ...(result.frequencyDays ? { frequencyDays: Math.min(30, Math.max(1, Number(result.frequencyDays))) } : {}),
            health: result.health || '',
            healthReason: result.healthReason || '',
            maturity: result.maturity || '',
            ...(result.waterAmount ? { waterAmount: result.waterAmount } : {}),
            ...(result.waterMethod ? { waterMethod: result.waterMethod } : {}),
            ...(result.potSize ? { potSize: result.potSize } : {}),
            ...(result.soilType ? { soilType: result.soilType } : {}),
          },
        }
        }))
      } catch (err) {
        setEntries((prev) => prev.map((e) => e.id === entry.id ? {
          ...e,
          status: 'error',
          error: `Analysis failed: ${err.message}`,
        } : e))
      }
    }, CONCURRENCY)
  }, [defaultRoom])

  const handleRetry = useCallback((entryId) => {
    const entry = entries.find((e) => e.id === entryId)
    if (entry) runAnalysis([entry])
  }, [entries, runAnalysis])

  const handleReanalyse = useCallback((entryId, hint) => {
    const entry = entries.find((e) => e.id === entryId)
    if (!entry) return
    runAnalysis([entry], (hint || '').trim())
  }, [entries, runAnalysis])

  const handleRemove = useCallback((entryId) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === entryId)
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      return prev.filter((e) => e.id !== entryId)
    })
  }, [])

  const handleChange = useCallback((updated) => {
    setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e))
  }, [])

  const handleSaveAll = useCallback(async () => {
    const ready = entries.filter((e) => e.status === 'ready')
    if (!ready.length) return
    setIsSaving(true)

    // Mark ready entries as saving
    const readyIds = new Set(ready.map((e) => e.id))
    setEntries((prev) => prev.map((e) => readyIds.has(e.id) ? { ...e, status: 'saving' } : e))

    // Upload images with concurrency, then create plants
    await withConcurrency(ready, async (entry) => {
      try {
        const imageUrl = await imagesApi.upload(entry.file, 'plants')
        const plantData = {
          ...entry.form,
          imageUrl,
          recommendations: entry.analysisRecommendations || [],
        }
        // Create via context
        const results = await handleBulkCreatePlants([plantData])
        const result = results?.[0]
        if (!result) throw new Error('No response from save handler')
        if (result.status === 'rejected') throw result.reason || new Error('Save rejected')

        setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: 'saved' } : e))
      } catch (err) {
        console.error('Bulk save failed for entry', entry.id, err)
        setEntries((prev) => prev.map((e) => e.id === entry.id ? {
          ...e, status: 'error', error: `Save failed: ${err?.message || 'unknown error'}`,
        } : e))
      }
    }, CONCURRENCY)

    setIsSaving(false)
  }, [entries, handleBulkCreatePlants])

  const handleClear = useCallback(() => {
    entries.forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl) })
    setEntries([])
  }, [entries])

  // Counts
  const counts = { pending: 0, analysing: 0, ready: 0, saving: 0, saved: 0, error: 0 }
  entries.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1 })
  const total = entries.length
  const progress = total > 0 ? Math.round(((counts.saved) / total) * 100) : 0

  return (
    <div className="content-wrapper">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="subheader-title">
          <svg className="sa-icon sa-icon-2x me-2"><use href="/icons/sprite.svg#upload"></use></svg>
          Bulk Upload Plants
        </h1>
        {entries.length > 0 && (
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={handleClear} disabled={isSaving}>
              Clear All
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveAll}
              disabled={isSaving || counts.ready === 0}>
              {isSaving ? 'Saving...' : `Save ${counts.ready} Plant${counts.ready !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
      </div>

      <div className="main-content">
        {/* Optional species hint — improves analysis accuracy when the user already knows */}
        <Form.Group className="mb-3">
          <Form.Label className="fs-sm fw-500 mb-1">
            What plant is this? <span className="text-muted fw-400">(optional, applies to next uploads)</span>
          </Form.Label>
          <Form.Control
            size="sm"
            placeholder="e.g. Monstera deliciosa, Peace Lily, Tomato..."
            value={uploadHint}
            onChange={(e) => setUploadHint(e.target.value)}
            disabled={isSaving}
          />
        </Form.Group>

        {/* Drop zone */}
        <div
          className={`panel mb-4 ${isDragging ? 'border-primary' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => !entries.length && fileInputRef.current?.click()}
        >
          <div
            className={`panel-container p-5 text-center ${isDragging ? 'bg-primary bg-opacity-10' : ''}`}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
          >
            <svg className="sa-icon sa-icon-5x text-muted mb-3"><use href="/icons/sprite.svg#upload"></use></svg>
            <h5 className="text-muted">Drop plant photos here or click to browse</h5>
            <p className="text-muted fs-sm mb-0">Upload multiple photos — AI will analyse each one automatically</p>
          </div>
        </div>
        <input
          ref={fileInputRef} type="file" accept="image/*" multiple className="d-none"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />

        {/* Summary bar */}
        {entries.length > 0 && (
          <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
            <span className="fs-sm fw-600">{total} photo{total !== 1 ? 's' : ''}</span>
            {counts.analysing > 0 && <Badge bg="info">{counts.analysing} analysing</Badge>}
            {counts.ready > 0 && <Badge bg="success">{counts.ready} ready</Badge>}
            {counts.saving > 0 && <Badge bg="warning">{counts.saving} saving</Badge>}
            {counts.saved > 0 && <Badge bg="primary">{counts.saved} saved</Badge>}
            {counts.error > 0 && <Badge bg="danger">{counts.error} error{counts.error !== 1 ? 's' : ''}</Badge>}
            <Button variant="outline-primary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
              <svg className="sa-icon me-1" style={{ width: 12, height: 12 }}><use href="/icons/sprite.svg#plus"></use></svg>
              Add More
            </Button>
            {counts.saved > 0 && (
              <ProgressBar now={progress} className="flex-grow-1" style={{ height: 8 }} />
            )}
          </div>
        )}

        {/* Plant cards grid */}
        <Row>
          {entries.map((entry) => (
            <Col lg={6} xl={4} key={entry.id}>
              <BulkPlantCard
                entry={entry}
                floors={floors}
                rooms={rooms}
                onChange={handleChange}
                onRemove={() => handleRemove(entry.id)}
                onRetry={() => handleRetry(entry.id)}
                onReanalyse={(hint) => handleReanalyse(entry.id, hint)}
              />
            </Col>
          ))}
        </Row>
      </div>
    </div>
  )
}
