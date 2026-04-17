export default function WeatherStrip({ weather, location, onLocationClick }) {
  if (!weather?.current) return null

  const temp = weather.current.temp
  const unit = weather.unit === 'fahrenheit' ? 'F' : 'C'
  const emoji = weather.current.condition.emoji
  const forecast = (weather.days || []).slice(1, 4)

  const pillStyle = {
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    fontSize: '0.65rem',
    lineHeight: 1,
    padding: '3px 6px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  }

  const dayLabel = (day, i) => i === 0 ? 'Tmrw' : new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })

  return (
    <div className="d-flex align-items-center gap-1 px-3 pt-2 overflow-auto" style={{ scrollbarWidth: 'none' }}>
      <span style={pillStyle} title={location?.name ? `${location.name}${weather.current.condition.label ? ' — ' + weather.current.condition.label : ''}` : undefined}>
        <span style={{ fontSize: '0.85rem', marginRight: 2 }}>{emoji}</span>
        <strong>{temp}°{unit}</strong>
      </span>
      {forecast.map((day, i) => (
        <span
          key={day.date}
          style={pillStyle}
          title={`${dayLabel(day, i)} · ${day.maxTemp}°/${day.minTemp}°${day.precipitation >= 2 ? ` · ${day.precipitation.toFixed(0)}mm` : ''}`}
        >
          <span style={{ opacity: 0.8, marginRight: 3 }}>{dayLabel(day, i).slice(0, 1)}</span>
          <span style={{ fontSize: '0.75rem', marginRight: 2 }}>{day.condition.emoji}</span>
          <span>{day.maxTemp}°</span>
        </span>
      ))}
      {location?.name && (
        <button
          type="button"
          onClick={onLocationClick}
          className="btn btn-sm p-0 text-white-50 ms-auto flex-shrink-0"
          title={`Location: ${location.name}`}
          style={{ fontSize: '0.65rem', background: 'transparent', border: 0 }}
        >
          <svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </button>
      )}
    </div>
  )
}
