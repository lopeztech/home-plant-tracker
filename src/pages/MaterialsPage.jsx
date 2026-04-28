import { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Form, Badge, Alert, Spinner } from 'react-bootstrap'
import { materialsApi } from '../api/plants.js'
import EmptyState from '../components/EmptyState.jsx'

const UNITS = ['g', 'kg', 'L', 'mL', 'each']
const MOVEMENT_REASONS = ['use', 'restock', 'adjustment']

const defaultForm = {
  name: '', unit: 'each', onHand: 0, reorderThreshold: 0,
  reorderQty: 1, sku: '', supplier: '', supplierUrl: '',
  costPerUnitCents: '', notes: '',
}

const defaultMovement = { delta: '', reason: 'use', notes: '' }

function stockBadge(m) {
  if (m.onHand === 0) return <Badge bg="danger">Out of stock</Badge>
  if (m.onHand <= m.reorderThreshold) return <Badge bg="warning" text="dark">Low stock</Badge>
  return <Badge bg="success">In stock</Badge>
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [movTarget, setMovTarget] = useState(null)
  const [movement, setMovement] = useState(defaultMovement)
  const [movSaving, setMovSaving] = useState(false)
  const [shoppingList, setShoppingList] = useState(null)
  const [shoppingListLoading, setShoppingListLoading] = useState(false)
  const [tab, setTab] = useState('inventory')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await materialsApi.list()
      setMaterials(data.materials || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  const openEdit = (m) => {
    setEditing(m.id)
    setForm({
      name: m.name, unit: m.unit,
      onHand: m.onHand, reorderThreshold: m.reorderThreshold,
      reorderQty: m.reorderQty,
      sku: m.sku || '', supplier: m.supplier || '',
      supplierUrl: m.supplierUrl || '',
      costPerUnitCents: m.costPerUnitCents ?? '',
      notes: m.notes || '',
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        onHand: Number(form.onHand),
        reorderThreshold: Number(form.reorderThreshold),
        reorderQty: Number(form.reorderQty),
        sku: form.sku || null,
        supplier: form.supplier || null,
        supplierUrl: form.supplierUrl || null,
        costPerUnitCents: form.costPerUnitCents !== '' ? Number(form.costPerUnitCents) : null,
        notes: form.notes || '',
      }
      if (editing) {
        await materialsApi.update(editing, payload)
      } else {
        await materialsApi.create(payload)
      }
      setShowForm(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id) => {
    if (!confirm('Archive this material? It will be hidden from inventory.')) return
    try {
      await materialsApi.archive(id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const openMovement = (m) => {
    setMovTarget(m)
    setMovement(defaultMovement)
  }

  const handleMovement = async (e) => {
    e.preventDefault()
    setMovSaving(true)
    try {
      const delta = Number(movement.delta)
      if (movement.reason === 'use' && delta > 0) {
        await materialsApi.addMovement(movTarget.id, { delta: -delta, reason: 'use', notes: movement.notes })
      } else {
        await materialsApi.addMovement(movTarget.id, { delta, reason: movement.reason, notes: movement.notes })
      }
      setMovTarget(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setMovSaving(false)
    }
  }

  const loadShoppingList = async () => {
    setShoppingListLoading(true)
    try {
      const data = await materialsApi.shoppingList()
      setShoppingList(data.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setShoppingListLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'shopping') loadShoppingList()
  }, [tab])

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="mb-0">Materials &amp; Supplies</h4>
        <Button size="sm" onClick={openAdd}>+ Add Material</Button>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link${tab === 'inventory' ? ' active' : ''}`} onClick={() => setTab('inventory')}>
            Inventory
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link${tab === 'shopping' ? ' active' : ''}`} onClick={() => setTab('shopping')}>
            Shopping List
          </button>
        </li>
      </ul>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {tab === 'inventory' && (
        <>
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" /></div>
          ) : materials.length === 0 ? (
            <EmptyState
              icon="package"
              title="No materials yet"
              message="Track supplies like fertiliser, soil, pots, and tools. Add your first item to get started."
              action={<Button onClick={openAdd}>Add Material</Button>}
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>On Hand</th>
                    <th>Status</th>
                    <th>Reorder At</th>
                    <th>Supplier</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="fw-semibold">{m.name}</div>
                        {m.sku && <small className="text-muted">SKU: {m.sku}</small>}
                      </td>
                      <td>{m.onHand} {m.unit}</td>
                      <td>{stockBadge(m)}</td>
                      <td>{m.reorderThreshold} {m.unit}</td>
                      <td>{m.supplier || <span className="text-muted">—</span>}</td>
                      <td className="text-end">
                        <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => openMovement(m)}>
                          Adjust
                        </Button>
                        <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => openEdit(m)}>
                          Edit
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => handleArchive(m.id)}>
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'shopping' && (
        <>
          {shoppingListLoading ? (
            <div className="text-center py-5"><Spinner animation="border" /></div>
          ) : shoppingList === null ? null : shoppingList.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title="All stocked up"
              message="No materials are below their reorder threshold."
            />
          ) : (
            <>
              <p className="text-muted small mb-2">
                {shoppingList.length} item{shoppingList.length !== 1 ? 's' : ''} to reorder, grouped by supplier.
              </p>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>On Hand</th>
                      <th>Reorder Qty</th>
                      <th>Supplier</th>
                      <th>Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoppingList.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="fw-semibold">{m.name}</div>
                          {m.sku && <small className="text-muted">SKU: {m.sku}</small>}
                        </td>
                        <td><Badge bg="warning" text="dark">{m.onHand} {m.unit}</Badge></td>
                        <td>{m.reorderQty} {m.unit}</td>
                        <td>
                          {m.supplierUrl
                            ? <a href={m.supplierUrl} target="_blank" rel="noopener noreferrer">{m.supplier || 'Link'}</a>
                            : (m.supplier || <span className="text-muted">—</span>)
                          }
                        </td>
                        <td>
                          {m.costPerUnitCents != null
                            ? `$${((m.costPerUnitCents * m.reorderQty) / 100).toFixed(2)}`
                            : <span className="text-muted">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Add / Edit material modal */}
      <Modal show={showForm} onHide={() => setShowForm(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Material' : 'Add Material'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Name *</Form.Label>
                <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col-md-3">
                <Form.Label>Unit *</Form.Label>
                <Form.Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label>On Hand</Form.Label>
                <Form.Control type="number" min="0" step="any" value={form.onHand}
                  onChange={(e) => setForm({ ...form, onHand: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Reorder At</Form.Label>
                <Form.Control type="number" min="0" step="any" value={form.reorderThreshold}
                  onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Reorder Qty</Form.Label>
                <Form.Control type="number" min="1" step="any" value={form.reorderQty}
                  onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>SKU / Product code</Form.Label>
                <Form.Control value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Cost per unit (cents)</Form.Label>
                <Form.Control type="number" min="0" value={form.costPerUnitCents}
                  placeholder="e.g. 299 = $2.99"
                  onChange={(e) => setForm({ ...form, costPerUnitCents: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Supplier</Form.Label>
                <Form.Control value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Supplier URL</Form.Label>
                <Form.Control type="url" value={form.supplierUrl}
                  onChange={(e) => setForm({ ...form, supplierUrl: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Notes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Adjust stock movement modal */}
      <Modal show={!!movTarget} onHide={() => setMovTarget(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Adjust Stock — {movTarget?.name}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleMovement}>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Current: <strong>{movTarget?.onHand} {movTarget?.unit}</strong>
            </p>
            <Form.Group className="mb-3">
              <Form.Label>Reason</Form.Label>
              <Form.Select value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })}>
                {MOVEMENT_REASONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                Quantity ({movTarget?.unit})
                {movement.reason === 'use' && <span className="text-muted ms-1 small">— will be subtracted</span>}
              </Form.Label>
              <Form.Control type="number" min="0.001" step="any" required
                value={movement.delta}
                onChange={(e) => setMovement({ ...movement, delta: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={movement.notes}
                onChange={(e) => setMovement({ ...movement, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setMovTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={movSaving}>{movSaving ? 'Saving…' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
