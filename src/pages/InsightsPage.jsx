import { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, Card, Badge, Spinner, Button, ProgressBar } from 'react-bootstrap'
import Chart from 'react-apexcharts'
import { usePlantContext } from '../context/PlantContext.jsx'
import { plantsApi } from '../api/plants.js'
import UpgradePrompt from '../components/UpgradePrompt.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCard, SkeletonRect } from '../components/Skeleton.jsx'

const GRADE_COLORS = { A: '#10b981', B: '#22c55e', C: '#f59e0b', D: '#ef4444', F: '#991b1b' }
const PATTERN_COLORS = { optimal: '#10b981', over_watered: '#3b82f6', under_watered: '#ef4444', inconsistent: '#f59e0b', insufficient_data: '#9ca3af' }
const PATTERN_LABELS = { optimal: 'Optimal', over_watered: 'Over-watered', under_watered: 'Under-watered', inconsistent: 'Inconsistent', insufficient_data: 'No Data' }

export default function InsightsPage() {
  const { plants } = usePlantContext()
  const [careScores, setCareScores] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [plantDetails, setPlantDetails] = useState({})

  // Fetch aggregate care scores
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const scores = await plantsApi.careScores()
        if (!cancelled) setCareScores(scores)
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [plants])

  // Lazy-load individual plant ML details on expand
  const loadPlantDetails = useCallback(async (plantId) => {
    if (plantDetails[plantId]) return
    try {
      const [pattern, prediction, anomaly, recommendation] = await Promise.all([
        plantsApi.wateringPattern(plantId).catch(() => null),
        plantsApi.healthPrediction(plantId).catch(() => null),
        plantsApi.anomaly(plantId).catch(() => null),
        plantsApi.wateringRecommendation(plantId).catch(() => null),
      ])
      setPlantDetails(prev => ({ ...prev, [plantId]: { pattern, prediction, anomaly, recommendation } }))
    } catch { /* ignore */ }
  }, [plantDetails])

  const handleExpand = useCallback((plantId) => {
    setExpandedPlant(prev => prev === plantId ? null : plantId)
    loadPlantDetails(plantId)
  }, [loadPlantDetails])

  // Collection overview stats
  const overview = useMemo(() => {
    if (!careScores || careScores.length === 0) return null
    const avgScore = Math.round(careScores.reduce((s, c) => s + c.score, 0) / careScores.length)
    const atRisk = careScores.filter(c => c.score < 60)
    return { avgScore, atRisk, total: careScores.length }
  }, [careScores])

  // Watering pattern distribution for donut chart
  const patternDistribution = useMemo(() => {
    if (!careScores) return null
    // Group by patterns from loaded details, or show placeholder
    const counts = { optimal: 0, over_watered: 0, under_watered: 0, inconsistent: 0, insufficient_data: 0 }
    // Use grades as proxy: A/B likely optimal, C inconsistent, D/F problematic
    for (const score of careScores) {
      if (score.grade === 'A' || score.grade === 'B') counts.optimal++
      else if (score.grade === 'C') counts.inconsistent++
      else counts.under_watered++
    }
    return counts
  }, [careScores])

  // Minimum data check
  const insufficientData = plants.length < 3 || (plants.reduce((sum, p) => sum + (p.wateringLog || []).length, 0) < 10)

  if (insufficientData) {
    const totalWaterings = plants.reduce((sum, p) => sum + (p.wateringLog || []).length, 0)
    const plantsNeeded = Math.max(0, 3 - plants.length)
    const wateringsNeeded = Math.max(0, 10 - totalWaterings)
    const progressPct = Math.min(100, (totalWaterings / 10) * 100)
    const descParts = []
    if (plantsNeeded > 0) descParts.push(`Add ${plantsNeeded} more plant${plantsNeeded > 1 ? 's' : ''}`)
    if (wateringsNeeded > 0) descParts.push(`log ${wateringsNeeded} more watering${wateringsNeeded > 1 ? 's' : ''}`)
    return (
      <div className="content-wrapper">
        <h1 className="subheader-title mb-4">ML Insights</h1>
        <div className="panel panel-icon">
          <div className="panel-container"><div className="panel-content">
            <EmptyState
              icon="bar-chart-2"
              title="Not enough data yet"
              description={descParts.length > 0 ? `${descParts.join(' and ')} to unlock health predictions.` : 'Insights will appear as you log more plant care history.'}
              actions={[
                { label: 'Go to dashboard', icon: 'home', href: '/' },
              ]}
            />
            <div className="px-4 pb-4" style={{ maxWidth: 340, margin: '0 auto' }}>
              <ProgressBar
                now={progressPct}
                label={`${totalWaterings}/10 waterings`}
                variant="success"
                style={{ height: 8 }}
              />
              <p className="text-muted fs-xs text-center mt-2">{totalWaterings} of 10 waterings logged</p>
            </div>
          </div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="mb-4">ML Insights</h2>

      <UpgradePrompt id="insights-lock" feature="home_pro" variant="warning">
        Full ML Insights are a Home Pro feature. Free-tier users see basic per-plant care scores but not aggregate predictions, anomaly detection, or watering-pattern analysis.
      </UpgradePrompt>

      {loading ? (
        <div aria-label="Loading insights" aria-busy="true">
          <Row className="mb-4">
            {[1, 2, 3].map((k) => (
              <Col md={4} key={k} className="mb-3">
                <SkeletonCard height={120} />
              </Col>
            ))}
          </Row>
          <SkeletonCard height={240} className="mb-4" />
          <SkeletonRect height={180} style={{ borderRadius: 8 }} />
        </div>
      ) : (
        <>
          {/* Collection Overview */}
          {overview && (
            <Row className="mb-4">
              <Col md={4}>
                <Card className="h-100">
                  <Card.Body className="text-center">
                    <h6 className="text-muted mb-2">Collection Health</h6>
                    <div className="display-4 fw-bold" style={{ color: overview.avgScore >= 75 ? '#10b981' : overview.avgScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                      {overview.avgScore}
                    </div>
                    <small className="text-muted">{overview.total} plant{overview.total !== 1 ? 's' : ''}</small>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={4}>
                <Card className="h-100">
                  <Card.Body>
                    <h6 className="text-muted mb-2">At Risk</h6>
                    {overview.atRisk.length === 0 ? (
                      <p className="text-success mb-0">All plants healthy</p>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {overview.atRisk.slice(0, 5).map(p => (
                          <li key={p.plantId}>
                            <Badge bg="danger" className="me-2">{p.grade}</Badge>
                            {p.name} <small className="text-muted">({p.score})</small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              <Col md={4}>
                <Card className="h-100">
                  <Card.Body>
                    <h6 className="text-muted mb-2">Pattern Breakdown</h6>
                    {patternDistribution && (
                      <Chart
                        type="donut"
                        height={180}
                        series={Object.values(patternDistribution).filter(v => v > 0)}
                        options={{
                          labels: Object.keys(patternDistribution).filter(k => patternDistribution[k] > 0).map(k => PATTERN_LABELS[k]),
                          colors: Object.keys(patternDistribution).filter(k => patternDistribution[k] > 0).map(k => PATTERN_COLORS[k]),
                          legend: { position: 'bottom', fontSize: '11px' },
                          dataLabels: { enabled: false },
                        }}
                      />
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Per-Plant Scores */}
          <h5 className="mb-3">Plant Scores</h5>
          {careScores && careScores.map(score => (
            <Card key={score.plantId} className="mb-2">
              <Card.Body
                className="d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }}
                onClick={() => handleExpand(score.plantId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand(score.plantId) } }}
                role="button"
                tabIndex={0}
                aria-expanded={expandedPlant === score.plantId}
                aria-label={`${score.name} care score details`}
              >
                <div className="d-flex align-items-center gap-3">
                  <Badge
                    style={{ backgroundColor: GRADE_COLORS[score.grade], fontSize: '1.1rem', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {score.grade}
                  </Badge>
                  <div>
                    <strong>{score.name}</strong>
                    {score.species && <small className="text-muted ms-2">{score.species}</small>}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <span className="fw-bold">{score.score}</span>
                  <svg className="sa-icon" style={{ transform: expandedPlant === score.plantId ? 'rotate(180deg)' : '' }}>
                    <use href="/icons/sprite.svg#chevron-down"></use>
                  </svg>
                </div>
              </Card.Body>

              {expandedPlant === score.plantId && (
                <Card.Footer>
                  {!plantDetails[score.plantId] ? (
                    <div className="text-center p-3"><Spinner size="sm" /></div>
                  ) : (
                    <Row>
                      <Col md={3}>
                        <h6>Dimensions</h6>
                        {score.dimensions && (
                          <ul className="list-unstyled small">
                            <li>Consistency: {score.dimensions.consistency}</li>
                            <li>Timing: {score.dimensions.timing}</li>
                            <li>Health: {score.dimensions.healthOutcome}</li>
                            <li>Responsiveness: {score.dimensions.responsiveness}</li>
                          </ul>
                        )}
                      </Col>
                      <Col md={3}>
                        <h6>Watering Pattern</h6>
                        {plantDetails[score.plantId].pattern ? (
                          <>
                            <Badge style={{ backgroundColor: PATTERN_COLORS[plantDetails[score.plantId].pattern.pattern] }}>
                              {PATTERN_LABELS[plantDetails[score.plantId].pattern.pattern] || plantDetails[score.plantId].pattern.pattern}
                            </Badge>
                            <ul className="list-unstyled small mt-2">
                              {(plantDetails[score.plantId].pattern.contributingFactors || []).map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </>
                        ) : <small className="text-muted">Unavailable</small>}
                      </Col>
                      <Col md={3}>
                        <h6>Health Prediction</h6>
                        {plantDetails[score.plantId].prediction ? (
                          <>
                            <p className="mb-1">
                              In 2 weeks: <strong>{plantDetails[score.plantId].prediction.predictedHealth}</strong>
                              {' '}({plantDetails[score.plantId].prediction.trend})
                            </p>
                            <ul className="list-unstyled small">
                              {(plantDetails[score.plantId].prediction.keyRisks || []).map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </>
                        ) : <small className="text-muted">Unavailable</small>}
                      </Col>
                      <Col md={3}>
                        <h6>Recommendation</h6>
                        {plantDetails[score.plantId].recommendation ? (
                          <>
                            <p className="mb-1">
                              Every <strong>{plantDetails[score.plantId].recommendation.recommendedFrequencyDays}</strong> days
                              {plantDetails[score.plantId].recommendation.confidenceInterval &&
                                ` (${plantDetails[score.plantId].recommendation.confidenceInterval[0]}-${plantDetails[score.plantId].recommendation.confidenceInterval[1]})`
                              }
                            </p>
                            <small className="text-muted">{plantDetails[score.plantId].recommendation.basis}</small>
                          </>
                        ) : <small className="text-muted">Unavailable</small>}
                      </Col>
                    </Row>
                  )}
                </Card.Footer>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
