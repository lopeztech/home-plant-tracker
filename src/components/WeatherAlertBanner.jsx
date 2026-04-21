import { useMemo, useState } from 'react'
import { Alert, Button, Collapse } from 'react-bootstrap'
import { usePlantContext } from '../context/PlantContext.jsx'
import { buildWeatherAlerts } from '../utils/weatherAlerts.js'

const ALERT_META = {
  frost:        { icon: 'cloud-snow',     variant: 'danger',  label: 'Frost tonight' },
  heatwave:     { icon: 'sun',            variant: 'danger',  label: 'Heatwave' },
  'heavy-rain': { icon: 'cloud-rain',     variant: 'warning', label: 'Heavy rain' },
  drought:      { icon: 'alert-triangle', variant: 'warning', label: 'Long dry spell' },
}

export default function WeatherAlertBanner() {
  const { plants, weather, floors } = usePlantContext()
  const { alerts } = useMemo(
    () => buildWeatherAlerts(plants, weather, floors),
    [plants, weather, floors],
  )

  if (alerts.length === 0) return null

  return (
    <div className="mb-3">
      {alerts.map((a) => <SingleAlert key={a.type} alert={a} />)}
    </div>
  )
}

function SingleAlert({ alert }) {
  const [open, setOpen] = useState(alert.severity === 'critical')
  const meta = ALERT_META[alert.type] ?? { icon: 'alert-circle', variant: 'warning', label: alert.type }
  const panelId = `alert-${alert.type}-plants`

  return (
    <Alert variant={meta.variant} className="mb-2">
      <div className="d-flex align-items-start gap-2">
        <svg className="sa-icon flex-shrink-0 mt-1" style={{ width: 20, height: 20 }} aria-hidden="true">
          <use href={`/icons/sprite.svg#${meta.icon}`}></use>
        </svg>
        <div className="flex-grow-1">
          <div className="fw-600">{meta.label} — {alert.summary}</div>
          <div className="fs-sm mt-1">{alert.advice}</div>
          <Button
            variant="link"
            size="sm"
            className={`p-0 mt-2 text-${meta.variant === 'danger' ? 'danger' : 'warning-emphasis'}`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide' : 'Show'} {alert.plants.length} affected plant{alert.plants.length === 1 ? '' : 's'}
          </Button>
          <Collapse in={open}>
            <ul id={panelId} className="list-unstyled mt-2 mb-0 fs-sm">
              {alert.plants.map((p) => (
                <li key={p.id} className="border-top border-opacity-25 py-1">
                  <span className="fw-500">{p.name}</span>
                  {p.room && <span className="text-muted"> · {p.room}</span>}
                  <div className="text-muted">{p.action}</div>
                </li>
              ))}
            </ul>
          </Collapse>
        </div>
      </div>
    </Alert>
  )
}
