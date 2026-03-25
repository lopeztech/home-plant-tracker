export const GROUND_FLOOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#070d18">
  <defs>
    <pattern id="gf-grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0d1a2e" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#gf-grid)"/>

  <!-- Outer walls -->
  <rect x="55" y="55" width="690" height="490" fill="none" stroke="#1e3a5f" stroke-width="10" rx="3"/>

  <!-- Open-plan Living / Dining -->
  <rect x="60" y="60" width="350" height="270" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="235" y="165" text-anchor="middle" fill="#1d4ed8" font-size="13" font-family="sans-serif" font-weight="600" letter-spacing="2">LIVING</text>
  <text x="235" y="183" text-anchor="middle" fill="#1e3a5f" font-size="10" font-family="sans-serif" letter-spacing="1">ROOM</text>
  <!-- Sofa suggestion -->
  <rect x="80" y="240" width="140" height="50" fill="#0f2040" stroke="#1e3a5f" stroke-width="1.5" rx="6"/>
  <rect x="80" y="240" width="140" height="18" fill="#162d52" rx="4"/>
  <!-- Coffee table -->
  <rect x="110" y="200" width="70" height="35" fill="#0f2040" stroke="#1e3a5f" stroke-width="1" rx="3"/>

  <!-- Kitchen -->
  <rect x="415" y="60" width="330" height="270" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="580" y="165" text-anchor="middle" fill="#1d4ed8" font-size="13" font-family="sans-serif" font-weight="600" letter-spacing="2">KITCHEN</text>
  <text x="580" y="183" text-anchor="middle" fill="#1e3a5f" font-size="10" font-family="sans-serif" letter-spacing="1">DINING</text>
  <!-- Counter L-shape -->
  <rect x="625" y="70" width="110" height="35" fill="#0f2040" stroke="#1e3a5f" stroke-width="1.5" rx="3"/>
  <rect x="700" y="70" width="35" height="120" fill="#0f2040" stroke="#1e3a5f" stroke-width="1.5" rx="3"/>
  <!-- Island -->
  <rect x="455" y="210" width="120" height="50" fill="#0f2040" stroke="#1e3a5f" stroke-width="1.5" rx="4"/>

  <!-- Hallway -->
  <rect x="60" y="335" width="165" height="120" fill="#080f1c" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="143" y="400" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif" letter-spacing="1">HALL</text>

  <!-- WC -->
  <rect x="230" y="335" width="110" height="120" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="285" y="395" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif">WC</text>
  <rect x="245" y="345" width="40" height="75" fill="none" stroke="#1e3a5f" stroke-width="1.5" rx="10"/>
  <circle cx="290" cy="405" r="14" fill="none" stroke="#1e3a5f" stroke-width="1.5"/>

  <!-- Utility -->
  <rect x="345" y="335" width="105" height="120" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="397" y="395" text-anchor="middle" fill="#1e3a5f" font-size="10" font-family="sans-serif">UTILITY</text>

  <!-- Study / Office -->
  <rect x="455" y="335" width="155" height="120" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="532" y="392" text-anchor="middle" fill="#1d4ed8" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="1">STUDY</text>
  <rect x="470" y="345" width="120" height="50" fill="#0f2040" stroke="#1e3a5f" stroke-width="1" rx="3"/>

  <!-- Garage -->
  <rect x="615" y="335" width="130" height="210" fill="#060c17" stroke="#1e3a5f" stroke-width="3" stroke-dasharray="8,4" rx="2"/>
  <text x="680" y="438" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif">GARAGE</text>
  <!-- Car shape -->
  <rect x="630" y="380" width="100" height="55" fill="#0a1528" stroke="#1e3a5f" stroke-width="1" rx="8"/>

  <!-- Bottom rooms row -->
  <rect x="60" y="460" width="200" height="85" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="160" y="505" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif">DINING AREA</text>

  <rect x="265" y="460" width="185" height="85" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="357" y="505" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif">SITTING</text>

  <rect x="455" y="460" width="155" height="85" fill="#0b1624" stroke="#1e3a5f" stroke-width="3" rx="2"/>
  <text x="532" y="505" text-anchor="middle" fill="#1e3a5f" font-size="11" font-family="sans-serif">BOOT ROOM</text>

  <!-- Windows - blue highlights -->
  <line x1="120" y1="58" x2="200" y2="58" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="470" y1="58" x2="580" y2="58" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="637" y1="58" x2="700" y2="58" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="63" y1="150" x2="63" y2="240" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="737" y1="150" x2="737" y2="240" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="63" y1="490" x2="63" y2="530" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="180" y1="543" x2="280" y2="543" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
  <line x1="380" y1="543" x2="450" y2="543" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>

  <!-- Door arcs -->
  <path d="M410 180 Q410 200 430 200" fill="none" stroke="#2d5a9e" stroke-width="2"/>
  <path d="M225 335 Q225 345 235 345" fill="none" stroke="#2d5a9e" stroke-width="2"/>
  <path d="M340 395 Q350 395 350 405" fill="none" stroke="#2d5a9e" stroke-width="2"/>
  <path d="M450 395 Q450 405 460 405" fill="none" stroke="#2d5a9e" stroke-width="2"/>
  <path d="M610 395 Q610 405 620 405" fill="none" stroke="#2d5a9e" stroke-width="2"/>

  <!-- Front door -->
  <rect x="185" y="540" width="50" height="5" fill="#3b82f6" rx="2"/>
  <text x="210" y="558" text-anchor="middle" fill="#3b82f6" font-size="9" font-family="sans-serif">ENTRANCE</text>
</svg>
`

export const UPPER_FLOOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#0a0718">
  <defs>
    <pattern id="uf-grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#140a28" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#uf-grid)"/>

  <!-- Outer walls -->
  <rect x="55" y="55" width="690" height="490" fill="none" stroke="#2d1a5f" stroke-width="10" rx="3"/>

  <!-- Master Bedroom -->
  <rect x="60" y="60" width="310" height="260" fill="#0e0b1e" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="215" y="165" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">MASTER</text>
  <text x="215" y="182" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">BEDROOM</text>
  <!-- Bed -->
  <rect x="80" y="80" width="160" height="110" fill="#150d2e" stroke="#2d1a5f" stroke-width="1.5" rx="6"/>
  <rect x="80" y="80" width="160" height="28" fill="#201040" rx="4"/>
  <!-- Wardrobe -->
  <rect x="260" y="70" width="100" height="40" fill="#150d2e" stroke="#2d1a5f" stroke-width="1" rx="2"/>
  <line x1="310" y1="70" x2="310" y2="110" stroke="#2d1a5f" stroke-width="1"/>

  <!-- En-suite -->
  <rect x="375" y="60" width="180" height="175" fill="#0c0a1a" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="465" y="140" text-anchor="middle" fill="#5b21b6" font-size="11" font-family="sans-serif" letter-spacing="1">EN-SUITE</text>
  <!-- Bath -->
  <rect x="390" y="75" width="60" height="110" fill="none" stroke="#2d1a5f" stroke-width="2" rx="8"/>
  <!-- Basin -->
  <circle cx="490" cy="120" r="16" fill="none" stroke="#2d1a5f" stroke-width="2"/>
  <!-- WC -->
  <rect x="475" y="150" width="30" height="40" fill="none" stroke="#2d1a5f" stroke-width="1.5" rx="4"/>

  <!-- Bedroom 2 -->
  <rect x="560" y="60" width="185" height="260" fill="#0e0b1e" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="652" y="175" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">BED 2</text>
  <rect x="575" y="75" width="130" height="90" fill="#150d2e" stroke="#2d1a5f" stroke-width="1.5" rx="6"/>
  <rect x="575" y="75" width="130" height="24" fill="#201040" rx="4"/>

  <!-- Landing / Stairs -->
  <rect x="375" y="240" width="180" height="80" fill="#080612" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="465" y="283" text-anchor="middle" fill="#2d1a5f" font-size="11" font-family="sans-serif">LANDING</text>
  <!-- Stair lines -->
  <line x1="390" y1="248" x2="390" y2="312" stroke="#2d1a5f" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="405" y1="248" x2="405" y2="312" stroke="#2d1a5f" stroke-width="1" stroke-dasharray="4,3"/>
  <line x1="420" y1="248" x2="420" y2="312" stroke="#2d1a5f" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Bedroom 3 -->
  <rect x="60" y="325" width="220" height="220" fill="#0e0b1e" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="170" y="430" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">BED 3</text>
  <rect x="75" y="340" width="130" height="90" fill="#150d2e" stroke="#2d1a5f" stroke-width="1.5" rx="6"/>
  <rect x="75" y="340" width="130" height="24" fill="#201040" rx="4"/>

  <!-- Bedroom 4 / Office -->
  <rect x="285" y="325" width="225" height="220" fill="#0e0b1e" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="397" y="428" text-anchor="middle" fill="#7c3aed" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">BED 4</text>
  <rect x="300" y="340" width="130" height="90" fill="#150d2e" stroke="#2d1a5f" stroke-width="1.5" rx="6"/>
  <rect x="300" y="340" width="130" height="24" fill="#201040" rx="4"/>

  <!-- Family Bathroom -->
  <rect x="515" y="325" width="230" height="220" fill="#0c0a1a" stroke="#2d1a5f" stroke-width="3" rx="2"/>
  <text x="630" y="420" text-anchor="middle" fill="#5b21b6" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="1">BATHROOM</text>
  <rect x="530" y="340" width="55" height="110" fill="none" stroke="#2d1a5f" stroke-width="2" rx="8"/>
  <circle cx="635" cy="390" r="20" fill="none" stroke="#2d1a5f" stroke-width="2"/>
  <rect x="610" y="420" width="35" height="50" fill="none" stroke="#2d1a5f" stroke-width="1.5" rx="4"/>
  <rect x="655" y="340" width="80" height="40" fill="#150d2e" stroke="#2d1a5f" stroke-width="1" rx="3"/>

  <!-- Windows -->
  <line x1="120" y1="58" x2="220" y2="58" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="590" y1="58" x2="700" y2="58" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="63" y1="130" x2="63" y2="230" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="737" y1="130" x2="737" y2="230" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="100" y1="543" x2="180" y2="543" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="320" y1="543" x2="430" y2="543" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
  <line x1="560" y1="543" x2="680" y2="543" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>

  <!-- Doors -->
  <path d="M370 190 Q370 210 390 210" fill="none" stroke="#4c1d95" stroke-width="2"/>
  <path d="M555 190 Q555 210 560 210" fill="none" stroke="#4c1d95" stroke-width="2"/>
  <path d="M280 435 Q290 435 290 445" fill="none" stroke="#4c1d95" stroke-width="2"/>
  <path d="M510 435 Q510 445 520 445" fill="none" stroke="#4c1d95" stroke-width="2"/>
</svg>
`

export const GARDEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#030d07">
  <defs>
    <pattern id="grass" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#040e08"/>
      <line x1="5" y1="20" x2="8" y2="12" stroke="#0a1f0d" stroke-width="1"/>
      <line x1="12" y1="20" x2="15" y2="13" stroke="#0a1f0d" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#grass)"/>

  <!-- Property boundary -->
  <rect x="30" y="30" width="740" height="540" fill="none" stroke="#1a4a2e" stroke-width="3" stroke-dasharray="12,6" rx="4"/>

  <!-- House footprint (centre) -->
  <rect x="270" y="190" width="260" height="220" fill="#0a1520" stroke="#2d4a6b" stroke-width="6" rx="4"/>
  <text x="400" y="304" text-anchor="middle" fill="#2d4a6b" font-size="14" font-family="sans-serif" font-weight="600" letter-spacing="3">HOUSE</text>
  <!-- Windows on house footprint -->
  <line x1="300" y1="190" x2="360" y2="190" stroke="#3b82f6" stroke-width="3"/>
  <line x1="440" y1="190" x2="500" y2="190" stroke="#3b82f6" stroke-width="3"/>
  <line x1="270" y1="250" x2="270" y2="310" stroke="#3b82f6" stroke-width="3"/>
  <line x1="530" y1="250" x2="530" y2="310" stroke="#3b82f6" stroke-width="3"/>
  <line x1="320" y1="410" x2="380" y2="410" stroke="#3b82f6" stroke-width="3"/>
  <line x1="420" y1="410" x2="480" y2="410" stroke="#3b82f6" stroke-width="3"/>

  <!-- Front path / driveway -->
  <rect x="360" y="415" width="80" height="155" fill="#0c1a10" stroke="#1a4a2e" stroke-width="1.5"/>
  <line x1="400" y1="415" x2="400" y2="570" stroke="#132212" stroke-width="2" stroke-dasharray="8,6"/>

  <!-- Front garden left -->
  <ellipse cx="160" cy="500" rx="100" ry="70" fill="#061409" stroke="#1a4a2e" stroke-width="1.5"/>
  <text x="160" y="504" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">FRONT LAWN</text>

  <!-- Front garden right -->
  <ellipse cx="640" cy="500" rx="100" ry="70" fill="#061409" stroke="#1a4a2e" stroke-width="1.5"/>
  <text x="640" y="504" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">FRONT LAWN</text>

  <!-- Rear patio -->
  <rect x="285" y="60" width="230" height="120" fill="#080f0a" stroke="#1a4a2e" stroke-width="2" rx="3"/>
  <text x="400" y="125" text-anchor="middle" fill="#166534" font-size="12" font-family="sans-serif" font-weight="600" letter-spacing="2">PATIO</text>
  <!-- Paving lines -->
  <line x1="330" y1="60" x2="330" y2="180" stroke="#0d1f10" stroke-width="1"/>
  <line x1="375" y1="60" x2="375" y2="180" stroke="#0d1f10" stroke-width="1"/>
  <line x1="420" y1="60" x2="420" y2="180" stroke="#0d1f10" stroke-width="1"/>
  <line x1="465" y1="60" x2="465" y2="180" stroke="#0d1f10" stroke-width="1"/>
  <line x1="285" y1="100" x2="515" y2="100" stroke="#0d1f10" stroke-width="1"/>
  <line x1="285" y1="140" x2="515" y2="140" stroke="#0d1f10" stroke-width="1"/>

  <!-- Rear lawn -->
  <ellipse cx="400" cy="115" rx="280" ry="55" fill="none" stroke="#166534" stroke-width="1" stroke-dasharray="4,3"/>

  <!-- Garden beds (rear) -->
  <ellipse cx="130" cy="130" rx="90" ry="90" fill="#040e07" stroke="#166534" stroke-width="2"/>
  <text x="130" y="128" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">GARDEN</text>
  <text x="130" y="143" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">BED</text>

  <ellipse cx="670" cy="130" rx="90" ry="90" fill="#040e07" stroke="#166534" stroke-width="2"/>
  <text x="670" y="128" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">GARDEN</text>
  <text x="670" y="143" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif">BED</text>

  <!-- Side access left -->
  <rect x="50" y="210" width="215" height="180" fill="#040e07" stroke="#1a4a2e" stroke-width="1.5" stroke-dasharray="6,3" rx="2"/>
  <text x="157" y="303" text-anchor="middle" fill="#1a4a2e" font-size="10" font-family="sans-serif">SIDE ACCESS</text>

  <!-- Side access right -->
  <rect x="535" y="210" width="215" height="180" fill="#040e07" stroke="#1a4a2e" stroke-width="1.5" stroke-dasharray="6,3" rx="2"/>
  <text x="642" y="303" text-anchor="middle" fill="#1a4a2e" font-size="10" font-family="sans-serif">SIDE ACCESS</text>

  <!-- Trees -->
  <circle cx="100" cy="100" r="32" fill="#051208" stroke="#166534" stroke-width="2"/>
  <circle cx="100" cy="100" r="18" fill="#061609" stroke="#1a5c30" stroke-width="1"/>
  <text x="100" y="104" text-anchor="middle" fill="#166534" font-size="9" font-family="sans-serif">🌳</text>

  <circle cx="700" cy="100" r="32" fill="#051208" stroke="#166534" stroke-width="2"/>
  <circle cx="700" cy="100" r="18" fill="#061609" stroke="#1a5c30" stroke-width="1"/>
  <text x="700" y="104" text-anchor="middle" fill="#166534" font-size="9" font-family="sans-serif">🌳</text>

  <circle cx="90" cy="480" r="25" fill="#051208" stroke="#166534" stroke-width="1.5"/>
  <circle cx="90" cy="480" r="13" fill="#061609" stroke="#1a5c30" stroke-width="1"/>

  <circle cx="710" cy="480" r="25" fill="#051208" stroke="#166534" stroke-width="1.5"/>
  <circle cx="710" cy="480" r="13" fill="#061609" stroke="#1a5c30" stroke-width="1"/>

  <!-- Shed -->
  <rect x="640" y="350" width="90" height="70" fill="#060e08" stroke="#1a4a2e" stroke-width="2" rx="2"/>
  <text x="685" y="390" text-anchor="middle" fill="#1a4a2e" font-size="10" font-family="sans-serif">SHED</text>

  <!-- Gate -->
  <line x1="340" y1="568" x2="360" y2="568" stroke="#166534" stroke-width="4" stroke-linecap="round"/>
  <line x1="440" y1="568" x2="460" y2="568" stroke="#166534" stroke-width="4" stroke-linecap="round"/>
  <text x="400" y="590" text-anchor="middle" fill="#166534" font-size="10" font-family="sans-serif" letter-spacing="2">ENTRANCE</text>
</svg>
`

// ── Room colour palette (matched by substring, case-insensitive) ──────────────
const ROOM_PALETTE = [
  { keys: ['living', 'lounge', 'sitting', 'reception'],  fill: '#0b1830', stroke: '#1e3a5f', text: '#2d5a9e' },
  { keys: ['kitchen', 'dining', 'breakfast'],            fill: '#1a1000', stroke: '#3d2800', text: '#7c5a1e' },
  { keys: ['master', 'bedroom', 'bed'],                  fill: '#130a2a', stroke: '#2d1a5f', text: '#5b3fa0' },
  { keys: ['bath', 'shower', 'wc', 'toilet', 'ensuite'], fill: '#001818', stroke: '#0d3333', text: '#1a8080' },
  { keys: ['hall', 'landing', 'corridor', 'lobby'],      fill: '#0a0a18', stroke: '#1a1a33', text: '#3a3a70' },
  { keys: ['study', 'office', 'library'],                fill: '#001208', stroke: '#0d3320', text: '#1a6640' },
  { keys: ['garage', 'utility', 'laundry', 'storage'],   fill: '#0a0a0a', stroke: '#1f1f1f', text: '#444444' },
  { keys: ['garden', 'lawn', 'yard'],                    fill: '#011208', stroke: '#1a4d20', text: '#2a7a2a' },
  { keys: ['patio', 'terrace', 'deck', 'balcony'],       fill: '#111008', stroke: '#2a2010', text: '#5a5030' },
  { keys: ['driveway', 'drive', 'parking'],              fill: '#0a0a0a', stroke: '#252525', text: '#505050' },
]

function roomPalette(name) {
  const lower = name.toLowerCase()
  for (const p of ROOM_PALETTE) {
    if (p.keys.some(k => lower.includes(k))) return p
  }
  return { fill: '#0d1117', stroke: '#1e3a5f', text: '#2d5a9e' }
}

export function generateFloorSvg(floor) {
  const W = 800
  const H = 600
  const rooms = floor.rooms || []
  const isOutdoor = floor.type === 'outdoor'
  const bg = isOutdoor ? '#010d03' : '#070d18'

  // Grid pattern id must be unique per floor to avoid SVG id collisions
  const gridId = 'grid-' + (floor.id || 'f')

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:${bg}">`
  svg += `<defs><pattern id="${gridId}" width="30" height="30" patternUnits="userSpaceOnUse">`
  svg += `<path d="M 30 0 L 0 0 0 30" fill="none" stroke="${isOutdoor ? '#0a1f0a' : '#0d1a2e'}" stroke-width="0.6"/>`
  svg += `</pattern></defs>`
  svg += `<rect width="${W}" height="${H}" fill="url(#${gridId})"/>`

  for (const room of rooms) {
    const x = Math.round((room.x / 100) * W)
    const y = Math.round((room.y / 100) * H)
    const w = Math.round((room.width / 100) * W)
    const h = Math.round((room.height / 100) * H)
    if (w < 4 || h < 4) continue

    const p = roomPalette(room.name)
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="2" rx="3"/>`

    // Label — two lines if name has a space
    const cx = x + w / 2
    const cy = y + h / 2
    const words = room.name.split(' ')
    const fs = Math.min(13, Math.max(7, Math.floor(Math.min(w, h) / 5)))
    if (words.length > 1 && h > 40) {
      const half = Math.ceil(words.length / 2)
      const line1 = words.slice(0, half).join(' ')
      const line2 = words.slice(half).join(' ')
      svg += `<text x="${cx}" y="${cy - fs * 0.7}" text-anchor="middle" fill="${p.text}" font-size="${fs}" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">${line1}</text>`
      svg += `<text x="${cx}" y="${cy + fs * 0.9}" text-anchor="middle" fill="${p.text}" font-size="${fs}" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">${line2}</text>`
    } else {
      svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${p.text}" font-size="${fs}" font-family="system-ui,sans-serif" font-weight="600" letter-spacing="1">${room.name}</text>`
    }
  }

  if (rooms.length === 0) {
    svg += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="middle" fill="#1e3a5f" font-size="14" font-family="system-ui,sans-serif">${floor.name}</text>`
  }

  svg += `</svg>`
  return svg
}
