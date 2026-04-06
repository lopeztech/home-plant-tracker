import { useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import { getWateringStatus } from '../utils/watering.js'

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

function Scene({ floor, plants, weather, floors, onPlantClick, onFloorplanClick }) {
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

      {/* Click ground to add plant */}
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

      <OrbitControls
        maxPolarAngle={Math.PI * 0.45}
        minPolarAngle={Math.PI * 0.1}
        minDistance={2}
        maxDistance={12}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0, 0]}
      />
    </>
  )
}

export default function Floorplan3D({ floor, floors, plants, weather, onPlantClick, onFloorplanClick }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#f1f3f5' }}>
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
        />
      </Canvas>
    </div>
  )
}
