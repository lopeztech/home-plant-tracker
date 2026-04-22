// Color-blind safe palettes for all charts.
// Okabe-Ito (categorical, 7 stops) — safe across deuteranopia, protanopia, tritanopia.
export const OKABE_ITO = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7']

// Sequential palette (cividis-inspired, 5 stops) — safe blue→yellow, suitable for
// heatmaps where saturation encodes magnitude.
export const SEQUENTIAL = ['#F0E442', '#56B4E9', '#0072B2', '#004C9B', '#00305E']

// Diverging palette (orange ↔ teal around zero) — for deviation charts.
export const DIVERGING = {
  negative: '#D55E00',
  neutral:  '#CCCCCC',
  positive: '#009E73',
}

// Health-specific palette (still color-blind friendly via shape/label redundancy).
export const HEALTH_COLORS = {
  Excellent: '#009E73',
  Good:      '#56B4E9',
  Fair:      '#E69F00',
  Poor:      '#D55E00',
  Unknown:   '#CCCCCC',
}

/**
 * Builds an ApexCharts-compatible theme object for a given app theme mode and
 * optional base color. Call this inside the `options` prop of react-apexcharts.
 *
 * @param {'light'|'dark'} mode   - from LayoutContext
 * @returns {object}              - ApexCharts theme config
 */
export function getApexTheme(mode = 'light') {
  const isDark = mode === 'dark'
  return {
    mode: isDark ? 'dark' : 'light',
    monochrome: { enabled: false },
    palette: 'palette1',
  }
}

/**
 * Shared ApexCharts axis/grid defaults that keep AA contrast in both modes.
 *
 * @param {'light'|'dark'} mode
 */
export function getApexAxisDefaults(mode = 'light') {
  const isDark = mode === 'dark'
  const labelColor  = isDark ? '#c9d1d9' : '#374151'
  const gridColor   = isDark ? '#374151' : '#e5e7eb'
  return {
    xaxis: {
      labels: { style: { colors: labelColor, fontSize: '11px' } },
      axisBorder: { color: gridColor },
      axisTicks: { color: gridColor },
    },
    yaxis: {
      labels: { style: { colors: labelColor, fontSize: '11px' } },
    },
    grid: {
      borderColor: gridColor,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px' },
    },
  }
}

/**
 * Returns a single color from the Okabe-Ito palette by index (wraps around).
 */
export function categoricalColor(index) {
  return OKABE_ITO[index % OKABE_ITO.length]
}

/**
 * Maps a deviation value to a diverging color.
 * Positive deviations → teal (good), negative → orange (concern), near-zero → grey.
 */
export function divergingColor(value, threshold = 0.5) {
  if (value > threshold) return DIVERGING.positive
  if (value < -threshold) return DIVERGING.negative
  return DIVERGING.neutral
}

/**
 * Maps an intensity value 0..max to a sequential heatmap color (5 stops).
 * Returns the appropriate stop from SEQUENTIAL.
 */
export function heatmapColor(count, max = 3) {
  if (count === 0) return 'var(--bs-tertiary-bg)'
  const idx = Math.min(Math.floor((count / Math.max(max, 1)) * (SEQUENTIAL.length - 1)), SEQUENTIAL.length - 1)
  return SEQUENTIAL[idx]
}
