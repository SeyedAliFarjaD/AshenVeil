/**
 * One-off CDP probe: load a page, wait, run JS, evaluate an expression, print it.
 *   node scripts/probe.mjs <url> <waitBeforeMs> <evalExpr> [waitAfterMs] [evalExpr2] [waitAfter2Ms] [evalExpr3]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const [url, waitBefore = '6000', expr = 'document.title', waitAfter = '0', expr2 = '', waitAfter2 = '0', expr3 = ''] = process.argv.slice(2)

const PORT = 9334
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-probe-'))
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
  '--no-proxy-server',
  'about:blank',
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

async function main() {
  let target = null
  for (let i = 0; i < 240 && !target; i++) {
    await sleep(250)
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await r.json()
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
    } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      logs.push(`[console.${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.navigate', { url })
  await sleep(Number(waitBefore))
  const r = await send('Runtime.evaluate', { expression: decodeURIComponent(expr), returnByValue: true })
  console.log('RESULT:', r.result?.value)
  if (expr2) {
    await sleep(Number(waitAfter))
    const r2 = await send('Runtime.evaluate', { expression: decodeURIComponent(expr2), returnByValue: true })
    console.log('RESULT2:', r2.result?.value)
  }
  if (expr3) {
    await sleep(Number(waitAfter2))
    const r3 = await send('Runtime.evaluate', { expression: decodeURIComponent(expr3), returnByValue: true })
    console.log('RESULT3:', r3.result?.value)
  }
  console.log('LOGS:', logs.length ? logs.join('\n       ') : 'none')
}

main().then(() => { chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* chrome still holds locks */ } process.exit(0) }, 800) })
  .catch((e) => { console.error('FAIL', e.message); chrome.kill(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e2) { /* ignore */ } process.exit(1) }, 800) })
