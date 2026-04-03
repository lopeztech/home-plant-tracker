import { useState, useRef, useEffect } from 'react'
import { Leaf, BarChart2, Settings, LogOut, Sun, Moon, ChevronRight, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'

function dayLabel(dateStr, index) {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tmrw'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' })
}

function ForecastModal({ weather, onClose }) {
  const { days } = weather
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-soft-lg shadow-soft-lg w-full max-w-md overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">7-Day Forecast</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-3 divide-y divide-gray-100">
          {days.map((day, i) => {
            const hasRain = day.precipitation >= 2
            return (
              <div key={day.date} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-10 text-gray-500 font-medium flex-shrink-0">{dayLabel(day.date, i)}</span>
                <span className="text-lg leading-none flex-shrink-0">{day.condition.emoji}</span>
                <span className="flex-1 text-gray-700 truncate">{day.condition.label}</span>
                {hasRain && (
                  <span className="text-blue-500 text-xs font-medium flex-shrink-0 tabular-nums">
                    {day.precipitation.toFixed(1)}mm
                  </span>
                )}
                <span className="text-gray-800 font-medium flex-shrink-0 tabular-nums">
                  {day.maxTemp}°<span className="text-gray-400 font-normal">/</span>{day.minTemp}°
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Header({ onOpenSettings, onOpenAnalytics, analyticsActive, weather }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0 relative">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-soft flex items-center justify-center shadow-soft">
          <Leaf size={18} className="text-white" />
        </div>
        <h1 className="text-base font-medium text-gray-100 leading-tight">Plant Tracker</h1>
      </div>

      {user && (
        <div className="flex items-center gap-1">
          {weather && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-gray-400 mr-1">
                {weather.current.isDay
                  ? <Sun size={13} className="text-yellow-400" />
                  : <Moon size={13} className="text-indigo-400" />
                }
                <span className="text-base leading-none">{weather.current.condition.emoji}</span>
                <span>{weather.current.temp}°{weather.unit === 'fahrenheit' ? 'F' : 'C'}</span>
              </span>
              <button
                onClick={() => setForecastOpen(true)}
                className="p-2 rounded-soft text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title="7-day forecast"
                aria-label="7-day forecast"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
          <button
            onClick={onOpenAnalytics}
            className={`p-2 rounded-soft transition-colors ${analyticsActive ? 'text-emerald-400 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            title="Analytics"
            aria-label="Analytics"
          >
            <BarChart2 size={16} />
          </button>

          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              aria-label="User menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full ring-1 ring-gray-600"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-700 ring-1 ring-gray-600 flex items-center justify-center text-xs font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-soft-lg shadow-soft-lg py-1 z-50" style={{ backdropFilter: 'blur(16px)' }}>
                <div className="px-3 py-2.5 border-b border-gray-800">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); onOpenSettings() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </button>
                <button
                  onClick={() => { setMenuOpen(false); logout() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {forecastOpen && weather && <ForecastModal weather={weather} onClose={() => setForecastOpen(false)} />}
    </header>
  )
}
