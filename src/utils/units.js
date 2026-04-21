// Unit conversion helpers — all store SI/metric internally, convert for display

export const POT_SIZES = {
  metric: [
    { value: 'small',  label: 'Small (< 15 cm)' },
    { value: 'medium', label: 'Medium (15–25 cm)' },
    { value: 'large',  label: 'Large (25–40 cm)' },
    { value: 'xlarge', label: 'X-Large (> 40 cm)' },
  ],
  imperial: [
    { value: 'small',  label: 'Small (< 6 in)' },
    { value: 'medium', label: 'Medium (6–10 in)' },
    { value: 'large',  label: 'Large (10–16 in)' },
    { value: 'xlarge', label: 'X-Large (> 16 in)' },
  ],
}

export function formatLength(cm, unitSystem) {
  if (unitSystem === 'imperial') {
    const inches = cm / 2.54
    return `${inches % 1 === 0 ? inches : inches.toFixed(1)} in`
  }
  return `${cm} cm`
}

export function formatTemperatureC(tempC, tempUnit) {
  if (tempUnit === 'fahrenheit') return `${Math.round(tempC * 9 / 5 + 32)}°F`
  return `${Math.round(tempC)}°C`
}

export function unitSystemLabel(system) {
  return system === 'imperial' ? 'Imperial (in, fl oz)' : 'Metric (cm, ml)'
}
