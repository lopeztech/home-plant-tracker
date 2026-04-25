import { useState, useEffect } from 'react'
import { bloomsApi } from '../api/plants.js'
import { formatDate } from '../utils/format.js'

const COLOR_SWATCHES = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#ffffff', name: 'White' },
  { hex: '#f9fafb', name: 'Cream' },
]

export default function BloomTab({ plant, onUpdated }) {
  const [blooms, setBlooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedColors, setSelectedColors] = useState([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!plant?.id) return
    setLoading(true)
    bloomsApi.list(plant.id)
      .then(setBlooms)
      .catch(() => setBlooms([]))
      .finally(() => setLoading(false))
  }, [plant?.id])

  function toggleColor(hex) {
    setSelectedColors((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : prev.length < 3 ? [...prev, hex] : prev
    )
  }

  async function handleStart() {
    setSaving(true)
    try {
      const bloom = await bloomsApi.start(plant.id, { colors: selectedColors, notes: notes || undefined })
      setBlooms((prev) => [bloom, ...prev])
      setShowForm(false)
      setSelectedColors([])
      setNotes('')
      onUpdated?.()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  async function handleEnd(bloomId) {
    try {
      await bloomsApi.end(plant.id, bloomId)
      setBlooms((prev) => prev.map((b) => b.id === bloomId ? { ...b, endedAt: new Date().toISOString() } : b))
      onUpdated?.()
    } catch { /* ignore */ }
  }

  if (loading) return <div className="p-3 text-center"><span className="spinner-border spinner-border-sm" /></div>

  const activeBlooms = blooms.filter((b) => !b.endedAt)
  const pastBlooms = blooms.filter((b) => b.endedAt)

  return (
    <div className="p-3" role="tabpanel">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0">Bloom history</h6>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Log bloom'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-3 border-primary">
          <div className="card-body">
            <p className="fs-sm mb-2 fw-500">Bloom colours (pick up to 3)</p>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {COLOR_SWATCHES.map(({ hex, name }) => (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  aria-pressed={selectedColors.includes(hex)}
                  onClick={() => toggleColor(hex)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: hex,
                    border: selectedColors.includes(hex) ? '3px solid #3b82f6' : '2px solid #d1d5db',
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
            <input
              type="text"
              className="form-control form-control-sm mb-2"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={saving}
              onClick={handleStart}
            >
              {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
              Start bloom
            </button>
          </div>
        </div>
      )}

      {activeBlooms.length > 0 && (
        <div className="mb-3">
          <p className="text-success fs-sm fw-500 mb-2">Currently blooming</p>
          {activeBlooms.map((b) => (
            <div key={b.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
              <div>
                <div className="d-flex gap-1 mb-1">
                  {(b.colors || []).map((c) => (
                    <span key={c} style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: c, border: '1px solid #e5e7eb', display: 'inline-block' }} />
                  ))}
                  {b.colors?.length === 0 && <span className="text-muted fs-xs">No colour recorded</span>}
                </div>
                <div className="fs-xs text-muted">Started {formatDate(b.startedAt, { day: 'numeric', month: 'short' })}</div>
                {b.notes && <div className="fs-xs text-muted">{b.notes}</div>}
              </div>
              <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => handleEnd(b.id)}>
                End bloom
              </button>
            </div>
          ))}
        </div>
      )}

      {pastBlooms.length > 0 && (
        <div>
          <p className="text-muted fs-sm fw-500 mb-2">Past blooms</p>
          {pastBlooms.map((b) => (
            <div key={b.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
              <div>
                <div className="d-flex gap-1 mb-1">
                  {(b.colors || []).map((c) => (
                    <span key={c} style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: c, border: '1px solid #e5e7eb', display: 'inline-block' }} />
                  ))}
                </div>
                <div className="fs-xs text-muted">
                  {formatDate(b.startedAt, { day: 'numeric', month: 'short' })}
                  {' → '}
                  {b.endedAt ? formatDate(b.endedAt, { day: 'numeric', month: 'short' }) : 'ongoing'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {blooms.length === 0 && !showForm && (
        <p className="text-muted fs-sm text-center py-4">No blooms recorded yet. Tap &ldquo;+ Log bloom&rdquo; to start tracking.</p>
      )}
    </div>
  )
}
