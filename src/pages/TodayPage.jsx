import { useState, useMemo, useCallback } from 'react'
import { Button, ButtonGroup, Dropdown, Alert } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useToast } from '../components/Toast.jsx'
import FeedRecordModal from '../components/FeedRecordModal.jsx'
import UpgradePrompt from '../components/UpgradePrompt.jsx'
import { getPlantEmoji } from '../utils/plantEmoji.js'
import { buildWaterTasks, buildFeedTasks, buildLifecycleTasks, setSnooze, clampSnooze } from '../utils/todayTasks.js'
import { friendlyErrorMessage } from '../utils/errorMessages.js'

const SNOOZE_PRESETS = [
  { label: '1 day',   days: 1 },
  { label: '3 days',  days: 3 },
  { label: '1 week',  days: 7 },
]

export default function TodayPage() {
  const { plants, weather, floors, handleWaterPlant, handleBatchWater } = usePlantContext()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [feedPlant, setFeedPlant] = useState(null)
  // Snooze writes to localStorage, so we bump this to force a recompute.
  const [snoozeVersion, setSnoozeVersion] = useState(0)

  const { tasks, deferredByRain } = useMemo(
    () => buildWaterTasks(plants, weather, floors),
    [plants, weather, floors, snoozeVersion],
  )
  const { tasks: feedTasks } = useMemo(
    () => buildFeedTasks(plants, weather),
    [plants, weather],
  )
  const { tasks: lifecycleTasks } = useMemo(
    () => buildLifecycleTasks(plants),
    [plants],
  )

  const grouped = useMemo(() => {
    const byRoom = new Map()
    for (const t of tasks) {
      const key = t.room || 'Other'
      if (!byRoom.has(key)) byRoom.set(key, [])
      byRoom.get(key).push(t)
    }
    return [...byRoom.entries()]
  }, [tasks])

  const onComplete = useCallback(async (plantId) => {
    setBusy(true)
    try {
      await handleWaterPlant(plantId)
      toast.success('Marked watered')
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { context: 'marking watered' }))
    } finally {
      setBusy(false)
    }
  }, [handleWaterPlant, toast])

  const onBulkComplete = useCallback(async () => {
    if (tasks.length === 0) return
    setBusy(true)
    try {
      const ids = tasks.map((t) => t.plantId)
      const count = await handleBatchWater(ids)
      toast.success(`Marked ${count} watered`)
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { context: 'marking watered' }))
    } finally {
      setBusy(false)
    }
  }, [tasks, handleBatchWater, toast])

  const onSnooze = useCallback((plant, days) => {
    const now = new Date()
    const requested = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const until = clampSnooze(plant, requested)
    setSnooze(plant.id, until)
    setSnoozeVersion((v) => v + 1)
    const clamped = until.getTime() < requested.getTime()
    toast.success(clamped
      ? `Snoozed until next due date (${until.toLocaleDateString()})`
      : `Snoozed for ${days} day${days === 1 ? '' : 's'}`)
  }, [toast])

  return (
    <div className="content-wrapper">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="subheader-title mb-1">Today</h1>
          <p className="text-muted mb-0 fs-sm">What needs doing right now across your collection</p>
        </div>
        {tasks.length > 0 && (
          <Button variant="primary" onClick={onBulkComplete} disabled={busy}>
            Mark all {tasks.length} watered
          </Button>
        )}
      </div>

      <UpgradePrompt id="today-ai-limit" quota="ai_analyses">
        You've used all free AI plant analyses this month. Upgrade for unlimited analyses.
      </UpgradePrompt>

      {deferredByRain > 0 && (
        <Alert variant="info" className="d-flex align-items-center">
          <svg className="sa-icon me-2" style={{ width: 18, height: 18 }} aria-hidden="true">
            <use href="/icons/sprite.svg#cloud-rain"></use>
          </svg>
          Rain is doing the watering — {deferredByRain} outdoor {deferredByRain === 1 ? 'task' : 'tasks'} auto-deferred.
        </Alert>
      )}

      {tasks.length === 0 && feedTasks.length === 0 && lifecycleTasks.length === 0 ? (
        <div className="text-center py-5">
          <div style={{ fontSize: '3rem' }} aria-hidden="true">🌿</div>
          <h2 className="h4 mt-2">All caught up</h2>
          <p className="text-muted">No plants need attention right now. Enjoy the quiet.</p>
        </div>
      ) : (
        <>
          {tasks.length > 0 && (
            <div className="mb-4">
              <h2 className="h5 mb-3">Water</h2>
              {grouped.map(([room, roomTasks]) => (
                <section key={room} className="mb-3">
                  <h3 className="h6 text-uppercase text-muted mb-2">{room}</h3>
                  <ul className="list-group">
                    {roomTasks.map((t) => (
                      <li key={t.plantId} className="list-group-item d-flex align-items-center gap-3">
                        <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{getPlantEmoji(t.plant)}</span>
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-500 text-truncate">{t.plant.name}</div>
                          <div className="fs-xs text-muted">
                            {t.daysUntil < 0 ? (
                              <span className="text-danger fw-500">{t.reason}</span>
                            ) : (
                              <span>{t.reason}</span>
                            )}
                          </div>
                        </div>
                        <ButtonGroup>
                          <Button size="sm" variant="primary" onClick={() => onComplete(t.plantId)} disabled={busy}>
                            Water
                          </Button>
                          <Dropdown as={ButtonGroup}>
                            <Dropdown.Toggle size="sm" variant="outline-secondary" aria-label="Snooze options" disabled={busy} />
                            <Dropdown.Menu align="end">
                              {SNOOZE_PRESETS.map((p) => (
                                <Dropdown.Item key={p.days} onClick={() => onSnooze(t.plant, p.days)}>
                                  Snooze {p.label}
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown>
                        </ButtonGroup>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {feedTasks.length > 0 && (
            <section className="mb-4">
              <h2 className="h5 mb-3">Fertilise</h2>
              <ul className="list-group">
                {feedTasks.map((t) => (
                  <li key={t.plantId} className="list-group-item d-flex align-items-center gap-3">
                    <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{getPlantEmoji(t.plant)}</span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-500 text-truncate">{t.plant.name}</div>
                      <div className="fs-xs text-muted">
                        {t.daysUntil < 0
                          ? <span className="text-warning fw-500">{t.reason}</span>
                          : <span>{t.reason}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => setFeedPlant(t.plant)} disabled={busy}>
                      Feed
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lifecycleTasks.length > 0 && (
            <section className="mb-4">
              <h2 className="h5 mb-3">Lifecycle</h2>
              <ul className="list-group">
                {lifecycleTasks.map((t) => (
                  <li key={t.id} className="list-group-item d-flex align-items-center gap-3">
                    <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{getPlantEmoji(t.plant)}</span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-500 text-truncate">{t.plant.name}</div>
                      <div className="fs-xs text-muted">
                        <span className="text-warning fw-500">
                          {t.type === 'repot' ? 'Repotting' : 'Pruning'} overdue by {t.daysOverdue} day{t.daysOverdue === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <span className="badge bg-warning text-dark text-uppercase fs-xs">
                      {t.type === 'repot' ? 'Repot' : 'Prune'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <FeedRecordModal plant={feedPlant} show={!!feedPlant} onHide={() => setFeedPlant(null)} />
    </div>
  )
}
