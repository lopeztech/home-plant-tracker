import { useState, useEffect } from 'react'

// WMO weather interpretation codes → condition metadata
const WMO = {
  0:  { label: 'Clear sky',      sky: 'sunny',   emoji: '☀️' },
  1:  { label: 'Mostly clear',   sky: 'sunny',   emoji: '🌤️' },
  2:  { label: 'Partly cloudy',  sky: 'partly',  emoji: '⛅' },
  3:  { label: 'Overcast',       sky: 'cloudy',  emoji: '☁️' },
  45: { label: 'Foggy',          sky: 'foggy',   emoji: '🌫️' },
  48: { label: 'Icy fog',        sky: 'foggy',   emoji: '🌫️' },
  51: { label: 'Light drizzle',  sky: 'rainy',   emoji: '🌦️' },
  53: { label: 'Drizzle',        sky: 'rainy',   emoji: '🌧️' },
  55: { label: 'Heavy drizzle',  sky: 'rainy',   emoji: '🌧️' },
  61: { label: 'Light rain',     sky: 'rainy',   emoji: '🌦️' },
  63: { label: 'Rain',           sky: 'rainy',   emoji: '🌧️' },
  65: { label: 'Heavy rain',     sky: 'stormy',  emoji: '⛈️' },
  71: { label: 'Light snow',     sky: 'snowy',   emoji: '🌨️' },
  73: { label: 'Snow',           sky: 'snowy',   emoji: '❄️' },
  75: { label: 'Heavy snow',     sky: 'snowy',   emoji: '❄️' },
  77: { label: 'Snow grains',    sky: 'snowy',   emoji: '❄️' },
  80: { label: 'Rain showers',   sky: 'rainy',   emoji: '🌦️' },
  81: { label: 'Showers',        sky: 'rainy',   emoji: '🌧️' },
  82: { label: 'Heavy showers',  sky: 'stormy',  emoji: '⛈️' },
  95: { label: 'Thunderstorm',   sky: 'stormy',  emoji: '⛈️' },
  96: { label: 'Thunderstorm',   sky: 'stormy',  emoji: '⛈️' },
  99: { label: 'Heavy storm',    sky: 'stormy',  emoji: '⛈️' },
}

export function getCondition(code) {
  return WMO[code] ?? WMO[0]
}

const CACHE_KEY = 'plantTracker_weather'
const CACHE_TTL = 5 * 60 * 1000 // 5 min — keeps "now is raining" from lingering

// Returns distance in metres between two lat/lon points (Haversine approximation)
function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(lat, lon, weather) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lon, weather, fetchedAt: Date.now() }))
  } catch {
    // sessionStorage unavailable (private browsing quota, etc.) — silently ignore
  }
}

// Dry-sky codes (clear, partly cloudy, overcast, fog) get overridden
// when current precipitation says it's actually raining right now.
const DRY_SKY_CODES = new Set([0, 1, 2, 3, 45, 48])

function parseWeather(data, unit = 'celsius') {
  // The modern /forecast `current=` block is preferred; fall back to
  // `current_weather` for older caches.
  const cw = data.current || data.current_weather || {}
  const d = data.daily
  const temp = cw.temperature_2m ?? cw.temperature
  const code = cw.weathercode
  const rainNow = (cw.precipitation ?? cw.rain ?? 0) > 0

  let condition = getCondition(code)
  // If the model reports clear/overcast/fog but live precipitation says
  // otherwise, trust the precipitation reading and show the rain pill.
  if (rainNow && DRY_SKY_CODES.has(code)) {
    condition = { label: 'Raining now', sky: 'rainy', emoji: '\uD83C\uDF27\uFE0F' }
  }

  return {
    unit,
    current: {
      temp: Math.round(temp),
      code,
      condition,
      isDay: cw.is_day === 1,
      precipitation: cw.precipitation ?? 0,
    },
    days: d.time.map((date, i) => ({
      date,
      code: d.weathercode[i],
      condition: getCondition(d.weathercode[i]),
      maxTemp: Math.round(d.temperature_2m_max[i]),
      minTemp: Math.round(d.temperature_2m_min[i]),
      precipitation: d.precipitation_sum[i] ?? 0,
    })),
  }
}

const LOCATION_KEY = 'plantTracker_location'

function loadSavedLocation() {
  try { return JSON.parse(localStorage.getItem(LOCATION_KEY)) } catch { return null }
}

export function useWeather(tempUnit = 'celsius') {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)
  const [location, setLocationState] = useState(() => loadSavedLocation())

  function setLocation(loc) {
    setLocationState(loc)
    if (loc) localStorage.setItem(LOCATION_KEY, JSON.stringify(loc))
    else localStorage.removeItem(LOCATION_KEY)
  }

  useEffect(() => {
    let cancelled = false

    function fetchWeather(lat, lon) {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', lat.toFixed(4))
      url.searchParams.set('longitude', lon.toFixed(4))
      url.searchParams.set('current', 'temperature_2m,precipitation,rain,weathercode,is_day')
      url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum')
      url.searchParams.set('forecast_days', '7')
      url.searchParams.set('timezone', 'auto')
      if (tempUnit === 'fahrenheit') url.searchParams.set('temperature_unit', 'fahrenheit')

      fetch(url)
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(data => {
          if (cancelled) return
          const parsed = parseWeather(data, tempUnit)
          parsed.location = { lat, lon }
          writeCache(lat, lon, parsed)
          setWeather(parsed)
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    // If the user has manually saved a location (via Settings), use its
    // coordinates directly — don't require browser geolocation permission.
    const savedLoc = loadSavedLocation()
    if (savedLoc?.lat && savedLoc?.lon) {
      const { lat, lon } = savedLoc
      const cached = readCache()
      if (
        cached &&
        Date.now() - cached.fetchedAt < CACHE_TTL &&
        distanceMetres(lat, lon, cached.lat, cached.lon) < 1000
      ) {
        setWeather(cached.weather)
        setLoading(false)
        return () => { cancelled = true }
      }
      fetchWeather(lat, lon)
      return () => { cancelled = true }
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        if (cancelled) return
        const { latitude: lat, longitude: lon } = pos.coords

        const cached = readCache()
        if (
          cached &&
          Date.now() - cached.fetchedAt < CACHE_TTL &&
          distanceMetres(lat, lon, cached.lat, cached.lon) < 1000
        ) {
          setWeather(cached.weather)
          setLoading(false)
          return
        }

        // Reverse geocode to get location name
        if (!loadSavedLocation()) {
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&format=json&zoom=10`, {
              headers: { 'Accept-Language': 'en' },
            })
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data?.address) {
                const name = data.address.city || data.address.town || data.address.suburb || data.address.village || ''
                const country = data.address.country || ''
                if (name) setLocation({ name, country, lat, lon })
              }
            })
            .catch(() => {})
        }

        fetchWeather(lat, lon)
      },
      () => {
        if (!cancelled) {
          setLocationDenied(true)
          setLoading(false)
        }
      },
      { timeout: 8000 }
    )

    return () => { cancelled = true }
  }, [tempUnit, location])

  return { weather, loading, locationDenied, location, setLocation }
}
