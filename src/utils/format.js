// Locale-aware formatting helpers — use Intl APIs, read user locale from
// localStorage override or navigator.language (browser default).

const STORAGE_KEY = 'plantTracker_locale'

export function getLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  } catch {}
  try {
    return navigator.language || 'en'
  } catch {}
  return 'en'
}

export function setLocale(locale) {
  try { localStorage.setItem(STORAGE_KEY, locale) } catch {}
}

/**
 * Format a date value using the user's locale.
 * @param {string|number|Date} date
 * @param {Intl.DateTimeFormatOptions} options
 */
export function formatDate(date, options = {}) {
  try {
    return new Intl.DateTimeFormat(getLocale(), options).format(new Date(date))
  } catch {
    return String(date)
  }
}

/**
 * Format a time value using the user's locale.
 * @param {string|number|Date} date
 * @param {Intl.DateTimeFormatOptions} options
 */
export function formatTime(date, options = { hour: 'numeric', minute: '2-digit' }) {
  try {
    return new Intl.DateTimeFormat(getLocale(), options).format(new Date(date))
  } catch {
    return String(date)
  }
}

/**
 * Format a relative time (e.g. "3 days ago", "in 2 hours").
 * @param {string|number|Date} date
 */
export function formatRelativeTime(date) {
  try {
    const ms = new Date(date).getTime() - Date.now()
    const abs = Math.abs(ms)
    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' })

    if (abs < 60_000)     return rtf.format(Math.round(ms / 1_000),    'second')
    if (abs < 3_600_000)  return rtf.format(Math.round(ms / 60_000),   'minute')
    if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), 'hour')
    if (abs < 2_592_000_000) return rtf.format(Math.round(ms / 86_400_000), 'day')
    if (abs < 31_536_000_000) return rtf.format(Math.round(ms / 2_592_000_000), 'month')
    return rtf.format(Math.round(ms / 31_536_000_000), 'year')
  } catch {
    return String(date)
  }
}

/**
 * Format a number using the user's locale (e.g. thousands separators, decimals).
 * @param {number} n
 * @param {Intl.NumberFormatOptions} options
 */
export function formatNumber(n, options = {}) {
  try {
    return new Intl.NumberFormat(getLocale(), options).format(n)
  } catch {
    return String(n)
  }
}
