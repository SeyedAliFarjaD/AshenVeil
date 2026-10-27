/**
 * Level smoke test (headless Chrome over CDP). For each level it boots the Game scene,
 * runs every enemy type's AI next to the hero, then drives the boss fight through its
 * phases until it dies, and reports any console errors or exceptions.
 *
 *   node scripts/level-smoke.mjs 5 6 7 8      (server: python tools/serve.py 8123)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:8123'
const levels = process.argv.slice(2).map(Number).filter(Boolean)
if (!levels.length) levels.push(5)

const PORT = 9341
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-smoke-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=960,540', '--no-first-run', '--no-default-browser-check',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-features=Translate,MediaRouter', '--no-proxy-server',
  ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank',
])

let ws, nextId = 1
const pending = new Map()
const logs = []
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}

async function connect() {
  let target = null
  for (let i = 0; i < 480 && !target; i++) {
    await sleep(250)
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch (e) { /* not up */ }
  }
  if (!target) throw new Error('no devtools page target')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id)
      pending.delete(d.id)
      d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result)
    } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
      logs.push(`[console.${d.params.type}] ` + d.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    } else if (d.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
}

const G = `window.__game.scene.getScene('Game')`
let failed = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++ }

async function runLevel(n) {
  console.log(`\n=== level ${n} ===`)
  logs.length = 0
  await send('Page.navigate', { url: `${BASE}/index.html?test` })
  await sleep(9000)
  await ev(`(() => { try { localStorage.clear() } catch (e) {} ; const g = window.__game; g.scene.stop('Title'); g.scene.start('Game', { level: ${n} }); return 1 })()`)
  await sleep(10000)
  const info = await ev(`(() => { const g = ${G}; if (!g || !g.player) return null; return { name: g.level.name, extras: g.extras.map((e) => e.constructor.name), bosses: g.bosses.map((b) => b.constructor.name + ':' + b.maxHp), px: Math.round(g.player.x), py: Math.round(g.player.y), swarms: g.swarms.length, saws: g.hazards.saws.length, movers: g.hazards.movers.length, crumbles: g.hazards.crumbles.length } })()`)
  check(!!info, 'Game scene is running')
  if (!info) return
  console.log('  ', JSON.stringify(info))
  check(logs.length === 0, `boot is clean ${logs.length ? '\n     ' + logs.join('\n     ') : ''}`)

  // make the hero tough, then walk him to each distinct enemy type and let its AI run
  await ev(`(() => { const p = ${G}.player; p.maxHp = 99999; p.hp = 99999; p.dmgTakenMul = 0.01; return 1 })()`)
  const kinds = [...new Set(info.extras)]
  for (const k of kinds) {
    const r = await ev(`(() => { const g = ${G}; const e = g.extras.find((o) => o.constructor.name === '${k}'); if (!e) return 'none'; g.player.body.reset(e.x - 70, e.y - 6); g.player.setPosition(e.x - 70, e.y - 6); g.player.lastSafe = { x: e.x - 70, y: e.y - 6 }; return Math.round(e.x) + ',' + Math.round(e.y) })()`)
    await sleep(4500)
    const st = await ev(`(() => { const g = ${G}; const e = g.extras.find((o) => o.constructor.name === '${k}'); return e ? e.state + ' hp=' + Math.round(e.hp) : 'gone' })()`)
    // knock it around: a hit must not throw
    await ev(`(() => { const g = ${G}; const e = g.extras.find((o) => o.constructor.name === '${k}'); if (e && !e.dead) e.takeHit(5, 1, 30); return 1 })()`)
    await sleep(1200)
    console.log(`   ${k.padEnd(12)} at ${r}  state: ${st}`)
  }
  check(logs.length === 0, `enemy AI ran clean ${logs.length ? '\n     ' + logs.join('\n     ') : ''}`)
  logs.length = 0

  // kill every extra (exercises death paths), then reset them (bonfire rest)
  await ev(`(() => { const g = ${G}; for (const e of g.extras) if (!e.dead) e.takeHit(99999, 1, 999); return 1 })()`)
  await sleep(1500)
  await ev(`(() => { ${G}.resetEnemies(); return 1 })()`)
  await sleep(500)
  check(logs.length === 0, `deaths and resets are clean ${logs.length ? '\n     ' + logs.join('\n     ') : ''}`)
  logs.length = 0

  // swarm zone: step inside and let it spawn, then rest-reset
  if (info.swarms) {
    await ev(`(() => { const g = ${G}; const z = g.swarms[0]; const x = z.rect.centerX, y = z.rect.bottom - 4; g.player.body.reset(x, y); g.player.setPosition(x, y); return 1 })()`)
    await sleep(9000)
    const sw = await ev(`(() => { const z = ${G}.swarms[0]; return z.state + ' spawned=' + z.count + ' alive=' + z.spawned.filter((e) => !e.dead).length })()`)
    console.log('   swarm:', sw)
    check(/active/.test(sw) && /spawned=[1-9]/.test(sw), 'swarm zone spawns foes')
    await ev(`(() => { const g = ${G}; g.player.body.reset(60, 100); g.player.setPosition(60, 100); g.resetEnemies(); return 1 })()`)
    const sw2 = await ev(`(() => { const z = ${G}.swarms[0]; return z.state + ' ' + z.spawned.length })()`)
    check(/idle 0/.test(sw2), 'swarm resets on rest: ' + sw2)
    check(logs.length === 0, `swarm clean ${logs.length ? '\n     ' + logs.join('\n     ') : ''}`)
    logs.length = 0
  }

  // boss: walk in, then batter it through its phases while the hero is practically immortal
  await ev(`(() => { const g = ${G}; const A = g.level.arena; g.player.body.reset(A.trigger + 30, A.floor - 4); g.player.setPosition(A.trigger + 30, A.floor - 4); g.player.lastSafe = { x: A.trigger + 30, y: A.floor }; return 1 })()`)
  await sleep(6000)
  const b0 = await ev(`(() => { const g = ${G}; const b = g.bosses[0]; return { started: g.bossStarted, state: b.state, hp: Math.round(b.hp), maxHp: b.maxHp } })()`)
  console.log('   boss:', JSON.stringify(b0))
  check(b0 && b0.started, 'boss fight starts')
  const states = new Set()
  for (let i = 0; i < 80; i++) {
    const r = await ev(`(() => { const g = ${G}; const p = g.player; p.hp = p.maxHp; const b = g.bosses.find((x) => !x.dead); if (!b) return 'dead'; if (!b.invuln) b.takeHit(b.maxHp * 0.045, 1, 0); return b.state + '/' + b.phase + (b.stage ? '/s' + b.stage : '') })()`)
    states.add(r)
    if (r === 'dead') break
    await sleep(1600)
  }
  console.log('   boss states seen:', [...states].join(' '))
  const dead = await ev(`${G}.bosses.every((b) => b.dead)`)
  check(dead === true, 'boss can be defeated')
  await sleep(12000)
  const done = await ev(`(() => { const g = ${G}; return g.bossDefeated })()`)
  check(done === true, 'level completes')
  check(logs.length === 0, `boss fight clean ${logs.length ? '\n     ' + logs.join('\n     ') : ''}`)
}

async function main() {
  await connect()
  for (const n of levels) await runLevel(n)
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nall checks passed')
}

main().then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* locked */ } process.exit(failed ? 1 : 0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => process.exit(1), 800) })
