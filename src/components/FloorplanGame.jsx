import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { usePlantContext } from '../context/PlantContext.jsx'
import { getWateringStatus } from '../utils/watering.js'

// ── World constants ──────────────────────────────────────────────────────────
// The game world uses percent coordinates (same as plant.x/y and room bounds).
// Camera maps percent → pixels with a tile size, centred on the gardener.

const TILE_DEFAULT = 12          // px per percent unit (world → screen) — starts zoomed out
const TILE_MIN = 6
const TILE_MAX = 36
const PLAYER_RADIUS = 2.4        // percent — also used for wall collision
const WALL_THICKNESS = 1.5       // percent
const DOOR_MIN = 5               // percent — min shared edge that counts as a doorway
const WATER_RANGE = 7            // percent — distance you must be within to water
const SPEED = 55                 // percent per second
// Scale the whole floorplan toward its centroid so rooms pack closer together
// and the gardener doesn't have to walk across half the lot to reach a plant.
const CONDENSE_FACTOR = 0.4
// Sprite scale — bumped so the gardener and plants read as ¼-ish of a
// condensed room (Stardew-ish proportions) instead of pebbles on a mansion floor.
const SPRITE_SCALE = 2.5

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

// Shrink every room (and every plant inside) toward the overall layout
// centroid by `factor`. With factor < 1 the whole scene is tighter, so the
// gardener has to walk less to get from one plant to the next.
function condenseLayout(rooms, plants, factor) {
  const visible = (rooms || []).filter((r) => !r.hidden)
  if (!visible.length || factor === 1) return { rooms, plants }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const r of visible) {
    minX = Math.min(minX, r.x)
    maxX = Math.max(maxX, r.x + r.width)
    minY = Math.min(minY, r.y)
    maxY = Math.max(maxY, r.y + r.height)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const shrinkRoom = (r) => r.hidden ? r : ({
    ...r,
    x: (r.x - cx) * factor + cx,
    y: (r.y - cy) * factor + cy,
    width: r.width * factor,
    height: r.height * factor,
  })
  const shrinkPlant = (p) => ({
    ...p,
    x: (p.x - cx) * factor + cx,
    y: (p.y - cy) * factor + cy,
  })

  return {
    rooms: (rooms || []).map(shrinkRoom),
    plants: (plants || []).map(shrinkPlant),
  }
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

// ── Wildlife (butterflies, bees, birds) ──────────────────────────────────────

const FLOWER_RE = /flower|rose|orchid|lily|daisy|tulip|lavender/

function pickFlowerTarget(plants) {
  if (!plants?.length) return null
  const flowers = plants.filter((p) => FLOWER_RE.test((p.species || '').toLowerCase()))
  const pool = flowers.length ? flowers : plants
  return pool[Math.floor(Math.random() * pool.length)]
}

function spawnButterfly(plants) {
  const target = pickFlowerTarget(plants)
  if (!target) return null
  return {
    type: 'butterfly',
    x: target.x + (Math.random() - 0.5) * 12,
    y: target.y + (Math.random() - 0.5) * 12,
    color: ['#ffffff', '#fbbf24', '#93c5fd', '#f9a8d4'][Math.floor(Math.random() * 4)],
    target,
    phase: Math.random() * Math.PI * 2,
    speed: 5 + Math.random() * 5,    // percent/sec
    retargetAt: 0,
  }
}

function spawnBee(plants) {
  const target = plants[Math.floor(Math.random() * plants.length)]
  if (!target) return null
  return {
    type: 'bee',
    x: target.x,
    y: target.y,
    target,
    phase: Math.random() * Math.PI * 2,
    orbitR: 3 + Math.random() * 2,
    retargetAt: 0,
  }
}

function spawnBird(canvasW, canvasH) {
  const leftToRight = Math.random() < 0.5
  return {
    type: 'bird',
    screenSpace: true,
    screenX: leftToRight ? -40 : canvasW + 40,
    screenY: 30 + Math.random() * Math.min(140, canvasH * 0.3),
    speed: (leftToRight ? 1 : -1) * (90 + Math.random() * 60),
    phase: Math.random() * Math.PI * 2,
  }
}

function updateWildlife(list, dt, plants, canvasW, canvasH, isOutdoor, birdNextRef, timeMs) {
  // Top up populations
  const butterflies = list.filter((w) => w.type === 'butterfly')
  const bees = list.filter((w) => w.type === 'bee')
  const birds = list.filter((w) => w.type === 'bird')

  while (butterflies.length < 3) {
    const b = spawnButterfly(plants); if (!b) break
    list.push(b); butterflies.push(b)
  }
  if (isOutdoor) {
    while (bees.length < 2) {
      const b = spawnBee(plants); if (!b) break
      list.push(b); bees.push(b)
    }
    if (timeMs > birdNextRef.current && birds.length === 0) {
      list.push(spawnBird(canvasW, canvasH))
      birdNextRef.current = timeMs + 25000 + Math.random() * 20000
    }
  } else {
    // Despawn bees/birds when floor is indoor
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].type === 'bee' || list[i].type === 'bird') list.splice(i, 1)
    }
  }

  const tSec = timeMs / 1000
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i]
    if (c.type === 'butterfly') {
      if (!c.target || tSec > c.retargetAt) {
        c.target = pickFlowerTarget(plants)
        c.retargetAt = tSec + 4 + Math.random() * 3
      }
      if (!c.target) { list.splice(i, 1); continue }
      const dx = c.target.x - c.x
      const dy = c.target.y - c.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      c.x += (dx / d) * c.speed * dt + Math.sin(tSec * 3 + c.phase) * 2 * dt
      c.y += (dy / d) * c.speed * dt + Math.cos(tSec * 2.5 + c.phase) * 2 * dt
      c.phase += dt * 3
    } else if (c.type === 'bee') {
      if (!c.target || tSec > c.retargetAt) {
        c.target = plants[Math.floor(Math.random() * plants.length)]
        c.retargetAt = tSec + 3 + Math.random() * 4
      }
      if (!c.target) { list.splice(i, 1); continue }
      c.phase += dt * 3.5
      c.x = c.target.x + Math.cos(c.phase) * c.orbitR + Math.sin(tSec * 9) * 0.6
      c.y = c.target.y + Math.sin(c.phase * 1.2) * (c.orbitR * 0.6) + Math.cos(tSec * 11) * 0.6
    } else if (c.type === 'bird') {
      c.screenX += c.speed * dt
      c.phase += dt * 6
      if (c.screenX < -80 || c.screenX > canvasW + 80) list.splice(i, 1)
    }
  }
}

function drawWildlife(ctx, list, worldToScreen, timeMs) {
  const t = timeMs / 1000
  for (const c of list) {
    if (c.type === 'bird') {
      const flap = Math.sin(c.phase)
      ctx.save()
      ctx.translate(c.screenX, c.screenY)
      if (c.speed < 0) ctx.scale(-1, 1)
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-8, 3 + flap * 3)
      ctx.lineTo(0, -2 + flap * -1)
      ctx.lineTo(8, 3 + flap * 3)
      ctx.stroke()
      ctx.restore()
      continue
    }
    const [sx, sy] = worldToScreen(c.x, c.y)
    ctx.save()
    ctx.translate(sx, sy)
    if (c.type === 'butterfly') {
      const flap = Math.sin(t * 14 + c.phase)
      const wingW = 3 + Math.abs(flap) * 3
      ctx.fillStyle = c.color
      ctx.beginPath(); ctx.ellipse(-3, 0, wingW, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse( 3, 0, wingW, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-0.5, -3, 1, 6)
    } else if (c.type === 'bee') {
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-2, -3, 1, 6)
      ctx.fillRect( 1, -3, 1, 6)
      const wingFlap = 2 + Math.abs(Math.sin(t * 24)) * 2
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath(); ctx.ellipse(0, -2, wingFlap, 1.4, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

// ── Minimap + waypoint ───────────────────────────────────────────────────────

const MINIMAP_SIZE = 120

// Draws a small overview in the top-left corner. Scales the condensed
// layout to fit in a fixed-size square, overlays plant dots by urgency
// colour, and a white triangle for the player's facing.
function drawMinimap(ctx, gameRooms, gamePlants, weather, floors, player, topOffset) {
  const visible = (gameRooms || []).filter((r) => !r.hidden)
  if (!visible.length) return
  const mx = 10, my = topOffset, ms = MINIMAP_SIZE

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const r of visible) {
    minX = Math.min(minX, r.x)
    maxX = Math.max(maxX, r.x + r.width)
    minY = Math.min(minY, r.y)
    maxY = Math.max(maxY, r.y + r.height)
  }
  minX = Math.min(minX, player.x); maxX = Math.max(maxX, player.x)
  minY = Math.min(minY, player.y); maxY = Math.max(maxY, player.y)
  const w2 = Math.max(1, maxX - minX)
  const h2 = Math.max(1, maxY - minY)
  const pad = 6
  const sc = Math.min((ms - pad * 2) / w2, (ms - pad * 2) / h2)
  const offX = mx + (ms - w2 * sc) / 2
  const offY = my + (ms - h2 * sc) / 2
  const toMap = (wx, wy) => [offX + (wx - minX) * sc, offY + (wy - minY) * sc]

  ctx.save()
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(mx - 2, my - 2, ms + 4, ms + 4)
  ctx.fillStyle = 'rgba(127,182,133,0.5)'
  ctx.fillRect(mx, my, ms, ms)

  // Rooms
  ctx.strokeStyle = 'rgba(122,90,61,0.85)'
  ctx.lineWidth = 1
  for (const r of visible) {
    const [x1, y1] = toMap(r.x, r.y)
    const [x2, y2] = toMap(r.x + r.width, r.y + r.height)
    ctx.fillStyle = 'rgba(230,213,185,0.85)'
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  }

  // Plant dots — urgency colour
  for (const p of gamePlants || []) {
    const [px, py] = toMap(p.x, p.y)
    const { color } = getWateringStatus(p, weather, floors)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill()
  }

  // Player triangle, rotated to facing
  const [ax, ay] = toMap(player.x, player.y)
  const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[player.facing] || 0
  ctx.translate(ax, ay)
  ctx.rotate(rot)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(-4, 4)
  ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(mx + 0.5, my + 0.5, ms - 1, ms - 1)
  ctx.restore()
}

// Find the single most-overdue plant (most negative daysUntil) so we can
// point a waypoint at it. Returns null if nothing is overdue.
function findMostOverdue(plants, weather, floors) {
  let worst = null
  let worstDays = 0
  for (const p of plants) {
    const { daysUntil } = getWateringStatus(p, weather, floors)
    if (daysUntil < worstDays) { worstDays = daysUntil; worst = p }
  }
  return worst
}

// Either draws a yellow chevron above the target (if visible) or clamps it
// to the viewport edge pointing toward it.
function drawWaypoint(ctx, canvasW, canvasH, target, player, tile) {
  if (!target) return
  const cam = { x: player.x * tile - canvasW / 2, y: player.y * tile - canvasH / 2 }
  const sx = target.x * tile - cam.x
  const sy = target.y * tile - cam.y
  const MARGIN = 30

  const inView = sx > MARGIN && sx < canvasW - MARGIN && sy > MARGIN && sy < canvasH - MARGIN
  ctx.save()
  if (inView) {
    ctx.translate(sx, sy - 48)
    // Pulse
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.1
    ctx.scale(pulse, pulse)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-10, -6); ctx.lineTo(10, -6); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-8, -4); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill()
  } else {
    // Off-screen — clamp to edge + rotate to face target
    const cx = canvasW / 2, cy = canvasH / 2
    const dx = sx - cx, dy = sy - cy
    const angle = Math.atan2(dy, dx)
    const ex = cx + Math.cos(angle) * Math.min(cx - MARGIN, Math.max(-(cx - MARGIN), dx))
    const ey = cy + Math.sin(angle) * Math.min(cy - MARGIN, Math.max(-(cy - MARGIN), dy))
    // Clamp to rect edge
    const tScale = Math.min((cx - MARGIN) / Math.max(0.001, Math.abs(dx)),
                            (cy - MARGIN) / Math.max(0.001, Math.abs(dy)))
    const edgeX = cx + dx * tScale
    const edgeY = cy + dy * tScale
    ctx.translate(edgeX, edgeY)
    ctx.rotate(angle + Math.PI / 2)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-11, 9); ctx.lineTo(11, 9); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-9, 7); ctx.lineTo(9, 7); ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

// ── Sprite drawing ───────────────────────────────────────────────────────────

const TOOLS = {
  water:     { emoji: '💧', label: 'water',     verb: 'Water',     main: '#16a34a', dark: '#14532d', accent: '#60a5fa' },
  prune:     { emoji: '✂️', label: 'prune',     verb: 'Prune',     main: '#dc2626', dark: '#7f1d1d', accent: '#f87171' },
  fertilise: { emoji: '🌱', label: 'fertilise', verb: 'Fertilise', main: '#8b5a2b', dark: '#45260f', accent: '#fbbf24' },
}
const TOOL_ORDER = ['water', 'prune', 'fertilise']

function drawGardener(ctx, x, y, facing, phase, pouring, tool = 'water') {
  const tc = TOOLS[tool] || TOOLS.water
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE)
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

  // Tool in right hand — shape depends on selected tool
  ctx.save()
  ctx.translate(armOutX + 2, armOutY + (pouring ? 2 : 3))
  if (pouring) ctx.rotate(-0.6)
  if (tool === 'prune') {
    // Pruning shears: two crossed blades
    ctx.fillStyle = tc.main
    ctx.fillRect(0, 2, 3, 3)       // handle ring 1
    ctx.fillRect(0, -3, 3, 3)      // handle ring 2
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(3, -1, 9, 1)
    ctx.fillRect(3,  1, 9, 1)
    ctx.fillStyle = tc.dark
    ctx.fillRect(12, -1, 2, 3)     // pivot
  } else if (tool === 'fertilise') {
    // Feed bag: rounded sack with tie at top
    ctx.fillStyle = tc.main
    ctx.fillRect(0, 0, 10, 9)
    ctx.fillStyle = tc.dark
    ctx.fillRect(0, -1, 10, 2)
    ctx.fillStyle = tc.accent
    ctx.fillRect(3, 3, 4, 4)       // pellet window
  } else {
    // Watering can (default)
    ctx.fillStyle = tc.main
    ctx.fillRect(0, 0, 10, 9)
    ctx.fillStyle = tc.dark
    ctx.fillRect(9, 0, 5, 3)       // spout base
    ctx.fillRect(13, -1, 3, 3)     // spout tip
    ctx.fillRect(0, -1, 10, 1)     // rim
    ctx.strokeStyle = tc.dark
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(5, 0, 5, Math.PI, 0)
    ctx.stroke()
  }
  // Pouring particles — water droplets / leaf tips / pellets
  if (pouring) {
    ctx.fillStyle = tc.accent
    if (tool === 'prune') {
      ctx.fillRect(14, -3, 1, 1)
      ctx.fillRect(15, -1, 1, 1)
    } else if (tool === 'fertilise') {
      ctx.fillRect(11, 3, 1, 1)
      ctx.fillRect(12, 5, 1, 1)
      ctx.fillRect(10, 7, 1, 1)
    } else {
      ctx.fillRect(16, 3, 1, 2)
      ctx.fillRect(17, 6, 1, 2)
      ctx.fillRect(18, 9, 1, 3)
    }
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

// Growth stage derived from watering history. New plants start as sprouts;
// with more watering-log entries they mature; well-cared-for flowering
// species eventually bloom.
function getGrowthStage(plant) {
  const count = (plant.wateringLog || []).length
  const species = (plant.species || '').toLowerCase()
  const flowering = /flower|rose|orchid|lily|daisy|tulip|lavender/.test(species)
  if (count < 4)  return 'sprout'
  if (count < 11) return 'young'
  if (count < 31) return 'mature'
  return flowering ? 'blooming' : 'mature'
}

// Plant is 'withered' when it's been overdue for more than 2× its frequency.
function isWithered(plant) {
  if (!plant.lastWatered || !plant.frequencyDays) return false
  const daysSince = (Date.now() - new Date(plant.lastWatered).getTime()) / 86400000
  return daysSince > plant.frequencyDays * 2
}

function drawPlant(ctx, x, y, plant, color, time) {
  // Capture a stable per-plant sway offset before overwriting local coords
  const swayPhase = (plant.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const stage = getGrowthStage(plant)
  const withered = isWithered(plant)

  // Size multiplier for the plant's foliage by stage — pot stays similar so
  // early-stage plants look like they've just been potted.
  const foliageScale = stage === 'sprout' ? 0.35
                     : stage === 'young'  ? 0.7
                     : 1.0
  const potShrink = stage === 'sprout' ? 0.75 : 1.0
  // Withered plants lean, desaturate, and shrink slightly.
  const witherTilt = withered ? (swayPhase % 2 ? 0.18 : -0.18) : 0
  const witherAlpha = withered ? 0.72 : 1.0

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE)
  // From here on, the drawing code uses local coords around 0,0.
  x = 0; y = 0
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
  ctx.ellipse(x, y + 8, 9 * potShrink, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Pot (tapered trapezoid). Sprouts get a smaller starter pot.
  const pw = 8 * potShrink, pb = 6 * potShrink
  ctx.fillStyle = COLORS.pot
  ctx.beginPath()
  ctx.moveTo(x - pw, y)
  ctx.lineTo(x + pw, y)
  ctx.lineTo(x + pb, y + 7)
  ctx.lineTo(x - pb, y + 7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = COLORS.potDark
  ctx.fillRect(x - pw, y - 2, pw * 2, 2)

  // Foliage + flowers — branch by stage. Withered overrides tilt/alpha.
  const species = (plant.species || '').toLowerCase()
  const isCactus = /cactus|succulent|aloe/.test(species)
  const sway = Math.sin(time * 0.003 + swayPhase) * 1.2
  const totalTilt = sway * 0.04 + witherTilt

  ctx.save()
  ctx.translate(0, y)
  if (totalTilt) ctx.rotate(totalTilt)
  ctx.globalAlpha = witherAlpha
  const leafDark = withered ? '#6b7d5a' : COLORS.leafDark
  const leafBright = withered ? '#8ba376' : COLORS.leafBright

  if (stage === 'sprout') {
    // Tiny single sprig — a stem + two tear-shaped leaves.
    ctx.strokeStyle = leafDark
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(sway, -4, 0, -6)
    ctx.stroke()
    ctx.fillStyle = leafBright
    ctx.beginPath(); ctx.ellipse(-2 + sway, -4, 2, 3, -0.5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse( 2 + sway, -5, 2, 3,  0.5, 0, Math.PI * 2); ctx.fill()
  } else if (isCactus) {
    const h = 14 * foliageScale
    ctx.fillStyle = leafDark
    ctx.fillRect(-4 * foliageScale, -h, 8 * foliageScale, h)
    ctx.fillStyle = leafBright
    ctx.fillRect(-3 * foliageScale, -h, 2 * foliageScale, h)
    ctx.fillStyle = '#f3e5ab'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-5 * foliageScale + sway, -10 * foliageScale + i * 4, 1, 1)
      ctx.fillRect( 4 * foliageScale + sway, -12 * foliageScale + i * 4, 1, 1)
    }
  } else {
    const s = foliageScale
    ctx.fillStyle = leafDark
    ctx.beginPath()
    ctx.ellipse(-4 * s + sway, -6 * s, 6 * s, 8 * s, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse( 4 * s + sway, -7 * s, 6 * s, 8 * s,  0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = leafBright
    ctx.beginPath()
    ctx.ellipse(0 + sway, -11 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Flowers — single bud for mature flowering species, triple for blooming
  const hasFlower = /flower|rose|orchid|lily|daisy|tulip|lavender/.test(species)
  if (hasFlower && !withered && stage !== 'sprout') {
    const buds = stage === 'blooming'
      ? [{ x: -5 + sway, y: -13 * foliageScale },
         { x:  5 + sway, y: -13 * foliageScale },
         { x:  0 + sway, y: -16 * foliageScale }]
      : [{ x: 0 + sway, y: -14 * foliageScale }]
    ctx.fillStyle = COLORS.flowerPink
    for (const b of buds) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#fbbf24'
    for (const b of buds) ctx.fillRect(b.x - 0.5, b.y - 0.5, 1, 1)
  }
  ctx.restore()
  ctx.restore()
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

  // Apply the condense transform once per floor/plants change and reuse the
  // shrunk world everywhere downstream (walls, rendering, collision).
  const { rooms: gameRooms, plants: gamePlants } = useMemo(
    () => condenseLayout(floor?.rooms || [], plants || [], CONDENSE_FACTOR),
    [floor, plants],
  )
  const walls = useMemo(() => computeGameWalls(gameRooms), [gameRooms])

  // Zoom — TILE is mutable via scroll wheel / +/- buttons. Using a ref so
  // the canvas loop reads the latest value each frame without re-renders.
  const tileRef = useRef(TILE_DEFAULT)

  // Mutable per-frame state
  const stateRef = useRef({
    x: 50, y: 50, facing: 'down', phase: 0, pouringUntil: 0,
    keys: new Set(), joy: { x: 0, y: 0 }, waterPending: false,
  })

  const [nearest, setNearest] = useState(null)
  const [actionFlash, setActionFlash] = useState(null)   // { tool, plantId } | null
  const [tool, setTool] = useState('water')
  const toolRef = useRef('water')
  useEffect(() => { toolRef.current = tool }, [tool])

  // Lightweight progression — localStorage only, no Firestore.
  const [stats, setStats] = useState(() => {
    try {
      const raw = localStorage.getItem('plantTracker_gameStats')
      if (raw) return { xp: 0, coins: 0, streakDays: 0, lastPlayDate: null, ...JSON.parse(raw) }
    } catch {}
    return { xp: 0, coins: 0, streakDays: 0, lastPlayDate: null }
  })
  useEffect(() => {
    try { localStorage.setItem('plantTracker_gameStats', JSON.stringify(stats)) } catch {}
  }, [stats])

  // Floating '+X XP' pops that rise above watered plants
  const [xpPops, setXpPops] = useState([])
  const xpPopsRef = useRef([])
  useEffect(() => { xpPopsRef.current = xpPops }, [xpPops])

  // Minimap + waypoint — on by default, persisted
  const [showMap, setShowMap] = useState(() => {
    try { return localStorage.getItem('plantTracker_gameMap') !== '0' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('plantTracker_gameMap', showMap ? '1' : '0') } catch {}
  }, [showMap])
  const showMapRef = useRef(showMap)
  useEffect(() => { showMapRef.current = showMap }, [showMap])

  // Wildlife — butterflies/bees follow plants; birds fly across outdoor views
  const wildlifeRef = useRef([])
  const birdNextRef = useRef(0)

  // Perform the selected tool's action on the targeted plant. Water hits the
  // real backend and awards XP + coins; prune/fertilise are client-only.
  const performAction = useCallback((plant) => {
    if (!plant) return
    const t = toolRef.current

    if (t === 'water') {
      // Read pre-water urgency so we can reward clearing an overdue plant.
      const pre = getWateringStatus(plant, weather, floors)
      const wasOverdue = pre.daysUntil < 0

      handleWaterPlant(plant.id)

      const today = new Date().toISOString().slice(0, 10)
      const ydate = new Date(); ydate.setDate(ydate.getDate() - 1)
      const yesterday = ydate.toISOString().slice(0, 10)
      const amount = 10
      setStats((s) => {
        let streakDays = s.streakDays
        let lastPlayDate = s.lastPlayDate
        if (lastPlayDate !== today) {
          streakDays = lastPlayDate === yesterday ? streakDays + 1 : 1
          lastPlayDate = today
        }
        return {
          xp: s.xp + amount,
          coins: s.coins + 2 + (wasOverdue ? 20 : 0),
          streakDays,
          lastPlayDate,
        }
      })
      const popId = `xp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setXpPops((p) => [...p, { id: popId, plantId: plant.id, amount, at: performance.now(), bonus: wasOverdue }])
      setTimeout(() => setXpPops((p) => p.filter((x) => x.id !== popId)), 1500)
    }

    stateRef.current.pouringUntil = performance.now() + 700
    const key = plant.id + ':' + performance.now()
    setActionFlash({ tool: t, plantId: plant.id, key })
    setTimeout(() => setActionFlash((cur) => (cur?.key === key ? null : cur)), 1400)
  }, [handleWaterPlant, weather, floors])

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

  // Scroll-wheel zoom
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      tileRef.current = Math.max(TILE_MIN, Math.min(TILE_MAX, tileRef.current - e.deltaY * 0.03))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = useCallback((delta) => {
    tileRef.current = Math.max(TILE_MIN, Math.min(TILE_MAX, tileRef.current + delta))
  }, [])

  // Keyboard input
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase()
      stateRef.current.keys.add(k)
      if (k === 'e' || k === ' ') { stateRef.current.waterPending = true; e.preventDefault() }
      if (k === '1') setTool('water')
      if (k === '2') setTool('prune')
      if (k === '3') setTool('fertilise')
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

      // Nearest plant + water action (operates on condensed positions)
      let nearestPlant = null
      let nearestDist = Infinity
      for (const p of gamePlants) {
        const pdx = p.x - s.x, pdy = p.y - s.y
        const d = Math.sqrt(pdx * pdx + pdy * pdy)
        if (d < nearestDist) { nearestDist = d; nearestPlant = p }
      }
      const inRange = nearestPlant && nearestDist <= WATER_RANGE
      setNearest((cur) => (cur === (inRange ? nearestPlant : null) ? cur : (inRange ? nearestPlant : null)))

      if (s.waterPending) {
        s.waterPending = false
        if (inRange) performAction(nearestPlant)
      }

      // ── Draw ──
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const tile = tileRef.current
      const cam = { x: s.x * tile - w / 2, y: s.y * tile - h / 2 }
      const worldToScreen = (wx, wy) => [wx * tile - cam.x, wy * tile - cam.y]

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
      const rooms = (gameRooms || []).filter((r) => !r.hidden)
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
        ctx.fillRect(hx, hy, (maxX - minX + 2 * pad) * tile, (maxY - minY + 2 * pad) * tile)
      }

      // Rooms — floor + walls
      for (const r of rooms) {
        const [rx, ry] = worldToScreen(r.x, r.y)
        const rw = r.width * tile
        const rh = r.height * tile
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
        const t = (WALL_THICKNESS / 2) * tile
        if (wall.axis === 'x') {
          const [sx, sy] = worldToScreen(wall.a, wall.v)
          ctx.fillStyle = COLORS.wall
          ctx.fillRect(sx, sy - t, (wall.b - wall.a) * tile, t * 2)
          ctx.fillStyle = COLORS.wallTop
          ctx.fillRect(sx, sy - t, (wall.b - wall.a) * tile, 2)
        } else {
          const [sx, sy] = worldToScreen(wall.v, wall.a)
          ctx.fillStyle = COLORS.wall
          ctx.fillRect(sx - t, sy, t * 2, (wall.b - wall.a) * tile)
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
      for (const p of gamePlants) {
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
          drawGardener(ctx, px, py, s.facing, s.phase, pouring, toolRef.current)
        }
      }

      // Wildlife — update + draw (skip during rain/storm or when tab hidden)
      const sky = weather?.current?.condition?.sky
      const allowWildlife = sky !== 'rainy' && sky !== 'stormy' && document.visibilityState === 'visible'
      if (allowWildlife && gamePlants.length) {
        const isOutdoor = floor?.type === 'outdoor' || (gameRooms || []).some((r) => r.type === 'outdoor')
        updateWildlife(wildlifeRef.current, dt, gamePlants, w, h, isOutdoor, birdNextRef, now)
        drawWildlife(ctx, wildlifeRef.current, worldToScreen, now)
      } else if (wildlifeRef.current.length) {
        wildlifeRef.current = []
      }

      // Waypoint + minimap overlay — only when enabled
      if (showMapRef.current) {
        const overdue = findMostOverdue(gamePlants, weather, floors)
        drawWaypoint(ctx, w, h, overdue, s, tile)
        // Position minimap below the stats pill (~48 px top offset)
        drawMinimap(ctx, gameRooms, gamePlants, weather, floors, s, 48)
      }

      // Floating "+10 XP" pops — drawn over everything so they read on any floor
      if (xpPopsRef.current.length) {
        ctx.font = '700 14px system-ui, sans-serif'
        ctx.textAlign = 'center'
        for (const pop of xpPopsRef.current) {
          const p = gamePlants.find((pp) => pp.id === pop.plantId)
          if (!p) continue
          const age = (performance.now() - pop.at) / 1500
          if (age < 0 || age > 1) continue
          const [sx, sy] = worldToScreen(p.x, p.y)
          const ty = sy - 34 - age * 36
          ctx.globalAlpha = Math.max(0, 1 - age)
          // Shadow for readability
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillText(`+${pop.amount} XP`, sx + 1, ty + 1)
          ctx.fillStyle = pop.bonus ? '#fbbf24' : '#34d399'
          ctx.fillText(`+${pop.amount} XP`, sx, ty)
          if (pop.bonus) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillText('+20 🪙', sx + 1, ty + 17)
            ctx.fillStyle = '#fbbf24'
            ctx.fillText('+20 🪙', sx, ty + 16)
          }
        }
        ctx.globalAlpha = 1
        ctx.textAlign = 'start'
      }

      rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [walls, gameRooms, gamePlants, weather, floors, floor, performAction])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: COLORS.grassDark }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />

      {/* Top-left stats — coins · XP · streak (localStorage only) */}
      <div
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 3,
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        <span title="Coins">🪙 {stats.coins}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span title="Experience">⭐ {stats.xp}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span title={`${stats.streakDays}-day streak`}>🔥 {stats.streakDays}</span>
      </div>

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
        <div><strong>Space</strong> or <strong>E</strong> — use selected tool</div>
        <div><strong>1 / 2 / 3</strong> — pick water / prune / fertilise</div>
        <div><strong>Scroll</strong> or +/− — zoom</div>
      </div>

      {/* Zoom buttons (work on both desktop + touch) */}
      <div
        style={{
          position: 'absolute', top: 74, right: 10, zIndex: 3,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}
      >
        <button
          type="button"
          onClick={() => zoomBy(3)}
          title="Zoom in"
          style={{
            width: 34, height: 34, borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)',
            background: '#fff', color: '#2a1f14', fontSize: 18, lineHeight: 1,
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >+</button>
        <button
          type="button"
          onClick={() => zoomBy(-3)}
          title="Zoom out"
          style={{
            width: 34, height: 34, borderRadius: 6, border: '1px solid rgba(0,0,0,0.15)',
            background: '#fff', color: '#2a1f14', fontSize: 18, lineHeight: 1,
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >−</button>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          title={showMap ? 'Hide minimap' : 'Show minimap'}
          style={{
            width: 34, height: 34, borderRadius: 6,
            border: showMap ? '2px solid #fbbf24' : '1px solid rgba(0,0,0,0.15)',
            background: '#fff', color: '#2a1f14', fontSize: 16, lineHeight: 1,
            cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >📍</button>
      </div>

      {/* Bottom-centre prompt */}
      <div
        style={{
          position: 'absolute', bottom: isTouch ? 140 : 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, padding: '10px 16px', borderRadius: 999,
          background: actionFlash ? 'rgba(34,197,94,0.95)' : (nearest ? 'rgba(16,185,129,0.95)' : 'rgba(0,0,0,0.5)'),
          color: '#fff', fontSize: 13, fontWeight: 600,
          fontFamily: 'system-ui, sans-serif', pointerEvents: 'none',
          transition: 'background 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {actionFlash
          ? <>{TOOLS[actionFlash.tool].emoji} {TOOLS[actionFlash.tool].verb}d!</>
          : nearest
            ? (isTouch
                ? <>Tap {TOOLS[tool].emoji} to {TOOLS[tool].label} <strong>{nearest.name}</strong></>
                : <>Press <kbd style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>E</kbd> to {TOOLS[tool].label} <strong>{nearest.name}</strong></>)
            : `Walk up to a plant to ${TOOLS[tool].label} it`}
      </div>

      {/* Tool belt — three slots, click or press 1/2/3 to switch */}
      <div
        style={{
          position: 'absolute', bottom: 20, left: isTouch ? 140 : 20, zIndex: 4,
          display: 'flex', gap: 4, padding: 4, borderRadius: 8,
          background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        {TOOL_ORDER.map((key, i) => {
          const active = tool === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTool(key)}
              title={`${TOOLS[key].verb} (${i + 1})`}
              style={{
                position: 'relative',
                width: 44, height: 44, borderRadius: 6,
                border: active ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.2)',
                background: active ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 22, cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {TOOLS[key].emoji}
              <span
                style={{
                  position: 'absolute', bottom: 1, right: 3,
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                }}
              >{i + 1}</span>
            </button>
          )
        })}
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
            onClick={() => nearest && performAction(nearest)}
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
            {TOOLS[tool].emoji}
          </button>
        </>
      )}
    </div>
  )
}
