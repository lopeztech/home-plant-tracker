import { useState, useMemo } from 'react'
import { Row, Col, Nav, Form, Badge } from 'react-bootstrap'
import Chart from 'react-apexcharts'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'
import HelpTooltip from '../components/HelpTooltip.jsx'
import ChartFrame from '../components/ChartFrame.jsx'
import { formatDate } from '../utils/format.js'
import { HEALTH_COLORS as CB_HEALTH, getApexTheme, getApexAxisDefaults, heatmapColor, OKABE_ITO } from '../charts/theme.js'

// Color-blind safe health palette (Okabe-Ito based).
const HEALTH_COLORS = CB_HEALTH
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
    return { week: formatDate(weekStart, { month: 'short', day: 'numeric' }), count }
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

// Use color-blind safe sequential palette from charts/theme for the heatmap.
function heatColor(count) {
  return heatmapColor(count, 3)
}

function incidentStats(plants) {
  const typeCounts = {}
  let totalResolved = 0
  let totalResolutionDays = 0
  for (const p of plants) {
    for (const inc of (p.incidents || [])) {
      const key = `${inc.category}:${inc.specificType}`
      typeCounts[key] = (typeCounts[key] || { category: inc.category, type: inc.specificType, count: 0 })
      typeCounts[key].count++
      if (inc.resolvedAt && inc.firstObservedAt) {
        const days = Math.round((new Date(inc.resolvedAt) - new Date(inc.firstObservedAt)) / 86400000)
        if (days >= 0) { totalResolved++; totalResolutionDays += days }
      }
    }
  }
  const topTypes = Object.values(typeCounts).sort((a, b) => b.count - a.count).slice(0, 5)
  const avgResolutionDays = totalResolved > 0 ? Math.round(totalResolutionDays / totalResolved) : null
  const activeIncidents = plants.flatMap(p => (p.incidents || []).filter(i => !i.resolvedAt))
  return { topTypes, avgResolutionDays, activeCount: activeIncidents.length }
}

function OverviewTab({ plants, theme }) {
  const healthData = useMemo(() => {
    const counts = {}
    for (const p of plants) { counts[p.health || 'Unknown'] = (counts[p.health || 'Unknown'] || 0) + 1 }
    return HEALTH_ORDER.filter((h) => counts[h]).map((h) => ({ name: h, value: counts[h], color: HEALTH_COLORS[h] }))
  }, [plants])

  const pestStats = useMemo(() => incidentStats(plants), [plants])

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

  const axisDefaults = getApexAxisDefaults(theme)
  const healthChartOpts = {
    chart: { type: 'donut', background: 'transparent' },
    theme: getApexTheme(theme),
    labels: healthData.map((d) => d.name),
    colors: healthData.map((d) => d.color),
    legend: { position: 'right', fontSize: '13px', ...axisDefaults.legend },
    plotOptions: { pie: { donut: { size: '65%' } } },
    dataLabels: { enabled: false },
    tooltip: {
      ...axisDefaults.tooltip,
      y: { formatter: (val, { seriesIndex, w }) => `${val} plant${val !== 1 ? 's' : ''} (${Math.round((val / plants.length) * 100)}%)` },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          legend: { position: 'bottom', fontSize: '12px' },
          plotOptions: { pie: { donut: { size: '60%' } } },
        },
      },
    ],
  }

  return (
    <div>
      <Row className="mb-4">
        <Col md={6}>
          <ChartFrame
            title="Health Distribution"
            unit="plants"
            empty={plants.length === 0}
            help={<HelpTooltip articleId="analytics" label="Explain health distribution chart" />}
          >
            <>
              <Chart options={healthChartOpts} series={healthData.map((d) => d.value)} type="donut" height={200} />
              <table className="visually-hidden">
                <caption>Health distribution of tracked plants</caption>
                <thead><tr><th scope="col">Health</th><th scope="col">Plants</th></tr></thead>
                <tbody>
                  {healthData.map((d) => (
                    <tr key={d.name}><td>{d.name}</td><td>{d.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          </ChartFrame>
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
                          <span className="tx-title">{p.name}</span>
                          <div className="tx-muted">
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
      <ChartFrame
        title="Watering Activity — Last 12 Weeks"
        className="mb-4"
        empty={plants.length === 0}
        help={<HelpTooltip articleId="analytics" label="Explain watering heatmap" />}
      >
        <>
          <div className="d-flex gap-1 flex-wrap" role="img" aria-label="Watering activity heatmap, last 12 weeks">
            {heatmapDays.map((day) => (
              <div
                key={day.dateStr}
                title={`${day.dateStr}: ${day.count} plant${day.count !== 1 ? 's' : ''} watered`}
                style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(day.count) }}
              />
            ))}
          </div>
          <div className="d-flex align-items-center gap-1 mt-2 tx-muted">
            <span className="fs-xs">Less</span>
            {[0, 1, 2, 3].map((n) => <div key={n} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(n) }} />)}
            <span className="fs-xs">More</span>
          </div>
          <table className="visually-hidden">
            <caption>Days where at least one plant was watered, last 12 weeks</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Plants watered</th></tr></thead>
            <tbody>
              {heatmapDays.filter((d) => d.count > 0).map((d) => (
                <tr key={d.dateStr}><td>{d.dateStr}</td><td>{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      </ChartFrame>

      {/* Pest & Disease */}
      <ChartFrame title="Pest &amp; Disease" empty={plants.length === 0}>
        <>
          <Row>
            <Col xs={6} md={3} className="mb-3 text-center">
              <div className="fs-3 fw-600 text-danger">{pestStats.activeCount}</div>
              <div className="tx-muted">Active incidents</div>
            </Col>
            <Col xs={6} md={3} className="mb-3 text-center">
              <div className="fs-3 fw-600">{pestStats.avgResolutionDays !== null ? `${pestStats.avgResolutionDays}d` : '—'}</div>
              <div className="tx-muted">Avg. resolution time</div>
            </Col>
            <Col md={6} className="mb-3">
              <div className="tx-muted fw-600 mb-2">Most common issues</div>
              {pestStats.topTypes.length === 0
                ? <p className="text-muted fs-sm mb-0">No incidents logged yet.</p>
                : pestStats.topTypes.map(t => (
                  <div key={`${t.category}:${t.type}`} className="d-flex align-items-center gap-2 mb-1">
                    <Badge bg={t.category === 'pest' ? 'danger' : t.category === 'disease' ? 'warning' : 'secondary'}
                      text={t.category === 'disease' ? 'dark' : undefined} className="fs-xs text-capitalize">
                      {t.category}
                    </Badge>
                    <span className="fs-sm">{t.type}</span>
                    <span className="ms-auto fs-xs text-muted">{t.count}×</span>
                  </div>
                ))
              }
            </Col>
          </Row>
        </>
      </ChartFrame>
    </div>
  )
}

function PerPlantTab({ plants, theme }) {
  const [selectedId, setSelectedId] = useState(plants[0]?.id ?? '')
  const plant = plants.find((p) => p.id === selectedId) ?? plants[0]

  const score = useMemo(() => plant ? consistencyScore(plant) : null, [plant])
  const weeklyData = useMemo(() => plant ? getWateringByWeek(plant, 12) : [], [plant])

  const daysSinceLast = useMemo(() => {
    if (!plant?.lastWatered) return null
    return Math.round((Date.now() - new Date(plant.lastWatered).getTime()) / 86400000)
  }, [plant])

  if (!plant) return <p className="text-muted">No plants yet.</p>

  const axisDefaults = getApexAxisDefaults(theme)
  const barOpts = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    theme: getApexTheme(theme),
    xaxis: { categories: weeklyData.map((w) => w.week), ...axisDefaults.xaxis },
    yaxis: { ...axisDefaults.yaxis, title: { text: 'waterings', style: { color: axisDefaults.yaxis.labels.style.colors } } },
    colors: [OKABE_ITO[1]],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    grid: axisDefaults.grid,
    tooltip: { ...axisDefaults.tooltip, y: { formatter: (val) => `${val} watering${val !== 1 ? 's' : ''}` } },
    annotations: plant.frequencyDays ? {
      yaxis: [{ y: +(7 / plant.frequencyDays).toFixed(2), borderColor: '#E69F00', strokeDashArray: 4, label: { text: 'Target', style: { color: '#E69F00', background: 'transparent' } } }]
    } : {},
    responsive: [
      {
        breakpoint: 480,
        options: {
          xaxis: { labels: { rotate: -45, style: { fontSize: '10px' } } },
          plotOptions: { bar: { columnWidth: '80%' } },
        },
      },
    ],
  }

  const radialOpts = {
    chart: { type: 'radialBar', background: 'transparent' },
    theme: getApexTheme(theme),
    plotOptions: { radialBar: { hollow: { size: '65%' }, dataLabels: { name: { show: true, fontSize: '12px' }, value: { show: true, fontSize: '24px', fontWeight: 700 } } } },
    labels: [score !== null ? (score >= 80 ? 'Consistent' : score >= 60 ? 'Moderate' : 'Irregular') : 'No data'],
    colors: [score !== null ? (score >= 80 ? '#009E73' : score >= 60 ? '#E69F00' : '#D55E00') : '#6b7280'],
    responsive: [
      {
        breakpoint: 480,
        options: {
          plotOptions: {
            radialBar: {
              hollow: { size: '55%' },
              dataLabels: { name: { fontSize: '10px' }, value: { fontSize: '18px' } },
            },
          },
        },
      },
    ],
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
          <ChartFrame
            title="Consistency Score"
            empty={score === null}
            emptyText="Need at least 2 watering events to compute score."
            help={<HelpTooltip articleId="analytics" label="What is the consistency score?" />}
          >
            <>
              <div className="text-center">
                <Chart options={radialOpts} series={[score]} type="radialBar" height={200} />
              </div>
              <p className="visually-hidden">
                Consistency score {score} out of 100 — {radialOpts.labels[0]}.
              </p>
            </>
          </ChartFrame>
        </Col>
        <Col md={6}>
          <ChartFrame title="Last Watered" unit="days" empty={daysSinceLast === null} emptyText="No watering recorded yet.">
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
          </ChartFrame>
        </Col>
      </Row>

      <ChartFrame
        title="Watering Timeline — Last 12 Weeks"
        unit="waterings"
        empty={weeklyData.every((w) => w.count === 0)}
        emptyText="No watering events in the last 12 weeks."
      >
        <>
          <Chart options={barOpts} series={[{ name: 'Waterings', data: weeklyData.map((w) => w.count) }]} type="bar" height={200} />
          <table className="visually-hidden">
            <caption>Weekly watering count, last 12 weeks</caption>
            <thead><tr><th scope="col">Week starting</th><th scope="col">Waterings</th></tr></thead>
            <tbody>
              {weeklyData.map((w) => (
                <tr key={w.week}><td>{w.week}</td><td>{w.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      </ChartFrame>
    </div>
  )
}

export default function AnalyticsPage() {
  const { plants } = usePlantContext()
  const { theme } = useLayoutContext()
  const [tab, setTab] = useState('overview')

  return (
    <div className="content-wrapper">
      <h1 className="subheader-title mb-2">Analytics</h1>
      <p className="tx-muted mb-4">{plants.length} plant{plants.length !== 1 ? 's' : ''} tracked</p>

      <Nav variant="tabs" className="mb-4">
        <Nav.Item><Nav.Link active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link active={tab === 'plant'} onClick={() => setTab('plant')}>Per Plant</Nav.Link></Nav.Item>
      </Nav>

      <div className="main-content">
        {tab === 'overview' ? <OverviewTab plants={plants} theme={theme} /> : <PerPlantTab plants={plants} theme={theme} />}
      </div>
    </div>
  )
}
