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

const SCALE = 0.1 // 100% → 10 world units
const WALL_HEIGHT = 0.8
const WALL_THICKNESS = 0.05

const ROOM_COLORS = {
  indoor:   { wall: '#e0e0e0', floor: '#ffffff', edge: '#9e9e9e' },
  interior: { wall: '#e0e0e0', floor: '#ffffff', edge: '#9e9e9e' },
  outdoor:  { wall: '#b7dfc5', floor: '#e8f5e9', edge: '#6aad80' },
}

function pctToWorld(x, y) {
  return [(x - 50) * SCALE, 0, (y - 50) * SCALE]
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

      {/* Room label */}
      <Billboard position={[0, 0.15, 0]}>
        <Text
          fontSize={0.2}
          color="#495057"
          anchorX="center"
          anchorY="middle"
          maxWidth={w - 0.2}
        >
          {room.name?.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  )
}

function PlantMarker({ plant, weather, floors, onClick }) {
  const { color, label } = getWateringStatus(plant, weather, floors)
  const [x, , z] = pctToWorld(plant.x, plant.y)
  const initial = (plant.name || '?')[0].toUpperCase()
  const meshRef = useRef()

  return (
    <group position={[x, 0.3, z]}>
      <Billboard>
        {/* Colored circle */}
        <mesh
          ref={meshRef}
          onClick={(e) => { e.stopPropagation(); onClick(plant) }}
          onPointerOver={() => { if (meshRef.current) meshRef.current.scale.set(1.2, 1.2, 1.2); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { if (meshRef.current) meshRef.current.scale.set(1, 1, 1); document.body.style.cursor = 'default' }}
        >
          <circleGeometry args={[0.18, 32]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Plant emoji icon */}
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.14, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Text
          position={[0, 0, 0.002]}
          fontSize={0.16}
          anchorX="center"
          anchorY="middle"
        >
          {getPlantEmoji(plant)}
        </Text>

        {/* Plant name label below */}
        <Text
          position={[0, -0.28, 0]}
          fontSize={0.08}
          color="#495057"
          anchorX="center"
          anchorY="middle"
          maxWidth={1}
        >
          {plant.name}
        </Text>

        {/* Status label */}
        <Text
          position={[0, -0.38, 0]}
          fontSize={0.06}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Billboard>

      {/* Ground dot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function Ground({ floorType }) {
  const color = floorType === 'outdoor' ? '#e8f5e9' : '#f1f3f5'
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[12, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// ── Walk mode ────────────────────────────────────────────────────────────────
// Avatar state lives in refs so the render loop can mutate without triggering
// React renders. Only proximity HUD state is lifted into React.

const WATER_RANGE = 0.9           // must be within this world distance to water
const WALK_SPEED = 2.5             // world units per second
const TURN_SPEED = 2.2             // radians per second
const AVATAR_RADIUS = 0.18         // for wall/room collision

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

function Avatar({ positionRef, yawRef }) {
  const groupRef = useRef()
  useFrame(() => {
    if (!groupRef.current) return
    const p = positionRef.current
    groupRef.current.position.set(p[0], 0, p[2])
    groupRef.current.rotation.y = yawRef.current
  })
  return (
    <group ref={groupRef}>
      {/* Shoes */}
      <mesh position={[-0.07, 0.03, -0.02]} castShadow>
        <boxGeometry args={[0.09, 0.06, 0.14]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.07, 0.03, -0.02]} castShadow>
        <boxGeometry args={[0.09, 0.06, 0.14]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Legs (pants) */}
      <mesh position={[-0.07, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.32, 12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.07, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.32, 12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

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

      {/* Left arm — hangs at the side */}
      <group position={[-0.18, 0.58, 0]} rotation={[0, 0, 0.05]}>
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

      {/* Right arm — reaches out to hold the can */}
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
      <group position={[0.34, 0.48, -0.02]}>
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
    Array.from({ length: 8 }, () => ({
      ox: (Math.random() - 0.5) * 0.12,
      oz: (Math.random() - 0.5) * 0.12,
      delay: Math.random() * 0.2,
      dur: 0.6 + Math.random() * 0.3,
      r: 0.018 + Math.random() * 0.01,
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
    const y = 0.7 - u * 0.7
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
  positionRef, yawRef, camBackRef, joyRef,
  bounds, plants, onNearestChange, onWaterRequest,
}) {
  const { camera } = useThree()
  const keysRef = useRef(new Set())
  const waterPendingRef = useRef(false)

  useEffect(() => {
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

    if (forward !== 0 || strafe !== 0) {
      const yaw = yawRef.current
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const sx =  Math.cos(yaw), sz = -Math.sin(yaw)
      const magnitude = Math.min(1, Math.sqrt(forward * forward + strafe * strafe))
      const nf = forward / (magnitude || 1), ns = strafe / (magnitude || 1)
      const step = magnitude * WALK_SPEED * dt
      let nx = positionRef.current[0] + (fx * nf + sx * ns) * step
      let nz = positionRef.current[2] + (fz * nf + sz * ns) * step
      // Clamp to house footprint (bounds) or ground (fallback)
      if (bounds) {
        nx = Math.max(bounds.minX, Math.min(bounds.maxX, nx))
        nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, nz))
      } else {
        nx = Math.max(-5.8, Math.min(5.8, nx))
        nz = Math.max(-5.8, Math.min(5.8, nz))
      }
      positionRef.current[0] = nx
      positionRef.current[2] = nz
    }

    // Third-person chase camera — behind the avatar's facing direction
    const yaw = yawRef.current
    const [ax, , az] = positionRef.current
    const camBack = camBackRef.current
    // Scale camera height with zoom so far-out view isn't staring into the ground
    const camUp = 0.9 + camBack * 0.35
    camera.position.set(
      ax + Math.sin(yaw) * camBack,
      camUp,
      az + Math.cos(yaw) * camBack,
    )
    camera.lookAt(ax, 0.5, az)

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
      if (inRange) onWaterRequest(nearest)
    }
  })

  return null
}

function Scene({
  floor, plants, weather, floors,
  onPlantClick, onFloorplanClick,
  walkMode, positionRef, yawRef, camBackRef, joyRef,
  onWalkNearest, onWalkWater,
  droplets,
}) {
  const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
  const bounds = useMemo(() => getRoomsBounds(rooms), [rooms])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

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
          <planeGeometry args={[12, 12]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {walkMode ? (
        <>
          <Avatar positionRef={positionRef} yawRef={yawRef} />
          <WalkController
            positionRef={positionRef}
            yawRef={yawRef}
            camBackRef={camBackRef}
            joyRef={joyRef}
            bounds={bounds}
            plants={plants}
            onNearestChange={onWalkNearest}
            onWaterRequest={onWalkWater}
          />
        </>
      ) : (
        <OrbitControls
          maxPolarAngle={Math.PI * 0.45}
          minPolarAngle={Math.PI * 0.05}
          minDistance={1.5}
          maxDistance={40}
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
  const [walkMode, setWalkMode] = useState(false)
  const [nearest, setNearest] = useState(null)
  const [justWatered, setJustWatered] = useState(null)
  const [droplets, setDroplets] = useState([])
  const wrapperRef = useRef(null)

  // Real refs the render loop mutates without re-rendering
  const positionRef = useRef([0, 0, 0])
  const yawRef = useRef(0)
  const camBackRef = useRef(1.8)  // chase-camera distance; scroll wheel adjusts
  const joyRef = useRef({ forward: 0, strafe: 0 })

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
      camBackRef.current = Math.max(1.0, Math.min(8.0, camBackRef.current + e.deltaY * 0.004))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [walkMode])

  const waterPlant = (plant) => {
    if (!plant) return
    handleWaterPlant(plant.id)
    setJustWatered(plant.id)
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
        camera={{ position: [6, 6, 6], fov: 45, near: 0.05, far: 100 }}
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
          positionRef={positionRef}
          yawRef={yawRef}
          camBackRef={camBackRef}
          joyRef={joyRef}
          onWalkNearest={setNearest}
          onWalkWater={waterPlant}
          droplets={droplets}
        />
      </Canvas>

      {/* Mode toggle */}
      <button
        type="button"
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
              <div><strong>Scroll</strong> — zoom camera</div>
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
