# Project memory — C:/test ("Ashen Vigil")

Phaser 3 souls-like metroidvania, vendored offline, procedural pixel art (no binary assets).

## Conventions
- Persian-language comments/UI per user; Jalali dates.
- Ali (user) runs LLMs locally, privacy-conscious — default offline/local.
- Repo has an AGENTS.md: never auto-build, never auto-create/modify/run tests.
- **Deliver Persian text as HTML with `dir="rtl"` — WorkBuddy's .md preview mangles bidi.**

## Architecture notes
- Character art: `pose()` → renderStrip → PixelCanvas, all procedural.
- Carry/NG+ data flows through `carryData` → `scene.init` → `writeSave` (localStorage).
- Level registry: `src/levels/index.js` `LEVELS[]`, `LAST_LEVEL`.
- Enemies read `scene.ngMul` for HP/dmg/ember scaling; set `parried = false` in reset().

## Headless verification recipe (works)
`python3 tools/serve.py 8123` (ThreadingHTTPServer) → `node scripts/probe.mjs <levelIdx>`
with Chrome flags `--no-proxy-server`. Never port 8080 (local proxy). See daily log
2026-10-25 for details.

## Known quirks
- Headless SwiftShader scene-time ≈ 10× slower: use 9–14s waits for delayedCalls/boot.
- Bellringer-style armor: stagger gate must be `heavy || poise >= N`, never negated.
- CDP tests: build rects with `new Phaser.Geom.Rectangle(...)` — plain objects break
  `RectangleToRectangle` (missing .right/.bottom getters → hits everything). `setPosition`
  doesn't move an arcade body immediately; use `body.reset`.
- **`body.reset(x, y)` does not put the body's top-left at (x, y)** (hollow: −32, −60).
  Don't reposition enemies that way; build the strike rect around `g.bodyRect(enemy)`.
- Title screen: Enter with a save present **continues that save and ignores `?level=N`**;
  emit `{code:'KeyN'}` for a fresh specific-level run. `text.color` is null — use
  `.style.color`. Menu pause = `g.paused`, not `scene.isPaused()`.
- Cheat mode: Shift+O toggles `scene.oneShot` (99999 dmg in playerStrike + updateBolts);
  skull + ONE-SHOT icon top-right in UI, resets per level load.
- Bonfire shop: second menu tab (`menuPanel`), A/D switches, 6 items in `SHOP_ITEMS`
  (UI.js) with ranks in `player.shop` and multipliers derived in `Player.applyStats()`.
  Persisted via `writeSave`/`carryData`. Tests: `scripts/shop-test.mjs`,
  `scripts/shop-fx-test.mjs`.
- **Charms (Hollow Knight style) live in `src/charms.js` — added by the user via
  Claude, treat as theirs.** 12 charms, notch economy (base 3, max 9), boss drops,
  secret false-wall charms. They extended my menu into 3 tabs (ASCEND/SHOP/CHARMS)
  on top of `menuPanel`/`switchPanel`; tab switching CLAMPS at the ends. Player:/n  `charms[]`, `equipped[]`, `notches`, `foundSecrets`, `charm(key)`.
- **User is editing this repo concurrently with Claude.** Re-read a file before every
  edit; verify (don't assume) after their changes land. Never auto-build/test per AGENTS.md.
