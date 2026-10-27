/**
 * Headless verification harness.
 *
 * Launches Chrome with the DevTools protocol, waits real time (so async data
 * fetches and count-up animations actually finish), collects console errors and
 * page state, then writes full-page screenshots.
 *
 *   node scripts/shoot.mjs <url> <outPrefix> [width] [height] [waitMs] [--lang=fa] [--theme=light]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const [url, prefix = 'shot', w = '1600', h = '1000', waitMs = '7000'] = process.argv.slice(2)
const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const body = a.replace(/^--/, '')
    const eq = body.indexOf('=')
    return eq === -1 ? [body, true] : [body.slice(0, eq), body.slice(eq + 1)]
  })
)

const PORT = 9333
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${w},${h}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-features=Translate,MediaRouter',
    '--no-proxy-server',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function targets() {
  for (let i = 0; i < 240; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const j = await r.json()
      if (j.length) return j
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('chrome devtools never came up')
}

const cleanup = () => {
  try {
    chrome.kill()
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(profile, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

let id = 0
const pending = new Map()
const logs = []

try {
  const list = await targets()
  const page = list.find((t) => t.type === 'page') || list[0]

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      logs.push(`[console.${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text))
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      logs.push(`[log.${msg.params.entry.source}] ${msg.params.entry.text} ${msg.params.entry.url || ''}`)
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(w),
    height: Number(h),
    deviceScaleFactor: 1,
    mobile: false,
  })

  await send('Page.navigate', { url })
  await sleep(Number(waitMs))

  /* apply preference overrides through the app's own storage, then reload */
  if (flags.lang || flags.theme) {
    const prefs = JSON.stringify({
      lang: flags.lang || 'en',
      theme: flags.theme || 'dark',
      density: flags.density || 'comfortable',
      motionOn: true,
      mascot: flags.mascot !== 'off',
      saved: [],
    })
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('animeverse.prefs.v1', ${JSON.stringify(prefs)}); location.reload()`,
    })
    await sleep(Number(waitMs))
  }

  /* optional: drive the page before capturing (e.g. open a modal) */
  if (flags.js) {
    await send('Runtime.evaluate', { expression: decodeURIComponent(String(flags.js)) })
    await sleep(Number(flags.settle || 1600))
  }

  const state = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      title: document.title,
      dir: document.documentElement.dir,
      theme: document.documentElement.className,
      h1: document.querySelector('h1')?.innerText?.replace(/\\n/g,' / '),
      heroStats: [...document.querySelectorAll('section .grad-border')].slice(0,4).map(e=>e.querySelector('.font-display')?.innerText),
      badge: document.querySelector('header span.rounded-full')?.innerText,
      cards: document.querySelectorAll('article').length,
      imgs: document.querySelectorAll('img').length,
      brokenImgs: [...document.querySelectorAll('img')].filter(i=>i.complete && i.naturalWidth===0).length,
      canvas: document.querySelectorAll('canvas').length,
      sections: [...document.querySelectorAll('section[id]')].map(s=>s.id),
      bodyHeight: document.body.scrollHeight,
      swatches: getComputedStyle(document.documentElement).getPropertyValue('--s1').trim(),
    })`,
    returnByValue: true,
  })

  /* full-page capture (entry animations below the fold will not have fired) */
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    optimizeForSpeed: false,
  })
  fs.writeFileSync(`${prefix}-full.png`, Buffer.from(shot.data, 'base64'))

  /* viewport captures at real scroll offsets — what a user actually sees */
  const offsets = String(flags.shots || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)

  for (const off of offsets) {
    await send('Runtime.evaluate', {
      expression: `window.scrollTo({ top: ${off}, behavior: 'instant' })`,
    })
    await sleep(Number(flags.settle || 1400))
    const v = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false })
    fs.writeFileSync(`${prefix}-y${off}.png`, Buffer.from(v.data, 'base64'))
  }

  const metrics = await send('Page.getLayoutMetrics')
  console.log('URL      :', url)
  console.log('viewport :', w + 'x' + h, ' contentHeight:', Math.round(metrics.cssContentSize?.height || 0))
  console.log('state    :', state.result.value)
  console.log('logs     :', logs.length ? logs.slice(0, 14).join('\n           ') : 'none')
  console.log('saved    :', `${prefix}-full.png`, fs.statSync(`${prefix}-full.png`).size, 'bytes')
  if (offsets.length) console.log('           ', offsets.map((o) => `${prefix}-y${o}.png`).join(' '))

  ws.close()
} catch (e) {
  console.error('FAILED:', e.message)
  console.error('logs:', logs.join('\n'))
  process.exitCode = 1
} finally {
  cleanup()
}
