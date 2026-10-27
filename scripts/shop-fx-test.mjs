/**
 * Headless gameplay test: proves the shop multipliers reach the real damage,
 * focus, ember and survivability code paths - not just the stat block.
 *   node scripts/shop-fx-test.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = 'http://127.0.0.1:8123/index.html?test&level=1'
const PORT = 9336
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-fx-'))
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
  for (let i = 0; i < 240 && !target; i++) {
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

  // Page.navigate returns before the new document commits; Runtime.evaluate can then land
  // in the outgoing page's context. Wait for the load event so every eval sees the new page.
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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval threw: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    if (!ok) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ->  ${JSON.stringify(got)}`)
  }

  // Waits for the page to expose __game, presses past the Title screen, then waits for
  // the Game scene to be live. Self-guarding: never evaluates against a half-loaded page.
  const waitGame = async (keyCode = 'Enter') => {
    for (let i = 0; i < 140; i++) {
      const ready = await js(`(() => !!window.__game)()`)
      if (ready) {
        // Title screen waits for a key press before starting the Game scene
        await js(`(() => { const T = window.__game.scene.getScene('Title');
          if (T && T.scene.isActive()) T.input.keyboard.emit('keydown', { code: '${keyCode}', key: '${keyCode}', preventDefault(){} }); return 1; })()`)
        const ok = await js(`(() => { const g = window.__game && window.__game.scene.getScene('Game');
          return !!(g && g.scene.isActive() && g.player && g.player.body); })()`)
        if (ok) return true
      }
      await sleep(500)
    }
    return false
  }

  // Chrome's renderer occasionally dies before the ES modules execute (SwiftShader), which
  // leaves window.__game undefined with no console output. Retry the whole page load.
  const boot = async (keyCode = 'Enter', attempts = 3) => {
    for (let a = 1; a <= attempts; a++) {
      await navigate(URL)
      if (await waitGame(keyCode)) return true
      logs.push(`[retry] boot attempt ${a} produced no live Game scene`)
    }
    return false
  }

  // fresh run: wipe any save so stats start at zero
  await navigate(URL)
  for (let i = 0; i < 80; i++) { if (await js(`(() => !!window.__game)()`)) break; await sleep(500) }
  await js(`(() => { localStorage.clear(); return true; })()`)
  if (!(await boot())) throw new Error('Game scene never became active')
  await sleep(2500)

  // ---- install a full shop loadout through the real applyStats
  await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.shop = { lifeseed: 1, hexed: 2, attuned: 1, flask: 1, luck: 1, sigil: 1 };
    p.applyStats(); return 1; })()`)
  await sleep(300)
  check('multipliers installed', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.maxHp, p.maxFlasks, p.spellMul, p.focusMul, p.emberMul, p.dmgTakenMul, p.dmgMul]; })()`),
    [120, 4, 1.3, 1.25, 1.25, 0.9, 1])

  // ---- Soul Bolt: 35 base * spellMul 1.3 (read the bolt in the same tick it spawns,
  //      before it can fly into an enemy and be consumed)
  check('Soul Bolt carries boosted damage', await js(`(() => { const g = window.__game.scene.getScene('Game');
    g.player.focus = 100; g.player.startCast();
    const b = g.soulBolts[g.soulBolts.length - 1];
    return b ? b.dmg : null; })()`), 45.5)

  // ---- Force: 100 base * spellMul 1.3, captured straight out of updateSuper
  check('Force cleave deals 130 (100 * 1.3)', await js(`(() => { const g = window.__game.scene.getScene('Game'); const p = g.player;
    let captured = null;
    const orig = g.playerStrike;
    g.playerStrike = function (rect, atk, dir, hitSet) { captured = atk; return orig.call(this, rect, atk, dir, hitSet); };
    p.startSuper(); p.superT = 0.2; p.updateSuper(0.01);
    g.playerStrike = orig;
    return captured ? captured.dmg : null; })()`), 130)

  // ---- focus gain: 10 * focusMul 1.25
  check('focus gain boosted', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    p.focus = 0; p.gainFocus(10); return p.focus; })()`), 12.5)

  // ---- damage taken: 20 * dmgTakenMul 0.9 (guardian sigil)
  check('incoming damage reduced by the sigil', await js(`(() => { const g = window.__game.scene.getScene('Game'); const p = g.player;
    p.iframes = 0; p.invuln = 0; p.state = 'normal'; p.hp = p.maxHp;
    const r = new Phaser.Geom.Rectangle(p.x - 60, p.y - 60, 120, 120);
    const hp0 = p.hp;
    g.hitPlayer(r, 20, p.x + 40);
    return [hp0, p.hp, hp0 - p.hp]; })()`), [120, 102, 18])

  // ---- ember pickup: value 40 * emberMul 1.25 (clear stray orbs first, assert the delta)
  check('ember pickup boosted', await js(`(() => { const g = window.__game.scene.getScene('Game'); const p = g.player;
    g.orbs.forEach((o) => o.destroy()); g.orbs = [];
    const e0 = p.embers;
    g.orbs.push({ x: p.x, y: p.y - 16, vx: 0, vy: 0, t: 1, value: 40, destroy() {} });
    g.updateOrbs(0.016);
    return p.embers - e0; })()`), 50)

  // ---- regression: melee ignores spellMul (only dmgMul applies). The strike rect is
  //      built around the enemy's real body so the hit cannot miss.
  check('melee unaffected by spellMul', await js(`(() => { const g = window.__game.scene.getScene('Game');
    const h = [...g.hollows, ...g.sentinels, ...g.wisps, ...g.acolytes, ...g.bellringers].find((e) => !e.dead);
    if (!h) return 'no live enemy';
    h.parried = false;
    const br = g.bodyRect(h);
    const r = new Phaser.Geom.Rectangle(br.x - 4, br.y - 4, br.width + 8, br.height + 8);
    const hp0 = h.hp;
    g.playerStrike(r, { dmg: 30, poise: 10 }, 1, new Set());
    return hp0 - h.hp; })()`), 30)

  // ---- regression: every level still boots clean with the new UI/player code
  for (const lv of [1, 2, 3, 4]) {
    // KeyN = new game: ignores any save, so the ?level= URL decides the level
    let live = false
    for (let a = 1; a <= 3 && !live; a++) {
      await navigate(`http://127.0.0.1:8123/index.html?test&level=${lv}`)
      live = await waitGame('KeyN')
      if (!live) logs.push(`[retry] level ${lv} boot attempt ${a} produced no live Game scene`)
    }
    if (!live) throw new Error(`level ${lv} never became active`)
    await sleep(1500)
    check(`level ${lv} boots`, await js(`(() => { const g = window.__game.scene.getScene('Game');
      return [g.levelNum, !!g.player.body, g.player.maxHp, window.__game.scene.getScene('UI').menuShopEls.length]; })()`),
      [lv, true, 100, 6])
  }

  console.log(fails.length ? `\n${fails.length} FAILURE(S):\n- ` + fails.join('\n- ') : '\nALL CHECKS PASSED')
  console.log('LOGS:', logs.length ? logs.join('\n       ') : 'none')
}

main().then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* locks */ } process.exit(fails.length ? 1 : 0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e2) { /* ignore */ } process.exit(1) }, 800) })
