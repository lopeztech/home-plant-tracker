import { useState, useCallback } from 'react'

const STORAGE_KEY = 'plantTracker_timezone'

function detectDefault() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {}
  return 'UTC'
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v) return v
  } catch {}
  return null
}

export function useTimezone() {
  const [timezone, setTimezoneState] = useState(() => readStored() || detectDefault())

  const setTimezone = useCallback((tz) => {
    setTimezoneState(tz)
    try { localStorage.setItem(STORAGE_KEY, tz) } catch {}
  }, [])

  return { timezone, setTimezone }
}

/**
 * Groups of commonly used IANA timezone identifiers for display in a picker.
 * Not exhaustive — covers ~95% of users worldwide.
 */
export const TIMEZONE_GROUPS = [
  { label: 'UTC', zones: ['UTC'] },
  {
    label: 'Americas',
    zones: [
      'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota',
      'America/Caracas', 'America/Chicago', 'America/Denver', 'America/Halifax',
      'America/Lima', 'America/Los_Angeles', 'America/Mexico_City', 'America/New_York',
      'America/Phoenix', 'America/Sao_Paulo', 'America/Santiago', 'America/Toronto',
      'America/Vancouver', 'Pacific/Honolulu',
    ],
  },
  {
    label: 'Europe',
    zones: [
      'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels',
      'Europe/Bucharest', 'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin',
      'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kiev', 'Europe/Lisbon',
      'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo',
      'Europe/Paris', 'Europe/Prague', 'Europe/Rome', 'Europe/Stockholm',
      'Europe/Vienna', 'Europe/Warsaw',
    ],
  },
  {
    label: 'Africa & Middle East',
    zones: [
      'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
      'Asia/Dubai', 'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Tehran',
    ],
  },
  {
    label: 'Asia',
    zones: [
      'Asia/Bangkok', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Hong_Kong',
      'Asia/Jakarta', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuala_Lumpur',
      'Asia/Manila', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore',
      'Asia/Taipei', 'Asia/Tokyo', 'Asia/Yangon',
    ],
  },
  {
    label: 'Pacific',
    zones: [
      'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Darwin',
      'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
      'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam',
    ],
  },
]
