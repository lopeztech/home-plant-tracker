import { useMemo } from 'react'

const WEATHER_CONFIGS = {
  sunny:  { sky: '#87CEEB', ground: '#90C695', sunVisible: true, clouds: 0, rainDrops: 0, snowFlakes: 0 },
  partly: { sky: '#A8D8EA', ground: '#90C695', sunVisible: true, clouds: 2, rainDrops: 0, snowFlakes: 0 },
  cloudy: { sky: '#B0BEC5', ground: '#7FB085', sunVisible: false, clouds: 4, rainDrops: 0, snowFlakes: 0 },
  foggy:  { sky: '#CFD8DC', ground: '#8BA888', sunVisible: false, clouds: 5, rainDrops: 0, snowFlakes: 0 },
  rainy:  { sky: '#78909C', ground: '#6B8F71', sunVisible: false, clouds: 4, rainDrops: 30, snowFlakes: 0 },
  stormy: { sky: '#546E7A', ground: '#5C7A5F', sunVisible: false, clouds: 5, rainDrops: 50, snowFlakes: 0 },
  snowy:  { sky: '#CFD8DC', ground: '#E8E8E8', sunVisible: false, clouds: 3, rainDrops: 0, snowFlakes: 25 },
  night:  { sky: '#1A237E', ground: '#2E4A32', sunVisible: false, clouds: 1, rainDrops: 0, snowFlakes: 0, night: true },
}

export default function HouseWeatherFrame({ weather, location, children }) {
  const condition = weather?.current?.condition?.sky || 'sunny'
  const isNight = weather?.current && !weather.current.isDay
  const config = isNight ? { ...WEATHER_CONFIGS.night } : (WEATHER_CONFIGS[condition] || WEATHER_CONFIGS.sunny)
  const temp = weather?.current?.temp
  const unit = weather?.unit === 'fahrenheit' ? 'F' : 'C'
  const label = weather?.current?.condition?.label || ''

  const rainDrops = useMemo(() =>
    Array.from({ length: config.rainDrops }, (_, i) => ({
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 3,
    })),
  [config.rainDrops])

  const snowFlakes = useMemo(() =>
    Array.from({ length: config.snowFlakes }, (_, i) => ({
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      size: 2 + Math.random() * 4,
    })),
  [config.snowFlakes])

  const clouds = useMemo(() =>
    Array.from({ length: config.clouds }, (_, i) => ({
      x: 10 + (i * 22) + Math.random() * 10,
      y: 8 + Math.random() * 15,
      scale: 0.6 + Math.random() * 0.6,
      speed: 30 + Math.random() * 40,
    })),
  [config.clouds])

  return (
    <div className="position-relative" style={{ overflow: 'hidden' }}>
      {/* Weather background */}
      <div
        className="position-absolute w-100"
        style={{
          top: 0, left: 0, height: '100%',
          background: `linear-gradient(180deg, ${config.sky} 0%, ${config.sky}CC 60%, ${config.ground} 100%)`,
          zIndex: 0,
        }}
      >
        {/* Sun/Moon */}
        {config.sunVisible && (
          <div
            className="position-absolute"
            style={{
              top: 20, right: 40, width: 50, height: 50,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #FFE082, #FFD54F)',
              boxShadow: '0 0 30px rgba(255,213,79,0.6), 0 0 60px rgba(255,213,79,0.3)',
              animation: 'glow-pulse 3s ease-in-out infinite',
            }}
          />
        )}
        {config.night && (
          <div
            className="position-absolute"
            style={{
              top: 20, right: 40, width: 40, height: 40,
              borderRadius: '50%',
              background: '#E8EAF6',
              boxShadow: '0 0 20px rgba(232,234,246,0.4), inset -8px -2px 0 0 #1A237E',
            }}
          />
        )}

        {/* Stars (night) */}
        {config.night && Array.from({ length: 15 }, (_, i) => (
          <div
            key={`star-${i}`}
            className="position-absolute"
            style={{
              top: `${5 + Math.random() * 40}%`,
              left: `${Math.random() * 100}%`,
              width: 2, height: 2,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.4 + Math.random() * 0.6,
              animation: `glow-pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}

        {/* Clouds */}
        {clouds.map((cloud, i) => (
          <svg
            key={i}
            className="position-absolute"
            style={{
              top: `${cloud.y}%`,
              left: `${cloud.x}%`,
              width: 80 * cloud.scale,
              height: 40 * cloud.scale,
              opacity: config.night ? 0.3 : 0.8,
              animation: `cloud-drift ${cloud.speed}s linear infinite`,
            }}
            viewBox="0 0 80 40"
          >
            <ellipse cx="40" cy="28" rx="35" ry="12" fill="white" opacity="0.7" />
            <ellipse cx="28" cy="20" rx="18" ry="14" fill="white" opacity="0.85" />
            <ellipse cx="50" cy="18" rx="20" ry="15" fill="white" opacity="0.9" />
            <ellipse cx="38" cy="15" rx="15" ry="12" fill="white" />
          </svg>
        ))}

        {/* Rain */}
        {rainDrops.map((drop, i) => (
          <div
            key={`rain-${i}`}
            className="position-absolute"
            style={{
              left: `${drop.x}%`,
              top: '-5%',
              width: 1.5,
              height: drop.size,
              background: 'rgba(150,200,255,0.6)',
              borderRadius: '0 0 2px 2px',
              animation: `rain-fall ${drop.duration}s linear infinite`,
              animationDelay: `${drop.delay}s`,
            }}
          />
        ))}

        {/* Snow */}
        {snowFlakes.map((flake, i) => (
          <div
            key={`snow-${i}`}
            className="position-absolute"
            style={{
              left: `${flake.x}%`,
              top: '-5%',
              width: flake.size,
              height: flake.size,
              background: 'white',
              borderRadius: '50%',
              opacity: 0.8,
              animation: `snow-fall ${flake.duration}s linear infinite`,
              animationDelay: `${flake.delay}s`,
            }}
          />
        ))}

        {/* Weather info overlay */}
        {temp !== null && (
          <div
            className="position-absolute d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
            style={{
              top: 12, left: 12, zIndex: 5,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{weather.current.condition.emoji}</span>
            <strong>{temp}°{unit}</strong>
            <span style={{ opacity: 0.8 }}>{label}</span>
            {location?.name && (
              <span style={{ opacity: 0.7, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 8, marginLeft: 4 }}>
                <svg style={{ width: 10, height: 10, marginRight: 3, verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {location.name}
              </span>
            )}
          </div>
        )}

        {/* Ground/grass line */}
        <div
          className="position-absolute w-100"
          style={{
            bottom: 0, height: '8%',
            background: config.ground,
            borderTop: `2px solid ${config.night ? '#1B5E20' : '#4CAF50'}`,
          }}
        />
      </div>

      {/* House shape with floorplan inside */}
      <div className="position-relative" style={{ zIndex: 1, padding: '60px 30px 30px' }}>
        {/* Roof */}
        <div
          className="mx-auto"
          style={{
            width: '90%',
            maxWidth: 900,
            height: 0,
            borderLeft: '40px solid transparent',
            borderRight: '40px solid transparent',
            borderBottom: '50px solid var(--bs-body-bg, #fff)',
            position: 'relative',
            zIndex: 2,
            filter: 'drop-shadow(0 -2px 4px rgba(0,0,0,0.1))',
          }}
        />
        {/* House body */}
        <div
          className="mx-auto"
          style={{
            width: '90%',
            maxWidth: 900,
            background: 'var(--bs-body-bg, #fff)',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(80px); }
        }
        @keyframes rain-fall {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(600px); opacity: 0; }
        }
        @keyframes snow-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.6; }
          100% { transform: translateY(600px) rotate(360deg); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
