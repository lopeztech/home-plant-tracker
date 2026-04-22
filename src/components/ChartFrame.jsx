import React from 'react'

/**
 * Consistent wrapper for all charts in the app.
 * Handles empty state, loading skeleton, title/unit props, and ARIA.
 *
 * Props:
 *   title       string   Panel header text
 *   unit        string   Y-axis unit shown in the panel header badge (e.g. "days", "plants")
 *   loading     bool     Show skeleton while data loads
 *   empty       bool     Show empty state when no data
 *   emptyText   string   Custom empty state copy
 *   children    node     The <Chart /> (react-apexcharts) element
 *   className   string   Additional classes on the panel root
 *   help        node     Optional HelpTooltip element placed in panel header
 */
export default function ChartFrame({
  title,
  unit,
  loading = false,
  empty = false,
  emptyText = 'No data yet — add plants and log care events to see charts.',
  children,
  className = '',
  help,
}) {
  return (
    <div className={`panel panel-icon ${className}`} role="region" aria-label={title}>
      <div className="panel-hdr">
        <span className="d-flex align-items-center gap-2">
          {title}
          {unit && (
            <span className="badge bg-light text-muted fw-normal fs-xs border">{unit}</span>
          )}
        </span>
        {help && <span className="ms-auto">{help}</span>}
      </div>
      <div className="panel-container">
        <div className="panel-content">
          {loading ? (
            <ChartSkeleton />
          ) : empty ? (
            <ChartEmptyState text={emptyText} />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div aria-hidden="true" className="chart-skeleton">
      <div className="skeleton-bar-group d-flex align-items-end gap-1" style={{ height: 160 }}>
        {[60, 90, 45, 120, 75, 100, 55, 80, 65, 110, 70, 95].map((h, i) => (
          <div
            key={i}
            className="flex-grow-1 rounded-top"
            style={{
              height: `${h}px`,
              background: 'var(--bs-tertiary-bg)',
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ChartEmptyState({ text }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-4 text-muted">
      <svg style={{ width: 40, height: 40, opacity: 0.35, marginBottom: 8 }}>
        <use href="/icons/sprite.svg#bar-chart-2" />
      </svg>
      <p className="fs-sm mb-0 text-center" style={{ maxWidth: 260 }}>{text}</p>
    </div>
  )
}
