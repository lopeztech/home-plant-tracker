import { useState, useEffect } from 'react'
import { lifecycleApi } from '../api/plants.js'
import { formatDate } from '../utils/format.js'

export default function LifecycleTab({ plant, onUpdated }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [repotNotes, setRepotNotes] = useState('')
  const [pruneNotes, setPruneNotes] = useState('')

  useEffect(() => {
    if (!plant?.id) return
    setLoading(true)
    lifecycleApi.getStatus(plant.id)
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [plant?.id])

  async function handleRepot() {
    setSaving('repot')
    try {
      await lifecycleApi.recordRepot(plant.id, { notes: repotNotes || undefined })
      const updated = await lifecycleApi.getStatus(plant.id)
      setStatus(updated)
      setRepotNotes('')
      onUpdated?.()
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  async function handlePrune() {
    setSaving('prune')
    try {
      await lifecycleApi.recordPrune(plant.id, { notes: pruneNotes || undefined })
      const updated = await lifecycleApi.getStatus(plant.id)
      setStatus(updated)
      setPruneNotes('')
      onUpdated?.()
    } catch { /* ignore */ } finally { setSaving(null) }
  }

  if (loading) return <div className="p-3 text-center"><span className="spinner-border spinner-border-sm" /></div>

  return (
    <div className="p-3" role="tabpanel">
      {/* Repotting */}
      <div className="card mb-3">
        <div className="card-body">
          <h6 className="card-title mb-2 d-flex align-items-center gap-2">
            <svg className="sa-icon sa-icon-sm text-warning" aria-hidden="true"><use href="/icons/sprite.svg#package" /></svg>
            Repotting
          </h6>
          {status?.lastRepotted ? (
            <p className="text-muted fs-sm mb-1">
              Last repotted: <strong>{formatDate(status.lastRepotted, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </p>
          ) : (
            <p className="text-muted fs-sm mb-1">No repotting recorded yet</p>
          )}
          <p className="fs-sm mb-2">
            Recommended interval: every <strong>{status?.repotIntervalMonths || 18} months</strong>
            {status?.repotDaysOverdue > 0 && (
              <span className="badge bg-warning text-dark ms-2">{status.repotDaysOverdue}d overdue</span>
            )}
            {status?.repotDaysOverdue !== null && status?.repotDaysOverdue <= 0 && (
              <span className="badge bg-success ms-2">On schedule</span>
            )}
          </p>
          <input
            type="text"
            className="form-control form-control-sm mb-2"
            placeholder="Notes (optional)"
            value={repotNotes}
            onChange={(e) => setRepotNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            disabled={saving === 'repot'}
            onClick={handleRepot}
          >
            {saving === 'repot' ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Mark as repotted today
          </button>
        </div>
      </div>

      {/* Pruning */}
      <div className="card">
        <div className="card-body">
          <h6 className="card-title mb-2 d-flex align-items-center gap-2">
            <svg className="sa-icon sa-icon-sm text-success" aria-hidden="true"><use href="/icons/sprite.svg#scissors" /></svg>
            Pruning
          </h6>
          {status?.lastPruned ? (
            <p className="text-muted fs-sm mb-1">
              Last pruned: <strong>{formatDate(status.lastPruned, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </p>
          ) : (
            <p className="text-muted fs-sm mb-1">No pruning recorded yet</p>
          )}
          <p className="fs-sm mb-2">
            Recommended interval: every <strong>{status?.pruneIntervalMonths || 6} months</strong>
            {status?.pruneDaysOverdue > 0 && (
              <span className="badge bg-warning text-dark ms-2">{status.pruneDaysOverdue}d overdue</span>
            )}
            {status?.pruneDaysOverdue !== null && status?.pruneDaysOverdue <= 0 && (
              <span className="badge bg-success ms-2">On schedule</span>
            )}
          </p>
          <input
            type="text"
            className="form-control form-control-sm mb-2"
            placeholder="Notes (optional)"
            value={pruneNotes}
            onChange={(e) => setPruneNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            disabled={saving === 'prune'}
            onClick={handlePrune}
          >
            {saving === 'prune' ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            Mark as pruned today
          </button>
        </div>
      </div>
    </div>
  )
}
