const BASE = {
  display: 'block',
  background: 'var(--skeleton-color, rgba(0,0,0,0.08))',
  borderRadius: 4,
  animation: 'skeleton-pulse 1.4s ease-in-out infinite',
}

export function SkeletonRect({ width = '100%', height = 16, className = '', style = {} }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={className}
      style={{ ...BASE, width, height, ...style }}
    />
  )
}

export function SkeletonCircle({ size = 36, className = '', style = {} }) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={className}
      style={{ ...BASE, width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }}
    />
  )
}

export function SkeletonText({ lines = 1, className = '', lastLineWidth = '60%' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonRect
          key={i}
          height={12}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          style={{ marginBottom: i < lines - 1 ? 6 : 0 }}
        />
      ))}
    </div>
  )
}

export function SkeletonPlantCard() {
  return (
    <div
      className="d-flex align-items-center gap-3 py-2 px-3 border-bottom"
      role="presentation"
      aria-hidden="true"
    >
      <SkeletonCircle size={38} />
      <div className="flex-grow-1">
        <SkeletonRect height={13} width="55%" style={{ marginBottom: 6 }} />
        <SkeletonRect height={11} width="35%" />
      </div>
      <SkeletonRect height={11} width={50} />
    </div>
  )
}

export function SkeletonCard({ lines = 2, height, className = '' }) {
  return (
    <div className={`panel panel-icon ${className}`} aria-hidden="true" role="presentation">
      <div className="panel-container"><div className="panel-content">
        {height ? (
          <SkeletonRect height={height} />
        ) : (
          <SkeletonText lines={lines} />
        )}
      </div></div>
    </div>
  )
}
