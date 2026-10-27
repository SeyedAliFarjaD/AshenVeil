/**
 * Level reachability checker. Simulates the hero's real jump physics (gravity 900, jump 322,
 * double jump 290, air dash 460 x 0.17s, glide 60px/s, wall kicks) over each level grid and
 * checks that spawn -> every bonfire -> the pickup -> the boss gate is reachable.
 *
 *   node scripts/reach-test.mjs            # all levels
 *   node scripts/reach-test.mjs 5          # one level
 *   node scripts/reach-test.mjs 5 --dump   # also print the grid with reachable floor marked '.'
 */
import { LEVELS } from '../src/levels/index.js'

const T = 16, G = 900, JUMP_V = 322, DJ_V = 290, RUN = 108, AIR_ACC = 750, DASH_V = 460, DASH_T = 0.17, HW = 5, BH = 26, MAXFALL = 520
const DT = 1 / 60
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t))

function makeWorld(L, { broken = false } = {}) {
  const W = L.W, H = L.H
  const g = L.grid.map((r) => r.slice())
  if (broken) for (const s of L.secrets || []) { const [x0, y0, x1, y1] = s.wall; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = 0 }
  // dynamic platforms count as one-way tiles over their whole track (optimistic)
  for (const m of L.movers || []) {
    const rx = m.axis === 'y' ? 0 : Math.ceil(m.range), ry = m.axis === 'y' ? Math.ceil(m.range) : 0
    for (let dy = 0; dy <= ry; dy++) for (let dx = 0; dx < m.w + rx; dx++) if (g[m.y + dy] && g[m.y + dy][m.x + dx] === 0) g[m.y + dy][m.x + dx] = 2
  }
  for (const c of L.crumbles || []) for (let dx = 0; dx < c.w; dx++) if (g[c.y][c.x + dx] === 0) g[c.y][c.x + dx] = 2
  const at = (x, y) => (x < 0 || x >= W ? 1 : y < 0 ? 1 : y >= H ? 0 : g[y][x])
  return { W, H, g, at }
}

function simulate(world, start, ab, opt) {
  const { at, H } = world
  let x = start.x, y = start.y, vx = 0, vy = 0, t = 0
  let dir = opt.dir, usedDJ = false, usedDash = false, dashT = -1, jumped = false, kickCount = 0, dropT = opt.drop ? 0.25 : 0
  if (opt.jump) { vy = -JUMP_V; jumped = true }
  let jumpCut = false
  let prevBottom = y
  const solid = (tx, ty) => at(tx, ty) === 1
  for (let step = 0; step < 420; step++) {
    t += DT
    // --- scripted events
    if (opt.dj != null && !usedDJ && ab.hasDouble && t >= opt.dj) { usedDJ = true; vy = -DJ_V }
    if (opt.dash != null && !usedDash && ab.hasDash && t >= opt.dash && dashT < 0) { usedDash = true; dashT = 0 }
    if (opt.cut != null && jumped && !jumpCut && t >= opt.cut && vy < -110) { vy *= 0.45; jumpCut = true }
    // --- wall contact
    let wall = 0
    if (ab.hasWallJump && opt.autoWall) {
      const probe = (px) => { const tx = Math.floor(px / T); return [y - BH + 6, y - 6].some((py) => solid(tx, Math.floor(py / T))) }
      if (probe(x - HW - 4)) wall = -1; else if (probe(x + HW + 4)) wall = 1
    }
    if (wall && vy > 0 && dashT < 0) {
      if (kickCount < 8) { // kick away from the wall, then head for the other side
        kickCount++; vx = -wall * 175; vy = -JUMP_V * 0.95; dir = -wall; usedDJ = false
      }
    }
    // --- horizontal
    if (dashT >= 0) {
      vx = dir * DASH_V; vy = 0; dashT += DT
      if (dashT >= DASH_T) dashT = -1
    } else {
      vx = approach(vx, dir * RUN, AIR_ACC * DT)
      vy = Math.min(MAXFALL, vy + G * DT)
      if (ab.hasGlide && opt.glide && vy > 60 && t > 0.25) vy = 60
    }
    // X move
    let nx = x + vx * DT
    {
      const dirx = Math.sign(vx)
      if (dirx !== 0) {
        const edge = dirx > 0 ? nx + HW : nx - HW
        const tx = Math.floor(edge / T)
        const y0 = Math.floor((y - BH + 0.5) / T), y1 = Math.floor((y - 0.5) / T)
        let hit = false
        for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) hit = true
        if (hit) { nx = dirx > 0 ? tx * T - HW - 0.001 : (tx + 1) * T + HW + 0.001; vx = 0; if (dashT >= 0) dashT = -1 }
      }
    }
    x = nx
    // Y move
    const py = y
    let ny = y + vy * DT
    if (vy < 0) {
      const top = ny - BH
      const ty = Math.floor(top / T)
      const c0 = Math.floor((x - HW + 0.01) / T), c1 = Math.floor((x + HW - 0.01) / T)
      let hit = false
      for (let c = c0; c <= c1; c++) if (solid(c, ty)) hit = true
      if (hit) { ny = (ty + 1) * T + BH + 0.001; vy = 0 }
    } else if (vy > 0 || dashT >= 0) {
      const rowA = Math.floor((py - 0.001) / T), rowB = Math.floor(ny / T)
      const c0 = Math.floor((x - HW + 0.01) / T), c1 = Math.floor((x + HW - 0.01) / T)
      let landed = false
      for (let r = Math.max(rowA, 0); r <= rowB && !landed; r++) {
        if (r === rowA && Math.abs(py - r * T) > 0.01 && py > r * T) continue // already inside this row
        for (let c = c0; c <= c1; c++) {
          const v = at(c, r)
          if (v === 1 || (v === 2 && py <= r * T + 0.01 && dropT <= 0)) { ny = r * T; landed = true; break }
        }
      }
      if (landed && dashT < 0) {
        const vv = at(Math.floor(x / T), Math.floor((ny - 1) / T))
        y = ny; vy = 0
        if (vv === 3 || vv === 4) return { fail: 'hazard' }
        return { land: { x, y } }
      }
      if (landed) { ny = py } // dashing along a floor: keep height
    }
    y = ny
    dropT -= DT
    // hazards under/around the body
    {
      const c0 = Math.floor((x - HW + 2) / T), c1 = Math.floor((x + HW - 2) / T)
      const r0 = Math.floor((y - BH) / T), r1 = Math.floor((y - 4) / T)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = at(c, r); if (v === 3 || v === 4) return { fail: 'hazard' } }
    }
    if (y > H * T + 20) return { fail: 'pit' }
  }
  return { fail: 'timeout' }
}

function variants(ab) {
  const out = []
  const dirs = [-1, 0, 1]
  const djs = ab.hasDouble ? [null, 0.2, 0.38, 0.58] : [null]
  const dashes = ab.hasDash ? [null, 0.08, 0.3, 0.55] : [null]
  const cuts = [null, 0.12]
  const glides = ab.hasGlide ? [false, true] : [false]
  const walls = ab.hasWallJump ? [false, true] : [false]
  for (const dir of dirs) for (const dj of djs) for (const dash of dashes) for (const cut of cuts) for (const glide of glides) for (const autoWall of walls) {
    out.push({ jump: true, dir, dj, dash, cut, glide, autoWall })
    if (dir !== 0 && cut == null) out.push({ jump: false, dir, dj, dash, glide, autoWall })
  }
  return out
}

function analyse(L, ab, opts = {}) {
  const world = makeWorld(L, opts)
  const { at, W, H } = world
  const key = (x, y) => `${Math.round(x / 6)},${Math.round(y)}`
  const standable = (x, y) => {
    const tx = Math.floor(x / T), ty = Math.floor(y / T)
    const v = at(tx, ty)
    if (!(v === 1 || v === 2)) return false
    const here = at(tx, ty - 1), above = at(tx, ty - 2)
    return here !== 1 && above !== 1 && here !== 3 && here !== 4
  }
  const seen = new Map()
  const queue = []
  const add = (x, y, from) => { const k = key(x, y); if (!seen.has(k)) { seen.set(k, { x, y }); queue.push({ x, y }); } }
  add(L.spawn.x, L.spawn.y)
  const vars = variants(ab)
  while (queue.length) {
    const n = queue.shift()
    // walk along the floor
    for (const d of [-1, 1]) {
      const nx = n.x + d * 6
      const tx = Math.floor((nx + d * HW) / T)
      if (at(tx, Math.floor((n.y - 1) / T)) === 1 || at(tx, Math.floor((n.y - BH + 1) / T)) === 1) continue
      if (standable(nx, n.y)) add(nx, n.y)
    }
    // jumps, falls, drops
    for (const v of vars) {
      if (!v.jump) {
        // walking off needs an edge on that side (otherwise it is just a walk)
        const tx = Math.floor((n.x + v.dir * (HW + 2)) / T)
        if (at(tx, Math.floor(n.y / T)) === 1 || at(tx, Math.floor(n.y / T)) === 2) continue
      }
      const res = simulate(world, { x: n.x, y: n.y }, ab, v)
      if (res.land) add(res.land.x, res.land.y)
    }
    // drop through a one-way platform
    if (at(Math.floor(n.x / T), Math.floor(n.y / T)) === 2) {
      for (const d of [-1, 0, 1]) {
        const res = simulate(world, { x: n.x, y: n.y + 1 }, ab, { jump: false, dir: d, drop: true })
        if (res.land) add(res.land.x, res.land.y)
      }
    }
    if (seen.size > 60000) break
  }
  return { seen, world, reaches: (x, y, rx = 14, ry = 4) => [...seen.values()].some((s) => Math.abs(s.x - x) <= rx && Math.abs(s.y - y) <= ry) }
}

function dump(L, an, mark = '.') {
  const rows = L.grid.map((r, y) => r.map((v, x) => ({ 0: ' ', 1: '#', 2: '=', 3: '^', 4: '~' }[v] ?? '?')))
  for (const s of an.seen.values()) { const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T) - 1; if (rows[ty] && rows[ty][tx] === ' ') rows[ty][tx] = mark }
  for (const b of L.bonfires) { const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T) - 1; if (rows[ty]) rows[ty][tx] = 'B' }
  const p = L.pickup; { const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T) - 1; if (rows[ty]) rows[ty][tx] = 'P' }
  { const tx = Math.floor(L.spawn.x / T), ty = Math.floor(L.spawn.y / T) - 1; if (rows[ty]) rows[ty][tx] = 'S' }
  { const tx = Math.floor(L.arena.trigger / T), ty = Math.floor(L.arena.floor / T) - 1; if (rows[ty]) rows[ty][tx] = 'T' }
  for (const [k, list] of Object.entries({ h: L.hollows, s: L.sentinels, a: L.acolytes, b: L.bellringers })) for (const e of list || []) { const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T) - 1; if (rows[ty] && rows[ty][tx] === ' ') rows[ty][tx] = k }
  return rows.map((r, y) => String(y).padStart(3) + ' ' + r.join('')).join('\n')
}

const args = process.argv.slice(2)
const wantDump = args.includes('--dump')
const only = args.find((a) => /^\d+$/.test(a))
let failures = 0
for (const id of Object.keys(LEVELS).map(Number)) {
  if (only && Number(only) !== id) continue
  const L = LEVELS[id]()
  let ab = { hasDouble: false, hasWallJump: false, hasDash: false, hasGrapple: false, hasGlide: false, ...(L.startAbilities || {}) }
  const t0 = Date.now()
  const FLAG = { feather: 'hasDouble', claw: 'hasWallJump', cinder: 'hasDash', grapple: 'hasGrapple', glide: 'hasGlide' }
  const startAb = { ...ab }
  let an = analyse(L, ab)
  // the level's own pickup may be the key to the rest of the level: grant it once it is reachable
  const pkFlag = FLAG[L.pickup.type]
  if (pkFlag && !ab[pkFlag] && an.reaches(L.pickup.x, L.pickup.y, 18, 4)) { ab = { ...ab, [pkFlag]: true }; an = analyse(L, ab) }
  if (process.env.REACH_DEBUG) console.log([...an.seen.values()].filter((q) => q.y === Number(process.env.REACH_DEBUG)).map((q) => Math.round(q.x)).sort((a, b) => a - b).join(' '))
  const problems = []
  // enemies must not be camped on a bonfire (they respawn when you rest)
  const lists = ['hollows', 'sentinels', 'acolytes', 'bellringers', 'wisps', 'archers', 'brutes', 'sappers', 'ghouls', 'champions', 'spiders', 'shades', 'duelists', 'necromancers']
  const near = []
  for (const b of L.bonfires) for (const k of lists) for (const e of L[k] || []) {
    const d = Math.hypot(e.x - b.x, (e.y - b.y) * 1.5)
    if (d < 150) near.push(`${k} at (${Math.floor(e.x / T)},${Math.floor(e.y / T)}) is ${Math.round(d / T)} tiles from bonfire ${b.id}`)
  }
  for (const w of near) problems.push('enemy too close to a bonfire: ' + w)
  for (const b of L.bonfires) if (!an.reaches(b.x, b.y, 18, 4)) problems.push(`bonfire ${b.id} at (${Math.floor(b.x / T)},${Math.floor(b.y / T)}) unreachable`)
  const pk = L.pickup
  if (!an.reaches(pk.x, pk.y, 18, 4)) problems.push(`pickup (${pk.type}) at (${Math.floor(pk.x / T)},${Math.floor(pk.y / T)}) unreachable`)
  const A = L.arena
  if (!an.reaches(A.trigger + 20, A.floor, 40, 4)) problems.push('boss arena trigger unreachable')
  // secret loot is reachable once the wall is broken
  if ((L.secrets || []).length) {
    const an2 = analyse(L, ab, { broken: true })
    for (const s of L.secrets) if (!an2.reaches(s.loot.x, s.loot.y, 18, 4)) problems.push(`secret loot at (${Math.floor(s.loot.x / T)},${Math.floor(s.loot.y / T)}) unreachable even with the wall broken`)
  }
  // gate: without the level's gate ability the boss must stay out of reach
  let gateNote = ''
  if (L.gate) {
    const ab2 = { ...startAb, [L.gate]: false }
    const an3 = analyse(L, ab2)
    const open = an3.reaches(A.trigger + 20, A.floor, 40, 4)
    gateNote = open ? `  GATE LEAKS without ${L.gate}` : `  gate holds without ${L.gate}`
    if (open) problems.push(`the gate (${L.gate}) can be skipped`)
    if (wantDump && only) console.log('--- without gate ability ---\n' + dump(L, an3, ',') + '\n')
  }
  console.log(`${problems.length ? 'FAIL' : ' ok '}  level ${id} ${L.name}  (${an.seen.size} floor spots, ${((Date.now() - t0) / 1000).toFixed(1)}s)${gateNote}`)
  for (const p of problems) { console.log('        - ' + p); failures++ }
  if (wantDump && only) console.log(dump(L, an))
}
process.exit(failures ? 1 : 0)
