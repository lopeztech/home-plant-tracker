import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { getWateringStatus, getSeason } from '../utils/watering.js'
import { usePlantContext } from '../context/PlantContext.jsx'
import { plantsApi } from '../api/plants.js'
import { useImageAspect } from '../hooks/useImageAspect.js'
import { derivePlantName } from '../utils/plantName.js'

// Scale room + plant coords around the centre (50). `aspect` reshapes the Y
// axis so the square world reflects the image's true proportions (X untouched
// when aspect ≈ 1). `factor` dilates the whole layout both ways, used in guest
// mode so the hand-authored 100×100 grid doesn't feel cramped next to the
// fixed-size avatar. Callers at the save boundary reverse both transforms.
const GUEST_SCALE_FACTOR = 1.5

function applyAspectToFloor(floor, aspect, factor = 1) {
  if (!floor || (aspect === 1 && factor === 1)) return floor
  return {
    ...floor,
    rooms: (floor.rooms || []).map((r) => ({
      ...r,
      x: (r.x - 50) * factor + 50,
      y: (r.y - 50) * factor / aspect + 50,
      width: r.width * factor,
      height: r.height * factor / aspect,
    })),
  }
}
function applyAspectToPlants(plants, aspect, factor = 1) {
  if (aspect === 1 && factor === 1) return plants
  return (plants || []).map((p) => ({
    ...p,
    x: (p.x - 50) * factor + 50,
    y: (p.y - 50) * factor / aspect + 50,
  }))
}

function getPlantEmoji(plant) {
  const species = (plant.species || '').toLowerCase()
  if (/cactus|succulent|aloe/i.test(species)) return '🌵'
  if (/tree|palm|fig|olive|eucalyptus/i.test(species)) return '🌳'
  if (/herb|basil|mint|rosemary/i.test(species)) return '🌿'
  if (/vine|ivy|pothos|philodendron|monstera/i.test(species)) return '🍃'
  if (/flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/i.test(species)) return '🌸'
  if (/grass|hedge|shrub/i.test(species)) return '🌲'
  return '🪴'
}

const SCALE = 0.14 // 100% → 14 world units — keeps rooms snug to the avatar
const WALL_HEIGHT = 2.5
const WALL_THICKNESS = 0.08

const ROOM_COLORS = {
  indoor:   { wall: '#e0e0e0', floor: '#ffffff', edge: '#9e9e9e' },
  interior: { wall: '#e0e0e0', floor: '#ffffff', edge: '#9e9e9e' },
  outdoor:  { wall: '#b7dfc5', floor: '#e8f5e9', edge: '#6aad80' },
}

function pctToWorld(x, y) {
  return [(x - 50) * SCALE, 0, (y - 50) * SCALE]
}

// Tiny deterministic RNG — same inputs produce the same layout each render.
function seedRand(seed) {
  let h = 2166136261
  const s = String(seed || 'x')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
    return ((h & 0x7fffffff) >>> 0) / 0x7fffffff
  }
}

function categoriseRoom(name) {
  const s = (name || '').toLowerCase()
  if (/living|lounge|family|rumpus/.test(s))        return 'living'
  if (/bedroom|^bed|master|nursery|guest/.test(s))   return 'bedroom'
  if (/kitchen|galley/.test(s))                      return 'kitchen'
  if (/bath|shower|ensuite|wc|toilet/.test(s))       return 'bathroom'
  if (/dining/.test(s))                              return 'dining'
  if (/office|study|library/.test(s))                return 'office'
  if (/garden|yard|lawn|patio|deck|balcony|terrace|courtyard/.test(s)) return 'outdoor'
  return null
}

// Place a single piece of furniture against a chosen wall of a room.
// side: 0=north (-z), 1=south (+z), 2=west (-x), 3=east (+x)
function wallAnchor(side, w, d, pieceDepth) {
  const gap = 0.08
  const inset = pieceDepth / 2 + gap + WALL_THICKNESS / 2
  switch (side) {
    case 0: return { x: 0,            z: -d / 2 + inset, ry: 0 }
    case 1: return { x: 0,            z:  d / 2 - inset, ry: Math.PI }
    case 2: return { x: -w / 2 + inset, z: 0,            ry:  Math.PI / 2 }
    default:return { x:  w / 2 - inset, z: 0,            ry: -Math.PI / 2 }
  }
}

function Sofa({ tint = '#6b7280' }) {
  return (
    <group>
      {/* seat */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[2.0, 0.5, 0.9]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      {/* backrest */}
      <mesh position={[0, 0.6, -0.35]} castShadow>
        <boxGeometry args={[2.0, 0.7, 0.2]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      {/* armrests */}
      <mesh position={[-1.0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.5, 0.9]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
      <mesh position={[1.0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.5, 0.9]} />
        <meshStandardMaterial color={tint} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bed() {
  return (
    <group>
      {/* mattress */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.5, 0.3, 2.0]} />
        <meshStandardMaterial color="#e8e6df" roughness={1} />
      </mesh>
      {/* duvet fold */}
      <mesh position={[0, 0.56, 0.3]} castShadow>
        <boxGeometry args={[1.45, 0.05, 1.3]} />
        <meshStandardMaterial color="#6b84b5" roughness={1} />
      </mesh>
      {/* pillows */}
      <mesh position={[-0.35, 0.58, -0.7]} castShadow>
        <boxGeometry args={[0.55, 0.12, 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      <mesh position={[0.35, 0.58, -0.7]} castShadow>
        <boxGeometry args={[0.55, 0.12, 0.35]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
      {/* headboard */}
      <mesh position={[0, 0.7, -1.05]} castShadow>
        <boxGeometry args={[1.55, 1.0, 0.1]} />
        <meshStandardMaterial color="#5c3317" roughness={0.7} />
      </mesh>
      {/* frame legs */}
      {[[-0.7, -0.9], [0.7, -0.9], [-0.7, 0.9], [0.7, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.13, z]}>
          <boxGeometry args={[0.1, 0.25, 0.1]} />
          <meshStandardMaterial color="#3a2a1b" />
        </mesh>
      ))}
    </group>
  )
}

function KitchenCounter({ length = 3 }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[length, 0.9, 0.6]} />
        <meshStandardMaterial color="#d6d2c9" roughness={0.6} />
      </mesh>
      {/* top */}
      <mesh position={[0, 0.91, 0]}>
        <boxGeometry args={[length + 0.05, 0.04, 0.65]} />
        <meshStandardMaterial color="#2b2b2b" roughness={0.2} metalness={0.3} />
      </mesh>
    </group>
  )
}

function Tub() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.7, 0.6, 0.75]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* inner water hollow hint */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.5, 0.05, 0.6]} />
        <meshStandardMaterial color="#a8d8ea" roughness={0.2} metalness={0.2} />
      </mesh>
    </group>
  )
}

function DiningTable() {
  return (
    <group>
      <mesh position={[0, 0.73, 0]} castShadow>
        <boxGeometry args={[1.8, 0.06, 0.9]} />
        <meshStandardMaterial color="#6b4423" roughness={0.7} />
      </mesh>
      {[[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]}>
          <boxGeometry args={[0.08, 0.72, 0.08]} />
          <meshStandardMaterial color="#4a2e1c" />
        </mesh>
      ))}
    </group>
  )
}

function Desk() {
  return (
    <group>
      <mesh position={[0, 0.73, 0]} castShadow>
        <boxGeometry args={[1.5, 0.05, 0.7]} />
        <meshStandardMaterial color="#8b6f4e" roughness={0.7} />
      </mesh>
      <mesh position={[-0.65, 0.36, 0]}>
        <boxGeometry args={[0.08, 0.72, 0.68]} />
        <meshStandardMaterial color="#5c3317" />
      </mesh>
      <mesh position={[0.65, 0.36, 0]}>
        <boxGeometry args={[0.08, 0.72, 0.68]} />
        <meshStandardMaterial color="#5c3317" />
      </mesh>
      {/* little monitor hint */}
      <mesh position={[0.2, 0.95, -0.2]}>
        <boxGeometry args={[0.45, 0.3, 0.05]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  )
}

function Bush({ scale = 1 }) {
  return (
    <mesh position={[0, 0.25 * scale, 0]} castShadow>
      <sphereGeometry args={[0.4 * scale, 12, 10]} />
      <meshStandardMaterial color="#4f9f4d" roughness={1} />
    </mesh>
  )
}

// ── Extra furniture ──────────────────────────────────────────────────────────

function TVAndStand() {
  return (
    <group>
      {/* stand */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.3, 0.4, 0.4]} />
        <meshStandardMaterial color="#3b2415" roughness={0.7} />
      </mesh>
      {/* screen frame */}
      <mesh position={[0, 0.85, 0.06]} castShadow>
        <boxGeometry args={[1.2, 0.7, 0.05]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* screen face */}
      <mesh position={[0, 0.85, 0.09]}>
        <planeGeometry args={[1.1, 0.6]} />
        <meshBasicMaterial color="#1e3a5f" />
      </mesh>
    </group>
  )
}

function Nightstand() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.4]} />
        <meshStandardMaterial color="#6b4423" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[0.48, 0.03, 0.43]} />
        <meshStandardMaterial color="#4a2e1c" roughness={0.6} />
      </mesh>
      {/* lamp */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <coneGeometry args={[0.12, 0.14, 14]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function Rug({ w = 2.4, d = 1.6, color = '#b45f5f' }) {
  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

function Chair({ color = '#5c3317' }) {
  return (
    <group>
      {/* seat */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.42, 0.06, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* legs */}
      {[[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.21, z]}>
          <boxGeometry args={[0.05, 0.42, 0.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* back */}
      <mesh position={[0, 0.72, -0.19]} castShadow>
        <boxGeometry args={[0.42, 0.55, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Fridge() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.7]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* door split */}
      <mesh position={[0, 1.4, 0.36]}>
        <boxGeometry args={[0.66, 0.02, 0.02]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      {/* handles */}
      <mesh position={[0.22, 1.65, 0.36]}>
        <boxGeometry args={[0.04, 0.25, 0.03]} />
        <meshStandardMaterial color="#6b7280" metalness={0.5} />
      </mesh>
      <mesh position={[0.22, 0.8, 0.36]}>
        <boxGeometry args={[0.04, 0.25, 0.03]} />
        <meshStandardMaterial color="#6b7280" metalness={0.5} />
      </mesh>
    </group>
  )
}

function Toilet() {
  return (
    <group>
      {/* tank */}
      <mesh position={[0, 0.75, -0.2]} castShadow>
        <boxGeometry args={[0.45, 0.55, 0.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* bowl */}
      <mesh position={[0, 0.3, 0.05]} castShadow>
        <boxGeometry args={[0.42, 0.4, 0.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* seat */}
      <mesh position={[0, 0.51, 0.05]}>
        <boxGeometry args={[0.44, 0.03, 0.52]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.4} />
      </mesh>
    </group>
  )
}

function Sink() {
  return (
    <group>
      {/* vanity */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.45]} />
        <meshStandardMaterial color="#d6d2c9" roughness={0.6} />
      </mesh>
      {/* basin */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[0.66, 0.06, 0.42]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
      </mesh>
      {/* faucet */}
      <mesh position={[0, 0.92, -0.12]}>
        <cylinderGeometry args={[0.012, 0.012, 0.15, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* mirror above */}
      <mesh position={[0, 1.45, -0.21]}>
        <boxGeometry args={[0.55, 0.5, 0.03]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.1} />
      </mesh>
    </group>
  )
}

function Bookshelf() {
  return (
    <group>
      {/* outer frame */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.9, 1.7, 0.3]} />
        <meshStandardMaterial color="#6b4423" roughness={0.7} />
      </mesh>
      {/* shelves as coloured bands to hint at books */}
      {[0.35, 0.75, 1.15, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0.02]}>
          <boxGeometry args={[0.82, 0.25, 0.26]} />
          <meshStandardMaterial color={['#b45309', '#1e40af', '#065f46', '#7c2d12'][i]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function OfficeChair() {
  return (
    <group>
      {/* seat */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 18]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
      {/* central post */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.4} />
      </mesh>
      {/* star base */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
        <meshStandardMaterial color="#4b5563" metalness={0.4} />
      </mesh>
      {/* backrest */}
      <mesh position={[0, 0.8, -0.18]} castShadow>
        <boxGeometry args={[0.42, 0.55, 0.06]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
    </group>
  )
}

function RoomFurniture({ room, w, d }) {
  const category = categoriseRoom(room.name)
  if (!category) return null

  const rand = seedRand(room.id || `${room.x}-${room.y}-${room.name || ''}`)

  if (category === 'living') {
    // Sofa against one of the long walls; coffee table + TV opposite it.
    const side = w >= d ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const a = wallAnchor(side, w, d, 0.9)
    const tint = ['#6b7280', '#8f8676', '#5a6677', '#78594b'][Math.floor(rand() * 4)]
    // Sofa's forward direction (the way it faces); used to offset rug and TV.
    const fx = side === 2 ? 1 : side === 3 ? -1 : 0
    const fz = side === 0 ? 1 : side === 1 ? -1 : 0
    const oppositeSide = { 0: 1, 1: 0, 2: 3, 3: 2 }[side]
    const tv = wallAnchor(oppositeSide, w, d, 0.4)
    return (
      <>
        <group position={[a.x + fx * 1.4, 0, a.z + fz * 0.9]}>
          <Rug w={2.4} d={1.6} color="#9c5a3c" />
        </group>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <Sofa tint={tint} />
        </group>
        <group position={[a.x + fx * 1.3, 0, a.z + fz * 1.2]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[1.2, 0.35, 0.6]} />
            <meshStandardMaterial color="#6b4423" roughness={0.7} />
          </mesh>
        </group>
        <group position={[tv.x, 0, tv.z]} rotation={[0, tv.ry, 0]}>
          <TVAndStand />
        </group>
      </>
    )
  }

  if (category === 'bedroom') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 2 : 3) : (rand() < 0.5 ? 0 : 1)
    const a = wallAnchor(side, w, d, 2.3)
    // Offset nightstand alongside the bed (perpendicular to bed orientation).
    const nx = side === 0 || side === 1 ? 1.05 : 0
    const nz = side === 2 || side === 3 ? 1.05 : 0
    // Rug in front of the bed.
    const rx = side === 2 ? 1.2 : side === 3 ? -1.2 : 0
    const rz = side === 0 ? 1.2 : side === 1 ? -1.2 : 0
    return (
      <>
        <group position={[a.x + rx, 0, a.z + rz]}>
          <Rug w={1.8} d={1.4} color="#4b6cb7" />
        </group>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <Bed />
        </group>
        <group position={[a.x + nx, 0, a.z + nz]} rotation={[0, a.ry, 0]}>
          <Nightstand />
        </group>
      </>
    )
  }

  if (category === 'kitchen') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const len = Math.min(longSide ? w : d, 4) - 1
    const a = wallAnchor(side, w, d, 0.6)
    // Fridge sits at one end of the counter along the wall.
    const along = Math.min(len / 2 + 0.4, (longSide ? w : d) / 2 - 0.5)
    const fx = side === 2 || side === 3 ? 0 : along * (rand() < 0.5 ? -1 : 1)
    const fz = side === 0 || side === 1 ? 0 : along * (rand() < 0.5 ? -1 : 1)
    return (
      <>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <KitchenCounter length={len} />
        </group>
        <group position={[a.x + fx, 0, a.z + fz]} rotation={[0, a.ry, 0]}>
          <Fridge />
        </group>
      </>
    )
  }

  if (category === 'bathroom') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const a = wallAnchor(side, w, d, 0.8)
    // Toilet + sink crowd the opposite wall.
    const opposite = { 0: 1, 1: 0, 2: 3, 3: 2 }[side]
    const t = wallAnchor(opposite, w, d, 0.5)
    const s = wallAnchor(opposite, w, d, 0.45)
    const spread = Math.min((longSide ? w : d) / 2 - 0.5, 0.8)
    const tOffX = opposite === 2 || opposite === 3 ? 0 : -spread
    const tOffZ = opposite === 0 || opposite === 1 ? 0 : -spread
    const sOffX = opposite === 2 || opposite === 3 ? 0 : spread
    const sOffZ = opposite === 0 || opposite === 1 ? 0 : spread
    return (
      <>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <Tub />
        </group>
        <group position={[t.x + tOffX, 0, t.z + tOffZ]} rotation={[0, t.ry, 0]}>
          <Toilet />
        </group>
        <group position={[s.x + sOffX, 0, s.z + sOffZ]} rotation={[0, s.ry, 0]}>
          <Sink />
        </group>
      </>
    )
  }

  if (category === 'dining') {
    const rotY = w < d ? Math.PI / 2 : 0
    // Four chairs — two on each long side of the table. Table geom is 1.8×0.9
    // along X, so chairs sit at ±0.45 along the table's local X and ±0.7 in Z.
    return (
      <group position={[0, 0, 0]} rotation={[0, rotY, 0]}>
        <DiningTable />
        {[
          { x: -0.45, z: -0.7, ry: 0 },
          { x:  0.45, z: -0.7, ry: 0 },
          { x: -0.45, z:  0.7, ry: Math.PI },
          { x:  0.45, z:  0.7, ry: Math.PI },
        ].map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.ry, 0]}>
            <Chair color="#6b4423" />
          </group>
        ))}
      </group>
    )
  }

  if (category === 'office') {
    const side = Math.floor(rand() * 4)
    const a = wallAnchor(side, w, d, 0.7)
    // Office chair in front of the desk (opposite the wall).
    const cx = side === 2 ? 1 : side === 3 ? -1 : 0
    const cz = side === 0 ? 1 : side === 1 ? -1 : 0
    // Bookshelf against a perpendicular wall so it doesn't overlap the desk.
    const shelfSide = (side + 2) % 4
    const bs = wallAnchor(shelfSide, w, d, 0.3)
    return (
      <>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <Desk />
        </group>
        <group position={[a.x + cx * 0.8, 0, a.z + cz * 0.8]} rotation={[0, a.ry + Math.PI, 0]}>
          <OfficeChair />
        </group>
        <group position={[bs.x, 0, bs.z]} rotation={[0, bs.ry, 0]}>
          <Bookshelf />
        </group>
      </>
    )
  }

  if (category === 'outdoor') {
    // A few bushes scattered around, deterministic positions
    const count = 3 + Math.floor(rand() * 3)
    const bushes = Array.from({ length: count }, () => ({
      x: (rand() - 0.5) * (w - 1.2),
      z: (rand() - 0.5) * (d - 1.2),
      scale: 0.7 + rand() * 0.5,
    }))
    return (
      <>
        {bushes.map((b, i) => (
          <group key={i} position={[b.x, 0, b.z]}>
            <Bush scale={b.scale} />
          </group>
        ))}
      </>
    )
  }

  return null
}

function Room({ room, floorType }) {
  const roomType = room.type || floorType || 'interior'
  const palette = ROOM_COLORS[roomType] || ROOM_COLORS.interior
  const cx = (room.x + room.width / 2 - 50) * SCALE
  const cz = (room.y + room.height / 2 - 50) * SCALE
  const w = room.width * SCALE
  const d = room.height * SCALE

  return (
    <group position={[cx, 0, cz]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={palette.floor} />
      </mesh>

      {/* Walls — 4 sides, no top */}
      {/* Front wall (z+) */}
      <mesh position={[0, WALL_HEIGHT / 2, d / 2]} castShadow>
        <boxGeometry args={[w, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={palette.wall} transparent opacity={0.6} />
      </mesh>
      {/* Back wall (z-) */}
      <mesh position={[0, WALL_HEIGHT / 2, -d / 2]} castShadow>
        <boxGeometry args={[w, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={palette.wall} transparent opacity={0.6} />
      </mesh>
      {/* Left wall (x-) */}
      <mesh position={[-w / 2, WALL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, d]} />
        <meshStandardMaterial color={palette.wall} transparent opacity={0.6} />
      </mesh>
      {/* Right wall (x+) */}
      <mesh position={[w / 2, WALL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, d]} />
        <meshStandardMaterial color={palette.wall} transparent opacity={0.6} />
      </mesh>

      {/* Deterministic furniture for the room category */}
      <RoomFurniture room={room} w={w} d={d} />

      {/* Room label */}
      <Billboard position={[0, 0.15, 0]}>
        <Text
          fontSize={0.4}
          color="#495057"
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.4}
        >
          {room.name?.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  )
}

// Leaf colour by species keyword — defaults to bright leaf green.
function getLeafColor(plant) {
  const s = (plant.species || '').toLowerCase()
  if (/cactus|succulent|aloe/.test(s))                return '#86b56c'
  if (/tree|palm|fig|olive|eucalyptus/.test(s))       return '#2e7d32'
  if (/herb|basil|mint|rosemary/.test(s))             return '#5aa852'
  if (/vine|ivy|pothos|philodendron|monstera/.test(s)) return '#3f8a3f'
  if (/grass|hedge|shrub/.test(s))                    return '#4f9f4d'
  return '#48a148'
}

function PlantMarker({ plant, weather, floors, onClick }) {
  const { color, label, daysUntil } = getWateringStatus(plant, weather, floors)
  const [x, , z] = pctToWorld(plant.x, plant.y)
  const hitRef = useRef()
  const foliageRef = useRef()
  const leafColor = getLeafColor(plant)
  const species = (plant.species || '').toLowerCase()
  const hasFlower = /flower|rose|orchid|lily|daisy|tulip|lavender|bird of paradise/.test(species)
  const isCactus = /cactus|succulent|aloe/.test(species)

  // 5 leaves around the pot, alternating size for variation
  const leaves = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      angle: (i / 5) * Math.PI * 2 + Math.random() * 0.2,
      tilt: 0.55 + (i % 2) * 0.2,
      length: 0.38 + (i % 2) * 0.08,
      radius: 0.06,
    })),
  [plant.id])

  // Animation state — ref-only so the render loop doesn't trigger React renders.
  // `droop`: current foliage lean (0 = upright, 0.35 = wilting).
  // `pourStart`: timestamp of the most recent water-triggered perk animation.
  // `lastWatered`: sentinel so we can detect the plant being watered externally.
  const animRef = useRef({ droop: 0, pourStart: 0, lastWatered: plant.lastWatered })

  // Detect a fresh water event (the PlantContext updates lastWatered on water).
  useEffect(() => {
    if (plant.lastWatered && plant.lastWatered !== animRef.current.lastWatered) {
      animRef.current.pourStart = performance.now()
      animRef.current.lastWatered = plant.lastWatered
    }
  }, [plant.lastWatered])

  const overdue = daysUntil < 0
  useFrame((_, rawDt) => {
    if (!foliageRef.current) return
    const dt = Math.min(rawDt, 0.1)
    const s = animRef.current
    const now = performance.now()
    const perkElapsed = now - (s.pourStart || -Infinity)
    const perking = perkElapsed >= 0 && perkElapsed < 800
    // Target droop: if actively perking, force to 0 so the leaves spring up.
    const target = perking ? 0 : (overdue ? 0.35 : 0)
    // Exponential lerp toward target
    s.droop += (target - s.droop) * (1 - Math.exp(-dt * 4))
    foliageRef.current.rotation.x = s.droop
    // Scale pulse during the first ~400 ms of a perk
    let scale = 1
    if (perking && perkElapsed < 400) {
      const u = perkElapsed / 400
      scale = 1 + Math.sin(u * Math.PI) * 0.08
    }
    foliageRef.current.scale.setScalar(scale)
  })

  return (
    <group position={[x, 0, z]}>
      {/* Urgency ring on the floor — visible from any angle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} />
      </mesh>

      {/* Invisible hit volume (larger than the pot) so clicks are easy */}
      <mesh
        ref={hitRef}
        position={[0, 0.3, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(plant) }}
        onPointerOver={() => { document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'default' }}
        visible={false}
      >
        <cylinderGeometry args={[0.45, 0.45, 1, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Terracotta pot */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.26, 18]} />
        <meshStandardMaterial color="#b86747" roughness={0.85} />
      </mesh>
      {/* Pot rim */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <torusGeometry args={[0.22, 0.022, 10, 24]} />
        <meshStandardMaterial color="#8c4a33" roughness={0.8} />
      </mesh>
      {/* Soil/cap */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 18]} />
        <meshStandardMaterial color="#3a2a1b" roughness={1} />
      </mesh>

      {/* Foliage pivots at the pot base so the droop animation leans the
          whole plant forward without detaching it from the pot. */}
      <group ref={foliageRef}>
        {isCactus ? (
          // Cactus: a tall barrel with ridges
          <>
            <mesh position={[0, 0.62, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.12, 0.5, 12]} />
              <meshStandardMaterial color={leafColor} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.92, 0]} castShadow>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color={leafColor} roughness={0.9} />
            </mesh>
          </>
        ) : (
          // Leafy plant: cones around a stem
          <>
            <mesh position={[0, 0.4, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.025, 0.14, 6]} />
              <meshStandardMaterial color="#6b4423" />
            </mesh>
            {leaves.map((leaf, i) => (
              <group key={i} rotation={[0, leaf.angle, 0]}>
                <mesh
                  position={[0.14, 0.45 + leaf.length / 2, 0]}
                  rotation={[0, 0, -leaf.tilt]}
                  castShadow
                >
                  <coneGeometry args={[leaf.radius, leaf.length, 6]} />
                  <meshStandardMaterial color={leafColor} roughness={0.7} side={2} />
                </mesh>
              </group>
            ))}
          </>
        )}
        {hasFlower && (
          <mesh position={[0, 0.78, 0]} castShadow>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color="#ec4899" roughness={0.6} />
          </mesh>
        )}
      </group>

      {/* Billboard name + status — floats above the plant */}
      <group position={[0, 1.3, 0]}>
        <Billboard>
          <Text
            position={[0, 0.14, 0]}
            fontSize={0.16}
            color="#1f2937"
            anchorX="center"
            anchorY="middle"
            maxWidth={2}
          >
            {plant.name}
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        </Billboard>
      </group>
    </group>
  )
}

// ── Outdoor decor (trees, fences, path) ──────────────────────────────────────

function Tree({ seed = 0 }) {
  const crown = 0.9 + (seed % 3) * 0.1
  return (
    <group>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 1.0, 8]} />
        <meshStandardMaterial color="#5c3317" roughness={0.95} />
      </mesh>
      {/* Crown — two stacked cones for a fuller silhouette */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <coneGeometry args={[0.45 * crown, 0.7, 10]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.35 * crown, 0.55, 10]} />
        <meshStandardMaterial color="#357a38" roughness={0.8} />
      </mesh>
    </group>
  )
}

function FencePost({ x, z }) {
  return (
    <mesh position={[x, 0.45, z]} castShadow>
      <boxGeometry args={[0.06, 0.9, 0.06]} />
      <meshStandardMaterial color="#8b6f4e" roughness={0.9} />
    </mesh>
  )
}

function FenceRail({ axis, v, a, b, y }) {
  const len = b - a
  const mid = (a + b) / 2
  if (axis === 'x') {
    return (
      <mesh position={[mid, y, v]} castShadow>
        <boxGeometry args={[len, 0.04, 0.03]} />
        <meshStandardMaterial color="#8b6f4e" roughness={0.9} />
      </mesh>
    )
  }
  return (
    <mesh position={[v, y, mid]} castShadow>
      <boxGeometry args={[0.03, 0.04, len]} />
      <meshStandardMaterial color="#8b6f4e" roughness={0.9} />
    </mesh>
  )
}

// Pastel dirt path running across an outdoor room — purely a ground overlay.
function DirtPath({ room }) {
  const cx = (room.x + room.width / 2 - 50) * SCALE
  const cz = (room.y + room.height / 2 - 50) * SCALE
  const long = Math.max(room.width, room.height) * SCALE * 0.6
  const horizontal = room.width >= room.height
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]}>
      {horizontal ? <planeGeometry args={[long, 0.45]} /> : <planeGeometry args={[0.45, long]} />}
      <meshStandardMaterial color="#c9a978" roughness={1} />
    </mesh>
  )
}

// Fences run along each wall segment at the floor; posts at both ends + every
// ~1.5 m in between; two horizontal rails.
function RoomExteriorDecor({ room, walls }) {
  const rand = seedRand(room.id || `${room.x}-${room.y}-${room.name || 'out'}`)
  const w = room.width * SCALE
  const d = room.height * SCALE
  const cx = (room.x + room.width / 2 - 50) * SCALE
  const cz = (room.y + room.height / 2 - 50) * SCALE

  // Trees near the four corners, jittered inward
  const treeCount = 2 + Math.floor(rand() * 3)
  const corners = [
    [-w / 2 + 0.5, -d / 2 + 0.5],
    [ w / 2 - 0.5, -d / 2 + 0.5],
    [-w / 2 + 0.5,  d / 2 - 0.5],
    [ w / 2 - 0.5,  d / 2 - 0.5],
  ]
  const trees = Array.from({ length: treeCount }).map(() => {
    const c = corners[Math.floor(rand() * 4)]
    return {
      x: cx + c[0] + (rand() - 0.5) * 0.3,
      z: cz + c[1] + (rand() - 0.5) * 0.3,
      seed: Math.floor(rand() * 1000),
    }
  })

  // Only draw fence segments for walls that belong to THIS outdoor room.
  // A wall belongs if its endpoints lie on the room's rectangle edge.
  const myWalls = (walls || []).filter((wall) => {
    const r = {
      x1: (room.x - 50) * SCALE, x2: (room.x + room.width - 50) * SCALE,
      z1: (room.y - 50) * SCALE, z2: (room.y + room.height - 50) * SCALE,
    }
    const eps = WALL_THICKNESS * 2
    if (wall.axis === 'x') {
      if (Math.abs(wall.v - r.z1) > eps && Math.abs(wall.v - r.z2) > eps) return false
      return wall.a >= r.x1 - eps && wall.b <= r.x2 + eps
    }
    if (Math.abs(wall.v - r.x1) > eps && Math.abs(wall.v - r.x2) > eps) return false
    return wall.a >= r.z1 - eps && wall.b <= r.z2 + eps
  })

  const postSpacing = 1.5
  const fenceSegments = []
  const fencePosts = []
  for (const wall of myWalls) {
    const len = wall.b - wall.a
    if (len < 0.1) continue
    // Two horizontal rails
    fenceSegments.push({ ...wall, y: 0.35, key: `${wall.axis}${wall.v}${wall.a}` + '-lo' })
    fenceSegments.push({ ...wall, y: 0.75, key: `${wall.axis}${wall.v}${wall.a}` + '-hi' })
    // Posts
    const n = Math.max(2, Math.ceil(len / postSpacing))
    for (let i = 0; i <= n; i++) {
      const t = wall.a + (len * i) / n
      if (wall.axis === 'x') fencePosts.push({ x: t, z: wall.v, key: `${wall.axis}${wall.v}${t}` })
      else fencePosts.push({ x: wall.v, z: t, key: `${wall.axis}${wall.v}${t}` })
    }
  }

  return (
    <>
      {trees.map((t, i) => (
        <group key={`tree-${i}`} position={[t.x, 0, t.z]}>
          <Tree seed={t.seed} />
        </group>
      ))}
      {fencePosts.map((p) => (
        <FencePost key={`post-${p.key}`} x={p.x} z={p.z} />
      ))}
      {fenceSegments.map((s) => (
        <FenceRail key={`rail-${s.key}`} axis={s.axis} v={s.v} a={s.a} b={s.b} y={s.y} />
      ))}
      <DirtPath room={room} />
    </>
  )
}

// ── Doors + windows ──────────────────────────────────────────────────────────

const DOOR_FRAME_HEIGHT = 2.0
const DOOR_FRAME_T = 0.1
const WINDOW_HEIGHT = 0.8
const WINDOW_WIDTH = 0.9
const WINDOW_MIN_WALL = 2.5   // don't window tiny sub-segments
const WINDOW_Y = 1.35

function DoorFrame({ door }) {
  const h = DOOR_FRAME_HEIGHT
  const t = DOOR_FRAME_T
  const mid = (door.a + door.b) / 2
  const len = door.b - door.a
  const mat = <meshStandardMaterial color="#5c3317" roughness={0.8} />
  if (door.axis === 'x') {
    const z = door.v
    return (
      <>
        <mesh position={[door.a, h / 2, z]} castShadow>
          <boxGeometry args={[t, h, t]} />{mat}
        </mesh>
        <mesh position={[door.b, h / 2, z]} castShadow>
          <boxGeometry args={[t, h, t]} />{mat}
        </mesh>
        <mesh position={[mid, h, z]} castShadow>
          <boxGeometry args={[len, t, t]} />{mat}
        </mesh>
      </>
    )
  }
  const x = door.v
  return (
    <>
      <mesh position={[x, h / 2, door.a]} castShadow>
        <boxGeometry args={[t, h, t]} />{mat}
      </mesh>
      <mesh position={[x, h / 2, door.b]} castShadow>
        <boxGeometry args={[t, h, t]} />{mat}
      </mesh>
      <mesh position={[x, h, mid]} castShadow>
        <boxGeometry args={[t, t, len]} />{mat}
      </mesh>
    </>
  )
}

// A translucent glass pane embedded in a wall segment. Only drawn on walls
// longer than WINDOW_MIN_WALL so tiny offcuts between rooms stay solid.
function Window({ wall }) {
  const len = wall.b - wall.a
  if (len < WINDOW_MIN_WALL) return null
  const mid = (wall.a + wall.b) / 2
  const paneT = WALL_THICKNESS + 0.02
  if (wall.axis === 'x') {
    return (
      <group position={[mid, WINDOW_Y, wall.v]}>
        <mesh>
          <boxGeometry args={[WINDOW_WIDTH, WINDOW_HEIGHT, paneT]} />
          <meshStandardMaterial color="#a8d8ea" transparent opacity={0.55} roughness={0.25} metalness={0.3} />
        </mesh>
        {/* Vertical mullion */}
        <mesh>
          <boxGeometry args={[0.05, WINDOW_HEIGHT, paneT + 0.01]} />
          <meshStandardMaterial color="#5c3317" />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[wall.v, WINDOW_Y, mid]}>
      <mesh>
        <boxGeometry args={[paneT, WINDOW_HEIGHT, WINDOW_WIDTH]} />
        <meshStandardMaterial color="#a8d8ea" transparent opacity={0.55} roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh>
        <boxGeometry args={[paneT + 0.01, WINDOW_HEIGHT, 0.05]} />
        <meshStandardMaterial color="#5c3317" />
      </mesh>
    </group>
  )
}

function Ground({ floorType }) {
  const color = floorType === 'outdoor' ? '#e8f5e9' : '#f1f3f5'
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// ── Dynamic lighting ─────────────────────────────────────────────────────────
// Derives sun position, colour, and intensities from the weather context
// passed down from usePlantContext. Sun arcs on a sine of the local hour; the
// sky condition scales intensity; night swaps in a cool low-angle 'moon' and
// a warmer hemisphere light so interiors don't look pitch-black.

// ── Walk-mode audio (Web Audio synth, no assets) ─────────────────────────────
function createWalkAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

  const playFootstep = () => {
    if (document.visibilityState !== 'visible') return
    const src = ctx.createBufferSource(); src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'; filter.frequency.value = 550 + Math.random() * 200
    const gain = ctx.createGain()
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.25, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    src.start(now); src.stop(now + 0.2)
  }

  const playSplash = () => {
    if (document.visibilityState !== 'visible') return
    const src = ctx.createBufferSource(); src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'; filter.Q.value = 1.5
    const gain = ctx.createGain()
    const now = ctx.currentTime
    filter.frequency.setValueAtTime(2200, now)
    filter.frequency.exponentialRampToValueAtTime(700, now + 0.4)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    src.start(now); src.stop(now + 0.5)
  }

  return { ctx, playFootstep, playSplash }
}

// Watches walkStateRef.phase for half-cycle crossings (each step) and
// walkStateRef.pourStart for new pour events, firing the synthesized sounds
// passed in from the parent. Mounted only while sound is unmuted.
function WalkSounds({ walkStateRef, audio }) {
  const lastPhaseRef = useRef(0)
  const lastPourRef = useRef(0)
  useFrame(() => {
    if (!audio) return
    const p = walkStateRef.current.phase
    const lp = lastPhaseRef.current
    if (Math.floor(p / Math.PI) !== Math.floor(lp / Math.PI) && walkStateRef.current.moving) {
      audio.playFootstep()
    }
    lastPhaseRef.current = p

    const pour = walkStateRef.current.pourStart || 0
    if (pour !== lastPourRef.current) {
      lastPourRef.current = pour
      if (pour) audio.playSplash()
    }
  })
  return null
}

const WEATHER_INTENSITY = {
  sunny:  1.00,
  partly: 0.85,
  cloudy: 0.55,
  foggy:  0.45,
  rainy:  0.40,
  stormy: 0.30,
  snowy:  0.75,
}

// Time compression factor: how many in-world seconds elapse per real second.
// 30 means a full 24h cycle takes ~48 real minutes; you see visible lighting
// drift within ~2 minutes of play.
const TIME_SCALE = 30

// Derive everything the lights care about from a single hour value so we
// can share the math between the frame-rate updater and any UI that wants
// to know what "time" it is in the game world.
function deriveLightingState(hour, sky) {
  const elev = Math.sin(((hour - 6) / 12) * Math.PI)
  const azim = ((hour - 12) / 12) * Math.PI
  const wFactor = WEATHER_INTENSITY[sky] ?? 0.9
  const effectiveElev = Math.max(0, elev)
  const isNight = elev <= 0
  return { elev, azim, wFactor, effectiveElev, isNight }
}

function DynamicLighting({ weather, timeRef }) {
  const dirRef = useRef()
  const ambRef = useRef()
  const hemiRef = useRef()

  // Advance in-world time + push values straight onto the three.js light
  // objects so the scene evolves every frame without React re-renders.
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25)
    timeRef.current = (timeRef.current + (dt * TIME_SCALE) / 3600 + 24) % 24
    const hour = timeRef.current
    const sky = weather?.current?.condition?.sky || 'sunny'
    const { azim, wFactor, effectiveElev, isNight } = deriveLightingState(hour, sky)

    // Sun color by elevation
    let sunHex = '#ffffff'
    if (isNight) sunHex = '#8592b0'
    else if (effectiveElev < 0.25) sunHex = '#ffb56b'
    else if (effectiveElev < 0.5)  sunHex = '#ffe3b8'

    const overcast = sky === 'cloudy' || sky === 'rainy' || sky === 'foggy' || sky === 'stormy'
    const ambHex = overcast ? '#b8c4d4' : '#ffffff'
    const ambientIntensity = !isNight
      ? (0.3 + effectiveElev * 0.3) * wFactor
      : 0.15
    const directionalIntensity = !isNight
      ? Math.max(0.15, 0.9 * effectiveElev * wFactor)
      : 0.12

    const r = 12
    const sunX = Math.sin(azim) * r
    const sunY = Math.max(3, effectiveElev * 10 + (isNight ? -4 : 2))
    const sunZ = Math.cos(azim) * r

    if (dirRef.current) {
      dirRef.current.position.set(sunX, sunY, sunZ)
      dirRef.current.color.set(sunHex)
      dirRef.current.intensity = directionalIntensity
    }
    if (ambRef.current) {
      ambRef.current.color.set(ambHex)
      ambRef.current.intensity = ambientIntensity
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = isNight ? 0.45 : 0
    }
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.5} />
      <directionalLight
        ref={dirRef}
        position={[5, 8, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight ref={hemiRef} args={['#334257', '#3f2a1a', 0]} />
    </>
  )
}

// ── Walk mode ────────────────────────────────────────────────────────────────
// Avatar state lives in refs so the render loop can mutate without triggering
// React renders. Only proximity HUD state is lifted into React.

const WATER_RANGE = 2.2           // must be within this world distance to water
const WALK_SPEED = 9.0             // world units per second
const TURN_SPEED = 2.6             // radians per second
const AVATAR_SCALE = 2.0           // applied to the whole avatar group
const AVATAR_RADIUS = 0.4          // for wall/room collision (matches scaled shoulders)

const DOOR_MIN = 1.2   // shared-edge overlaps this long become passable doorways

// Compute an axis-aligned bounding box that encloses every visible room so
// the avatar is clamped to the house footprint. Returns null for outdoor-only
// or empty floors (falls back to ground bounds).
function getRoomsBounds(rooms) {
  if (!rooms?.length) return null
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const r of rooms) {
    if (r.hidden) continue
    minX = Math.min(minX, (r.x - 50) * SCALE)
    maxX = Math.max(maxX, (r.x + r.width - 50) * SCALE)
    minZ = Math.min(minZ, (r.y - 50) * SCALE)
    maxZ = Math.max(maxZ, (r.y + r.height - 50) * SCALE)
  }
  if (minX === Infinity) return null
  const pad = AVATAR_RADIUS + 0.05
  return { minX: minX + pad, maxX: maxX - pad, minZ: minZ + pad, maxZ: maxZ - pad }
}

// Break each room edge into one or more solid sub-segments by subtracting
// overlaps ≥ DOOR_MIN with any collinear edge from another room. Those
// overlaps become implicit doorways. Any room that has NO such overlap on
// any of its 4 walls gets a forced doorway punched into the middle of its
// longest wall so the avatar can always get in.
//
// Returns { walls, doors } — both arrays of { axis, v, a, b }:
//   axis: 'x' — runs along X between a..b at constant z = v
//   axis: 'z' — runs along Z between a..b at constant x = v
// `walls` are the solid sub-segments (the collision set). `doors` are the
// complementary gaps so the renderer can frame them as door openings.
function computeWallSegments(rooms) {
  const eps = WALL_THICKNESS * 1.5
  const scaled = (rooms || [])
    .filter((r) => !r.hidden)
    .map((r) => ({
      x1: (r.x - 50) * SCALE,
      x2: (r.x + r.width - 50) * SCALE,
      z1: (r.y - 50) * SCALE,
      z2: (r.y + r.height - 50) * SCALE,
    }))

  // Build edges, tagged by room index so we can detect doorless rooms.
  const raw = []
  const roomEdges = []
  for (let ri = 0; ri < scaled.length; ri++) {
    const r = scaled[ri]
    const edges = [
      { axis: 'x', v: r.z1, a: r.x1, b: r.x2, roomIdx: ri }, // north
      { axis: 'x', v: r.z2, a: r.x1, b: r.x2, roomIdx: ri }, // south
      { axis: 'z', v: r.x1, a: r.z1, b: r.z2, roomIdx: ri }, // west
      { axis: 'z', v: r.x2, a: r.z1, b: r.z2, roomIdx: ri }, // east
    ]
    raw.push(...edges)
    roomEdges.push(edges)
  }

  // Forced doorways: synthetic "overlaps" injected into rooms that would
  // otherwise have every wall solid. Modelled the same way as shared-edge
  // doorways so the subtraction loop handles them uniformly.
  const forcedDoors = []
  for (let ri = 0; ri < scaled.length; ri++) {
    const edges = roomEdges[ri]
    let hasDoor = false
    for (const e of edges) {
      for (const o of raw) {
        if (o.roomIdx === ri) continue
        if (o.axis !== e.axis) continue
        if (Math.abs(o.v - e.v) > eps) continue
        const start = Math.max(e.a, o.a)
        const end = Math.min(e.b, o.b)
        if (end - start >= DOOR_MIN) { hasDoor = true; break }
      }
      if (hasDoor) break
    }
    if (hasDoor) continue
    // No shared-edge doorway: cut one into the longest wall.
    const longest = edges.reduce((best, e) => (e.b - e.a) > (best.b - best.a) ? e : best)
    const wallLen = longest.b - longest.a
    const doorLen = Math.min(DOOR_MIN * 1.25, wallLen - 0.6)
    if (doorLen >= DOOR_MIN * 0.9) {
      const mid = (longest.a + longest.b) / 2
      forcedDoors.push({ axis: longest.axis, v: longest.v, a: mid - doorLen / 2, b: mid + doorLen / 2 })
    }
  }

  const blockers = []
  const openings = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]
    const doors = []
    // Shared-edge doorways
    for (let j = 0; j < raw.length; j++) {
      if (j === i) continue
      const o = raw[j]
      if (o.axis !== s.axis) continue
      if (Math.abs(o.v - s.v) > eps) continue
      const start = Math.max(s.a, o.a)
      const end = Math.min(s.b, o.b)
      if (end - start >= DOOR_MIN) doors.push([start, end])
    }
    // Forced doors that land on this exact edge
    for (const f of forcedDoors) {
      if (f.axis !== s.axis) continue
      if (Math.abs(f.v - s.v) > eps) continue
      const start = Math.max(s.a, f.a)
      const end = Math.min(s.b, f.b)
      if (end - start > 0.1) doors.push([start, end])
    }
    doors.sort((x, y) => x[0] - y[0])
    const merged = []
    for (const d of doors) {
      if (merged.length && d[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], d[1])
      } else {
        merged.push([...d])
      }
    }
    let cursor = s.a
    for (const [a, b] of merged) {
      if (a > cursor) blockers.push({ axis: s.axis, v: s.v, a: cursor, b: a })
      cursor = Math.max(cursor, b)
      openings.push({ axis: s.axis, v: s.v, a, b })
    }
    if (cursor < s.b) blockers.push({ axis: s.axis, v: s.v, a: cursor, b: s.b })
  }

  const dedupe = (arr) => {
    const seen = new Set()
    const out = []
    for (const w of arr) {
      const k = `${w.axis}:${w.v.toFixed(3)}:${w.a.toFixed(3)}:${w.b.toFixed(3)}`
      if (seen.has(k)) continue
      seen.add(k); out.push(w)
    }
    return out
  }
  return { walls: dedupe(blockers), doors: dedupe(openings) }
}

// Circle-vs-AABB slide: push the avatar out of every wall it overlaps. Axis
// normals come out of the closest-point projection, so tangential motion is
// preserved naturally (you slide along a wall when you press into it).
function resolveWallCollisions(x, z, walls, radius) {
  const t = WALL_THICKNESS / 2
  let nx = x, nz = z
  // Two passes so a corner hit between two perpendicular walls settles.
  for (let pass = 0; pass < 2; pass++) {
    for (const w of walls) {
      let wMinX, wMaxX, wMinZ, wMaxZ
      if (w.axis === 'x') {
        wMinX = w.a; wMaxX = w.b; wMinZ = w.v - t; wMaxZ = w.v + t
      } else {
        wMinX = w.v - t; wMaxX = w.v + t; wMinZ = w.a; wMaxZ = w.b
      }
      const cx = Math.max(wMinX, Math.min(wMaxX, nx))
      const cz = Math.max(wMinZ, Math.min(wMaxZ, nz))
      const dx = nx - cx
      const dz = nz - cz
      const distSq = dx * dx + dz * dz
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq)
        if (dist > 1e-6) {
          const push = radius - dist
          nx += (dx / dist) * push
          nz += (dz / dist) * push
        } else if (w.axis === 'x') {
          // centre exactly on wall — nudge off to a plausible side
          nz += (nz < w.v ? -1 : 1) * (radius + t)
        } else {
          nx += (nx < w.v ? -1 : 1) * (radius + t)
        }
      }
    }
  }
  return [nx, nz]
}

// Procedurally draw a home-plant-tracker logo (leaf inside a white disc) onto
// a canvas and hand it back as a texture. Memoised at the module level so the
// canvas is built once per page load and shared by any avatar instance.
let _shirtLogoTexture = null
function getShirtLogoTexture() {
  if (_shirtLogoTexture) return _shirtLogoTexture
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!c) return null
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 256, 256)

  // White disc
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#14532d'; ctx.lineWidth = 8
  ctx.stroke()

  // Leaf body
  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.moveTo(128, 48)
  ctx.bezierCurveTo(62, 92, 62, 178, 128, 212)
  ctx.bezierCurveTo(194, 178, 194, 92, 128, 48)
  ctx.closePath()
  ctx.fill()

  // Darker leaf edge
  ctx.strokeStyle = '#14532d'; ctx.lineWidth = 6; ctx.stroke()

  // Central vein + side veins
  ctx.strokeStyle = '#14532d'; ctx.lineWidth = 5; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(128, 58); ctx.lineTo(128, 200)
  ctx.moveTo(128, 100); ctx.lineTo(92, 118)
  ctx.moveTo(128, 100); ctx.lineTo(164, 118)
  ctx.moveTo(128, 140); ctx.lineTo(92, 158)
  ctx.moveTo(128, 140); ctx.lineTo(164, 158)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  _shirtLogoTexture = tex
  return tex
}

function ShirtLogo() {
  const tex = useMemo(() => getShirtLogoTexture(), [])
  if (!tex) return null
  return (
    // Placed just in front of the torso cylinder (radius ~0.15) so it sits on
    // the shirt without z-fighting; rotated to face the avatar's forward (-z).
    <mesh position={[0, 0.57, -0.162]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[0.14, 0.14]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  )
}

function Avatar({ positionRef, yawRef, walkStateRef, camMode = 'tp' }) {
  // In first-person, hide everything behind the camera so we don't clip the
  // head / torso. Keep the right arm + can visible as a "hands-cam" element.
  const fp = camMode === 'fp'
  const groupRef = useRef()
  const leftLegRef = useRef()
  const rightLegRef = useRef()
  const leftArmRef = useRef()
  const canRef = useRef()

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    if (!groupRef.current) return
    const p = positionRef.current
    groupRef.current.position.set(p[0], 0, p[2])
    groupRef.current.rotation.y = yawRef.current

    const s = walkStateRef.current
    // Walk cycle: advance phase while moving, decay toward 0 when idle so
    // legs come to rest instead of freezing mid-stride.
    if (s.moving) {
      s.phase += dt * 14
      s.swingAmp = Math.min(1, s.swingAmp + dt * 4)
    } else {
      s.swingAmp = Math.max(0, s.swingAmp - dt * 4)
    }
    const swing = Math.sin(s.phase) * 0.45 * s.swingAmp
    if (leftLegRef.current)  leftLegRef.current.rotation.x  =  swing
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
    if (leftArmRef.current)  leftArmRef.current.rotation.x  = -swing * 0.8

    // Pour animation — tilt the can around Z so the spout dips forward.
    // Ramp up fast (~150 ms), hold briefly, ease back over ~500 ms.
    if (canRef.current) {
      const now = performance.now()
      const elapsed = now - (s.pourStart || 0)
      const RAMP = 150, HOLD = 250, EASE = 450, TOTAL = RAMP + HOLD + EASE
      let tilt = 0
      if (elapsed >= 0 && elapsed < TOTAL) {
        if (elapsed < RAMP) tilt = elapsed / RAMP
        else if (elapsed < RAMP + HOLD) tilt = 1
        else tilt = 1 - (elapsed - RAMP - HOLD) / EASE
      }
      canRef.current.rotation.z = 0.75 * tilt
    }
  })

  return (
    <group ref={groupRef} scale={AVATAR_SCALE}>
      {!fp && (
        <>
          {/* Left leg + shoe (pivots at hip) */}
          <group ref={leftLegRef} position={[-0.07, 0.38, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.32, 12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0, -0.35, -0.02]} castShadow>
              <boxGeometry args={[0.09, 0.06, 0.14]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
          {/* Right leg + shoe */}
          <group ref={rightLegRef} position={[0.07, 0.38, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.32, 12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[0, -0.35, -0.02]} castShadow>
              <boxGeometry args={[0.09, 0.06, 0.14]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>

          {/* Torso (shirt) */}
          <mesh position={[0, 0.54, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.16, 0.28, 20]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.8} />
          </mesh>
          {/* Shirt collar (darker band at the neckline) */}
          <mesh position={[0, 0.685, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 20]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
          </mesh>
          {/* Brand logo patch on the chest */}
          <ShirtLogo />
          {/* Shoulder rounds smooth the cylinder → arm transition */}
          <mesh position={[-0.16, 0.66, 0]} castShadow>
            <sphereGeometry args={[0.06, 14, 12]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.8} />
          </mesh>
          <mesh position={[0.16, 0.66, 0]} castShadow>
            <sphereGeometry args={[0.06, 14, 12]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.8} />
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.70, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 0.05, 10]} />
            <meshStandardMaterial color="#fcd7b6" />
          </mesh>

          {/* Head */}
          <mesh position={[0, 0.82, 0]} castShadow>
            <sphereGeometry args={[0.13, 24, 24]} />
            <meshStandardMaterial color="#fcd7b6" roughness={0.85} />
          </mesh>
          {/* Ears */}
          <mesh position={[-0.128, 0.82, 0]} castShadow>
            <sphereGeometry args={[0.026, 10, 10]} />
            <meshStandardMaterial color="#f5b896" roughness={0.85} />
          </mesh>
          <mesh position={[0.128, 0.82, 0]} castShadow>
            <sphereGeometry args={[0.026, 10, 10]} />
            <meshStandardMaterial color="#f5b896" roughness={0.85} />
          </mesh>
          {/* Hair — a cap covering the top half of the head */}
          <mesh position={[0, 0.86, 0.015]} castShadow>
            <sphereGeometry args={[0.135, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color="#5c3317" roughness={0.95} />
          </mesh>
          {/* Eyebrows — small dark slabs above each eye, tilted inward */}
          <mesh position={[-0.05, 0.858, -0.108]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.028, 0.008, 0.006]} />
            <meshBasicMaterial color="#3d230c" />
          </mesh>
          <mesh position={[0.05, 0.858, -0.108]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.028, 0.008, 0.006]} />
            <meshBasicMaterial color="#3d230c" />
          </mesh>
          {/* Eyes — white sclera + dark iris so the gaze reads from a distance */}
          <mesh position={[-0.048, 0.83, -0.11]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.048, 0.83, -0.11]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.048, 0.83, -0.123]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0.048, 0.83, -0.123]}>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {/* Nose — a small wedge projecting from the face */}
          <mesh position={[0, 0.81, -0.125]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.015, 0.03, 0.02]} />
            <meshStandardMaterial color="#f5b896" roughness={0.85} />
          </mesh>
          {/* Smile */}
          <mesh position={[0, 0.785, -0.118]}>
            <boxGeometry args={[0.04, 0.008, 0.005]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>

          {/* Left arm — swings during walk (pivots at shoulder) */}
          <group ref={leftArmRef} position={[-0.18, 0.6, 0]} rotation={[0, 0, 0.05]}>
            {/* Upper arm */}
            <mesh position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.22, 12]} />
              <meshStandardMaterial color="#3b82f6" roughness={0.8} />
            </mesh>
            {/* Elbow */}
            <mesh position={[0, -0.22, 0]}>
              <sphereGeometry args={[0.037, 10, 10]} />
              <meshStandardMaterial color="#3b82f6" roughness={0.8} />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.27, 0]} castShadow>
              <sphereGeometry args={[0.042, 12, 12]} />
              <meshStandardMaterial color="#fcd7b6" roughness={0.85} />
            </mesh>
          </group>
        </>
      )}

      {/* Right arm — reaches out to hold the can (visible in both modes) */}
      <group position={[0.17, 0.6, 0]} rotation={[0.1, 0, -1.1]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.24, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <sphereGeometry args={[0.037, 10, 10]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.29, 0]} castShadow>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color="#fcd7b6" roughness={0.85} />
        </mesh>
      </group>

      {/* Watering can gripped by the right hand */}
      <group ref={canRef} position={[0.34, 0.48, -0.02]}>
        {/* Body — tapered (top slightly wider than base) */}
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.07, 0.13, 18]} />
          <meshStandardMaterial color="#16a34a" metalness={0.25} roughness={0.5} />
        </mesh>
        {/* Rim */}
        <mesh position={[0, 0.07, 0]}>
          <torusGeometry args={[0.075, 0.008, 8, 20]} />
          <meshStandardMaterial color="#14532d" metalness={0.3} roughness={0.5} />
        </mesh>
        {/* Angled spout */}
        <mesh position={[0.115, 0.02, 0]} rotation={[0, 0, -0.55]} castShadow>
          <cylinderGeometry args={[0.015, 0.03, 0.17, 12]} />
          <meshStandardMaterial color="#16a34a" metalness={0.25} roughness={0.5} />
        </mesh>
        {/* Rose (sprinkler head at spout tip) */}
        <mesh position={[0.195, 0.095, 0]} rotation={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.022, 0.022, 0.015, 14]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>
        {/* Arching handle over the top */}
        <mesh position={[-0.03, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.01, 8, 18, Math.PI]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>
      </group>
    </group>
  )
}

// Emits a short burst of droplets over a target plant.
function WaterDroplets({ worldPos, onDone }) {
  const groupRef = useRef()
  const startRef = useRef(null)
  const droplets = useMemo(() =>
    Array.from({ length: 10 }, () => ({
      ox: (Math.random() - 0.5) * 0.24,
      oz: (Math.random() - 0.5) * 0.24,
      delay: Math.random() * 0.25,
      dur: 0.7 + Math.random() * 0.3,
      r: 0.035 + Math.random() * 0.02,
    })),
  [])
  useFrame((state) => {
    if (startRef.current == null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current
    if (t > 1.1) onDone?.()
  })
  return (
    <group ref={groupRef} position={[worldPos[0], 0, worldPos[2]]}>
      {droplets.map((d, i) => (
        <Drop key={i} d={d} />
      ))}
    </group>
  )
}

function Drop({ d }) {
  const ref = useRef()
  const startRef = useRef(null)
  useFrame((state) => {
    if (!ref.current) return
    if (startRef.current == null) startRef.current = state.clock.elapsedTime
    const t = Math.max(0, state.clock.elapsedTime - startRef.current - d.delay)
    const u = Math.min(1, t / d.dur)
    // Start at ~0.7, fall to ground then bounce into invisibility
    // Fall from above the plant down to soil level
    const y = 1.4 - u * 1.1
    ref.current.position.set(d.ox, Math.max(0.02, y), d.oz)
    ref.current.scale.setScalar(u < 1 ? 1 : 0)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[d.r, 6, 6]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.9} />
    </mesh>
  )
}

function WalkController({
  positionRef, yawRef, pitchRef, camBackRef, joyRef, walkStateRef,
  camMode, walls, bounds, plants,
  carriedPlantId, onPickup, onDrop,
  onNearestChange, onWaterRequest,
}) {
  const { camera } = useThree()
  const keysRef = useRef(new Set())
  const waterPendingRef = useRef(false)
  const pickupPendingRef = useRef(false)
  const camLookRef = useRef({ x: 0, y: 0.5, z: 0 })
  const firstFrameRef = useRef(true)

  useEffect(() => {
    firstFrameRef.current = true
    const down = (e) => {
      const k = e.key.toLowerCase()
      keysRef.current.add(k)
      if (k === 'e') waterPendingRef.current = true
      if (k === 'f') pickupPendingRef.current = true
    }
    const up = (e) => keysRef.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keysRef.current.clear()
    }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)  // clamp long frames so the avatar doesn't teleport
    const keys = keysRef.current

    // Rotate via keys or joystick strafe (on touch, strafe doubles as turn)
    if (keys.has('arrowleft') || keys.has('q')) yawRef.current += TURN_SPEED * dt
    if (keys.has('arrowright'))                   yawRef.current -= TURN_SPEED * dt

    // Combined input: keyboard + joystick
    const keyForward = (keys.has('w') || keys.has('arrowup')   ? 1 : 0)
                     - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
    const keyStrafe  = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
    const forward = keyForward + (joyRef.current?.forward || 0)
    const strafe  = keyStrafe  + (joyRef.current?.strafe  || 0)

    const hasInput = forward !== 0 || strafe !== 0
    if (hasInput) {
      const yaw = yawRef.current
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const sx =  Math.cos(yaw), sz = -Math.sin(yaw)
      const magnitude = Math.min(1, Math.sqrt(forward * forward + strafe * strafe))
      const nf = forward / (magnitude || 1), ns = strafe / (magnitude || 1)
      const step = magnitude * WALK_SPEED * dt
      let nx = positionRef.current[0] + (fx * nf + sx * ns) * step
      let nz = positionRef.current[2] + (fz * nf + sz * ns) * step
      // Wall collision when we have real room walls; otherwise fall back
      // to the outer bounding box or ground clamp for empty floors.
      if (walls?.length) {
        [nx, nz] = resolveWallCollisions(nx, nz, walls, AVATAR_RADIUS)
      } else if (bounds) {
        nx = Math.max(bounds.minX, Math.min(bounds.maxX, nx))
        nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, nz))
      } else {
        nx = Math.max(-10, Math.min(10, nx))
        nz = Math.max(-10, Math.min(10, nz))
      }
      positionRef.current[0] = nx
      positionRef.current[2] = nz
    }
    walkStateRef.current.moving = hasInput

    // Camera — behaviour forks by mode
    const yaw = yawRef.current
    const pitch = pitchRef.current
    const [ax, , az] = positionRef.current
    const k = 1 - Math.exp(-dt * 10)

    if (camMode === 'fp') {
      // First-person: camera is at head height, looks along yaw+pitch.
      // Head sits at ~0.82 in the avatar model, scaled by AVATAR_SCALE.
      const eyeY = 1.65
      camera.position.set(ax, eyeY, az)
      const cp = Math.cos(pitch)
      const lookX = ax - Math.sin(yaw) * cp
      const lookY = eyeY + Math.sin(pitch)
      const lookZ = az - Math.cos(yaw) * cp
      camera.lookAt(lookX, lookY, lookZ)
      firstFrameRef.current = false
    } else {
      // Third-person chase camera — behind the avatar's facing direction,
      // lerped so yaw changes and scroll-zoom glide rather than snap.
      const camBack = camBackRef.current
      const camUp = 2.0 + camBack * 0.25  // slightly above the avatar's head
      const desiredX = ax + Math.sin(yaw) * camBack
      const desiredZ = az + Math.cos(yaw) * camBack
      if (firstFrameRef.current) {
        camera.position.set(desiredX, camUp, desiredZ)
        camLookRef.current = { x: ax, y: 1.3, z: az }
        firstFrameRef.current = false
      } else {
        camera.position.x += (desiredX - camera.position.x) * k
        camera.position.y += (camUp - camera.position.y) * k
        camera.position.z += (desiredZ - camera.position.z) * k
        camLookRef.current.x += (ax  - camLookRef.current.x) * k
        camLookRef.current.y += (1.3 - camLookRef.current.y) * k  // look at chest height
        camLookRef.current.z += (az  - camLookRef.current.z) * k
      }
      camera.lookAt(camLookRef.current.x, camLookRef.current.y, camLookRef.current.z)
    }

    // Nearest plant
    let nearest = null
    let nearestDist = Infinity
    for (const plant of plants) {
      const [px, , pz] = pctToWorld(plant.x, plant.y)
      const dx = px - ax, dz = pz - az
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d < nearestDist) { nearestDist = d; nearest = plant }
    }
    const inRange = nearest && nearestDist <= WATER_RANGE
    onNearestChange(inRange ? nearest : null)

    if (waterPendingRef.current) {
      waterPendingRef.current = false
      if (inRange) {
        walkStateRef.current.pourStart = performance.now()
        onWaterRequest(nearest)
      }
    }

    if (pickupPendingRef.current) {
      pickupPendingRef.current = false
      if (carriedPlantId) onDrop?.()
      else if (inRange) onPickup?.(nearest)
    }
  })

  return null
}

// ── Carried plant (hovers in front of the avatar while picked up) ────────────

function CarriedPlant({ plant, positionRef, yawRef }) {
  const groupRef = useRef()
  useFrame((_, rawDt) => {
    if (!groupRef.current) return
    const dt = Math.min(rawDt, 0.05)
    const [ax, , az] = positionRef.current
    const yaw = yawRef.current
    // Hold in front of the avatar at chest height; gentle bob.
    const forwardX = -Math.sin(yaw) * 0.55
    const forwardZ = -Math.cos(yaw) * 0.55
    const bob = Math.sin(performance.now() / 320) * 0.03
    groupRef.current.position.set(ax + forwardX, 1.4 + bob, az + forwardZ)
    groupRef.current.rotation.y = yaw
    // Slight continuous tilt so it reads as held
    groupRef.current.rotation.x = Math.sin(performance.now() / 400) * 0.04
  })
  const leafColor = getLeafColor(plant)
  const species = (plant.species || '').toLowerCase()
  const isCactus = /cactus|succulent|aloe/.test(species)
  return (
    <group ref={groupRef}>
      {/* Pot */}
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.24, 16]} />
        <meshStandardMaterial color="#b86747" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
        <meshStandardMaterial color="#3a2a1b" />
      </mesh>
      {/* Simplified foliage */}
      {isCactus ? (
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.4, 10]} />
          <meshStandardMaterial color={leafColor} roughness={0.9} />
        </mesh>
      ) : (
        <mesh position={[0, 0.32, 0]} castShadow>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshStandardMaterial color={leafColor} roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

// ── Weather / seasonal particles in-scene ────────────────────────────────────

const PARTICLE_RADIUS = 18     // world-unit half-width of the particle zone
const PARTICLE_CEILING = 7     // where drops spawn before falling

// Shared instanced-particle system. `geom` + `mat` define the look; `count` the
// density; `behaviour` per-frame updates position + rotation of each instance.
function ParticleCloud({ count, geom, mat, behaviour, spawner }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(
    () => Array.from({ length: count }, () => spawner()),
    [count, spawner],
  )

  useFrame((_, rawDt) => {
    if (!meshRef.current) return
    const dt = Math.min(rawDt, 0.1)
    for (let i = 0; i < data.length; i++) {
      behaviour(data[i], dt)
      dummy.position.set(data[i].x, data[i].y, data[i].z)
      dummy.rotation.set(data[i].rx || 0, data[i].ry || 0, data[i].rz || 0)
      dummy.scale.setScalar(data[i].s || 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geom, mat, count]} />
  )
}

function RainCloud() {
  const geom = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.75 }), [])
  const spawner = useCallback(() => ({
    x: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    y: Math.random() * PARTICLE_CEILING,
    z: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    speed: 9 + Math.random() * 5,
  }), [])
  const behaviour = useCallback((d, dt) => {
    d.y -= d.speed * dt
    d.x += 0.5 * dt   // slight wind
    if (d.y < -0.1) {
      d.y = PARTICLE_CEILING + Math.random() * 1.5
      d.x = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
      d.z = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
    }
  }, [])
  return <ParticleCloud count={140} geom={geom} mat={mat} spawner={spawner} behaviour={behaviour} />
}

function SnowCloud() {
  const geom = useMemo(() => new THREE.SphereGeometry(0.04, 6, 6), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), [])
  const spawner = useCallback(() => ({
    x: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    y: Math.random() * PARTICLE_CEILING,
    z: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    speed: 0.8 + Math.random() * 1.2,
    driftPhase: Math.random() * Math.PI * 2,
    s: 0.6 + Math.random() * 1.2,
  }), [])
  const behaviour = useCallback((d, dt) => {
    d.y -= d.speed * dt
    d.driftPhase += dt
    d.x += Math.sin(d.driftPhase) * 0.3 * dt
    d.z += Math.cos(d.driftPhase * 1.1) * 0.2 * dt
    if (d.y < -0.1) {
      d.y = PARTICLE_CEILING + Math.random() * 2
      d.x = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
      d.z = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
    }
  }, [])
  return <ParticleCloud count={120} geom={geom} mat={mat} spawner={spawner} behaviour={behaviour} />
}

function SeasonalCloud({ season }) {
  const color = season === 'spring' ? '#f9a8d4'
               : season === 'autumn' ? '#f59e0b'
               : season === 'summer' ? '#fde68a'
               : '#ffffff'
  const count = season === 'autumn' ? 60 : season === 'spring' ? 50 : 30
  const geom = useMemo(() => new THREE.PlaneGeometry(0.16, 0.09), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }),
    [color],
  )
  const spawner = useCallback(() => ({
    x: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    y: Math.random() * PARTICLE_CEILING,
    z: (Math.random() - 0.5) * PARTICLE_RADIUS * 2,
    speed: 0.5 + Math.random() * 1.0,
    drift: (Math.random() - 0.5) * 1.5,
    rx: Math.random() * Math.PI,
    ry: Math.random() * Math.PI * 2,
    rz: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 2,
    s: 0.7 + Math.random() * 0.6,
  }), [])
  const behaviour = useCallback((d, dt) => {
    d.y -= d.speed * dt
    d.x += d.drift * dt
    d.rx += d.spin * dt
    d.ry += d.spin * dt * 0.7
    if (d.y < -0.1) {
      d.y = PARTICLE_CEILING + Math.random() * 2
      d.x = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
      d.z = (Math.random() - 0.5) * PARTICLE_RADIUS * 2
    }
  }, [])
  return <ParticleCloud count={count} geom={geom} mat={mat} spawner={spawner} behaviour={behaviour} />
}

// Picks which particle cloud — if any — to render based on weather and season.
function WeatherParticles3D({ weather }) {
  const sky = weather?.current?.condition?.sky
  const season = getSeason(weather?.location?.lat)
  if (sky === 'rainy' || sky === 'stormy')        return <RainCloud />
  if (sky === 'snowy' || season === 'winter')     return <SnowCloud />
  if (season === 'spring' || season === 'autumn' || season === 'summer') {
    return <SeasonalCloud season={season} />
  }
  return null
}

function Scene({
  floor, plants, weather, floors,
  aspect, scaleFactor,
  onPlantClick, onFloorplanClick,
  walkMode, camMode,
  positionRef, yawRef, pitchRef, camBackRef, joyRef, walkStateRef, timeRef,
  carriedPlantId, onPickup, onDrop,
  audio,
  onWalkNearest, onWalkWater,
  droplets,
}) {
  const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
  const bounds = useMemo(() => getRoomsBounds(rooms), [rooms])
  const { walls, doors } = useMemo(() => computeWallSegments(rooms), [rooms])

  return (
    <>
      <DynamicLighting weather={weather} timeRef={timeRef} />
      <WeatherParticles3D weather={weather} />

      <Ground floorType={floor?.type} />

      {rooms.map((room, i) => (
        <Room key={room.id || i} room={room} floorType={floor?.type} />
      ))}

      {/* Outdoor decor — trees + fences + dirt path per outdoor room */}
      {rooms
        .filter((r) => (r.type || floor?.type) === 'outdoor')
        .map((r) => (
          <RoomExteriorDecor key={`decor-${r.id || r.x}-${r.y}`} room={r} walls={walls} />
        ))}

      {/* Door frames at every inferred doorway */}
      {doors.map((d, i) => (
        <DoorFrame key={`door-${i}`} door={d} />
      ))}

      {/* Windows on longer wall segments */}
      {walls.map((w, i) => (
        <Window key={`win-${i}`} wall={w} />
      ))}

      {plants.filter((p) => p.id !== carriedPlantId).map((plant) => (
        <PlantMarker
          key={plant.id}
          plant={plant}
          weather={weather}
          floors={floors}
          onClick={onPlantClick}
        />
      ))}

      {/* Plant attached to the avatar while carried */}
      {walkMode && carriedPlantId && (() => {
        const carried = plants.find((p) => p.id === carriedPlantId)
        return carried ? (
          <CarriedPlant plant={carried} positionRef={positionRef} yawRef={yawRef} />
        ) : null
      })()}

      {/* Watering droplet bursts */}
      {droplets.map((d) => (
        <WaterDroplets key={d.id} worldPos={d.worldPos} onDone={d.onDone} />
      ))}

      {/* Click ground to add plant — only in tour mode */}
      {!walkMode && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          visible={false}
          onClick={(e) => {
            const scaledX = e.point.x / SCALE + 50
            const scaledY = e.point.z / SCALE + 50
            const x = (scaledX - 50) / scaleFactor + 50
            const y = (scaledY - 50) * aspect / scaleFactor + 50
            if (x >= 2 && x <= 98 && y >= 2 && y <= 98) {
              onFloorplanClick(Math.round(x), Math.round(y))
            }
          }}
        >
          <planeGeometry args={[30, 30]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {walkMode ? (
        <>
          <Avatar positionRef={positionRef} yawRef={yawRef} walkStateRef={walkStateRef} camMode={camMode} />
          <WalkController
            positionRef={positionRef}
            yawRef={yawRef}
            pitchRef={pitchRef}
            camBackRef={camBackRef}
            joyRef={joyRef}
            walkStateRef={walkStateRef}
            camMode={camMode}
            walls={walls}
            bounds={bounds}
            plants={plants}
            carriedPlantId={carriedPlantId}
            onPickup={onPickup}
            onDrop={onDrop}
            onNearestChange={onWalkNearest}
            onWaterRequest={onWalkWater}
          />
          {audio && <WalkSounds walkStateRef={walkStateRef} audio={audio} />}
        </>
      ) : (
        <OrbitControls
          maxPolarAngle={Math.PI * 0.45}
          minPolarAngle={Math.PI * 0.05}
          minDistance={2}
          maxDistance={50}
          enableDamping
          dampingFactor={0.05}
          target={[0, 0, 0]}
        />
      )}
    </>
  )
}

// ── Touch joystick (mobile) ──────────────────────────────────────────────────
function Joystick({ joyRef }) {
  const wrapRef = useRef(null)
  const knobRef = useRef(null)
  const activeRef = useRef(false)
  const centerRef = useRef({ x: 0, y: 0 })
  const RADIUS = 38

  const setKnob = (dx, dy) => {
    if (!knobRef.current) return
    knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }

  const reset = () => {
    activeRef.current = false
    if (joyRef.current) { joyRef.current.forward = 0; joyRef.current.strafe = 0 }
    setKnob(0, 0)
  }

  const handleStart = (clientX, clientY) => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    activeRef.current = true
    handleMove(clientX, clientY)
  }

  const handleMove = (clientX, clientY) => {
    if (!activeRef.current || !joyRef.current) return
    let dx = clientX - centerRef.current.x
    let dy = clientY - centerRef.current.y
    const mag = Math.sqrt(dx * dx + dy * dy)
    if (mag > RADIUS) { dx = dx * RADIUS / mag; dy = dy * RADIUS / mag }
    setKnob(dx, dy)
    // forward is -y (up on screen), strafe is +x (right)
    joyRef.current.forward = -dy / RADIUS
    joyRef.current.strafe  =  dx / RADIUS
  }

  return (
    <div
      ref={wrapRef}
      data-walk-ui
      onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleStart(t.clientX, t.clientY) }}
      onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleMove(t.clientX, t.clientY) }}
      onTouchEnd={() => reset()}
      onTouchCancel={() => reset()}
      onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY) }}
      onMouseMove={(e) => { if (activeRef.current) handleMove(e.clientX, e.clientY) }}
      onMouseUp={() => reset()}
      onMouseLeave={() => reset()}
      style={{
        position: 'absolute', bottom: 20, left: 20, zIndex: 6,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.5)',
        touchAction: 'none', userSelect: 'none',
      }}
    >
      <div
        ref={knobRef}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 40, height: 40, marginTop: -20, marginLeft: -20,
          borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transition: activeRef.current ? 'none' : 'transform 0.1s',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ── Minimap overlay (walk mode) ──────────────────────────────────────────────
// Mirrors the game-mode minimap: rooms as tan rects, plants coloured by
// watering urgency, and a white triangle pointing in the avatar's facing.
// Reads positionRef/yawRef via rAF so camera motion never rerenders React.
const MINIMAP_3D_SIZE = 120

function Minimap3D({ floor, plants, weather, floors, positionRef, yawRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let raf = 0
    const render = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const size = MINIMAP_3D_SIZE
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== size * dpr) {
          canvas.width = size * dpr
          canvas.height = size * dpr
        }
        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, size, size)

        const visible = (floor?.rooms || []).filter((r) => !r.hidden)
        if (visible.length) {
          const [wx, , wz] = positionRef.current
          const playerX = wx / SCALE + 50
          const playerY = wz / SCALE + 50

          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          for (const r of visible) {
            minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.width)
            minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.height)
          }
          minX = Math.min(minX, playerX); maxX = Math.max(maxX, playerX)
          minY = Math.min(minY, playerY); maxY = Math.max(maxY, playerY)
          const w2 = Math.max(1, maxX - minX)
          const h2 = Math.max(1, maxY - minY)
          const pad = 6
          const sc = Math.min((size - pad * 2) / w2, (size - pad * 2) / h2)
          const offX = (size - w2 * sc) / 2
          const offY = (size - h2 * sc) / 2
          const toMap = (px, py) => [offX + (px - minX) * sc, offY + (py - minY) * sc]

          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.fillRect(0, 0, size, size)
          ctx.fillStyle = 'rgba(127,182,133,0.5)'
          ctx.fillRect(2, 2, size - 4, size - 4)

          ctx.strokeStyle = 'rgba(122,90,61,0.85)'
          ctx.lineWidth = 1
          for (const r of visible) {
            const [x1, y1] = toMap(r.x, r.y)
            const [x2, y2] = toMap(r.x + r.width, r.y + r.height)
            ctx.fillStyle = 'rgba(230,213,185,0.85)'
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
          }

          for (const p of plants || []) {
            const [px, py] = toMap(p.x, p.y)
            const { color } = getWateringStatus(p, weather, floors)
            ctx.fillStyle = color
            ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill()
          }

          const [ax, ay] = toMap(playerX, playerY)
          ctx.save()
          ctx.translate(ax, ay)
          // Canvas y is flipped vs. world z, so rotate by -yaw to match facing.
          ctx.rotate(-yawRef.current)
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(-4, 4)
          ctx.closePath()
          ctx.fill(); ctx.stroke()
          ctx.restore()

          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = 1
          ctx.strokeRect(0.5, 0.5, size - 1, size - 1)
        }
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [floor, plants, weather, floors, positionRef, yawRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 10, left: 10, zIndex: 5,
        width: MINIMAP_3D_SIZE, height: MINIMAP_3D_SIZE,
        pointerEvents: 'none',
      }}
    />
  )
}

export default function Floorplan3D({ floor, floors, plants, weather, onPlantClick, onFloorplanClick }) {
  const { handleWaterPlant, updatePlantsLocally, isGuest } = usePlantContext()

  // When a real floorplan image is present, its aspect ratio is baked into
  // the room/plant percentages. Apply it to every coordinate we render so the
  // square world reflects the image's true proportions; reverse it at every
  // save boundary. Guest mode additionally dilates the layout so its compact
  // 100×100 grid doesn't feel cramped next to the fixed-size avatar.
  const aspect = useImageAspect(floor?.imageUrl)
  const scaleFactor = isGuest ? GUEST_SCALE_FACTOR : 1
  const aspectFloor = useMemo(
    () => applyAspectToFloor(floor, aspect, scaleFactor),
    [floor, aspect, scaleFactor],
  )
  const aspectPlants = useMemo(
    () => applyAspectToPlants(plants, aspect, scaleFactor),
    [plants, aspect, scaleFactor],
  )
  // Walk mode is the default 3D experience. Remember the user's choice so
  // they can turn it off once and have tour mode stick across sessions.
  const [walkMode, setWalkMode] = useState(() => {
    try { return localStorage.getItem('plantTracker_3dWalkMode') !== '0' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('plantTracker_3dWalkMode', walkMode ? '1' : '0') } catch {}
  }, [walkMode])
  const [nearest, setNearest] = useState(null)
  const [justWatered, setJustWatered] = useState(null)
  const [droplets, setDroplets] = useState([])
  const wrapperRef = useRef(null)

  // Real refs the render loop mutates without re-rendering
  const positionRef = useRef([0, 0, 0])
  const yawRef = useRef(0)
  const pitchRef = useRef(0)   // first-person look pitch (-π/3 .. π/3)
  const camBackRef = useRef(4.0)  // chase-camera distance; scroll wheel adjusts
  const joyRef = useRef({ forward: 0, strafe: 0 })
  // Shared animation state between WalkController (writer) and Avatar (reader)
  const walkStateRef = useRef({ moving: false, phase: 0, swingAmp: 0, pourStart: 0 })

  // Plant pickup — state for rendering (which plant is hidden / carried),
  // plus a ref so the frame loop can short-circuit without waiting for a
  // re-render between presses.
  const [carriedPlantId, setCarriedPlantId] = useState(null)
  const carriedIdRef = useRef(null)
  useEffect(() => { carriedIdRef.current = carriedPlantId }, [carriedPlantId])

  const pickupPlant = useCallback((plant) => {
    if (!plant) return
    setCarriedPlantId(plant.id)
  }, [])

  const dropPlant = useCallback(() => {
    const id = carriedIdRef.current
    if (!id) return
    const [ax, , az] = positionRef.current
    const scaledX = ax / SCALE + 50
    const scaledY = az / SCALE + 50
    // Don't clamp to 0–100 — the avatar can stand outside the floorplan grid
    // and the dropped plant should land where they're standing.
    const newX = (scaledX - 50) / scaleFactor + 50
    const newY = (scaledY - 50) * aspect / scaleFactor + 50
    // Find containing room for the new room assignment
    let newRoom = null
    for (const r of (floor?.rooms || [])) {
      if (r.hidden) continue
      if (newX >= r.x && newX <= r.x + r.width && newY >= r.y && newY <= r.y + r.height) {
        newRoom = r.name
        break
      }
    }
    const updates = { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 }
    if (newRoom) {
      updates.room = newRoom
      const carried = plants.find((p) => p.id === id)
      updates.name = derivePlantName({ species: carried?.species, room: newRoom })
    }
    updatePlantsLocally({ [id]: updates })
    if (!isGuest) {
      plantsApi.update(id, updates).catch((err) => console.error('Move plant failed:', err))
    }
    setCarriedPlantId(null)
  }, [floor, aspect, scaleFactor, plants, updatePlantsLocally, isGuest])
  // In-world hour (0..24), starts at real wall-clock time and drifts forward
  // while the canvas is rendering so lighting evolves through the day.
  const timeRef = useRef((() => {
    const d = new Date()
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
  })())

  // First/third-person preference, persisted across sessions
  const [camMode, setCamMode] = useState(() => {
    try { return localStorage.getItem('plantTracker_3dCamMode') === 'fp' ? 'fp' : 'tp' } catch { return 'tp' }
  })
  useEffect(() => {
    try { localStorage.setItem('plantTracker_3dCamMode', camMode) } catch {}
  }, [camMode])

  // Sound preference — default OFF so we never autoplay. AudioContext is
  // created + resumed INSIDE the toggle click so it counts as a user gesture
  // (Chrome/Safari autoplay policy). The effect below only persists the
  // preference to localStorage.
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('plantTracker_3dSoundOn') === '1' } catch { return false }
  })
  const audioRef = useRef(null)
  useEffect(() => {
    try { localStorage.setItem('plantTracker_3dSoundOn', soundOn ? '1' : '0') } catch {}
  }, [soundOn])

  const toggleSound = useCallback(() => {
    // If we're flipping ON, create/resume audio synchronously so the browser
    // treats this click as the gesture that unlocks playback.
    if (!soundOn) {
      if (!audioRef.current) audioRef.current = createWalkAudio()
      if (audioRef.current?.ctx?.state === 'suspended') {
        audioRef.current.ctx.resume().catch(() => {})
      }
    }
    setSoundOn((v) => !v)
  }, [soundOn])

  // Reset avatar to the centre of the visible rooms when the floor changes,
  // or when the image aspect ratio arrives (scaled bounds differ from square).
  useEffect(() => {
    const rooms = (aspectFloor?.rooms || []).filter((r) => !r.hidden)
    if (!rooms.length) {
      positionRef.current[0] = 0
      positionRef.current[2] = 0
    } else {
      const bounds = getRoomsBounds(rooms)
      if (bounds) {
        positionRef.current[0] = (bounds.minX + bounds.maxX) / 2
        positionRef.current[2] = (bounds.minZ + bounds.maxZ) / 2
      }
    }
    yawRef.current = 0
  }, [floor?.id, aspect, scaleFactor])

  // Scroll-wheel zoom in walk mode
  useEffect(() => {
    if (!walkMode) return
    const el = wrapperRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      camBackRef.current = Math.max(2.0, Math.min(20.0, camBackRef.current + e.deltaY * 0.008))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [walkMode])

  // Pointer-drag look: horizontal drag adjusts yaw, vertical drag pitch (clamped).
  // Ignored if the press starts on an interactive overlay (joystick/water button).
  useEffect(() => {
    if (!walkMode) return
    const el = wrapperRef.current
    if (!el) return
    let dragging = false
    let lastX = 0, lastY = 0
    const onDown = (e) => {
      if (e.target && e.target.closest('[data-walk-ui]')) return
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const onMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      yawRef.current -= dx * 0.005
      pitchRef.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitchRef.current - dy * 0.004))
    }
    const onUp = () => { dragging = false }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [walkMode])

  const waterPlant = (plant) => {
    if (!plant) return
    handleWaterPlant(plant.id)
    setJustWatered(plant.id)
    walkStateRef.current.pourStart = performance.now()
    // Spawn a droplet burst at the plant — plant.y here is aspect-scaled (the
    // droplet lives in the internal world coord space).
    const [px, , pz] = pctToWorld(plant.x, plant.y)
    const id = Math.random().toString(36).slice(2)
    setDroplets((prev) => [...prev, {
      id,
      worldPos: [px, 0, pz],
      onDone: () => setDroplets((cur) => cur.filter((d) => d.id !== id)),
    }])
    setTimeout(() => setJustWatered((id) => (id === plant.id ? null : id)), 1500)
  }

  // Detect touch device to show joystick + tap-water button
  const isTouch = typeof window !== 'undefined'
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', background: '#f1f3f5', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [10, 10, 10], fov: 45, near: 0.05, far: 200 }}
        gl={{ antialias: true }}
      >
        <Scene
          floor={aspectFloor}
          plants={aspectPlants}
          weather={weather}
          floors={floors}
          aspect={aspect}
          scaleFactor={scaleFactor}
          onPlantClick={onPlantClick}
          onFloorplanClick={onFloorplanClick}
          walkMode={walkMode}
          camMode={camMode}
          positionRef={positionRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          camBackRef={camBackRef}
          joyRef={joyRef}
          walkStateRef={walkStateRef}
          timeRef={timeRef}
          carriedPlantId={carriedPlantId}
          onPickup={pickupPlant}
          onDrop={dropPlant}
          audio={soundOn ? audioRef.current : null}
          onWalkNearest={setNearest}
          onWalkWater={waterPlant}
          droplets={droplets}
        />
      </Canvas>

      {/* Mode toggle */}
      <button
        type="button"
        data-walk-ui
        onClick={() => { setWalkMode((v) => !v); setNearest(null) }}
        title={walkMode ? 'Exit walk mode' : 'Walk around your house'}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 5,
          padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
          background: walkMode ? '#10b981' : '#fff', color: walkMode ? '#fff' : '#495057',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        }}
      >
        {walkMode ? '🚶 Walk mode — exit' : '🚶 Walk mode'}
      </button>

      {/* First/third-person toggle — only while in walk mode */}
      {walkMode && (
        <button
          type="button"
          data-walk-ui
          onClick={() => setCamMode((m) => (m === 'fp' ? 'tp' : 'fp'))}
          title={camMode === 'fp' ? 'Switch to third-person' : 'Switch to first-person'}
          style={{
            position: 'absolute', top: 48, right: 10, zIndex: 5,
            padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff', color: '#495057',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          {camMode === 'fp' ? '👁️ First-person' : '🎥 Third-person'}
        </button>
      )}

      {/* Sound toggle — only while in walk mode; muted by default */}
      {walkMode && (
        <button
          type="button"
          data-walk-ui
          onClick={toggleSound}
          title={soundOn ? 'Mute footsteps & splash' : 'Unmute footsteps & splash'}
          style={{
            position: 'absolute', top: 86, right: 10, zIndex: 5,
            padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)',
            background: soundOn ? '#10b981' : '#fff', color: soundOn ? '#fff' : '#495057',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          {soundOn ? '🔊 Sound on' : '🔇 Sound off'}
        </button>
      )}

      {/* HUD */}
      {walkMode && (
        <>
          <Minimap3D
            floor={aspectFloor}
            plants={aspectPlants}
            weather={weather}
            floors={floors}
            positionRef={positionRef}
            yawRef={yawRef}
          />
          {!isTouch && (
            <div
              style={{
                position: 'absolute', top: 140, left: 10, zIndex: 5,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 12, lineHeight: 1.4,
                fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
                maxWidth: 260,
              }}
            >
              <div><strong>WASD</strong> / arrows — move &amp; turn</div>
              <div><strong>Drag</strong> — look around</div>
              <div><strong>Scroll</strong> — zoom camera (third-person)</div>
              <div><strong>E</strong> — water the plant you're next to</div>
              <div><strong>F</strong> — pick up / drop a plant</div>
            </div>
          )}

          {(() => {
            const carried = carriedPlantId ? plants.find((p) => p.id === carriedPlantId) : null
            const bg = justWatered
              ? 'rgba(34,197,94,0.95)'
              : carried
                ? 'rgba(120,53,15,0.95)'
                : nearest
                  ? 'rgba(16,185,129,0.95)'
                  : 'rgba(0,0,0,0.5)'
            return (
              <div
                style={{
                  position: 'absolute', bottom: isTouch ? 140 : 20, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 5, padding: '10px 16px', borderRadius: 999,
                  background: bg,
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {justWatered
                  ? '💧 Watered!'
                  : carried
                    ? <>Carrying <strong>{carried.name}</strong> — press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>F</kbd> to drop here</>
                    : nearest
                      ? (isTouch
                          ? <>Tap 💧 to water, 🫳 to pick up <strong>{nearest.name}</strong></>
                          : <>Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>E</kbd> to water · <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>F</kbd> to carry <strong>{nearest.name}</strong></>)
                      : 'Walk up to a plant to water it'}
              </div>
            )
          })()}

          {isTouch && (
            <>
              <Joystick joyRef={joyRef} />
              <button
                type="button"
                data-walk-ui
                onClick={() => waterPlant(nearest)}
                disabled={!nearest || !!carriedPlantId}
                style={{
                  position: 'absolute', bottom: 28, right: 20, zIndex: 6,
                  width: 78, height: 78, borderRadius: '50%',
                  border: 'none', fontSize: 32,
                  background: nearest && !carriedPlantId ? '#10b981' : 'rgba(0,0,0,0.35)',
                  color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  opacity: nearest && !carriedPlantId ? 1 : 0.5,
                  touchAction: 'manipulation',
                }}
              >
                💧
              </button>
              <button
                type="button"
                data-walk-ui
                onClick={() => {
                  if (carriedPlantId) dropPlant()
                  else if (nearest) pickupPlant(nearest)
                }}
                disabled={!carriedPlantId && !nearest}
                style={{
                  position: 'absolute', bottom: 28, right: 108, zIndex: 6,
                  width: 78, height: 78, borderRadius: '50%',
                  border: 'none', fontSize: 30,
                  background: carriedPlantId
                    ? '#f59e0b'
                    : nearest ? '#8b5cf6' : 'rgba(0,0,0,0.35)',
                  color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  opacity: carriedPlantId || nearest ? 1 : 0.5,
                  touchAction: 'manipulation',
                }}
              >
                {carriedPlantId ? '📥' : '🫳'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
