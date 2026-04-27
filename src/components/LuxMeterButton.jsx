import { useState, useRef, useEffect } from 'react'
import { Button, Badge, Spinner } from 'react-bootstrap'
import { plantsApi } from '../api/plants.js'

const LUX_THRESHOLDS = {
  'full-sun':  { min: 5000, ideal: 15000, label: 'Full sun',  unit: 'direct sun' },
  'part-sun':  { min: 800,  ideal: 3000,  label: 'Part sun',  unit: 'bright indirect' },
  'shade':     { min: 50,   ideal: 500,   label: 'Shade',     unit: 'low light' },
}

export function luxVerdict(lux, sunExposure) {
  const th = LUX_THRESHOLDS[sunExposure]
  if (!th) return null
  if (lux >= th.ideal)        return { color: 'success', text: `Great light for ${th.label.toLowerCase()}` }
  if (lux >= th.min)          return { color: 'warning', text: `Adequate — ideally needs more (${th.label.toLowerCase()})` }
  return { color: 'danger',   text: `Too dark for this plant — it wants ${th.unit} (${th.ideal.toLocaleString()}+ lux)` }
}

export function formatLux(lux) {
  if (lux >= 10000) return `${(lux / 1000).toFixed(0)}k lux`
  if (lux >= 1000)  return `${(lux / 1000).toFixed(1)}k lux`
  return `${Math.round(lux)} lux`
}

export default function LuxMeterButton({ plantId, sunExposure, onReading }) {
  const [state, setState] = useState('idle') // idle | reading | done | unsupported | error
  const [lux, setLux] = useState(null)
  const sensorRef = useRef(null)

  useEffect(() => () => { sensorRef.current?.stop?.() }, [])

  const measure = async () => {
    if (!('AmbientLightSensor' in window)) {
      setState('unsupported')
      return
    }
    setState('reading')
    try {
      const perm = await navigator.permissions.query({ name: 'ambient-light-sensor' }).catch(() => ({ state: 'granted' }))
      if (perm.state === 'denied') { setState('unsupported'); return }

      const sensor = new window.AmbientLightSensor({ frequency: 1 })
      sensorRef.current = sensor
      sensor.addEventListener('error', () => setState('error'))
      sensor.addEventListener('reading', () => {
        const val = sensor.illuminance
        sensor.stop()
        setLux(val)
        setState('done')
        if (plantId) {
          plantsApi.update(plantId, {
            lastLuxReading: val,
            lastLuxReadingDate: new Date().toISOString(),
          }).catch(() => {})
        }
        onReading?.(val)
      })
      sensor.start()
    } catch {
      setState('error')
    }
  }

  const verdict = lux !== null && sunExposure ? luxVerdict(lux, sunExposure) : null

  if (state === 'unsupported') {
    return (
      <p className="text-muted fs-xs mb-0">
        Light measurement requires Chrome on Android with a physical ambient-light sensor.
      </p>
    )
  }

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={measure}
        disabled={state === 'reading'}
      >
        {state === 'reading' ? (
          <><Spinner size="sm" animation="border" className="me-1" />Reading…</>
        ) : (
          <>
            <svg className="sa-icon me-1" style={{ width: 14, height: 14 }} aria-hidden="true">
              <use href="/icons/sprite.svg#sun" />
            </svg>
            Measure light
          </>
        )}
      </Button>

      {lux !== null && (
        <span className="fs-xs">
          <Badge bg="secondary" className="me-1">{formatLux(lux)}</Badge>
          {verdict && (
            <span className={`text-${verdict.color}`}>{verdict.text}</span>
          )}
          {!verdict && <span className="text-muted">Set sun exposure above to get a verdict.</span>}
        </span>
      )}

      {state === 'error' && (
        <span className="text-danger fs-xs">Could not read sensor. Try again.</span>
      )}
    </div>
  )
}
