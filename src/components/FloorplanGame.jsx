import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { usePlantContext } from '../context/PlantContext.jsx'
import { getWateringStatus } from '../utils/watering.js'

// ── World constants ──────────────────────────────────────────────────────────
// The game world uses percent coordinates (same as plant.x/y and room bounds).
// Camera maps percent → pixels with a tile size, centred on the gardener.

const TILE = 18                  // px per percent unit (world → screen)
const PLAYER_RADIUS = 1.5        // percent — also used for wall collision
const WALL_THICKNESS = 1.5       // percent
const DOOR_MIN = 5               // percent — min shared edge that counts as a doorway
const WATER_RANGE = 6            // percent — distance you must be within to water
const SPEED = 55                 // percent per second

const COLORS = {
  grass:        '#7fb685',
  grassDark:    '#6aa37a',
  dirt:         '#c9a978',
  dirtDark:     '#b89868',
  floorIndoor:  '#e6d5b9',
  floorTile:    '#d6c5a8',
  wall:         '#7a5a3d',
  wallTop:      '#a07a53',
  roomLabel:    'rgba(60,45,30,0.75)',
  shirt:        '#3b6fd6',
  hat:          '#a0552f',
  hatBand:      '#5c2f14',
  pants:        '#2c3e66',
  skin:         '#f3c2a0',
  shoe:         '#3a2614',
  canGreen:     '#2e7d32',
  canDark:      '#1b5e20',
  textDark:     '#2a1f14',
  pot:          '#9b5b3b',
  potDark:      '#7a432a',
  leafBright:   '#4caf50',
  leafDark:     '#2e7d32',
  flowerPink:   '#ec4899',
}

// ── Wall geometry (re-uses the same approach as Floorplan3D) ─────────────────
// Returns solid wall segments after subtracting doorways (shared edges
// between rooms AND a forced entry in rooms that have none).

function computeGameWalls(rooms) {
  const eps = WALL_THICKNESS * 1.5
  const visible = (rooms || []).filter((r) => !r.hidden)

  const roomEdges = visible.map((r) => ([
    { axis: 'x', v: r.y,              a: r.x,           b: r.x + r.width  }, // north
    { axis: 'x', v: r.y + r.height,   a: r.x,           b: r.x + r.width  }, // south
    { axis: 'z', v: r.x,              a: r.y,           b: r.y + r.height }, // west
    { axis: 'z', v: r.x + r.width,    a: r.y,           b: r.y + r.height }, // east
  ]))

  const raw = []
  roomEdges.forEach((edges, idx) => {
    for (const e of edges) raw.push({ ...e, roomIdx: idx })
  })

  // Forced doors for rooms with no shared-edge ≥ DOOR_MIN
  const forced = []
  for (let idx = 0; idx < visible.length; idx++) {
    const edges = roomEdges[idx]
    let has = false
    for (const e of edges) {
      for (const o of raw) {
        if (o.roomIdx === idx) continue
        if (o.axis !== e.axis) continue
        if (Math.abs(o.v - e.v) > eps) continue
        const start = Math.max(e.a, o.a)
        const end = Math.min(e.b, o.b)
        if (end - start >= DOOR_MIN) { has = true; break }
      }
      if (has) break
    }
    if (!has) {
      const longest = edges.reduce((best, e) => (e.b - e.a) > (best.b - best.a) ? e : best)
      const wallLen = longest.b - longest.a
      const doorLen = Math.min(DOOR_MIN * 1.4, wallLen - 3)
      if (doorLen >= DOOR_MIN * 0.8) {
        const mid = (longest.a + longest.b) / 2
        forced.push({ axis: longest.axis, v: longest.v, a: mid - doorLen / 2, b: mid + doorLen / 2 })
      }
    }
  }

  const blockers = []
  for (const s of raw) {
    const doors = []
    for (const o of raw) {
      if (o === s) continue
      if (o.axis !== s.axis) continue
      if (Math.abs(o.v - s.v) > eps) continue
      const start = Math.max(s.a, o.a)
      const end = Math.min(s.b, o.b)
      if (end - start >= DOOR_MIN) doors.push([start, end])
    }
    for (const f of forced) {
      if (f.axis !== s.axis) continue
      if (Math.abs(f.v - s.v) > eps) continue
      const start = Math.max(s.a, f.a)
      const end = Math.min(s.b, f.b)
      if (end - start > 0.1) doors.push([start, end])
    }
    doors.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const d of doors) {
      if (merged.length && d[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], d[1])
      } else merged.push([...d])
    }
    let cursor = s.a
    for (const [a, b] of merged) {
      if (a > cursor) blockers.push({ axis: s.axis, v: s.v, a: cursor, b: a })
      cursor = Math.max(cursor, b)
    }
    if (cursor < s.b) blockers.push({ axis: s.axis, v: s.v, a: cursor, b: s.b })
  }

  const seen = new Set()
  const out = []
  for (const w of blockers) {
    const k = `${w.axis}:${w.v.toFixed(2)}:${w.a.toFixed(2)}:${w.b.toFixed(2)}`
    if (seen.has(k)) continue
    seen.add(k); out.push(w)
  }
  return out
}

// Circle-vs-AABB slide (same shape as the 3D version, in percent units)
function resolveCollision(x, y, walls, radius) {
  let nx = x, ny = y
  const t = WALL_THICKNESS / 2
  for (let pass = 0; pass < 2; pass++) {
    for (const w of walls) {
      let wMinX, wMaxX, wMinY, wMaxY
      if (w.axis === 'x') { wMinX = w.a; wMaxX = w.b; wMinY = w.v - t; wMaxY = w.v + t }
      else                 { wMinX = w.v - t; wMaxX = w.v + t; wMinY = w.a; wMaxY = w.b }
      const cx = Math.max(wMinX, Math.min(wMaxX, nx))
      const cy = Math.max(wMinY, Math.min(wMaxY, ny))
      const dx = nx - cx, dy = ny - cy
      const d2 = dx * dx + dy * dy
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2)
        if (d > 1e-4) {
          const push = radius - d
          nx += (dx / d) * push
          ny += (dy / d) * push
        } else if (w.axis === 'x') {
          ny += (ny < w.v ? -1 : 1) * (radius + t)
        } else {
          nx += (nx < w.v ? -1 : 1) * (radius + t)
        }
      }
    }
  }
  return [nx, ny]
}

// ── Sprite drawing ───────────────────────────────────────────────────────────

function drawGardener(ctx, x, y, facing, phase, pouring) {
  ctx.save()
  ctx.translate(x, y)
  const step = Math.sin(phase) * 2   // foot offset in pixels
  const bob = Math.abs(Math.sin(phase)) * 1

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(0, 24, 10, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Facing flip — character is drawn facing down by default; mirror for left/right.
  const flipX = facing === 'left' ? -1 : 1
  ctx.scale(flipX, 1)

  // Legs (pixel-ish rectangles)
  ctx.fillStyle = COLORS.pants
  ctx.fillRect(-6, 10 - bob, 5, 12 + step)
  ctx.fillRect(1,  10 - bob, 5, 12 - step)
  ctx.fillStyle = COLORS.shoe
  ctx.fillRect(-6, 22 - bob + step, 5, 3)
  ctx.fillRect(1,  22 - bob - step, 5, 3)

  // Body / shirt
  ctx.fillStyle = COLORS.shirt
  ctx.fillRect(-8, -4 - bob, 16, 15)
  // Backpack strap accent
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.fillRect(-8, -4 - bob, 16, 2)

  // Arms
  ctx.fillStyle = COLORS.skin
  ctx.fillRect(-10, 0 - bob, 3, 9)
  const armOutX = pouring ? 10 : 9
  const armOutY = pouring ? -4 - bob : 0 - bob
  ctx.fillRect(armOutX - 3, armOutY, 3, pouring ? 6 : 9)

  // Watering can in right hand
  ctx.save()
  ctx.translate(armOutX + 2, armOutY + (pouring ? 2 : 3))
  if (pouring) ctx.rotate(-0.6)
  ctx.fillStyle = COLORS.canGreen
  ctx.fillRect(0, 0, 10, 9)
  ctx.fillStyle = COLORS.canDark
  ctx.fillRect(9, 0, 5, 3)       // spout base
  ctx.fillRect(13, -1, 3, 3)     // spout tip
  ctx.fillRect(0, -1, 10, 1)     // rim
  // Handle arc
  ctx.strokeStyle = COLORS.canDark
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(5, 0, 5, Math.PI, 0)
  ctx.stroke()
  // Pouring water droplets
  if (pouring) {
    ctx.fillStyle = '#60a5fa'
    ctx.fillRect(16, 3, 1, 2)
    ctx.fillRect(17, 6, 1, 2)
    ctx.fillRect(18, 9, 1, 3)
  }
  ctx.restore()

  // Head (peach circle)
  ctx.fillStyle = COLORS.skin
  ctx.beginPath()
  ctx.arc(0, -10 - bob, 6, 0, Math.PI * 2)
  ctx.fill()

  // Hat
  ctx.fillStyle = COLORS.hat
  ctx.beginPath()
  ctx.ellipse(0, -14 - bob, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(-5, -17 - bob, 10, 4)
  ctx.fillStyle = COLORS.hatBand
  ctx.fillRect(-5, -14 - bob, 10, 1)

  // Eyes (only visible when facing down)
  if (facing === 'down') {
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(-3, -10 - bob, 1, 2)
    ctx.fillRect(2,  -10 - bob, 1, 2)
  } else if (facing === 'left' || facing === 'right') {
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(2,  -10 - bob, 2, 2)
  }
  ctx.restore()
}

function drawPlant(ctx, x, y, plant, color, time) {
  // Status ring on the ground
  ctx.fillStyle = color
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Shadow under pot
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 8, 9, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Pot (tapered trapezoid)
  ctx.fillStyle = COLORS.pot
  ctx.beginPath()
  ctx.moveTo(x - 8, y)
  ctx.lineTo(x + 8, y)
  ctx.lineTo(x + 6, y + 7)
  ctx.lineTo(x - 6, y + 7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = COLORS.potDark
  ctx.fillRect(x - 8, y - 2, 16, 2)

  // Leaves — a cluster of overlapping circles with slight sway
  const species = (plant.species || '').toLowerCase()
  const isCactus = /cactus|succulent|aloe/.test(species)
  const hasFlower = /flower|rose|orchid|lily|daisy|tulip|lavender/.test(species)
  const sway = Math.sin(time * 0.003 + x) * 1.2

  if (isCactus) {
    ctx.fillStyle = COLORS.leafDark
    ctx.fillRect(x - 4, y - 14, 8, 14)
    ctx.fillStyle = COLORS.leafBright
    ctx.fillRect(x - 3, y - 14, 2, 14)
    // spikes
    ctx.fillStyle = '#f3e5ab'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 5 + sway, y - 10 + i * 4, 1, 1)
      ctx.fillRect(x + 4 + sway, y - 12 + i * 4, 1, 1)
    }
  } else {
    ctx.fillStyle = COLORS.leafDark
    ctx.beginPath()
    ctx.ellipse(x - 4 + sway, y - 6, 6, 8, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x + 4 + sway, y - 7, 6, 8, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLORS.leafBright
    ctx.beginPath()
    ctx.ellipse(x + sway, y - 11, 5, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  if (hasFlower) {
    ctx.fillStyle = COLORS.flowerPink
    ctx.beginPath(); ctx.arc(x + sway, y - 14, 2.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fbbf24'
    ctx.fillRect(x + sway - 0.5, y - 14 - 0.5, 1, 1)
  }
}

function drawGrassTile(ctx, sx, sy, size, cam) {
  ctx.fillStyle = COLORS.grass
  ctx.fillRect(sx, sy, size, size)
  // Sprinkle darker tufts deterministically from world coord
  const wx = Math.floor((sx + cam.x) / 6)
  const wy = Math.floor((sy + cam.y) / 6)
  const h = (wx * 73856093) ^ (wy * 19349663)
  if ((h & 7) === 0) {
    ctx.fillStyle = COLORS.grassDark
    ctx.fillRect(sx + ((h >> 3) & 7), sy + ((h >> 6) & 7), 2, 2)
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export default function FloorplanGame({ floor, floors, plants, weather, onPlantClick }) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const { handleWaterPlant } = usePlantContext()

  const walls = useMemo(() => computeGameWalls(floor?.rooms || []), [floor])

  // Mutable per-frame state
  const stateRef = useRef({
    x: 50, y: 50, facing: 'down', phase: 0, pouringUntil: 0,
    keys: new Set(), joy: { x: 0, y: 0 }, waterPending: false,
  })

  const [nearest, setNearest] = useState(null)
  const [justWatered, setJustWatered] = useState(null)

  const waterPlant = useCallback((plant) => {
    if (!plant) return
    handleWaterPlant(plant.id)
    setJustWatered(plant.id)
    stateRef.current.pouringUntil = performance.now() + 700
    setTimeout(() => setJustWatered((id) => (id === plant.id ? null : id)), 1400)
  }, [handleWaterPlant])

  // Reset position when floor changes
  useEffect(() => {
    const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
    if (rooms.length) {
      let minX = 100, maxX = 0, minY = 100, maxY = 0
      for (const r of rooms) {
        minX = Math.min(minX, r.x)
        maxX = Math.max(maxX, r.x + r.width)
        minY = Math.min(minY, r.y)
        maxY = Math.max(maxY, r.y + r.height)
      }
      stateRef.current.x = (minX + maxX) / 2
      stateRef.current.y = (minY + maxY) / 2
    } else {
      stateRef.current.x = 50
      stateRef.current.y = 50
    }
    stateRef.current.facing = 'down'
    stateRef.current.phase = 0
  }, [floor?.id])

  // Keyboard input
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase()
      stateRef.current.keys.add(k)
      if (k === 'e' || k === ' ') { stateRef.current.waterPending = true; e.preventDefault() }
    }
    const up = (e) => stateRef.current.keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      stateRef.current.keys.clear()
    }
  }, [])

  // Touch joystick (same pattern as Floorplan3D)
  const joyKnobRef = useRef(null)
  const joyWrapRef = useRef(null)
  const joyActiveRef = useRef(false)
  const joyCenterRef = useRef({ x: 0, y: 0 })
  const JOY_R = 38

  const handleJoyStart = (cx, cy) => {
    if (!joyWrapRef.current) return
    const r = joyWrapRef.current.getBoundingClientRect()
    joyCenterRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    joyActiveRef.current = true
    handleJoyMove(cx, cy)
  }
  const handleJoyMove = (cx, cy) => {
    if (!joyActiveRef.current) return
    let dx = cx - joyCenterRef.current.x
    let dy = cy - joyCenterRef.current.y
    const m = Math.sqrt(dx * dx + dy * dy)
    if (m > JOY_R) { dx = dx * JOY_R / m; dy = dy * JOY_R / m }
    if (joyKnobRef.current) joyKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    stateRef.current.joy.x = dx / JOY_R
    stateRef.current.joy.y = dy / JOY_R
  }
  const resetJoy = () => {
    joyActiveRef.current = false
    stateRef.current.joy.x = 0
    stateRef.current.joy.y = 0
    if (joyKnobRef.current) joyKnobRef.current.style.transform = 'translate(0,0)'
  }

  const isTouch = typeof window !== 'undefined'
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let last = performance.now()
    let rafId = 0
    let running = true

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)

    const step = (now) => {
      if (!running) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const s = stateRef.current
      const keys = s.keys
      let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0)
                - (keys.has('a') || keys.has('arrowleft')  ? 1 : 0)
      let dy = (keys.has('s') || keys.has('arrowdown')  ? 1 : 0)
                - (keys.has('w') || keys.has('arrowup')    ? 1 : 0)
      dx += s.joy.x
      dy += s.joy.y
      const mag = Math.sqrt(dx * dx + dy * dy)
      const moving = mag > 0.08
      if (moving) {
        const clamped = Math.min(1, mag)
        dx = dx / (mag || 1) * clamped
        dy = dy / (mag || 1) * clamped
        let nx = s.x + dx * SPEED * dt
        let ny = s.y + dy * SPEED * dt
        // Clamp to world bounds with a small margin so you can't leave entirely
        nx = Math.max(-20, Math.min(120, nx))
        ny = Math.max(-20, Math.min(120, ny))
        ;[nx, ny] = resolveCollision(nx, ny, walls, PLAYER_RADIUS)
        s.x = nx; s.y = ny
        // Facing: dominant axis
        if (Math.abs(dx) > Math.abs(dy)) s.facing = dx > 0 ? 'right' : 'left'
        else s.facing = dy > 0 ? 'down' : 'up'
        s.phase += dt * 16
      } else {
        // Decay phase so legs come to rest
        s.phase = 0
      }

      // Nearest plant + water action
      let nearestPlant = null
      let nearestDist = Infinity
      for (const p of plants) {
        const pdx = p.x - s.x, pdy = p.y - s.y
        const d = Math.sqrt(pdx * pdx + pdy * pdy)
        if (d < nearestDist) { nearestDist = d; nearestPlant = p }
      }
      const inRange = nearestPlant && nearestDist <= WATER_RANGE
      setNearest((cur) => (cur === (inRange ? nearestPlant : null) ? cur : (inRange ? nearestPlant : null)))

      if (s.waterPending) {
        s.waterPending = false
        if (inRange) waterPlant(nearestPlant)
      }

      // ── Draw ──
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const cam = { x: s.x * TILE - w / 2, y: s.y * TILE - h / 2 }
      const worldToScreen = (wx, wy) => [wx * TILE - cam.x, wy * TILE - cam.y]

      // Grass background, tiled
      const gridSize = 16
      const sx0 = -((cam.x % gridSize) + gridSize) % gridSize
      const sy0 = -((cam.y % gridSize) + gridSize) % gridSize
      for (let gx = sx0; gx < w; gx += gridSize) {
        for (let gy = sy0; gy < h; gy += gridSize) {
          drawGrassTile(ctx, gx, gy, gridSize, cam)
        }
      }

      // Dirt path halo around rooms for "farm" vibe on indoor floors
      const rooms = (floor?.rooms || []).filter((r) => !r.hidden)
      if (rooms.length && floor?.type !== 'outdoor') {
        let minX = 100, maxX = 0, minY = 100, maxY = 0
        for (const r of rooms) {
          minX = Math.min(minX, r.x)
          maxX = Math.max(maxX, r.x + r.width)
          minY = Math.min(minY, r.y)
          maxY = Math.max(maxY, r.y + r.height)
        }
        const pad = 3
        const [hx, hy] = worldToScreen(minX - pad, minY - pad)
        ctx.fillStyle = COLORS.dirt
        ctx.fillRect(hx, hy, (maxX - minX + 2 * pad) * TILE, (maxY - minY + 2 * pad) * TILE)
      }

      // Rooms — floor + walls
      for (const r of rooms) {
        const [rx, ry] = worldToScreen(r.x, r.y)
        const rw = r.width * TILE
        const rh = r.height * TILE
        // floor
        const isOutdoorRoom = r.type === 'outdoor' || floor?.type === 'outdoor'
        ctx.fillStyle = isOutdoorRoom ? COLORS.grass : COLORS.floorIndoor
        ctx.fillRect(rx, ry, rw, rh)
        // subtle tile pattern
        if (!isOutdoorRoom) {
          ctx.strokeStyle = COLORS.floorTile
          ctx.lineWidth = 1
          for (let gx = rx + 20; gx < rx + rw; gx += 20) {
            ctx.beginPath(); ctx.moveTo(gx, ry); ctx.lineTo(gx, ry + rh); ctx.stroke()
          }
          for (let gy = ry + 20; gy < ry + rh; gy += 20) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw, gy); ctx.stroke()
          }
        }
      }

      // Walls on top of floors (drawn per segment so doorways are visible gaps)
      for (const wall of walls) {
        const t = (WALL_THICKNESS / 2) * TILE
        if (wall.axis === 'x') {
          const [sx, sy] = worldToScreen(wall.a, wall.v)
          ctx.fillStyle = COLORS.wall
          ctx.fillRect(sx, sy - t, (wall.b - wall.a) * TILE, t * 2)
          ctx.fillStyle = COLORS.wallTop
          ctx.fillRect(sx, sy - t, (wall.b - wall.a) * TILE, 2)
        } else {
          const [sx, sy] = worldToScreen(wall.v, wall.a)
          ctx.fillStyle = COLORS.wall
          ctx.fillRect(sx - t, sy, t * 2, (wall.b - wall.a) * TILE)
          ctx.fillStyle = COLORS.wallTop
          ctx.fillRect(sx - t, sy, t * 2, 2)
        }
      }

      // Room labels (drawn after walls, inside the floor)
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.fillStyle = COLORS.roomLabel
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const r of rooms) {
        const [cx, cy] = worldToScreen(r.x + r.width / 2, r.y + 2)
        ctx.fillText((r.name || '').toUpperCase(), cx, cy)
      }
      ctx.textAlign = 'start'
      ctx.textBaseline = 'alphabetic'

      // Depth-sorted sprites: gardener + plants, back-to-front
      const sprites = []
      for (const p of plants) {
        sprites.push({ kind: 'plant', wy: p.y, data: p })
      }
      sprites.push({ kind: 'player', wy: s.y })
      sprites.sort((a, b) => a.wy - b.wy)

      const pouring = performance.now() < s.pouringUntil
      for (const sp of sprites) {
        if (sp.kind === 'plant') {
          const p = sp.data
          const [px, py] = worldToScreen(p.x, p.y)
          const { color } = getWateringStatus(p, weather, floors)
          drawPlant(ctx, px, py, p, color, now)
        } else {
          const [px, py] = worldToScreen(s.x, s.y)
          drawGardener(ctx, px, py, s.facing, s.phase, pouring)
        }
      }

      rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [walls, plants, weather, floors, floor, waterPlant])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: COLORS.grassDark }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />

      {/* Top-right legend */}
      <div
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 3,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, lineHeight: 1.4,
          fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
          maxWidth: 220,
        }}
      >
        <div><strong>WASD / arrows</strong> — move</div>
        <div><strong>Space</strong> or <strong>E</strong> — water nearest plant</div>
      </div>

      {/* Bottom-centre prompt */}
      <div
        style={{
          position: 'absolute', bottom: isTouch ? 140 : 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, padding: '10px 16px', borderRadius: 999,
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

      {/* Mobile controls */}
      {isTouch && (
        <>
          <div
            ref={joyWrapRef}
            onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; handleJoyStart(t.clientX, t.clientY) }}
            onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; handleJoyMove(t.clientX, t.clientY) }}
            onTouchEnd={resetJoy}
            onTouchCancel={resetJoy}
            style={{
              position: 'absolute', bottom: 20, left: 20, zIndex: 4,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.5)',
              touchAction: 'none', userSelect: 'none',
            }}
          >
            <div
              ref={joyKnobRef}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 40, height: 40, marginTop: -20, marginLeft: -20,
                borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => nearest && waterPlant(nearest)}
            disabled={!nearest}
            style={{
              position: 'absolute', bottom: 28, right: 20, zIndex: 4,
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
    </div>
  )
}
