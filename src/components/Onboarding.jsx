import { useState, useEffect } from 'react'
import { Modal, Button, ProgressBar } from 'react-bootstrap'

const LS_KEY = 'plant-tracker-onboarded'

const STEPS = [
  {
    icon: '/icons/sprite.svg#upload',
    title: 'Upload a Floorplan',
    description: 'Go to Settings and upload a photo of your floor plan. Gemini AI will identify rooms automatically.',
  },
  {
    icon: '/icons/sprite.svg#plus',
    title: 'Add Your Plants',
    description: 'Click anywhere on the floorplan to place a plant. Take a photo to auto-identify the species.',
  },
  {
    icon: '/icons/sprite.svg#droplet',
    title: 'Track Watering',
    description: 'Mark plants as watered to build your care schedule. Get reminders when plants need attention.',
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(LS_KEY)) setShow(true)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(LS_KEY, '1')
  }

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else dismiss()
  }

  if (!show) return null
  const current = STEPS[step]

  return (
    <Modal show={show} onHide={dismiss} centered size="sm">
      <Modal.Body className="p-4">
        <ProgressBar
          now={((step + 1) / STEPS.length) * 100}
          variant="primary"
          className="mb-4"
          style={{ height: 4 }}
        />

        <div className="d-flex align-items-start justify-content-between mb-3">
          <div className="rounded-3 bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
            <svg className="sa-icon sa-icon-2x text-primary">
              <use href={current.icon}></use>
            </svg>
          </div>
          <button className="btn btn-sm text-muted p-0" onClick={dismiss} aria-label="Skip">
            <svg className="sa-icon"><use href="/icons/sprite.svg#x"></use></svg>
          </button>
        </div>

        <h5 className="fw-500 mb-2">{current.title}</h5>
        <p className="text-muted fs-sm mb-0">{current.description}</p>
      </Modal.Body>
      <Modal.Footer className="border-top-0 d-flex justify-content-between">
        <button className="btn btn-link btn-sm text-muted p-0" onClick={dismiss}>
          Skip tour
        </button>
        <Button variant="primary" size="sm" onClick={next}>
          {step < STEPS.length - 1 ? (
            <>
              Next
              <svg className="sa-icon ms-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#chevron-right"></use></svg>
            </>
          ) : 'Get started'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
