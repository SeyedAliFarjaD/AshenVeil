/**
 * Movement test: measures the air-dash distance against the ground roll, proves the
 * level 3 lava trench is still crossable with the shorter dash, and checks that
 * jumping now costs stamina (and what happens at 0).
 *   node scripts/move-test.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9338
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-move-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=960,540', '--no-first-run', '--no-default-browser-check',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-features=Translate,MediaRouter', '--no-proxy-server', 'about:blank',
])

let ws, nextId = 1
const pending = new Map()
const logs = []
let fails = []
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let target = null
  for (let i = 0; i < 480 && !target; i++) {
    await sleep(250)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
    } catch (e) { /* not up */ }
  }
  if (!target) throw new Error('no devtools page target')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')

  let navResolve = null
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Page.loadEventFired' && navResolve) { const r = navResolve; navResolve = null; r() }
  })
  const navigate = async (url) => {
    const loaded = new Promise((resolve) => { navResolve = resolve })
    await send('Page.navigate', { url })
    await Promise.race([loaded, sleep(20000)])
  }

  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('eval threw: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    if (!ok) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ->  ${JSON.stringify(got)}`)
  }

  const waitGame = async (keyCode = 'Enter') => {
    for (let i = 0; i < 140; i++) {
      if (await js(`(() => !!window.__game)()`)) {
        await js(`(() => { const T = window.__game.scene.getScene('Title');
          if (T && T.scene.isActive()) T.input.keyboard.emit('keydown', { code: '${keyCode}', key: '${keyCode}', preventDefault(){} }); return 1; })()`)
        if (await js(`(() => { const g = window.__game && window.__game.scene.getScene('Game');
          return !!(g && g.scene.isActive() && g.player && g.player.body); })()`)) return true
      }
      await sleep(500)
    }
    return false
  }
  const load = async (level) => {
    const url = `http://127.0.0.1:8123/index.html?test&level=${level}`
    for (let a = 1; a <= 3; a++) {
      await navigate(url)
      if (await waitGame()) return true
      logs.push(`[retry] level ${level} boot attempt ${a} failed`)
    }
    return false
  }

  // Take over Controls.update so input is scripted, not typed. The player's own logic
  // (updateNormal, startDash, the jump branches) runs untouched.
  const installCtl = () => js(`(() => {
    const g = window.__game.scene.getScene('Game');
    window.__in = { right: false, left: false, jump: false, roll: false, down: false };
    g.ctl.update = function () {
      const i = window.__in;
      const s = { left: !!i.left, right: !!i.right, up: false, down: !!i.down,
        jump: !!i.jump, roll: !!i.roll, attack: false, heal: false, interact: false,
        parry: false, grapple: false, cast: false, super: false, pause: false };
      for (const k in s) this.pressed[k] = s[k] && !this.prev[k];
      this.prev = s; this.state = s;
    };
    return 1;
  })()`)
  const input = (o) => js(`(() => { Object.assign(window.__in, ${JSON.stringify(o)}); return 1; })()`)

  // Per-frame recorder: distances are measured, never computed.
  const record = () => js(`(() => {
    const g = window.__game.scene.getScene('Game'); const p = g.player;
    window.__rec = [];
    const h = () => window.__rec.push([Math.round(p.x * 100) / 100, p.state, Math.round(p.st), p.body.onFloor(), Math.round(p.body.velocity.y)]);
    g.events.on('update', h);
    window.__stop = () => g.events.off('update', h);
    return 1;
  })()`)
  const stopRec = () => js(`(() => { window.__stop(); return window.__rec; })()`)
  // horizontal distance covered while the player was in a given state
  const span = (rec, state) => {
    let start = null, end = null
    for (const [x, st] of rec) {
      if (st === state && start === null) start = x
      if (start !== null && st !== state && end === null) end = x
    }
    if (start === null) return null
    if (end === null) end = rec[rec.length - 1][0] // still in that state when we stopped
    return Math.round((end - start) * 10) / 10
  }
  const settle = async () => {
    // let the hero come to rest on the ground before the next measurement
    for (let i = 0; i < 20; i++) {
      const ok = await js(`(() => { const p = window.__game.scene.getScene('Game').player;
        return p.body.onFloor() && Math.abs(p.body.velocity.x) < 5; })()`)
      if (ok) return true
      await sleep(100)
    }
    return false
  }
  const reset = (o = {}) => js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.st = 100; p.stDelay = 0; p.hp = p.maxHp; p.state = 'normal'; p.usedDash = false; p.usedDouble = false;
    p.coyote = 0; p.wallCoyote = 0; p.jumpBuf = 0;
    ${Object.entries(o).map(([k, v]) => `p.${k} = ${JSON.stringify(v)};`).join(' ')}
    return 1; })()`)


  // Drive one frame of the player's own logic with a scripted input, no RAF timing.
  const step = (o = {}) => js(`(() => {
    const p = window.__game.scene.getScene('Game').player;
    p.jumpBuf = ${o.jump ? '0.13' : '0'};
    const ctl = { x: ${o.x || 0}, state: { jump: ${!!o.jump}, roll: false, down: false },
      pressed: { jump: ${!!o.jump}, roll: false, attack: false, heal: false, interact: false,
                 parry: false, grapple: false, cast: false, super: false, up: false } };
    p.updateNormal(1 / 60, ctl);
    return { st: Math.round(p.st), vy: Math.round(p.body.velocity.y), usedDouble: p.usedDouble, onFloor: p.body.onFloor() };
  })()`)

  // ================================================================ level 1: dash + stamina
  if (!(await load(1))) throw new Error('level 1 never booted')
  await sleep(2500)
  await installCtl()
  // Holding "right" for a second drifts the hero off the spawn ledge; put them back
  // before every measurement so each one starts from the same known ground.
  const home = await js(`(() => { const p = window.__game.scene.getScene('Game').player; return { x: p.x, y: p.y }; })()`)
  const goHome = async () => {
    for (let i = 0; i < 24; i++) {
      await js(`(() => { const p = window.__game.scene.getScene('Game').player;
        p.setPosition(${home.x}, ${home.y}); p.body.setVelocity(0, 0); p.state = 'normal'; return 1; })()`)
      await sleep(500)
      if (await js(`(() => { const p = window.__game.scene.getScene('Game').player;
        return p.body.onFloor() && Math.abs(p.body.velocity.x) < 5; })()`)) return true
    }
    return false
  }
  if (!(await goHome())) throw new Error('hero never settled on the spawn ground')

  // ---- ground roll: the yardstick the dash is compared against
  await record()
  await input({ right: true, roll: true })
  await sleep(1600)
  const rollRec = await stopRec()
  const rollDist = span(rollRec, 'roll')
  console.log(`      roll covered ${rollDist}px  (states seen: ${[...new Set(rollRec.map((r) => r[1]))].join(',')})`)
  check('ground roll happens and is short', rollDist !== null && rollDist > 20 && rollDist < 100, true)
  await input({ right: false, roll: false })
  if (!(await goHome())) throw new Error('lost the hero before the dash measurement')

  // ---- air dash: jump, then dash mid-air (exactly what a player does)
  await reset({ hasDash: true })
  await record()
  await input({ right: true, jump: true })
  await sleep(170)
  await input({ roll: true })
  await sleep(1600)
  const dashRec = await stopRec()
  const dashDist = span(dashRec, 'dash')
  console.log(`      dash covered ${dashDist}px  (states seen: ${[...new Set(dashRec.map((r) => r[1]))].join(',')})`)
  if (dashDist === null) console.log('      frame log: ' + dashRec.slice(0, 24).map((r) => r.join('/')).join('  '))
  check('air dash fires', dashDist !== null, true)
  check('air dash is far shorter than the old 138px', dashDist < 100, true)
  check('air dash is only a little more than the roll', dashDist > rollDist && dashDist < rollDist * 1.6, true)
  await input({ right: false, jump: false, roll: false })
  if (!(await goHome())) throw new Error('lost the hero before the jump measurement')

  // ---- jump costs stamina (one scripted frame of the real jump code)
  await reset()
  await js(`(() => { const p = window.__game.scene.getScene('Game').player; p.coyote = 0.1; return 1; })()`)
  check('a jump costs 10 stamina', (await step({ jump: true })).st, 90)
  if (!(await goHome())) throw new Error('lost the hero before the double-jump measurement')

  // ---- double jump costs 12: drop the hero into open air, then press once. With coyote
  //      and wall windows cleared, that press can only be the double jump.
  await reset({ hasDouble: true })
  await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.setPosition(${home.x}, ${home.y - 130}); p.body.setVelocity(0, 0);
    p.coyote = 0; p.wallCoyote = 0; return 1; })()`)
  await sleep(250)
  const dj = await step({ jump: true })
  check('the double jump costs 12 and fires', [dj.st, dj.usedDouble, dj.vy < 0], [88, true, true])
  if (!(await goHome())) throw new Error('lost the hero before the empty-bar test')

  // ---- empty bar: the press is dropped, exactly like a roll or a swing at 0 stamina
  await reset()
  await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.coyote = 0.1; p.st = 0; p.stDelay = 0.65; return 1; })()`)
  const blocked = await step({ jump: true })
  check('at 0 stamina the jump is dropped', [blocked.st, blocked.vy >= 0], [0, true])
  // regen is on cooldown while stDelay runs, then resumes at 55/s
  await sleep(900)
  const after = await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return { st: Math.round(p.st), delay: Math.round(p.stDelay * 100) / 100, state: p.state, onFloor: p.body.onFloor() }; })()`)
  check('stamina comes back on its own', after.st > 0, true)
  console.log(`      while empty: st stayed 0; 900ms later ${JSON.stringify(after)}`)

  // ================================================================ level 3: the trench
  if (!(await load(3))) throw new Error('level 3 never booted')
  await sleep(2500)
  await installCtl()
  await js(`(() => { const g = window.__game.scene.getScene('Game'); const p = g.player;
    p.hasDash = true; p.hasDouble = true; p.hasWallJump = true;
    p.state = 'normal'; p.st = 100; p.stDelay = 0; p.hp = p.maxHp;
    return 1; })()`)
  await sleep(500)
  // the gallery floor, read straight off the tilemap rather than assumed
  const floor = await js(`(() => {
    const g = window.__game.scene.getScene('Game');
    for (let ty = 20; ty < 45; ty++) {
      const t = g.ground.getTileAt(74, ty);
      if (t && t.index > 0 && t.index <= 17) return { ty, y: ty * 16 };
    }
    return null;
  })()`)
  console.log(`      gallery floor at tile row ${floor.ty} -> world y ${floor.y}`)
  const grid = await js(`(() => {
    const d = window.__game.scene.getScene('Game').level.data;
    const rows = [];
    for (let ty = 22; ty <= 29; ty++) rows.push(ty + '|' + d[ty].slice(71, 85).map((v) => v === 0 ? '.' : (v === 1 ? '#' : String(v))).join(''));
    return rows.join('   ');
  })()`)
  console.log(`      raw grid rows 22-29, tiles 71-84 (.# = rock, . = open):`)
  console.log(`      ${grid}`)
  await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.setPosition(1150, ${floor.y - 4}); p.body.setVelocity(0, 0); p.state = 'normal'; return 1; })()`)
  await sleep(400)
  const grounded = await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return { x: Math.round(p.x), y: Math.round(p.y), onFloor: p.body.onFloor() }; })()`)
  console.log(`      placed at ${grounded.x},${grounded.y} onFloor=${grounded.onFloor}`)
  // run up from well inside the gallery: the trench needs the jump's own reach now,
  // not just the dash, so take it at speed like a player would
  await input({ right: true })
  for (let i = 0; i < 60; i++) {
    const x = await js(`(() => Math.round(window.__game.scene.getScene('Game').player.x))()`)
    if (x >= 1205) break
    await sleep(30)
  }
  const runX = await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return { x: Math.round(p.x), vx: Math.round(p.body.velocity.x), onFloor: p.body.onFloor() }; })()`)
  console.log(`      took off at x=${runX.x} vx=${runX.vx} onFloor=${runX.onFloor}`)
  await record()
  await input({ jump: true })
  await sleep(200)
  await input({ roll: true })
  const startX = runX.x
  await sleep(1100)
  const trench = await js(`(() => { const g = window.__game.scene.getScene('Game'); const p = g.player;
    window.__stop(); return { x: Math.round(p.x), onFloor: p.body.onFloor(), hp: p.hp, dead: p.dead }; })()`)
  console.log(`      took off x=${startX} -> ended x=${trench.x} onFloor=${trench.onFloor} hp=${trench.hp} (trench spans 1216..1328)`)
  check('crosses the 112px trench and lands', [trench.x >= 1328, trench.onFloor, trench.hp > 0], [true, true, true])

  console.log(fails.length ? `\n${fails.length} FAILURE(S):\n- ` + fails.join('\n- ') : '\nALL CHECKS PASSED')
  console.log('LOGS:', logs.length ? logs.join('\n       ') : 'none')
}

main().then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* locks */ } process.exit(fails.length ? 1 : 0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e2) { /* ignore */ } process.exit(1) }, 800) })
