import React, { useState, useMemo } from 'react'
import { Droplets, AlertTriangle, Leaf, Activity } from 'lucide-react'
import { analyseWateringPattern, getPatternMeta } from '../utils/wateringPattern.js'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  LineChart, Line,
} from 'recharts'

// ─── Constants ───────────────────────────────────────────────────────────────

const HEALTH_COLORS = {
  Excellent: '#10b981',
  Good:      '#22c55e',
  Fair:      '#f59e0b',
  Poor:      '#ef4444',
}
const HEALTH_ORDER = ['Excellent', 'Good', 'Fair', 'Poor']
const HEALTH_VALUE = { Excellent: 4, Good: 3, Fair: 2, Poor: 1 }

// ─── Analytics helpers ────────────────────────────────────────────────────────

/** 0–100 consistency score: how closely actual gaps match frequencyDays */
function consistencyScore(plant) {
  const log = plant.wateringLog || []
  if (log.length < 2) return null
  const sorted = [...log].sort((a, b) => new Date(a.date) - new Date(b.date))
  let totalDev = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000
    totalDev += Math.abs(gap - plant.frequencyDays)
  }
  const avgDev = totalDev / (sorted.length - 1)
  return Math.max(0, Math.min(100, Math.round(100 - (avgDev / plant.frequencyDays) * 100)))
}

function scoreColor(score) {
  if (score === null) return '#6b7280'
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score) {
  if (score === null) return 'No data'
  if (score >= 80) return 'Consistent'
  if (score >= 60) return 'Moderate'
  return 'Irregular'
}

/** Returns watering events per week for the last `weeks` weeks */
function getWateringByWeek(plant, weeks = 12) {
  const now = new Date()
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(now.getTime() - (weeks - 1 - i) * 7 * 86400000)
    const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000)
    const count = (plant.wateringLog || []).filter(e => {
      const d = new Date(e.date)
      return d >= weekStart && d < weekEnd
    }).length
    const expected = plant.frequencyDays ? +(7 / plant.frequencyDays).toFixed(2) : 1
    return {
      week: weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      count,
      expected,
    }
  })
}

/** Calendar heatmap data — last 84 days, keyed by YYYY-MM-DD */
function buildHeatmap(plants) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today.getTime() - (83 - i) * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    let count = 0
    for (const plant of plants) {
      if ((plant.wateringLog || []).some(e => e.date.slice(0, 10) === dateStr)) count++
    }
    return { date: d, dateStr, count, dow: (d.getDay() + 6) % 7 /* Mon=0 */ }
  })
}

function heatCell(count) {
  if (count === 0) return 'bg-gray-800'
  if (count === 1) return 'bg-emerald-900'
  if (count === 2) return 'bg-emerald-700'
  if (count === 3) return 'bg-emerald-600'
  return 'bg-emerald-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{children}</h3>
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 shadow-sm shadow-black/10 ${className}`} style={{ background: 'linear-gradient(135deg, rgba(30, 42, 58, 0.5) 0%, rgba(20, 30, 48, 0.5) 100%)' }}>
      {children}
    </div>
  )
}

/** Recharts tooltip styled for dark theme */
function DarkTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900/95 border border-gray-700/60 rounded-lg px-3 py-2 text-xs shadow-xl shadow-black/30" style={{ backdropFilter: 'blur(8px)' }}>
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name}: <strong>{p.value}{unit}</strong></p>
      ))}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ plants }) {
  const healthData = useMemo(() => {
    const counts = {}
    for (const p of plants) {
      const h = p.health || 'Unknown'
      counts[h] = (counts[h] || 0) + 1
    }
    return HEALTH_ORDER
      .filter(h => counts[h])
      .map(h => ({ name: h, value: counts[h], color: HEALTH_COLORS[h] }))
  }, [plants])

  const atRisk = useMemo(() => {
    const now = Date.now()
    return plants
      .filter(p => {
        if (p.health === 'Poor' || p.health === 'Fair') return true
        if (p.lastWatered && p.frequencyDays) {
          const daysOverdue = (now - new Date(p.lastWatered).getTime()) / 86400000 - p.frequencyDays
          if (daysOverdue > 3) return true
        }
        return false
      })
      .slice(0, 6)
  }, [plants])

  const speciesData = useMemo(() => {
    const bySpecies = {}
    for (const p of plants) {
      const key = p.species || p.name
      if (!bySpecies[key]) bySpecies[key] = { plants: [], name: key }
      bySpecies[key].plants.push(p)
    }
    return Object.values(bySpecies).map(s => {
      const scores = s.plants.map(consistencyScore).filter(x => x !== null)
      return {
        name: s.name.split(' ').slice(0, 2).join(' '), // truncate long names
        consistency: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        count: s.plants.length,
      }
    }).filter(s => s.consistency !== null).sort((a, b) => b.consistency - a.consistency)
  }, [plants])

  const heatmapDays = useMemo(() => buildHeatmap(plants), [plants])

  // Pad heatmap start to Monday
  const heatmapPadded = useMemo(() => {
    const startDow = heatmapDays[0]?.dow ?? 0
    return [...Array(startDow).fill(null), ...heatmapDays]
  }, [heatmapDays])

  // Week labels: one per 7 columns
  const weekLabels = useMemo(() => {
    const labels = []
    for (let col = 0; col < Math.ceil(heatmapPadded.length / 7); col++) {
      const dayIdx = col * 7 - heatmapDays[0]?.dow ?? 0
      const day = heatmapDays[Math.max(0, dayIdx)]
      labels.push(day ? day.date.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '')
    }
    return labels
  }, [heatmapPadded, heatmapDays])

  return (
    <div className="space-y-5">
      {/* Health distribution + at-risk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Health Distribution</SectionTitle>
          {plants.length === 0 ? (
            <p className="text-gray-500 text-sm">No plants yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie
                    data={healthData}
                    cx="50%" cy="50%"
                    innerRadius={32} outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {healthData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1 min-w-0">
                {healthData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-gray-300 flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>At-Risk Plants</SectionTitle>
          {atRisk.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Leaf size={14} />
              <span>All plants are thriving!</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {atRisk.map(p => {
                const isHealthRisk = p.health === 'Poor' || p.health === 'Fair'
                const daysOverdue = p.lastWatered && p.frequencyDays
                  ? Math.round((Date.now() - new Date(p.lastWatered).getTime()) / 86400000 - p.frequencyDays)
                  : null
                return (
                  <li key={p.id} className="flex items-start gap-2">
                    <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {isHealthRisk && <span className="text-amber-400">{p.health} health</span>}
                        {isHealthRisk && daysOverdue > 3 && ' · '}
                        {daysOverdue > 3 && <span className="text-red-400">{daysOverdue}d overdue</span>}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Watering heatmap */}
      <Card>
        <SectionTitle>Watering Activity — Last 12 Weeks</SectionTitle>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Week labels */}
            <div className="flex gap-1 mb-1 pl-7">
              {weekLabels.map((label, i) => (
                <div key={i} className="w-3 flex-shrink-0 text-[9px] text-gray-500 whitespace-nowrap" style={{ width: '0.75rem' }}>
                  {i % 2 === 0 ? label : ''}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              {/* Day-of-week labels */}
              <div className="flex flex-col gap-1 pr-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} className="w-3 h-3 flex items-center justify-center text-[9px] text-gray-600">{d}</div>
                ))}
              </div>
              {/* Grid: each column = 1 week, rows = days of week */}
              <div className="grid gap-1" style={{ gridTemplateRows: 'repeat(7, 0.75rem)', gridAutoFlow: 'column', gridAutoColumns: '0.75rem' }}>
                {heatmapPadded.map((day, i) => (
                  day === null
                    ? <div key={`pad-${i}`} className="w-3 h-3" />
                    : (
                      <div
                        key={day.dateStr}
                        className={`w-3 h-3 rounded-sm ${heatCell(day.count)}`}
                        title={`${day.dateStr}: ${day.count} plant${day.count !== 1 ? 's' : ''} watered`}
                      />
                    )
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1.5 mt-2 pl-7">
              <span className="text-[10px] text-gray-500">Less</span>
              {[0, 1, 2, 3, 4].map(n => (
                <div key={n} className={`w-3 h-3 rounded-sm ${heatCell(n)}`} />
              ))}
              <span className="text-[10px] text-gray-500">More</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Species comparison */}
      {speciesData.length > 1 && (
        <Card>
          <SectionTitle>Watering Consistency by Species</SectionTitle>
          <ResponsiveContainer width="100%" height={speciesData.length * 36 + 20}>
            <BarChart
              data={speciesData}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="#374151" />
              <XAxis
                type="number" domain={[0, 100]}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false} axisLine={false}
                tickFormatter={v => `${v}%`}
              />
              <YAxis
                type="category" dataKey="name" width={130}
                tick={{ fill: '#d1d5db', fontSize: 11 }}
                tickLine={false} axisLine={false}
              />
              <Tooltip content={<DarkTooltip unit="%" />} />
              <Bar dataKey="consistency" name="Consistency" radius={[0, 4, 4, 0]} maxBarSize={14}>
                {speciesData.map((entry, i) => (
                  <Cell key={i} fill={scoreColor(entry.consistency)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Per Plant tab ────────────────────────────────────────────────────────────

function PerPlantTab({ plants }) {
  const [selectedId, setSelectedId] = useState(plants[0]?.id ?? '')
  const plant = plants.find(p => p.id === selectedId) ?? plants[0]

  const score = useMemo(() => plant ? consistencyScore(plant) : null, [plant])

  const weeklyData = useMemo(() => plant ? getWateringByWeek(plant, 12) : [], [plant])

  const daysSinceLast = useMemo(() => {
    if (!plant?.lastWatered) return null
    return Math.round((Date.now() - new Date(plant.lastWatered).getTime()) / 86400000)
  }, [plant])

  const healthData = useMemo(() => {
    const log = plant?.healthLog || []
    if (log.length < 2) return []
    return [...log]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        value: HEALTH_VALUE[entry.health] ?? 0,
        health: entry.health,
        reason: entry.reason,
      }))
  }, [plant])

  const patternResult = useMemo(() => plant ? analyseWateringPattern(plant) : null, [plant])

  if (!plant) {
    return <p className="text-gray-500 text-sm">No plants yet.</p>
  }

  const gaugeMax = plant.frequencyDays ? Math.max(plant.frequencyDays * 2, 1) : 14
  const gaugePct = Math.min(100, Math.round(((daysSinceLast ?? 0) / gaugeMax) * 100))
  const gaugeDue = plant.frequencyDays
    ? Math.min(100, Math.round((plant.frequencyDays / gaugeMax) * 100))
    : 50

  function gaugeColor() {
    if (daysSinceLast === null) return '#6b7280'
    if (!plant.frequencyDays) return '#6b7280'
    const ratio = daysSinceLast / plant.frequencyDays
    if (ratio > 1.2) return '#ef4444'
    if (ratio > 0.9) return '#f97316'
    if (ratio > 0.7) return '#eab308'
    return '#22c55e'
  }

  return (
    <div className="space-y-5">
      {/* Plant selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Select plant</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {plants.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.species || p.room}</option>
          ))}
        </select>
      </div>

      {/* Consistency score + days gauge */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Consistency Score</SectionTitle>
          <div className="flex flex-col items-center py-2">
            {score === null ? (
              <p className="text-xs text-gray-500 text-center">Need at least 2 watering events to calculate.</p>
            ) : (
              <>
                {/* Circular gauge via SVG */}
                <svg width={88} height={88} viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="#374151" strokeWidth="8" />
                  <circle
                    cx="44" cy="44" r="36"
                    fill="none"
                    stroke={scoreColor(score)}
                    strokeWidth="8"
                    strokeDasharray={`${(score / 100) * 2 * Math.PI * 36} ${2 * Math.PI * 36}`}
                    strokeLinecap="round"
                    transform="rotate(-90 44 44)"
                  />
                  <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="bold">{score}</text>
                  <text x="44" y="58" textAnchor="middle" fill="#9ca3af" fontSize="9">/ 100</text>
                </svg>
                <p className="text-xs mt-1" style={{ color: scoreColor(score) }}>{scoreLabel(score)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{plant.wateringLog?.length ?? 0} waterings logged</p>
              </>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle>Last Watered</SectionTitle>
          {daysSinceLast === null ? (
            <p className="text-xs text-gray-500">No watering recorded.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-white">{daysSinceLast}</span>
                <span className="text-sm text-gray-400">days ago</span>
              </div>
              {plant.frequencyDays && (
                <>
                  <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                    {/* Due marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
                      style={{ left: `${gaugeDue}%` }}
                    />
                    {/* Fill */}
                    <div
                      className="absolute top-0 left-0 bottom-0 rounded-full transition-all"
                      style={{ width: `${gaugePct}%`, background: gaugeColor() }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Recommended every <span className="text-gray-300">{plant.frequencyDays}d</span>
                    {daysSinceLast > plant.frequencyDays
                      ? <span className="text-red-400 ml-1">· {daysSinceLast - plant.frequencyDays}d overdue</span>
                      : <span className="text-emerald-400 ml-1">· {plant.frequencyDays - daysSinceLast}d remaining</span>
                    }
                  </p>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Watering pattern analysis */}
      {patternResult && patternResult.pattern !== 'insufficient_data' && (
        <Card>
          <SectionTitle>Watering Pattern</SectionTitle>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: getPatternMeta(patternResult.pattern).color + '20', border: `2px solid ${getPatternMeta(patternResult.pattern).color}` }}>
              <Activity size={16} style={{ color: getPatternMeta(patternResult.pattern).color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{getPatternMeta(patternResult.pattern).label}</span>
                <span className="text-[11px] text-gray-500">{Math.round(patternResult.confidence * 100)}% confidence</span>
              </div>
              <ul className="space-y-0.5">
                {patternResult.contributingFactors.map((f, i) => (
                  <li key={i} className="text-xs text-gray-400">{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Watering timeline */}
      <Card>
        <SectionTitle>Watering Timeline — Last 12 Weeks</SectionTitle>
        {weeklyData.every(w => w.count === 0) ? (
          <p className="text-xs text-gray-500">No watering events in the last 12 weeks.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="#374151" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#6b7280', fontSize: 9 }}
                tickLine={false} axisLine={false}
                interval={1}
                angle={-35} textAnchor="end" height={36}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false} axisLine={false}
              />
              <Tooltip content={<DarkTooltip unit=" waterings" />} />
              {plant.frequencyDays && (
                <ReferenceLine
                  y={+(7 / plant.frequencyDays).toFixed(2)}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  label={{ value: 'Target', fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }}
                />
              )}
              <Bar dataKey="count" name="Waterings" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {plant.frequencyDays && (
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <span className="inline-block w-4 border-t border-dashed border-yellow-400" />
            Target: {+(7 / plant.frequencyDays).toFixed(1)}× per week (every {plant.frequencyDays}d)
          </p>
        )}
      </Card>

      {/* Health progression */}
      <Card>
        <SectionTitle>Health Progression</SectionTitle>
        {healthData.length === 0 ? (
          <p className="text-xs text-gray-500">Need at least 2 health assessments to show progression.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={healthData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={false} axisLine={false}
                  angle={-35} textAnchor="end" height={36}
                />
                <YAxis
                  domain={[0.5, 4.5]}
                  ticks={[1, 2, 3, 4]}
                  tickFormatter={v => ['', 'Poor', 'Fair', 'Good', 'Excellent'][v] || ''}
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={false} axisLine={false}
                  width={60}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg max-w-[200px]">
                      <p className="text-gray-400 mb-1">{d.date}</p>
                      <p style={{ color: HEALTH_COLORS[d.health] }} className="font-semibold">{d.health}</p>
                      {d.reason && <p className="text-gray-400 mt-1">{d.reason}</p>}
                    </div>
                  )
                }} />
                <Line
                  type="stepAfter"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={({ cx, cy, payload }) => (
                    <circle
                      key={payload.date}
                      cx={cx} cy={cy} r={4}
                      fill={HEALTH_COLORS[payload.health] || '#6b7280'}
                      stroke="#1f2937" strokeWidth={2}
                    />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-2">
              {HEALTH_ORDER.map(h => (
                <div key={h} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: HEALTH_COLORS[h] }} />
                  <span className="text-[10px] text-gray-500">{h}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ─── Full-page analytics view ────────────────────────────────────────────────

export default function AnalyticsPage({ plants }) {
  const [tab, setTab] = useState('overview')

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-950">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0 px-4">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'plant',    label: 'Per Plant' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'text-emerald-400 border-emerald-500'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="self-center text-xs text-gray-500">{plants.length} plant{plants.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-5 max-w-3xl mx-auto w-full">
        {tab === 'overview'
          ? <OverviewTab plants={plants} />
          : <PerPlantTab plants={plants} />
        }
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800 flex-shrink-0">
        <p className="text-[11px] text-gray-600 flex items-center justify-center gap-1">
          <Droplets size={10} />
          Analytics computed from watering and health log data.
        </p>
      </div>
    </div>
  )
}
