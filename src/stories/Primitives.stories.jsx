/**
 * Bootstrap primitive components as used in this application —
 * Button, Badge, Card/Panel patterns.
 */
import { Button, Badge, Alert, Form, InputGroup } from 'react-bootstrap'

export default {
  title: 'Primitives/Bootstrap Components',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Bootstrap 5.3 + React-Bootstrap primitives in this app\'s theme context. ' +
          'Use these as the source of truth for variant, size, and state combinations.',
      },
    },
  },
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export const Buttons = {
  render: () => (
    <div>
      <h6 className="tx-title mb-3">Button variants</h6>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark', 'link'].map((v) => (
          <Button key={v} variant={v}>{v}</Button>
        ))}
      </div>

      <h6 className="tx-title mb-3">Outline variants</h6>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info'].map((v) => (
          <Button key={v} variant={`outline-${v}`}>{v}</Button>
        ))}
      </div>

      <h6 className="tx-title mb-3">Sizes</h6>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Button variant="primary" size="lg">Large</Button>
        <Button variant="primary">Default</Button>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" disabled>Disabled</Button>
      </div>

      <h6 className="tx-title mb-3">Icon buttons</h6>
      <div className="d-flex gap-2">
        {[
          { label: 'Add plant', icon: 'plus', variant: 'primary' },
          { label: 'Edit', icon: 'edit-2', variant: 'outline-secondary' },
          { label: 'Delete', icon: 'trash-2', variant: 'outline-danger' },
          { label: 'Water', icon: 'droplet', variant: 'outline-info' },
          { label: 'Upload', icon: 'upload', variant: 'outline-secondary' },
        ].map(({ label, icon, variant }) => (
          <Button key={label} variant={variant} size="sm">
            <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href={`/icons/sprite.svg#${icon}`} />
            </svg>
            {label}
          </Button>
        ))}
      </div>
    </div>
  ),
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export const Badges = {
  render: () => (
    <div>
      <h6 className="tx-title mb-3">Health status badges</h6>
      <div className="d-flex gap-2 mb-4">
        {[
          { label: 'Excellent', bg: 'success' },
          { label: 'Good', bg: 'success' },
          { label: 'Fair', bg: 'warning' },
          { label: 'Poor', bg: 'danger' },
          { label: 'Critical', bg: 'danger' },
        ].map(({ label, bg }) => (
          <Badge key={label} bg={bg}>{label}</Badge>
        ))}
      </div>

      <h6 className="tx-title mb-3">Count / pill badges</h6>
      <div className="d-flex gap-2 mb-4">
        {['primary', 'secondary', 'success', 'danger', 'warning', 'info'].map((v) => (
          <Badge key={v} bg={v} pill>
            {Math.floor(Math.random() * 20) + 1}
          </Badge>
        ))}
      </div>

      <h6 className="tx-title mb-3">Status pills (custom)</h6>
      <div className="d-flex gap-2">
        <span className="status-pill bg-danger bg-opacity-10 text-danger">3 overdue</span>
        <span className="status-pill bg-warning bg-opacity-10 text-warning">2 today</span>
        <span className="status-pill bg-success bg-opacity-10 text-success">12 good</span>
      </div>
    </div>
  ),
}

// ─── Panel pattern ───────────────────────────────────────────────────────────

export const PanelPattern = {
  name: 'Card / Panel Pattern',
  render: () => (
    <div style={{ maxWidth: 440 }}>
      <div className="panel panel-icon">
        <div className="panel-hdr d-flex justify-content-between align-items-center">
          <span>Panel Header</span>
          <div className="panel-toolbar">
            <Button variant="primary" size="sm">
              <svg className="sa-icon me-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#plus" /></svg>
              Action
            </Button>
          </div>
        </div>
        <div className="panel-container">
          <div className="panel-content">
            <p className="tx-body mb-0">
              This is the standard <code>.panel</code> pattern from Smart Admin. Use{' '}
              <code>.panel-hdr</code> for the header row and{' '}
              <code>.panel-content</code> for the body.
            </p>
          </div>
        </div>
      </div>
    </div>
  ),
}

// ─── Form controls ───────────────────────────────────────────────────────────

export const FormControls = {
  name: 'Form Controls',
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <Form>
        <Form.Group className="mb-3">
          <Form.Label>Text input</Form.Label>
          <Form.Control type="text" placeholder="Enter plant name…" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Select</Form.Label>
          <Form.Select>
            <option>Ground</option>
            <option>Garden bed</option>
            <option>Pot</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Textarea</Form.Label>
          <Form.Control as="textarea" rows={3} placeholder="Care notes…" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check type="checkbox" label="Mark as outdoor plant" />
          <Form.Check type="radio" name="health" label="Excellent" />
          <Form.Check type="radio" name="health" label="Good" />
          <Form.Check type="radio" name="health" label="Fair" />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Search with icon</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <svg className="sa-icon" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#search" /></svg>
            </InputGroup.Text>
            <Form.Control placeholder="Search plants…" />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Disabled</Form.Label>
          <Form.Control type="text" placeholder="Disabled" disabled />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Invalid</Form.Label>
          <Form.Control type="text" isInvalid />
          <Form.Control.Feedback type="invalid">
            This field is required.
          </Form.Control.Feedback>
        </Form.Group>
      </Form>
    </div>
  ),
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const Alerts = {
  render: () => (
    <div style={{ maxWidth: 520 }}>
      {['primary', 'success', 'warning', 'danger', 'info'].map((v) => (
        <Alert key={v} variant={v} className="d-flex align-items-center gap-2">
          <svg className="sa-icon" style={{ width: 16, height: 16 }} aria-hidden="true">
            <use href={`/icons/sprite.svg#${
              v === 'success' ? 'check-circle' :
              v === 'danger' ? 'alert-circle' :
              v === 'warning' ? 'alert-triangle' :
              'info'
            }`} />
          </svg>
          <span>{v.charAt(0).toUpperCase() + v.slice(1)} alert — contextual feedback.</span>
        </Alert>
      ))}
    </div>
  ),
}
