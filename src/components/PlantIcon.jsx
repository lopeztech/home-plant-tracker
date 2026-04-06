/**
 * SVG plant icons based on maturity and plant type.
 * Returns an inline SVG element sized to fit its container.
 */

// Detect plant type from species/room/method
function getPlantType(plant) {
  const species = (plant.species || '').toLowerCase()
  const room = (plant.room || '').toLowerCase()
  const method = (plant.waterMethod || '').toLowerCase()

  if (/cactus|succulent|aloe|agave|echeveria/i.test(species)) return 'succulent'
  if (/tree|palm|fig|olive|citrus|eucalyptus/i.test(species)) return 'tree'
  if (/herb|basil|mint|rosemary|thyme|parsley|cilantro/i.test(species)) return 'herb'
  if (/vine|ivy|pothos|philodendron|monstera|hoya/i.test(species)) return 'vine'
  if (/flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/i.test(species)) return 'flower'
  if (method === 'hose' || method === 'irrigation') return 'garden'
  if (/garden|outdoor|balcony|patio|verandah/i.test(room)) return 'garden'
  return 'pot'
}

function getMaturityScale(maturity) {
  switch (maturity) {
    case 'Seedling': return 0.5
    case 'Young': return 0.7
    case 'Mature': return 0.9
    case 'Established': return 1.0
    default: return 0.8
  }
}

// SVG icons for each plant type
const ICONS = {
  pot: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="10" y="26" width="20" height="12" rx="2" fill={color} opacity="0.3" />
      <rect x="8" y="24" width="24" height="4" rx="1" fill={color} opacity="0.4" />
      <line x1="20" y1="24" x2="20" y2={24 - 14 * s} stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx={14} cy={24 - 12 * s} rx={4 * s} ry={3 * s} fill="#66BB6A" />
      <ellipse cx={26} cy={24 - 10 * s} rx={4 * s} ry={3 * s} fill="#81C784" />
      {s > 0.7 && <ellipse cx={20} cy={24 - 16 * s} rx={3.5 * s} ry={2.5 * s} fill="#43A047" />}
    </svg>
  ),
  succulent: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="12" y="28" width="16" height="10" rx="2" fill={color} opacity="0.3" />
      <ellipse cx="20" cy="26" rx={8 * s} ry={4 * s} fill="#66BB6A" />
      <ellipse cx="20" cy={26 - 4 * s} rx={6 * s} ry={3 * s} fill="#81C784" />
      <ellipse cx="20" cy={26 - 7 * s} rx={4 * s} ry={2.5 * s} fill="#A5D6A7" />
      {s > 0.8 && <circle cx="20" cy={26 - 10 * s} r={2 * s} fill="#C8E6C9" />}
    </svg>
  ),
  tree: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="18" y={38 - 16 * s} width="4" height={16 * s} fill="#795548" rx="1" />
      <ellipse cx="20" cy={22 - 8 * s} rx={10 * s} ry={10 * s} fill="#43A047" />
      <ellipse cx="16" cy={24 - 6 * s} rx={7 * s} ry={7 * s} fill="#66BB6A" />
      <ellipse cx="24" cy={24 - 6 * s} rx={7 * s} ry={7 * s} fill="#4CAF50" />
    </svg>
  ),
  herb: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="12" y="30" width="16" height="8" rx="2" fill={color} opacity="0.3" />
      {[14, 20, 26].map((x, i) => (
        <g key={i}>
          <line x1={x} y1="30" x2={x} y2={30 - 10 * s} stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx={x} cy={30 - 11 * s} rx={2.5 * s} ry={1.5 * s} fill="#81C784" />
        </g>
      ))}
    </svg>
  ),
  vine: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="12" y="30" width="16" height="8" rx="2" fill={color} opacity="0.3" />
      <path d={`M20,30 Q12,${24 - 4 * s} 16,${20 - 6 * s} Q20,${16 - 8 * s} 14,${12 - 8 * s}`} fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      <path d={`M20,30 Q28,${24 - 4 * s} 24,${20 - 6 * s} Q20,${16 - 8 * s} 26,${12 - 8 * s}`} fill="none" stroke="#66BB6A" strokeWidth="2" strokeLinecap="round" />
      {[14, 24, 16, 26].slice(0, Math.ceil(s * 4)).map((x, i) => (
        <ellipse key={i} cx={x} cy={20 - i * 3 * s} rx={2.5 * s} ry={2 * s} fill="#81C784" />
      ))}
    </svg>
  ),
  flower: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="12" y="30" width="16" height="8" rx="2" fill={color} opacity="0.3" />
      <line x1="20" y1="30" x2="20" y2={30 - 16 * s} stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx={16} cy={28 - 10 * s} rx={3 * s} ry={2 * s} fill="#81C784" />
      <ellipse cx={24} cy={28 - 8 * s} rx={3 * s} ry={2 * s} fill="#66BB6A" />
      {s > 0.6 && (
        <g>
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <ellipse
              key={i}
              cx={20 + Math.cos(angle * Math.PI / 180) * 3.5}
              cy={30 - 16 * s + Math.sin(angle * Math.PI / 180) * 3.5}
              rx="2.5" ry="1.5"
              fill={i % 2 === 0 ? '#E91E63' : '#F48FB1'}
              transform={`rotate(${angle}, ${20 + Math.cos(angle * Math.PI / 180) * 3.5}, ${30 - 16 * s + Math.sin(angle * Math.PI / 180) * 3.5})`}
            />
          ))}
          <circle cx="20" cy={30 - 16 * s} r="2" fill="#FFC107" />
        </g>
      )}
    </svg>
  ),
  garden: (s, color) => (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <rect x="5" y="34" width="30" height="4" rx="1" fill="#795548" opacity="0.3" />
      <line x1="20" y1="34" x2="20" y2={34 - 18 * s} stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx={14} cy={34 - 14 * s} rx={5 * s} ry={3 * s} fill="#66BB6A" />
      <ellipse cx={26} cy={34 - 12 * s} rx={5 * s} ry={3 * s} fill="#81C784" />
      <ellipse cx={20} cy={34 - 18 * s} rx={4 * s} ry={3 * s} fill="#43A047" />
      {s > 0.8 && <ellipse cx={18} cy={34 - 8 * s} rx={4 * s} ry={2 * s} fill="#A5D6A7" />}
    </svg>
  ),
}

export default function PlantIcon({ plant, size = 40, color = '#43A047' }) {
  const type = getPlantType(plant)
  const scale = getMaturityScale(plant.maturity)
  const render = ICONS[type] || ICONS.pot

  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      {render(scale, color)}
    </div>
  )
}
