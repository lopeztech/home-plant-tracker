import { useState, useEffect } from 'react'
import { Modal, Button, ProgressBar } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProfile } from '../context/ProfileContext.jsx'

const LS_KEY = 'plant-tracker-onboarded'

// Step icons keyed by persona — landscaper steps are about properties /
// visits / branding, household are about floorplan / plants / watering.
const STEP_ICONS = {
  household:  ['/icons/sprite.svg#upload',     '/icons/sprite.svg#plus',     '/icons/sprite.svg#droplet'],
  landscaper: ['/icons/sprite.svg#home',       '/icons/sprite.svg#calendar', '/icons/sprite.svg#star'],
}

// `both` reuses the household track — it's the broader of the two and the
// user can re-take the landscaper tour from the Take-a-tour menu later.
const STEP_KEYS = {
  household:  ['step1', 'step2', 'step3'],
  landscaper: ['landscaperStep1', 'landscaperStep2', 'landscaperStep3'],
}

function infoStepsFor(persona, t) {
  const track = persona === 'landscaper' ? 'landscaper' : 'household'
  return STEP_KEYS[track].map((key, i) => ({
    kind: 'info',
    icon: STEP_ICONS[track][i],
    title: t(`${key}.title`),
    description: t(`${key}.description`),
  }))
}

export default function Onboarding() {
  const { t } = useTranslation('onboarding')
  const { accountType, setAccountType } = useProfile()
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)
  const [savingPersona, setSavingPersona] = useState(false)

  // First step is the persona picker (no Next button — clicking a card
  // saves and advances). Remaining steps adapt to the picked persona —
  // landscaper sees Property/Visit/Branding copy, household sees the
  // original Floorplan/Plants/Watering copy.
  const PERSONA_STEP = { kind: 'persona' }
  const INFO_STEPS = infoStepsFor(accountType, t)
  const STEPS = [PERSONA_STEP, ...INFO_STEPS]

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

  const pickPersona = async (accountType) => {
    if (savingPersona) return
    setSavingPersona(true)
    try {
      await setAccountType(accountType)
    } catch { /* ProfileContext rolls back; surface nothing here */ }
    finally {
      setSavingPersona(false)
      setStep((s) => s + 1)
    }
  }

  if (!show) return null
  const current = STEPS[step]
  const isPersonaStep = current.kind === 'persona'

  return (
    <Modal show={show} onHide={dismiss} centered size={isPersonaStep ? 'md' : 'sm'}>
      <Modal.Body className="p-4">
        <ProgressBar
          now={((step + 1) / STEPS.length) * 100}
          variant="primary"
          className="mb-4"
          style={{ height: 4 }}
        />

        <div className="d-flex align-items-start justify-content-end mb-3">
          <button className="btn btn-sm text-muted p-0" onClick={dismiss} aria-label={t('skipTour')}>
            <svg className="sa-icon"><use href="/icons/sprite.svg#x"></use></svg>
          </button>
        </div>

        {isPersonaStep ? (
          <>
            <h5 className="fw-500 mb-2">How will you use Plant Tracker?</h5>
            <p className="text-muted fs-sm mb-3">You can change this later in Settings.</p>
            <div className="d-flex flex-column gap-2" role="radiogroup" aria-label="Profile mode">
              <button
                type="button"
                onClick={() => pickPersona('household')}
                disabled={savingPersona}
                className="btn btn-outline-primary text-start p-3 d-flex gap-2 align-items-start"
              >
                <svg className="sa-icon sa-icon-2x flex-shrink-0 mt-1" aria-hidden="true">
                  <use href="/icons/sprite.svg#home"></use>
                </svg>
                <span>
                  <span className="d-block fw-500">Caring for your home garden</span>
                  <span className="d-block text-muted fs-sm">Track plants, share with family, log watering and feeding.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => pickPersona('landscaper')}
                disabled={savingPersona}
                className="btn btn-outline-primary text-start p-3 d-flex gap-2 align-items-start"
              >
                <svg className="sa-icon sa-icon-2x flex-shrink-0 mt-1" aria-hidden="true">
                  <use href="/icons/sprite.svg#briefcase"></use>
                </svg>
                <span>
                  <span className="d-block fw-500">Managing client properties</span>
                  <span className="d-block text-muted fs-sm">Multi-property visits, team scheduling, branded reports.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => pickPersona('both')}
                disabled={savingPersona}
                className="btn btn-link btn-sm text-muted text-decoration-none align-self-center"
              >
                I do both — show me everything
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-3 bg-primary bg-opacity-10 d-flex align-items-center justify-content-center mb-3" style={{ width: 48, height: 48 }}>
              <svg className="sa-icon sa-icon-2x text-primary">
                <use href={current.icon}></use>
              </svg>
            </div>
            <h5 className="fw-500 mb-2">{current.title}</h5>
            <p className="text-muted fs-sm mb-0">{current.description}</p>
          </>
        )}
      </Modal.Body>
      {!isPersonaStep && (
        <Modal.Footer className="border-top-0 d-flex justify-content-between">
          <button className="btn btn-link btn-sm text-muted p-0" onClick={dismiss}>
            {t('skipTour')}
          </button>
          <Button variant="primary" size="sm" onClick={next}>
            {step < STEPS.length - 1 ? (
              <>
                {t('common:actions.next')}
                <svg className="sa-icon ms-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#chevron-right"></use></svg>
              </>
            ) : t('getStarted')}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  )
}
