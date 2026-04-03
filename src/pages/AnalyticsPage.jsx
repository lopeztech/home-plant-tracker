import { useState, useMemo } from 'react'
import { Row, Col, Card, Nav, Form, Badge } from 'react-bootstrap'
import Chart from 'react-apexcharts'
import { usePlantContext } from '../context/PlantContext.jsx'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'

const HEALTH_COLORS = { Excellent: '#10b981', Good: '#22c55e', Fair: '#f59e0b', Poor: '#ef4444' }
const HEALTH_ORDER = ['Excellent', 'Good', 'Fair', 'Poor']
const HEALTH_VALUE = { Excellent: 4, Good: 3, Fair: 2, Poor: 1 }

function consistencyScore(plant) {
  const log = plant.wateringLog || []
  if (log.length < 2) return null
  const sorted = [...log].sort((a, b) => new Date(a.date) - new Date(b.date))
  let totalDev = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000
    totalDev += Math.abs(gap - plant.frequencyDays)
  }
  return Math.max(0, Math.min(100, Math.round(100 - (totalDev / (sorted.length - 1) / plant.frequencyDays) * 100)))
}

function getWateringByWeek(plant, weeks = 12) {
  const now = new Date()
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(now.getTime() - (weeks - 1 - i) * 7 * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const count = (plant.wateringLog || []).filter((e) => { const d = new Date(e.date); return d >= weekStart && d < weekEnd }).length
    return { week: weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }), count }
  })
}

function buildHeatmap(plants) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today.getTime() - (83 - i) * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    let count = 0
    for (const plant of plants) { if ((plant.wateringLog || []).some((e) => e.date.slice(0, 10) === dateStr)) count++ }
    return { date: d, dateStr, count, dow: (d.getDay() + 6) % 7 }
  })
}

function heatColor(count) {
  if (count === 0) return 'var(--bs-tertiary-bg)'
  if (count === 1) return 'var(--bs-success)'
  if (count === 2) return '#059669'
  return '#047857'
}

function OverviewTab({ plants }) {
  const healthData = useMemo(() => {
    const counts = {}
    for (const p of plants) { counts[p.health || 'Unknown'] = (counts[p.health || 'Unknown'] || 0) + 1 }
    return HEALTH_ORDER.filter((h) => counts[h]).map((h) => ({ name: h, value: counts[h], color: HEALTH_COLORS[h] }))
  }, [plants])

  const atRisk = useMemo(() => {
    const now = Date.now()
    return plants.filter((p) => {
      if (p.health === 'Poor' || p.health === 'Fair') return true
      if (p.lastWatered && p.frequencyDays) {
        return (now - new Date(p.lastWatered).getTime()) / 86400000 - p.frequencyDays > 3
      }
      return false
    }).slice(0, 6)
  }, [plants])

  const heatmapDays = useMemo(() => buildHeatmap(plants), [plants])

  const healthChartOpts = {
    chart: { type: 'donut' },
    labels: healthData.map((d) => d.name),
    colors: healthData.map((d) => d.color),
    legend: { position: 'right', fontSize: '13px' },
    plotOptions: { pie: { donut: { size: '65%' } } },
    dataLabels: { enabled: false },
  }

  return (
    <div>
      <Row className="mb-4">
        <Col md={6}>
          <div className="panel panel-icon">
            <div className="panel-hdr"><span>Health Distribution</span></div>
            <div className="panel-container"><div className="panel-content">
              {plants.length === 0 ? <p className="text-muted">No plants yet.</p> : (
                <Chart options={healthChartOpts} series={healthData.map((d) => d.value)} type="donut" height={200} />
              )}
            </div></div>
          </div>
        </Col>
        <Col md={6}>
          <div className="panel panel-icon">
            <div className="panel-hdr"><span>At-Risk Plants</span></div>
            <div className="panel-container"><div className="panel-content">
              {atRisk.length === 0 ? (
                <div className="d-flex align-items-center gap-2 text-success">
                  <svg className="sa-icon"><use href="/icons/sprite.svg#feather"></use></svg>
                  All plants are thriving!
                </div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {atRisk.map((p) => {
                    const daysOverdue = p.lastWatered && p.frequencyDays
                      ? Math.round((Date.now() - new Date(p.lastWatered).getTime()) / 86400000 - p.frequencyDays) : null
                    return (
                      <li key={p.id} className="d-flex align-items-start gap-2 mb-2">
                        <svg className="sa-icon text-warning flex-shrink-0 mt-1" style={{ width: 14, height: 14 }}><use href="/icons/sprite.svg#alert-triangle"></use></svg>
                        <div>
                          <span className="fw-500 fs-sm">{p.name}</span>
                          <div className="fs-xs text-muted">
                            {(p.health === 'Poor' || p.health === 'Fair') && <span className="text-warning">{p.health} health</span>}
                            {daysOverdue > 3 && <span className="text-danger ms-1">{daysOverdue}d overdue</span>}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div></div>
          </div>
        </Col>
      </Row>

      {/* Heatmap */}
      <div className="panel panel-icon mb-4">
        <div className="panel-hdr"><span>Watering Activity — Last 12 Weeks</span></div>
        <div className="panel-container"><div className="panel-content">
          <div className="d-flex gap-1 flex-wrap">
            {heatmapDays.map((day) => (
              <div
                key={day.dateStr}
                title={`${day.dateStr}: ${day.count} plant${day.count !== 1 ? 's' : ''} watered`}
                style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(day.count) }}
              />
            ))}
          </div>
          <div className="d-flex align-items-center gap-1 mt-2 fs-xs text-muted">
            <span>Less</span>
            {[0, 1, 2, 3].map((n) => <div key={n} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(n) }} />)}
            <span>More</span>
          </div>
        </div></div>
      </div>
    </div>
  )
}

function PerPlantTab({ plants }) {
  const [selectedId, setSelectedId] = useState(plants[0]?.id ?? '')
  const plant = plants.find((p) => p.id === selectedId) ?? plants[0]

  const score = useMemo(() => plant ? consistencyScore(plant) : null, [plant])
  const weeklyData = useMemo(() => plant ? getWateringByWeek(plant, 12) : [], [plant])

  const daysSinceLast = useMemo(() => {
    if (!plant?.lastWatered) return null
    return Math.round((Date.now() - new Date(plant.lastWatered).getTime()) / 86400000)
  }, [plant])

  if (!plant) return <p className="text-muted">No plants yet.</p>

  const barOpts = {
    chart: { type: 'bar', toolbar: { show: false } },
    xaxis: { categories: weeklyData.map((w) => w.week) },
    colors: ['var(--bs-primary, #10b981)'],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    annotations: plant.frequencyDays ? {
      yaxis: [{ y: +(7 / plant.frequencyDays).toFixed(2), borderColor: '#f59e0b', strokeDashArray: 4, label: { text: 'Target', style: { color: '#f59e0b', background: 'transparent' } } }]
    } : {},
  }

  const radialOpts = {
    chart: { type: 'radialBar' },
    plotOptions: { radialBar: { hollow: { size: '65%' }, dataLabels: { name: { show: true, fontSize: '12px' }, value: { show: true, fontSize: '24px', fontWeight: 700 } } } },
    labels: [score !== null ? (score >= 80 ? 'Consistent' : score >= 60 ? 'Moderate' : 'Irregular') : 'No data'],
    colors: [score !== null ? (score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444') : '#6b7280'],
  }

  return (
    <div>
      <Form.Group className="mb-4">
        <Form.Label className="text-muted fs-xs">Select plant</Form.Label>
        <Form.Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {plants.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.species || p.room}</option>)}
        </Form.Select>
      </Form.Group>

      <Row className="mb-4">
        <Col md={6}>
          <div className="panel panel-icon">
            <div className="panel-hdr"><span>Consistency Score</span></div>
            <div className="panel-container"><div className="panel-content text-center">
              {score === null ? <p className="text-muted fs-sm py-3">Need at least 2 watering events.</p> : (
                <Chart options={radialOpts} series={[score]} type="radialBar" height={200} />
              )}
            </div></div>
          </div>
        </Col>
        <Col md={6}>
          <div className="panel panel-icon">
            <div className="panel-hdr"><span>Last Watered</span></div>
            <div className="panel-container"><div className="panel-content">
              {daysSinceLast === null ? <p className="text-muted fs-sm">No watering recorded.</p> : (
                <>
                  <div className="d-flex align-items-baseline gap-1 mb-3">
                    <span className="display-6 fw-bold">{daysSinceLast}</span>
                    <span className="text-muted">days ago</span>
                  </div>
                  {plant.frequencyDays && (
                    <p className="fs-xs text-muted">
                      Recommended every <strong>{plant.frequencyDays}d</strong>
                      {daysSinceLast > plant.frequencyDays
                        ? <span className="text-danger ms-1">· {daysSinceLast - plant.frequencyDays}d overdue</span>
                        : <span className="text-success ms-1">· {plant.frequencyDays - daysSinceLast}d remaining</span>}
                    </p>
                  )}
                </>
              )}
            </div></div>
          </div>
        </Col>
      </Row>

      <div className="panel panel-icon">
        <div className="panel-hdr"><span>Watering Timeline — Last 12 Weeks</span></div>
        <div className="panel-container"><div className="panel-content">
          {weeklyData.every((w) => w.count === 0) ? (
            <p className="text-muted fs-sm">No watering events in the last 12 weeks.</p>
          ) : (
            <Chart options={barOpts} series={[{ name: 'Waterings', data: weeklyData.map((w) => w.count) }]} type="bar" height={200} />
          )}
        </div></div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { plants } = usePlantContext()
  const [tab, setTab] = useState('overview')

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-2">Analytics</h1>
      <p className="text-muted mb-4">{plants.length} plant{plants.length !== 1 ? 's' : ''} tracked</p>

      <Nav variant="tabs" className="mb-4">
        <Nav.Item><Nav.Link active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link active={tab === 'plant'} onClick={() => setTab('plant')}>Per Plant</Nav.Link></Nav.Item>
      </Nav>

      <div className="main-content">
        {tab === 'overview' ? <OverviewTab plants={plants} /> : <PerPlantTab plants={plants} />}
      </div>
    </div>
  )
}
