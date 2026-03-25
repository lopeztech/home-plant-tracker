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

export function useWeather() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locationDenied, setLocationDenied] = useState(false)

  useEffect(() => {
    let cancelled = false

    function fetchWeather(lat, lon) {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', lat.toFixed(4))
      url.searchParams.set('longitude', lon.toFixed(4))
      url.searchParams.set('current_weather', 'true')
      url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum')
      url.searchParams.set('forecast_days', '7')
      url.searchParams.set('timezone', 'auto')

      fetch(url)
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(data => {
          if (cancelled) return
          const cw = data.current_weather
          const d = data.daily
          setWeather({
            current: {
              temp: Math.round(cw.temperature),
              code: cw.weathercode,
              condition: getCondition(cw.weathercode),
              isDay: cw.is_day === 1,
            },
            days: d.time.map((date, i) => ({
              date,
              code: d.weathercode[i],
              condition: getCondition(d.weathercode[i]),
              maxTemp: Math.round(d.temperature_2m_max[i]),
              minTemp: Math.round(d.temperature_2m_min[i]),
              precipitation: d.precipitation_sum[i] ?? 0,
            })),
          })
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        if (!cancelled) {
          setLocationDenied(true)
          setLoading(false)
        }
      },
      { timeout: 8000 }
    )

    return () => { cancelled = true }
  }, [])

  return { weather, loading, locationDenied }
}
