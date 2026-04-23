import { useState, useEffect, useMemo, useCallback } from 'react'
import { Row, Col, Card, Badge, Spinner, Button, Alert, ProgressBar } from 'react-bootstrap'
import Chart from 'react-apexcharts'
import { usePlantContext } from '../context/PlantContext.jsx'
import { useLayoutContext } from '../context/LayoutContext.jsx'
import { plantsApi } from '../api/plants.js'
import UpgradePrompt from '../components/UpgradePrompt.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCard, SkeletonRect } from '../components/Skeleton.jsx'

const GRADE_COLORS = { A: '#10b981', B: '#22c55e', C: '#f59e0b', D: '#ef4444', F: '#991b1b' }
const PATTERN_COLORS = { optimal: '#10b981', over_watered: '#3b82f6', under_watered: '#ef4444', inconsistent: '#f59e0b', insufficient_data: '#9ca3af' }
const PATTERN_LABELS = { optimal: 'Optimal', over_watered: 'Over-watered', under_watered: 'Under-watered', inconsistent: 'Inconsistent', insufficient_data: 'No Data' }

const CLUSTER_ICONS = {
  thirsty_tropicals: '🌿',
  forgiving_foliage: '🍃',
  drought_tolerant: '🌵',
  seasonal_bloomers: '🌸',
}

function AnomalyBadge({ anomaly }) {
  if (!anomaly) return null
  if (!anomaly.isAnomaly) {
    return <Badge bg="success" className="ms-2">Normal</Badge>
  }
  return (
    <Badge bg="danger" className="ms-2" title={`Score: ${anomaly.score}`}>
      ⚠ Anomaly
    </Badge>
  )
}

export default function InsightsPage() {
  const { plants } = usePlantContext()
  const { theme } = useLayoutContext()
  const [careScores, setCareScores] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedPlant, setExpandedPlant] = useState(null)
  const [plantDetails, setPlantDetails] = useState({})

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

  const loadPlantDetails = useCallback(async (plantId, species) => {
    if (plantDetails[plantId]) return
    try {
      const [pattern, prediction, anomaly, recommendation, seasonal, cluster] = await Promise.all([
        plantsApi.wateringPattern(plantId).catch(() => null),
        plantsApi.healthPrediction(plantId).catch(() => null),
        plantsApi.anomaly(plantId).catch(() => null),
        plantsApi.wateringRecommendation(plantId).catch(() => null),
        plantsApi.seasonalAdjustment(plantId).catch(() => null),
        species ? plantsApi.speciesCluster(species).catch(() => null) : Promise.resolve(null),
      ])
      setPlantDetails(prev => ({
        ...prev,
        [plantId]: { pattern, prediction, anomaly, recommendation, seasonal, cluster },
      }))
    } catch { /* ignore */ }
  }, [plantDetails])

  const handleExpand = useCallback((score) => {
    const plantId = score.plantId
    setExpandedPlant(prev => prev === plantId ? null : plantId)
    loadPlantDetails(plantId, score.species)
  }, [loadPlantDetails])

  const overview = useMemo(() => {
    if (!careScores || careScores.length === 0) return null
    const avgScore = Math.round(careScores.reduce((s, c) => s + c.score, 0) / careScores.length)
    const atRisk = careScores.filter(c => c.score < 60)
    const anomalyCount = Object.values(plantDetails).filter(d => d?.anomaly?.isAnomaly).length
    return { avgScore, atRisk, total: careScores.length, anomalyCount }
  }, [careScores, plantDetails])

  const patternDistribution = useMemo(() => {
    if (!careScores) return null
    const counts = { optimal: 0, over_watered: 0, under_watered: 0, inconsistent: 0, insufficient_data: 0 }
    for (const score of careScores) {
      if (score.grade === 'A' || score.grade === 'B') counts.optimal++
      else if (score.grade === 'C') counts.inconsistent++
      else counts.under_watered++
    }
    return counts
  }, [careScores])

  // Collect anomaly alerts across all loaded plant details
  const anomalyAlerts = useMemo(() => {
    if (!careScores) return []
    return careScores
      .filter(s => plantDetails[s.plantId]?.anomaly?.isAnomaly)
      .map(s => ({ ...s, anomaly: plantDetails[s.plantId].anomaly }))
  }, [careScores, plantDetails])

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
              actions={[{ label: 'Go to dashboard', icon: 'home', href: '/' }]}
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

      {/* Anomaly alerts — rendered once plants are expanded and anomaly data is loaded */}
      {anomalyAlerts.length > 0 && (
        <Alert variant="danger" className="mb-4" data-testid="anomaly-alert-banner">
          <strong>⚠ Watering anomalies detected</strong> in {anomalyAlerts.length} plant{anomalyAlerts.length !== 1 ? 's' : ''}:
          {anomalyAlerts.map(a => (
            <div key={a.plantId} className="mt-1 ms-2">
              <strong>{a.name}</strong>
              {(a.anomaly.flags || []).map((f, i) => (
                <span key={i} className="text-danger d-block ms-2 small">• {f}</span>
              ))}
            </div>
          ))}
        </Alert>
      )}

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
                          chart: { background: 'transparent' },
                          theme: { mode: theme },
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

          <h5 className="mb-3">Plant Scores</h5>
          {careScores && careScores.map(score => (
            <Card key={score.plantId} className="mb-2">
              <Card.Body
                className="d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }}
                onClick={() => handleExpand(score)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand(score) } }}
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
                    {/* Show anomaly badge if data already loaded */}
                    {plantDetails[score.plantId]?.anomaly && (
                      <AnomalyBadge anomaly={plantDetails[score.plantId].anomaly} />
                    )}
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
                    <>
                      {/* Row 1: Care dimensions */}
                      <Row className="mb-3">
                        <Col md={3}>
                          <h6>Score Dimensions</h6>
                          {score.dimensions && (
                            <ul className="list-unstyled small">
                              <li>Consistency: <strong>{score.dimensions.consistency}</strong></li>
                              <li>Timing: <strong>{score.dimensions.timing}</strong></li>
                              <li>Health: <strong>{score.dimensions.healthOutcome}</strong></li>
                              <li>Responsiveness: <strong>{score.dimensions.responsiveness}</strong></li>
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

                      {/* Row 2: Anomaly, Seasonal, Cluster */}
                      <Row className="pt-2 border-top">
                        <Col md={4} data-testid="anomaly-section">
                          <h6>Anomaly Detection</h6>
                          {plantDetails[score.plantId].anomaly ? (
                            <>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                {plantDetails[score.plantId].anomaly.isAnomaly ? (
                                  <Badge bg="danger">⚠ Anomaly detected</Badge>
                                ) : (
                                  <Badge bg="success">Normal behaviour</Badge>
                                )}
                                <small className="text-muted">score: {plantDetails[score.plantId].anomaly.score}</small>
                              </div>
                              {(plantDetails[score.plantId].anomaly.flags || []).map((f, i) => (
                                <div key={i} className="small text-danger">• {f}</div>
                              ))}
                              {(!plantDetails[score.plantId].anomaly.flags?.length && !plantDetails[score.plantId].anomaly.isAnomaly) && (
                                <small className="text-muted">No unusual watering patterns detected.</small>
                              )}
                            </>
                          ) : <small className="text-muted">Unavailable</small>}
                        </Col>

                        <Col md={4} data-testid="seasonal-section">
                          <h6>Seasonal Adjustment</h6>
                          {plantDetails[score.plantId].seasonal ? (
                            <>
                              <p className="mb-1">
                                <Badge bg="secondary" className="me-1 text-capitalize">{plantDetails[score.plantId].seasonal.season}</Badge>
                                {plantDetails[score.plantId].seasonal.multiplier && (
                                  <span className="small">
                                    ×{plantDetails[score.plantId].seasonal.multiplier.toFixed(2)} multiplier
                                  </span>
                                )}
                              </p>
                              {plantDetails[score.plantId].seasonal.adjustedFrequencyDays && (
                                <p className="mb-1 small">
                                  Adjusted: every <strong>{plantDetails[score.plantId].seasonal.adjustedFrequencyDays}</strong> days
                                </p>
                              )}
                              {plantDetails[score.plantId].seasonal.note && (
                                <small className="text-muted">{plantDetails[score.plantId].seasonal.note}</small>
                              )}
                            </>
                          ) : <small className="text-muted">Unavailable</small>}
                        </Col>

                        <Col md={4} data-testid="cluster-section">
                          <h6>Species Cluster</h6>
                          {plantDetails[score.plantId].cluster && plantDetails[score.plantId].cluster.clusterId ? (
                            <>
                              <div className="mb-1">
                                <span className="me-1">{CLUSTER_ICONS[plantDetails[score.plantId].cluster.clusterId] || '🌱'}</span>
                                <strong>{plantDetails[score.plantId].cluster.clusterLabel}</strong>
                              </div>
                              {plantDetails[score.plantId].cluster.clusterCareProfile && (
                                <ul className="list-unstyled small">
                                  <li>Avg frequency: every {plantDetails[score.plantId].cluster.clusterCareProfile.avgFrequency} days</li>
                                  <li>Drought tolerance: {plantDetails[score.plantId].cluster.clusterCareProfile.droughtTolerance}</li>
                                  <li>Humidity need: {plantDetails[score.plantId].cluster.clusterCareProfile.humidityNeed}</li>
                                </ul>
                              )}
                              {(plantDetails[score.plantId].cluster.similarSpecies || []).length > 0 && (
                                <small className="text-muted">
                                  Similar: {plantDetails[score.plantId].cluster.similarSpecies.slice(0, 3).join(', ')}
                                </small>
                              )}
                            </>
                          ) : (
                            <small className="text-muted">
                              {score.species ? 'No cluster match for this species.' : 'Add a species to see cluster info.'}
                            </small>
                          )}
                        </Col>
                      </Row>
                    </>
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
