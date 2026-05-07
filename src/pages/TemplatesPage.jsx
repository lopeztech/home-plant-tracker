import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Modal, Form, Row, Col, Tab, Tabs } from 'react-bootstrap'
import { templatesApi } from '../api/plants.js'
import { useSubscription } from '../context/SubscriptionContext.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import UpgradePrompt from '../components/UpgradePrompt.jsx'

const TASK_TYPES = ['watering', 'pruning', 'fertilising', 'inspection', 'custom']

function ItemEditor({ items, onChange }) {
  function addItem() {
    onChange([...items, { title: '', taskType: 'custom', estimatedMinutes: 15, plantIds: [] }])
  }
  function removeItem(i) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function updateItem(i, key, value) {
    const next = [...items]
    next[i] = { ...next[i], [key]: value }
    onChange(next)
  }

  return (
    <div>
      {items.map((item, i) => (
        <Row key={i} className="g-2 mb-2 align-items-center">
          <Col md={4}>
            <Form.Control
              size="sm"
              placeholder="Task title"
              value={item.title}
              onChange={(e) => updateItem(i, 'title', e.target.value)}
            />
          </Col>
          <Col md={3}>
            <Form.Select
              size="sm"
              value={item.taskType || 'custom'}
              onChange={(e) => updateItem(i, 'taskType', e.target.value)}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2}>
            <Form.Control
              size="sm"
              type="number"
              min={0}
              placeholder="Min"
              value={item.estimatedMinutes ?? ''}
              onChange={(e) => updateItem(i, 'estimatedMinutes', Number(e.target.value))}
            />
          </Col>
          <Col md="auto">
            <Button size="sm" variant="outline-danger" onClick={() => removeItem(i)}>×</Button>
          </Col>
        </Row>
      ))}
      <Button size="sm" variant="outline-secondary" onClick={addItem}>+ Add item</Button>
    </div>
  )
}

function TemplateModal({ template, onSave, onClose }) {
  const [form, setForm] = useState(
    template
      ? { ...template }
      : { name: '', description: '', items: [] },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const result = template
        ? await templatesApi.update(template.id, form)
        : await templatesApi.create(form)
      onSave(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{template ? 'Edit Template' : 'New Template'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
        <Row className="g-3">
          <Col md={8}>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Weekly garden care"
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={form.description || ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional"
              />
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Label>Checklist items</Form.Label>
            <ItemEditor items={form.items || []} onChange={(items) => set('items', items)} />
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

function TemplateCard({ template, onEdit, onDelete, onClone }) {
  const totalMin = (template.items || []).reduce((s, i) => s + (i.estimatedMinutes || 0), 0)
  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <h6 className="mb-1">{template.name}</h6>
            {template.description && (
              <p className="text-muted small mb-1">{template.description}</p>
            )}
            <div className="d-flex gap-2 flex-wrap">
              <Badge bg="secondary">{(template.items || []).length} items</Badge>
              {totalMin > 0 && <Badge bg="info">~{totalMin} min</Badge>}
            </div>
          </div>
          <div className="d-flex gap-1">
            {!template.isPlatform && (
              <>
                <Button size="sm" variant="outline-secondary" onClick={() => onEdit(template)}>Edit</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => onClone(template.id)}>Clone</Button>
                <Button size="sm" variant="outline-danger" onClick={() => onDelete(template.id)}>Delete</Button>
              </>
            )}
            {template.isPlatform && (
              <Button size="sm" variant="outline-secondary" onClick={() => onClone(template.id)}>Use</Button>
            )}
          </div>
        </div>
        {(template.items || []).length > 0 && (
          <ul className="list-unstyled mt-2 mb-0 small">
            {template.items.slice(0, 3).map((item, i) => (
              <li key={i} className="text-muted">• {item.title}</li>
            ))}
            {template.items.length > 3 && (
              <li className="text-muted">…and {template.items.length - 3} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const { canAccess } = useSubscription()
  const isLandscaper = canAccess('landscaper_pro')

  const [myTemplates, setMyTemplates] = useState([])
  const [platformTemplates, setPlatformTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalTemplate, setModalTemplate] = useState(undefined)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mine, platform] = await Promise.all([
        templatesApi.list(),
        templatesApi.listPlatform(),
      ])
      setMyTemplates(mine.templates || [])
      setPlatformTemplates((platform.templates || []).map((t) => ({ ...t, isPlatform: true })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setModalTemplate(undefined)
    setShowModal(true)
  }
  function openEdit(t) {
    setModalTemplate(t)
    setShowModal(true)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this template?')) return
    try {
      await templatesApi.remove(id)
      setMyTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleClone(id) {
    try {
      const result = await templatesApi.clone(id)
      setMyTemplates((prev) => [...prev, result.template || result])
    } catch (e) {
      setError(e.message)
    }
  }

  function handleSaved(saved) {
    const t = saved.template || saved
    setMyTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = t
        return next
      }
      return [...prev, t]
    })
    setShowModal(false)
  }

  if (!isLandscaper) {
    return (
      <div className="container py-4">
        <h4>Maintenance Templates</h4>
        <UpgradePrompt id="maintenance_templates" feature="landscaper_pro" />
      </div>
    )
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Maintenance Templates</h4>
        <Button variant="primary" onClick={openNew}>+ New Template</Button>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <Tabs defaultActiveKey="mine" className="mb-3">
        <Tab eventKey="mine" title={`My Templates (${myTemplates.length})`}>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : myTemplates.length === 0 ? (
            <EmptyState
              icon="checklist"
              title="No templates yet"
              message="Create a reusable checklist to speed up recurring maintenance visits."
              action={<Button onClick={openNew}>Create template</Button>}
            />
          ) : (
            myTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={openEdit}
                onDelete={handleDelete}
                onClone={handleClone}
              />
            ))
          )}
        </Tab>
        <Tab eventKey="library" title={`Library (${platformTemplates.length})`}>
          {platformTemplates.length === 0 ? (
            <p className="text-muted small">No curated templates yet — check back soon.</p>
          ) : (
            platformTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => {}}
                onDelete={() => {}}
                onClone={handleClone}
              />
            ))
          )}
        </Tab>
      </Tabs>

      {showModal && (
        <TemplateModal
          template={modalTemplate}
          onSave={handleSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
