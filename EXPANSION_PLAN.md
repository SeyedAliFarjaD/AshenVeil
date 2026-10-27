# Ashen Vigil: Expansion Plan

Goal: many more enemies, harder platforming, more levels, more bosses.
Status: PLAN ONLY. No game code has been changed.

## 1. Prerequisites (gathered and verified)

| Need | Status |
|---|---|
| Python 3.14.4 (`python`, not `python3`) | OK, dev server `python tools/serve.py 8123` |
| Node 22.13 / npm 10.9 | OK |
| Phaser 3.90.0 (vendored in `vendor/`, also in node_modules) | OK, loads in headless Chrome |
| Chrome (for CDP test scripts in `scripts/`) | OK, `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Art / audio assets | None needed: all sprites, tiles, SFX and music are generated in code |
| Extra packages | None needed. No install required |

Port 8080 is taken by a local proxy, so always use 8123.

## 2. How the code is organised (what we extend)

- Levels: `src/levels/levelN.js` return a data object (grid, spawn, bonfires, enemy lists, anchors, boss cfg). Register in `src/levels/index.js` and bump `LAST_LEVEL`.
- Grid values: 1 solid, 0 air, 2 one-way platform, 3 spikes, 4 lava.
- Enemies: `src/entities/Enemies.js` (Hollow, Wisp, Sentinel, Acolyte) and `Bellringer.js`. `Game.js` spawns them from level lists (`hollows`, `sentinels`, `acolytes`, `bellringers`, `wisps`).
- Bosses: `Warden.js` and `Saint.js` take a `cfg` (name, HP, colours, flags like `frost`, `twin`). Levels 3 and 4 are variants of these.
- Hazards in `Game.js`: lava, spikes, fire vents (level 3), grapple anchors, breakable secret walls.
- Art: `src/art/` (humanoid skeleton, `characters.js` poses, `world.js` tiles/props).
- Scaling: enemies read `scene.ngMul` (New Game+).

## 3. Risks to design around

1. A later `carve` erases earlier `fill` platforms. This has made levels 2 and 4 impassable before. Fix: build a reachability checker first (Phase 0).
2. Bosses are re-skins of two AIs. New bosses need genuinely new move sets, not recolours.
3. Other people edit this repo (charms were added separately). Keep changes additive and don't touch `charms.js` or the shop.
4. Headless Chrome is about 10x slower, so tests need long waits.

## 4. Phases

### Phase 0: Tooling (small, do first)
- `scripts/grid-dump.mjs`: print any level grid as ASCII.
- `scripts/reach-test.mjs`: flood-fill reachability using the player's real jump/double-jump/wall-jump/dash/grapple limits. Fails if spawn, every bonfire, every pickup and the boss gate are not reachable in order. Runs for all levels in seconds, no browser.
- Debug flag `?level=N` already exists; extend it to 5..8.

### Phase 1: New platforming mechanics (shared by new levels)
Add as tile types / level-data lists in `Game.js`, each with art in `world.js`:
- **Crumbling platforms:** fall away 0.4s after you land, respawn later.
- **Moving platforms:** horizontal and vertical, carry the player.
- **Ice floor:** low friction (belfry-style levels).
- **Spike and saw traps:** rotating or sliding saw blades on rails.
- **Wind or updraft zones:** push or lift the player.
- **Bounce pads and timed doors/switches** (optional, if time allows).

### Phase 2: New enemies (about 8 types)
| Enemy | Behaviour | Counter |
|---|---|---|
| Archer | Ranged arrows, keeps distance | Close in, roll through |
| Charger / Boar | Telegraphed straight rush, wall stun | Dodge, hit while stunned |
| Bomber | Throws arcing bombs, explodes on death | Kill at range |
| Leaper / Ghoul | Pounces from ledges | Parry mid-air |
| Shade (ghost) | Phases through walls, only hittable when it attacks | Timing |
| Spider | Walls and ceilings, drops on a thread | Look up |
| Shield Duelist | Fast blocks, counter-attacks | Break guard |
| Necromancer | Summons hollows, shielded while minions live | Kill adds, then it |
Plus **mini-bosses** (Elite hollow with a unique move) guarding each bonfire.
All use `scene.ngMul`, `parried=false` in `reset()`, and the existing `takeHit` poise conventions.

### Phase 3: New levels (5 to 8)
Each has a gate ability or mechanic, a themed hazard, and a boss.
5. **The Sunken Foundry:** moving platforms, saw rails, bombers. Boss: forge golem.
6. **The Hollow Wood:** crumbling branches, spiders, archers, wind. Boss: stag-spirit with arena-wide charges.
7. **The Glass Citadel:** ice and mirror platforms, shades, duelists. Boss: duelist queen (fast parry-focused fight).
8. **The Ashen Throne (finale):** all hazards combined, necromancers. Final boss with 3 phases.
The final screen and New Game+ loop move from level 4 to level 8.

### Phase 4: New bosses (4 new, genuinely distinct)
- Forge Golem: slow, arena-wide slams, heats up and opens a weak point.
- Stag Spirit: charge lanes, summons spirit-wolves, phase 2 spreads charge patterns.
- Duelist Queen: parry-and-riposte fight; punishes spamming.
- Ashen King (final): 3 phases, reuses warden/saint moves plus new summon and platform-destroying attacks.
Each: fog gate, intro, phase change, ember drop, charm drop.

### Phase 5: Balance, polish, docs
- Re-tune embers/HP curve across 8 levels, rest-stop spacing, bonfire placement.
- Music and SFX for new enemies (WebAudio synth).
- Update README (levels, controls, tuning).
- Full playthrough via `?level=N` plus `reach-test`.

## 5. Verification per phase
- `reach-test` on every level after any edit (guards the carve/fill bug).
- Browser drive via `scripts/probe.mjs` / `move-test.mjs`: teleport with `body.reset`, run each route.
- Existing `shop-test.mjs` and `shop-fx-test.mjs` must still pass (no regressions to shop/boot).
- Check the browser console is clean on each level.

## 6. Suggested order and size
Phase 0 (small) -> Phase 1 (medium) -> Phase 2 (large) -> one level + boss at a time (5, 6, 7, 8), verifying each before the next -> Phase 5.

## 7. Decisions needed from you
1. How many new levels: 4 (to level 8) or fewer?
2. Difficulty target: souls-hard, or friendlier?
3. OK to add tooling scripts under `scripts/`?
4. Do you want me to start with Phase 0, or build one full vertical slice (one new enemy + one platform mechanic + level 5 + boss) first?
