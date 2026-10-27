/**
 * One-off: boot a level (dispatch Enter), wait for Game scene, screenshot gameplay.
 *   node scripts/shoot-level.mjs <level> <out.png> [waitMs]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const [level = '4', out = 'level.png', waitMs = '9000', preExpr = ''] = process.argv.slice(2)
const url = `http://127.0.0.1:8123/index.html?test&level=${level}`

const PORT = 9335
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-lvl-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--window-size=960,540',
  '--no-first-run',
  '--no-default-browser-check',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--disable-features=Translate,MediaRouter',
  '--no-proxy-server', ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  'about:blank',
])

let ws, nextId = 1
const pending = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})

async function main() {
  let target = null
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
    } catch (e) { /* not up yet */ }
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
    }
  }
  await send('Page.enable')
  await send('Page.navigate', { url })
  await sleep(8000)

  // dispatch generic keydown until Game scene has a player
  const started = await send('Runtime.evaluate', {
    expression: `(() => {
      const g = window.__game;
      let n = 0;
      return new Promise((res) => {
        const t = setInterval(() => {
          const T = g.scene.keys.Title;
          if (T && !T.leaving) T.input.keyboard.emit('keydown', { code: 'Enter' });
          const gm = g.scene.keys.Game;
          if (gm && gm.player) { clearInterval(t); res('player ready'); }
          if (++n > 60) { clearInterval(t); res('timeout'); }
        }, 200);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log('boot  :', started.result?.value)

  if (preExpr) {
    const pre = await send('Runtime.evaluate', { expression: decodeURIComponent(preExpr), returnByValue: true })
    console.log('pre   :', pre.result?.value)
  }

  await sleep(Number(waitMs))
  const state = await send('Runtime.evaluate', {
    expression: `(() => { const g = window.__game; const s = g.scene.keys.Game;
      return JSON.stringify({ level: s.levelNum, hp: s.player.hp, x: Math.round(s.player.x), y: Math.round(s.player.y), enemies: s.enemies ? s.enemies.getLength() : 0 }); })()`,
    returnByValue: true,
  })
  console.log('state :', state.result?.value)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('saved :', out)
}

main()
  .then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* locks */ } process.exit(0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e2) { /* locks */ } process.exit(1) }, 800) })
