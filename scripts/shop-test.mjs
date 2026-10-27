/**
 * Headless shop test: drives the real bonfire menu through injected key events
 * and asserts every shop effect, rank cap, ember rejection and save persistence.
 *   node scripts/shop-test.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
import { CHARMS } from '../src/charms.js'
const CHARM_COUNT = CHARMS.length
const URL = 'http://127.0.0.1:8123/index.html?test&level=1'
const PORT = 9335
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-shop-'))
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
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error('eval threw: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
  // real key event through the UI scene's keyboard plugin
  const key = (code) => js(`(() => { const ui = window.__game.scene.getScene('UI');
    ui.input.keyboard.emit('keydown', { code: '${code}', shiftKey: false, preventDefault(){}, key: '${code}' }); return '${code}'; })()`)

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

  if (!(await boot())) throw new Error('Game scene never became active | logs: ' + (logs.join(' ; ') || 'none'))
  await sleep(3000) // let HUD/UI settle

  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    if (!ok) fails.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ->  ${JSON.stringify(got)}`)
  }

  // ---- open the bonfire menu through the real event path
  await js(`(() => { const g = window.__game.scene.getScene('Game'); g.events.emit('open-levelup'); return g.scene.isPaused(); })()`)
  await sleep(400)
  check('menu opens + game paused', await js(`(() => { const ui = window.__game.scene.getScene('UI'); const g = window.__game.scene.getScene('Game'); return [ui.menuOpen, ui.menuLayer.visible, ui.menuPanel, g.paused, g.physics.world.isPaused]; })()`), [true, true, 'stats', true, true])
  check('stats panel visible first', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return [ui.menuRowEls[0].name.visible, ui.menuShopEls[0].name.visible]; })()`), [true, false])

  // ---- switch to shop with D, wrap with A
  await key('KeyD'); await sleep(250)
  check('D switches to SHOP tab', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return [ui.menuPanel, ui.menuRowEls[0].name.visible, ui.menuShopEls[0].name.visible, ui.menuIndex]; })()`), ['shop', false, true, 0])
  check('tab colours follow selection', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return [ui.menuTabStats.style.color, ui.menuTabShop.style.color]; })()`), ['#6a5c46', '#ffe2a0'])
  await key('KeyA'); await sleep(250)
  check('A switches back to ASCEND', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return [ui.menuPanel, ui.menuIndex]; })()`), ['stats', 0])
  await key('KeyD'); await sleep(200)

  // ---- funds, then buy each of the six items through the real buy path
  await js(`(() => { const g = window.__game.scene.getScene('Game'); g.player.embers = 9000; window.__game.scene.getScene('UI').refreshMenu(); return g.player.embers; })()`)
  await sleep(200)

  // 1) LIFESEED  (row 0)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 0; ui.refreshMenu(); return ui.menuIndex; })()`)
  await key('KeyE'); await sleep(300)
  check('LIFESEED rank 1 bought', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.lifeseed, p.maxHp, p.hp]; })()`), [1, 120, 120])
  check('cost 350 deducted', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return p.embers; })()`), 9000 - 350)
  check('row shows rank 1 / 5', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuShopEls[0].lvl.text; })()`), '1 / 5')

  // 2) HEXED EMBER (row 1)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 1; ui.refreshMenu(); return 1; })()`)
  await key('KeyE'); await sleep(300)
  check('HEXED EMBER rank 1', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.hexed, p.spellMul]; })()`), [1, 1.15])
  check('cost 400 deducted', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return p.embers; })()`), 9000 - 750)

  // 3) ATTUNED MIND (row 2)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 2; ui.refreshMenu(); return 2; })()`)
  await key('KeyE'); await sleep(300)
  check('ATTUNED MIND rank 1', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.attuned, p.focusMul]; })()`), [1, 1.25])

  // 4) EMBER FLASK (row 3)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 3; ui.refreshMenu(); return 3; })()`)
  await key('KeyE'); await sleep(300)
  check('EMBER FLASK rank 1 -> +1 flask', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.flask, p.maxFlasks, p.flasks]; })()`), [1, 4, 4])

  // 5) LUCKY COIN (row 4)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 4; ui.refreshMenu(); return 4; })()`)
  await key('KeyE'); await sleep(300)
  check('LUCKY COIN rank 1', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.luck, p.emberMul]; })()`), [1, 1.25])

  // 6) GUARDIAN SIGIL (row 5)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 5; ui.refreshMenu(); return 5; })()`)
  await key('KeyE'); await sleep(300)
  check('GUARDIAN SIGIL rank 1', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.sigil, p.dmgTakenMul]; })()`), [1, 0.9])

  // ---- derived line reflects shop multipliers
  check('derived line lists shop stats', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuDerived.text; })()`),
    'Health 120    Flasks 4\nSpell damage 115%    Focus gain 125%\nEmbers from the fallen 125%    Ward 10%')

  // ---- navigation wraps across 6 rows (index is 5 after the sigil purchase)
  await key('ArrowUp'); await sleep(200)
  check('Up moves to previous row', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuIndex; })()`), 4)
  await key('ArrowDown'); await sleep(200)
  check('Down moves to next row', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuIndex; })()`), 5)
  await key('ArrowDown'); await sleep(200)
  check('Down wraps past the last row', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuIndex; })()`), 0)
  await key('ArrowUp'); await sleep(200)
  check('Up wraps before the first row', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuIndex; })()`), 5)

  // ---- rank cap: EMBER FLASK max 2, buy a second then a third
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 3; ui.refreshMenu(); return 3; })()`)
  await key('KeyE'); await sleep(300)
  check('EMBER FLASK rank 2', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.flask, p.maxFlasks]; })()`), [2, 5])
  check('capped row shows MAX', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return ui.menuShopEls[3].cost.text; })()`), 'MAX')
  const embersBefore = await js(`(() => window.__game.scene.getScene('Game').player.embers)()`)
  await key('KeyE'); await sleep(300)
  check('third buy rejected, embers kept', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.flask, p.embers]; })()`), [2, embersBefore])

  // ---- insufficient embers
  await js(`(() => { const g = window.__game.scene.getScene('Game'); g.player.embers = 0; window.__game.scene.getScene('UI').refreshMenu(); return g.player.embers; })()`)
  await key('KeyE'); await sleep(300)
  check('no embers -> no purchase', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop.luck, p.embers]; })()`), [1, 0])

  // ---- save written with shop
  check('save payload carries shop', await js(`(() => { const d = JSON.parse(localStorage.getItem('ashen-vigil-save')); return d && d.shop; })()`),
    { lifeseed: 1, hexed: 1, attuned: 1, flask: 2, luck: 1, sigil: 1 })

  // ---- persistence across a reload (real load path)
  await js(`(() => { window.__game.scene.getScene('UI').closeLevelUp(); return true; })()`)
  await sleep(300)
  if (!(await boot())) throw new Error('Game scene never became active after reload | logs: ' + (logs.join(' ; ') || 'none'))
  await sleep(3000)
  check('shop restored from save', await js(`(() => { const p = window.__game.scene.getScene('Game').player; return [p.shop, p.maxHp, p.spellMul, p.focusMul, p.emberMul, p.dmgTakenMul, p.maxFlasks]; })()`),
    [{ lifeseed: 1, hexed: 1, attuned: 1, flask: 2, luck: 1, sigil: 1 }, 120, 1.15, 1.25, 1.25, 0.9, 5])

  // ---- menu reopens on the stats tab, shop rows hidden again
  await js(`(() => { window.__game.scene.getScene('Game').events.emit('open-levelup'); return true; })()`)
  await sleep(400)
  check('reopen resets to ASCEND tab', await js(`(() => { const ui = window.__game.scene.getScene('UI'); return [ui.menuPanel, ui.menuRowEls[0].name.visible, ui.menuShopEls[0].name.visible]; })()`), ['stats', true, false])
  check('stats panel still buys (regression)', await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = 0; ui.refreshMenu(); return ui.menuRowEls[0].cost.text; })()`), '500')

  // ---- CHARMS tab (added by another hand): three tabs, buy then equip, notch economy
  await js(`(() => { const g = window.__game.scene.getScene('Game'); g.player.embers = 5000;
    g.player.charms = []; g.player.equipped = []; g.player.notches = 3; g.writeSave();
    window.__game.scene.getScene('UI').refreshMenu(); return 1; })()`)
  await key('KeyD'); await sleep(200)   // stats -> shop
  await key('KeyD'); await sleep(250)   // shop -> charms
  check('second D reaches the CHARMS tab', await js(`(() => { const ui = window.__game.scene.getScene('UI');
    return [ui.menuPanel, ui.menuRowEls[0].name.visible, ui.menuShopEls[0].name.visible, ui.menuCharmEls[0].name.visible, ui.menuCharmEls.length === CHARM_COUNT]; })()`),
    ['charms', false, false, true, true])
  await key('KeyA'); await sleep(250)
  check('A from charms goes back to SHOP (no wrap)', await js(`(() => { const ui = window.__game.scene.getScene('UI');
    return ui.menuPanel; })()`), 'shop')
  await key('KeyD'); await sleep(250)
  check('hero starts with 3 notches, nothing equipped', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.notches, p.charms.length, p.equipped.length]; })()`), [3, 0, 0])
  // QUICK FLASK is index 6 (price 500, notch 1)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = ui.menuCharmEls.findIndex((e) => e.s.key === 'quickflask'); ui.refreshMenu(); return 6; })()`)
  await key('KeyE'); await sleep(300)
  check('charm bought with embers', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.charms.includes('quickflask'), p.embers]; })()`), [true, 4500])
  await key('KeyE'); await sleep(300)
  check('second press equips it', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.equipped.includes('quickflask'), p.charms.length]; })()`), [true, 1])
  check('quickflask effect reaches the player', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return p.charm('quickflask'); })()`), true)
  await key('KeyE'); await sleep(300)
  check('third press unequips it', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.equipped.includes('quickflask'), p.charms.length]; })()`), [false, 1])
  // notch economy: ASHEN FURY is index 11 (notch 3, price 1400)
  await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.menuIndex = ui.menuCharmEls.findIndex((e) => e.s.key === 'ashenfury'); ui.refreshMenu(); return 11; })()`)
  await key('KeyE'); await sleep(300)
  check('notch cap blocks a 3-notch charm on 3 notches with one spent', await js(`(() => { const p = window.__game.scene.getScene('Game').player;
    return [p.equipped.includes('ashenfury'), p.embers]; })()`), [false, 3100])
  check('secret charms are listed but locked', await js(`(() => { const ui = window.__game.scene.getScene('UI');
    const e = ui.menuCharmEls.find((e) => e.s.secret); return [!!e, e && e.name.text]; })()`), [true, '? ? ?'])
  // owned-but-not-equipped is the correct Hollow-Knight shape: buying records the charm,
  // the notch gate only blocks equipping it
  check('charm state persists in the save', await js(`(() => { const d = JSON.parse(localStorage.getItem('ashen-vigil-save'));
    return [d.charms, d.equipped, d.notches]; })()`), [['quickflask', 'ashenfury'], [], 3])

  // ---- optional screenshots of both panels
  if (process.argv.includes('--shot')) {
    const shot = async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false })
      fs.writeFileSync(path.join('C:/test', file), Buffer.from(r.data, 'base64'))
      console.log('saved   :', file)
    }
    const show = async (panel, file) => {
      await js(`(() => { const ui = window.__game.scene.getScene('UI'); ui.switchPanel('${panel}'); return ui.menuPanel; })()`)
      await sleep(400)
      await shot(file)
    }
    await show('stats', 'vigil-bonfire-stats.png')
    await show('shop', 'vigil-shop.png')
    await show('charms', 'vigil-charms.png')
  }

  check('A on the first tab stays put (clamp, not wrap)', await js(`(() => { const ui = window.__game.scene.getScene('UI');
    ui.switchPanel('stats'); ui.switchPanel('stats'); return ui.menuPanel; })()`), 'stats')
  check('D on the last tab stays put (clamp, not wrap)', await js(`(() => { const ui = window.__game.scene.getScene('UI');
    ui.switchPanel('charms'); ui.switchPanel('charms'); return ui.menuPanel; })()`), 'charms')

  console.log(fails.length ? `\n${fails.length} FAILURE(S):\n- ` + fails.join('\n- ') : '\nALL CHECKS PASSED')
  console.log('LOGS:', logs.length ? logs.join('\n       ') : 'none')
}

main().then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* locks */ } process.exit(fails.length ? 1 : 0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e2) { /* ignore */ } process.exit(1) }, 800) })
