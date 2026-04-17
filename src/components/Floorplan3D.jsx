import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import { getWateringStatus } from '../utils/watering.js'
import { usePlantContext } from '../context/PlantContext.jsx'

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

const SCALE = 0.2 // 100% → 20 world units (roughly 20m house footprint)
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

function RoomFurniture({ room, w, d }) {
  const category = categoriseRoom(room.name)
  if (!category) return null

  const rand = seedRand(room.id || `${room.x}-${room.y}-${room.name || ''}`)

  if (category === 'living') {
    // Sofa against one of the long walls; coffee table ~1m away from it.
    const side = w >= d ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const a = wallAnchor(side, w, d, 0.9)
    const tint = ['#6b7280', '#8f8676', '#5a6677', '#78594b'][Math.floor(rand() * 4)]
    // Coffee table offset away from the sofa back
    const dx = side === 2 ? 1.3 : side === 3 ? -1.3 : 0
    const dz = side === 0 ? 1.2 : side === 1 ? -1.2 : 0
    return (
      <>
        <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
          <Sofa tint={tint} />
        </group>
        <group position={[a.x + dx, 0, a.z + dz]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[1.2, 0.35, 0.6]} />
            <meshStandardMaterial color="#6b4423" roughness={0.7} />
          </mesh>
        </group>
      </>
    )
  }

  if (category === 'bedroom') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 2 : 3) : (rand() < 0.5 ? 0 : 1)
    const a = wallAnchor(side, w, d, 2.3)
    return (
      <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
        <Bed />
      </group>
    )
  }

  if (category === 'kitchen') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const len = Math.min(longSide ? w : d, 4) - 1
    const a = wallAnchor(side, w, d, 0.6)
    return (
      <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
        <KitchenCounter length={len} />
      </group>
    )
  }

  if (category === 'bathroom') {
    const longSide = w >= d
    const side = longSide ? (rand() < 0.5 ? 0 : 1) : (rand() < 0.5 ? 2 : 3)
    const a = wallAnchor(side, w, d, 0.8)
    return (
      <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
        <Tub />
      </group>
    )
  }

  if (category === 'dining') {
    return (
      <group position={[0, 0, 0]} rotation={[0, w < d ? Math.PI / 2 : 0, 0]}>
        <DiningTable />
      </group>
    )
  }

  if (category === 'office') {
    const side = Math.floor(rand() * 4)
    const a = wallAnchor(side, w, d, 0.7)
    return (
      <group position={[a.x, 0, a.z]} rotation={[0, a.ry, 0]}>
        <Desk />
      </group>
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
  const { color, label } = getWateringStatus(plant, weather, floors)
  const [x, , z] = pctToWorld(plant.x, plant.y)
  const hitRef = useRef()
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

      {/* Flower bud for flowering species */}
      {hasFlower && (
        <mesh position={[0, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#ec4899" roughness={0.6} />
        </mesh>
      )}

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

function DynamicLighting({ weather }) {
  const sky = weather?.current?.condition?.sky || 'sunny'
  const isDay = weather?.current?.isDay !== false
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60

  // Elevation: sine that peaks at noon, negative after sunset
  const elev = Math.sin(((hour - 6) / 12) * Math.PI)
  // Azimuth: east in the morning (negative X), west in the afternoon
  const azim = ((hour - 12) / 12) * Math.PI

  const wFactor = WEATHER_INTENSITY[sky] ?? 0.9
  const effectiveElev = Math.max(0, elev)

  // Warm golden at low elevations, neutral midday, cool at night
  let sunColor = '#ffffff'
  if (!isDay || elev <= 0) sunColor = '#8592b0'       // moonlight-ish
  else if (effectiveElev < 0.25) sunColor = '#ffb56b' // golden hour
  else if (effectiveElev < 0.5)  sunColor = '#ffe3b8' // warm morning/late afternoon

  // Overcast/rain desaturates ambient toward cool grey
  const overcast = sky === 'cloudy' || sky === 'rainy' || sky === 'foggy' || sky === 'stormy'
  const ambientColor = overcast ? '#b8c4d4' : '#ffffff'
  const ambientIntensity = isDay
    ? (0.3 + effectiveElev * 0.3) * wFactor
    : 0.15

  const directionalIntensity = isDay
    ? Math.max(0.15, 0.9 * effectiveElev * wFactor)
    : 0.12

  // Sun vector — push it out so shadows make sense, keep a minimum height
  const r = 12
  const sunX = Math.sin(azim) * r
  const sunY = Math.max(3, effectiveElev * 10 + (isDay ? 2 : -4))
  const sunZ = Math.cos(azim) * r

  return (
    <>
      <ambientLight color={ambientColor} intensity={ambientIntensity} />
      <directionalLight
        position={[sunX, sunY, sunZ]}
        color={sunColor}
        intensity={directionalIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Night hemisphere warmth so interiors aren't pitch-black */}
      {!isDay && (
        <hemisphereLight
          args={['#334257', '#3f2a1a', 0.45]}
        />
      )}
    </>
  )
}

// ── Walk mode ────────────────────────────────────────────────────────────────
// Avatar state lives in refs so the render loop can mutate without triggering
// React renders. Only proximity HUD state is lifted into React.

const WATER_RANGE = 1.6           // must be within this world distance to water
const WALK_SPEED = 4.5             // world units per second
const TURN_SPEED = 2.2             // radians per second
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
// overlaps become implicit doorways — no schema change required.
//
// Returns an array of { axis, v, a, b }:
//   axis: 'x' — wall runs along X between a..b at constant z = v
//   axis: 'z' — wall runs along Z between a..b at constant x = v
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

  const raw = []
  for (const r of scaled) {
    raw.push({ axis: 'x', v: r.z1, a: r.x1, b: r.x2 }) // north (top edge)
    raw.push({ axis: 'x', v: r.z2, a: r.x1, b: r.x2 }) // south (bottom edge)
    raw.push({ axis: 'z', v: r.x1, a: r.z1, b: r.z2 }) // west (left edge)
    raw.push({ axis: 'z', v: r.x2, a: r.z1, b: r.z2 }) // east (right edge)
  }

  const blockers = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]
    const doors = []
    for (let j = 0; j < raw.length; j++) {
      if (j === i) continue
      const o = raw[j]
      if (o.axis !== s.axis) continue
      if (Math.abs(o.v - s.v) > eps) continue
      const start = Math.max(s.a, o.a)
      const end = Math.min(s.b, o.b)
      if (end - start >= DOOR_MIN) doors.push([start, end])
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
    }
    if (cursor < s.b) blockers.push({ axis: s.axis, v: s.v, a: cursor, b: s.b })
  }

  // Dedupe identical sub-segments produced by adjacent rooms
  const seen = new Set()
  const out = []
  for (const w of blockers) {
    const k = `${w.axis}:${w.v.toFixed(3)}:${w.a.toFixed(3)}:${w.b.toFixed(3)}`
    if (seen.has(k)) continue
    seen.add(k); out.push(w)
  }
  return out
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
      s.phase += dt * 9
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
            <cylinderGeometry args={[0.14, 0.16, 0.28, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.70, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 0.05, 10]} />
            <meshStandardMaterial color="#fcd7b6" />
          </mesh>

          {/* Head */}
          <mesh position={[0, 0.82, 0]} castShadow>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshStandardMaterial color="#fcd7b6" />
          </mesh>
          {/* Hair — a cap covering the top half of the head */}
          <mesh position={[0, 0.86, 0.015]} castShadow>
            <sphereGeometry args={[0.135, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color="#5c3317" />
          </mesh>
          {/* Eyes — looking forward (-z) */}
          <mesh position={[-0.045, 0.83, -0.11]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0.045, 0.83, -0.11]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {/* Smile */}
          <mesh position={[0, 0.79, -0.115]}>
            <boxGeometry args={[0.04, 0.008, 0.005]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>

          {/* Left arm — swings during walk (pivots at shoulder) */}
          <group ref={leftArmRef} position={[-0.18, 0.58, 0]} rotation={[0, 0, 0.05]}>
            {/* Upper arm */}
            <mesh position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.22, 10]} />
              <meshStandardMaterial color="#3b82f6" />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.24, 0]} castShadow>
              <sphereGeometry args={[0.04, 10, 10]} />
              <meshStandardMaterial color="#fcd7b6" />
            </mesh>
          </group>
        </>
      )}

      {/* Right arm — reaches out to hold the can (visible in both modes) */}
      <group position={[0.17, 0.6, 0]} rotation={[0.1, 0, -1.1]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.24, 10]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, -0.26, 0]} castShadow>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#fcd7b6" />
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
  camMode, walls, bounds, plants, onNearestChange, onWaterRequest,
}) {
  const { camera } = useThree()
  const keysRef = useRef(new Set())
  const waterPendingRef = useRef(false)
  const camLookRef = useRef({ x: 0, y: 0.5, z: 0 })
  const firstFrameRef = useRef(true)

  useEffect(() => {
    firstFrameRef.current = true
    const down = (e) => {
      const k = e.key.toLowerCase()
      keysRef.current.add(k)
      if (k === 'e') waterPendingRef.current = true
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
        nx = Math.max(-14, Math.min(14, nx))
        nz = Math.max(-14, Math.min(14, nz))
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
  })

  return null
}

function Scene({
  floor, plants, weather, floors,
  onPlantClick, onFloorplanClick,
  walkMode, camMode,
  positionRef, yawRef, pitchRef, camBackRef, joyRef, walkStateRef,
  audio,
  onWalkNearest, onWalkWater,
  droplets,
}) {
  const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
  const bounds = useMemo(() => getRoomsBounds(rooms), [rooms])
  const walls = useMemo(() => computeWallSegments(rooms), [rooms])

  return (
    <>
      <DynamicLighting weather={weather} />

      <Ground floorType={floor?.type} />

      {rooms.map((room, i) => (
        <Room key={room.id || i} room={room} floorType={floor?.type} />
      ))}

      {plants.map((plant) => (
        <PlantMarker
          key={plant.id}
          plant={plant}
          weather={weather}
          floors={floors}
          onClick={onPlantClick}
        />
      ))}

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
            const x = e.point.x / SCALE + 50
            const y = e.point.z / SCALE + 50
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
            onNearestChange={onWalkNearest}
            onWaterRequest={onWalkWater}
          />
          {audio && <WalkSounds walkStateRef={walkStateRef} audio={audio} />}
        </>
      ) : (
        <OrbitControls
          maxPolarAngle={Math.PI * 0.45}
          minPolarAngle={Math.PI * 0.05}
          minDistance={3}
          maxDistance={80}
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

export default function Floorplan3D({ floor, floors, plants, weather, onPlantClick, onFloorplanClick }) {
  const { handleWaterPlant } = usePlantContext()
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

  // First/third-person preference, persisted across sessions
  const [camMode, setCamMode] = useState(() => {
    try { return localStorage.getItem('plantTracker_3dCamMode') === 'fp' ? 'fp' : 'tp' } catch { return 'tp' }
  })
  useEffect(() => {
    try { localStorage.setItem('plantTracker_3dCamMode', camMode) } catch {}
  }, [camMode])

  // Sound preference — default OFF so we never autoplay. Lazy-init the
  // AudioContext when the user first unmutes (counts as a user gesture).
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('plantTracker_3dSoundOn') === '1' } catch { return false }
  })
  const audioRef = useRef(null)
  useEffect(() => {
    try { localStorage.setItem('plantTracker_3dSoundOn', soundOn ? '1' : '0') } catch {}
    if (soundOn && !audioRef.current) audioRef.current = createWalkAudio()
    // Resume after tab-switch suspend
    if (soundOn && audioRef.current?.ctx?.state === 'suspended') {
      audioRef.current.ctx.resume().catch(() => {})
    }
  }, [soundOn])

  // Reset avatar to the centre of the visible rooms when the floor changes
  useEffect(() => {
    const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
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
  }, [floor?.id])

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
    // Spawn a droplet burst at the plant
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
        camera={{ position: [14, 14, 14], fov: 45, near: 0.05, far: 200 }}
        gl={{ antialias: true }}
      >
        <Scene
          floor={floor}
          plants={plants}
          weather={weather}
          floors={floors}
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
          onClick={() => setSoundOn((v) => !v)}
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
          {!isTouch && (
            <div
              style={{
                position: 'absolute', top: 10, left: 10, zIndex: 5,
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
            </div>
          )}

          <div
            style={{
              position: 'absolute', bottom: isTouch ? 140 : 20, left: '50%', transform: 'translateX(-50%)',
              zIndex: 5, padding: '10px 16px', borderRadius: 999,
              background: justWatered ? 'rgba(34,197,94,0.95)' : (nearest ? 'rgba(16,185,129,0.95)' : 'rgba(0,0,0,0.5)'),
              color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {justWatered
              ? '💧 Watered!'
              : nearest
                ? (isTouch
                    ? <>Tap 💧 to water <strong>{nearest.name}</strong></>
                    : <>Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>E</kbd> to water <strong>{nearest.name}</strong></>)
                : 'Walk up to a plant to water it'}
          </div>

          {isTouch && (
            <>
              <Joystick joyRef={joyRef} />
              <button
                type="button"
                data-walk-ui
                onClick={() => waterPlant(nearest)}
                disabled={!nearest}
                style={{
                  position: 'absolute', bottom: 28, right: 20, zIndex: 6,
                  width: 78, height: 78, borderRadius: '50%',
                  border: 'none', fontSize: 32,
                  background: nearest ? '#10b981' : 'rgba(0,0,0,0.35)',
                  color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  opacity: nearest ? 1 : 0.5,
                  touchAction: 'manipulation',
                }}
              >
                💧
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
