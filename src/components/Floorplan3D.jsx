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

const WATER_RANGE = 0.7           // must be within this world distance to water
const WALK_SPEED = 2.5             // world units per second
const TURN_SPEED = 2.2             // radians per second (arrow keys)
const BOUND = 5.8                  // ground is 12x12 centred — keep the avatar inside

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
      {/* Body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.6, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#fcd7b6" />
      </mesh>
      {/* Facing indicator — small nose cone pointing forward (-z) */}
      <mesh position={[0, 0.7, -0.14]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.07, 8]} />
        <meshStandardMaterial color="#fcd7b6" />
      </mesh>
    </group>
  )
}

function WalkController({ positionRef, yawRef, plants, onNearestChange, onWaterRequest }) {
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

  useFrame((_, dt) => {
    const keys = keysRef.current

    // Rotate (arrow keys or Q/E-equivalent letters; keep E for water)
    if (keys.has('arrowleft') || keys.has('q')) yawRef.current += TURN_SPEED * dt
    if (keys.has('arrowright'))                   yawRef.current -= TURN_SPEED * dt

    // Move
    const forward = (keys.has('w') || keys.has('arrowup')   ? 1 : 0)
                  - (keys.has('s') || keys.has('arrowdown') ? 1 : 0)
    const strafe  = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)

    if (forward !== 0 || strafe !== 0) {
      const yaw = yawRef.current
      // Forward is -z in the avatar's local frame (cone points -z)
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
      const sx =  Math.cos(yaw), sz = -Math.sin(yaw)
      let nx = positionRef.current[0] + (fx * forward + sx * strafe) * WALK_SPEED * dt
      let nz = positionRef.current[2] + (fz * forward + sz * strafe) * WALK_SPEED * dt
      // Clamp to ground bounds — full wall collision is a TODO
      nx = Math.max(-BOUND, Math.min(BOUND, nx))
      nz = Math.max(-BOUND, Math.min(BOUND, nz))
      positionRef.current[0] = nx
      positionRef.current[2] = nz
    }

    // Third-person chase camera — behind the avatar's facing direction
    const yaw = yawRef.current
    const [ax, , az] = positionRef.current
    const camBack = 1.6
    const camUp = 1.2
    camera.position.set(
      ax + Math.sin(yaw) * camBack,
      camUp,
      az + Math.cos(yaw) * camBack,
    )
    camera.lookAt(ax, 0.5, az)

    // Find nearest plant
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

    // Consume water keypress if in range
    if (waterPendingRef.current) {
      waterPendingRef.current = false
      if (inRange) onWaterRequest(nearest)
    }
  })

  return null
}

function Scene({ floor, plants, weather, floors, onPlantClick, onFloorplanClick, walkMode, walkRefs, onWalkNearest, onWalkWater }) {
  const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
  const { camera } = useThree()

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
          <Avatar positionRef={walkRefs.position} yawRef={walkRefs.yaw} />
          <WalkController
            positionRef={walkRefs.position}
            yawRef={walkRefs.yaw}
            plants={plants}
            onNearestChange={onWalkNearest}
            onWaterRequest={onWalkWater}
          />
        </>
      ) : (
        <OrbitControls
          maxPolarAngle={Math.PI * 0.45}
          minPolarAngle={Math.PI * 0.1}
          minDistance={2}
          maxDistance={12}
          enableDamping
          dampingFactor={0.05}
          target={[0, 0, 0]}
        />
      )}
    </>
  )
}

export default function Floorplan3D({ floor, floors, plants, weather, onPlantClick, onFloorplanClick }) {
  const { handleWaterPlant } = usePlantContext()
  const [walkMode, setWalkMode] = useState(false)
  const [nearest, setNearest] = useState(null)
  const [justWatered, setJustWatered] = useState(null)

  // Mutable refs the render loop writes to without causing React renders
  const walkRefs = useMemo(() => ({ position: [0, 0, 0], yaw: 0 }), [])

  const waterNearest = (plant) => {
    if (!plant) return
    handleWaterPlant(plant.id)
    setJustWatered(plant.id)
    setTimeout(() => setJustWatered((id) => (id === plant.id ? null : id)), 1500)
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#f1f3f5', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ position: [6, 6, 6], fov: 45 }}
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
          walkRefs={walkRefs}
          onWalkNearest={setNearest}
          onWalkWater={waterNearest}
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
            <div><strong>E</strong> — water the plant you're next to</div>
          </div>
          <div
            style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              zIndex: 5, padding: '10px 16px', borderRadius: 999,
              background: justWatered ? 'rgba(34,197,94,0.95)' : (nearest ? 'rgba(16,185,129,0.95)' : 'rgba(0,0,0,0.5)'),
              color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
              transition: 'background 0.15s',
            }}
          >
            {justWatered
              ? '💧 Watered!'
              : nearest
                ? <>Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>E</kbd> to water <strong>{nearest.name}</strong></>
                : 'Walk up to a plant to water it'}
          </div>
        </>
      )}
    </div>
  )
}
