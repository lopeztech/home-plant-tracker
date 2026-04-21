import { useState } from 'react'
import { Modal, Button, Form, Row, Col } from 'react-bootstrap'
import { recommendApi } from '../api/plants.js'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useToast } from './Toast.jsx'
import { isOutdoor } from '../utils/watering.js'

export default function FeedRecordModal({ plant, show, onHide }) {
  const { floors, location, tempUnit, handleFertilisePlant } = usePlantContext()
  const toast = useToast()

  const seed = plant?.fertiliser || {}
  const [form, setForm] = useState({
    productName: seed.productName || '',
    npk:         seed.npk || '',
    dilution:    seed.dilution || '',
    amount:      '',
    notes:       '',
  })
  const [saving, setSaving] = useState(false)
  const [loadingRec, setLoadingRec] = useState(false)

  if (!plant) return null

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const requestRecommendation = async () => {
    setLoadingRec(true)
    try {
      const rec = await recommendApi.getFertiliser({
        name: plant.name,
        species: plant.species,
        plantedIn: plant.plantedIn,
        isOutdoor: isOutdoor(plant, floors),
        potSize: plant.potSize,
        soilType: plant.soilType,
        health: plant.health,
        maturity: plant.maturity,
        location,
        tempUnit: tempUnit?.unit,
      })
      setForm((f) => ({
        ...f,
        productName: rec.productName || f.productName,
        npk:         rec.npk || f.npk,
        dilution:    rec.dilution || f.dilution,
        amount:      rec.amount || f.amount,
      }))
      toast.success('AI recommendation loaded')
    } catch (err) {
      toast.error(err.message || 'Failed to get recommendation')
    } finally {
      setLoadingRec(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await handleFertilisePlant(plant.id, form)
      toast.success('Marked fertilised')
      onHide?.()
    } catch (err) {
      toast.error(err.message || 'Failed to mark fertilised')
    } finally {
      setSaving(false)
    }
  }

  const log = plant.fertiliserLog || []
  const recent = log.slice(-5).reverse()

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>Feed {plant.name}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          <Row className="g-2">
            <Col xs={12} md={8}>
              <Form.Group>
                <Form.Label>Product</Form.Label>
                <Form.Control value={form.productName} onChange={setField('productName')} placeholder="e.g. Balanced liquid houseplant food" />
              </Form.Group>
            </Col>
            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label>NPK</Form.Label>
                <Form.Control value={form.npk} onChange={setField('npk')} placeholder="10-10-10" />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label>Dilution</Form.Label>
                <Form.Control value={form.dilution} onChange={setField('dilution')} placeholder="5ml per 1L" />
              </Form.Group>
            </Col>
            <Col xs={12} md={6}>
              <Form.Group>
                <Form.Label>Amount applied</Form.Label>
                <Form.Control value={form.amount} onChange={setField('amount')} placeholder="250ml" />
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group>
                <Form.Label>Notes</Form.Label>
                <Form.Control value={form.notes} onChange={setField('notes')} as="textarea" rows={2} />
              </Form.Group>
            </Col>
          </Row>

          <div className="mt-3">
            <Button size="sm" variant="outline-secondary" onClick={requestRecommendation} disabled={loadingRec}>
              {loadingRec ? 'Asking AI…' : 'Fill from AI recommendation'}
            </Button>
          </div>

          {recent.length > 0 && (
            <div className="mt-4">
              <h2 className="h6 text-uppercase text-muted">Recent</h2>
              <ul className="list-unstyled mb-0 fs-sm">
                {recent.map((e, i) => (
                  <li key={i} className="d-flex justify-content-between border-bottom py-1">
                    <span>{new Date(e.date).toLocaleDateString()}</span>
                    <span className="text-muted">{e.productName || '—'}{e.dilution ? ` · ${e.dilution}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Mark fertilised'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
