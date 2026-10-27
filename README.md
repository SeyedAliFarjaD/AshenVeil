# Ashen Vigil

A 2D souls-like metroidvania built with Phaser 3. It has eight levels, each ending in a boss fight:

1. **The Ashen Ramparts:** *Ser Caedric, the Ashen Warden*.
2. **The Drowned Crypt:** *Morwen, the Drowned Saint*.
3. **The Burning Cathedral:** *the Twin Pyres*, Aldous and Ysolde, fought together.
4. **The Frozen Belfry:** *Sir Hallowyn, the Rimebound*.
5. **The Sunken Foundry:** *Gorrak, the Forge Golem*.
6. **The Hollow Wood:** *Oakhart, the Stag Spirit*.
7. **The Glass Citadel:** *Seraphine, the Duelist Queen*.
8. **The Ashen Throne:** *Vaelor, the Ashen King* (three stages).

The combat blends **Hollow Knight** (pogo plunges, focus-powered soul bolts, constant movement)
with **Nine Sols** (deflect timing, a focus gauge, and the Force super). Rest at bonfires to
spend embers on stats, Dark Souls style. After the last level, New Game+ loops the whole game
with tougher, richer enemies.

Settings include difficulty (Story / Normal / Hard), key rebinding, volume, screen scale (fit or pixel-perfect), fullscreen, and accessibility toggles for screen shake, bright flashes and damage numbers.

Progress (current level, embers, stats, abilities) saves automatically. The title screen offers Continue, or N for a new game.

Every sprite, tile, effect, sound and piece of music is generated in code, so there are no asset files to manage.

## Run it

```bash
npm start
```

Then open http://localhost:8080. You need Python 3, which serves the files with caching disabled. Phaser is vendored in `vendor/`, so it works offline.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | A / D or Arrows | Stick / D-pad |
| Jump (hold for height, again in mid-air for double jump) | Space / Z | A |
| Attack (press again to chain 3 hits) | J / X / Left click | X / RB |
| Plunge (pogo) | Down + Attack in mid-air | Down + X |
| Up slash (hits foes overhead) | Up + Attack | Up + X |
| Roll (invincible) | Shift / K / C | B |
| Parry (riposte on a clean deflect) | L | LT |
| Heal (Ember Flask) | F / Q | Y |
| Soul Bolt (50 focus) | I | - |
| Force, the focused strike (100 focus, forward, blade burns red) | U | - |
| Rest at bonfire / interact | E or W | LB |
| Grapple (mid-air, at iron rings) | R | RT |
| Drop through platforms | S + Space | Down + A |
| Wall slide / wall jump (level 2 ability) | Hold toward a wall in mid-air, then Jump | Stick + A |
| Air dash (level 3 ability, invincible) | Roll while in the air | B in the air |
| One-shot cheat (toggle) | Shift + O | - |
| Bonfire menu: switch tab (ASCEND / SHOP) | A / D or Left / Right | - |
| Pause / mute | Esc / M | Start |

## What's in the game

### Progression (all levels)

- **Bonfire level-up:** resting opens a menu where embers buy **Vigor** (HP), **Endurance**
  (stamina), **Strength** (damage) and **Attunement** (flasks). Costs climb 55% per rank.
- **Bonfire shop:** the same menu carries a second tab. **A / D** switches between ASCEND
  (stats) and SHOP (items). Six items, each bought with embers and each with a rank cap:
  - **Lifeseed** - +20 maximum health per rank (5 ranks)
  - **Hexed Ember** - +15% Soul Bolt and Force damage per rank (5 ranks)
  - **Attuned Mind** - +25% focus from hits and parries per rank (4 ranks)
  - **Ember Flask** - +1 Ember Flask per rank (2 ranks)
  - **Lucky Coin** - +25% embers dropped by the fallen per rank (4 ranks)
  - **Guardian Sigil** - -10% damage taken per rank (3 ranks, floors at 50%)
  
  Costs climb 50% per rank, every purchase is permanent and saved with your progress, and
  the panel's footer line restates what your ranks add up to.
- **Focus gauge:** lands hits (+8, heavy +12) and parries (+25) to fill it. Spend 50 on a
  **Soul Bolt** (I), or 100 on **Force** (U): a 360° cleave with a long stagger window.
- **Parry (L):** an 0.18s window. Arrows, fireballs, orbs, bombs and shockwaves can be parried too: they fly back at the thrower.
- **Traps cut both ways:** an enemy you knock into spikes, lava, a saw or a fire vent (or one that lunges into it) dies.
- **Hidden rooms** are painted over with rock until their false wall breaks; watch for glints, falling grit and drafts.
- **Parry (L) details:** an 0.18s window. A clean parry staggers the attacker (bosses included) and
  leaves a riposte window - the next hit deals 1.75x. A whiff leaves you committed.
- **Plunge (Down + Attack in mid-air):** a heavy overhead stab. Hit something and you pogo
  straight back up, Hollow Knight style.
- **Hit feedback:** every landed hit throws a white "cutting shadow" after-image of the enemy
  along the hit direction, plus impact lines, sparks and hit-stop.
- **One-shot cheat:** Shift + O toggles it. While on, every connected blow (melee, plunge,
  Force, Soul Bolt) kills outright and a skull + ONE-SHOT marker pulses in the top-right
  corner. Shift + O again turns it off. It resets when a level loads.

### Level 1: The Ashen Ramparts

- **Souls-like combat:** stamina, a 3-hit combo with a heavy finisher, i-frame rolls, telegraphed enemy attacks, poise and stagger, hit-stop and screen shake.
- **Ember Flasks:** 3 heals, refilled at bonfires.
- **Bonfires:** checkpoints. Resting refills you and respawns enemies.
- **Death:** you drop your embers where you fell. Get back there to recover them, or lose them if you die again.
- **Metroidvania gate:** a wall you can't climb until you find the **Ashen Feather** (double jump) in the depths below.
- **Enemies:** hollow soldiers (patrol, wind-up, lunge) and wisps (flying skulls that swoop).
- **Boss: the Ashen Warden.** He has a fog gate, an intro roar, slam, swipe, dash and leap attacks, and a stagger window. At 50% HP he enters phase 2 and adds combos, fire pillars, ground shockwaves and faster attacks.

### Level 2: The Drowned Crypt

- **A flooded catacomb** lit by spirit flames. Dark water slows you and softens your falls.
- **Crypt Sentinels:** shield-and-spear knights that block every frontal hit. Break their guard with your heavy third strike, or roll behind them (they turn slowly) for bonus damage.
- **Metroidvania gate:** a sheer shaft you can only climb with the **Gravecrawler's Claw** (wall slide and wall jump), found in the ossuary below.
- **Boss: Morwen, the Drowned Saint.** A floating caster:
  - She keeps her distance and fires homing soul orbs.
  - She teleports behind you to slam the ground, then sits exposed and takes extra damage.
  - She sweeps a telegraphed spirit lance across the arena: jump the low one.
  - At 50% HP the arena floods. She adds wisp summons, raining orbs, and a second high lance: stay grounded for that one.

### Level 3: The Burning Cathedral

- **A cathedral that never stops burning:** stained-glass windows, lava seams, and fire vents that erupt on a rhythm (watch the glow, then pass). Lava burns through i-frames and returns you to the last safe ground.
- **Pyre Acolytes:** robed casters that back away and lob arcing fireballs after a glinting wind-up. They're fragile up close.
- **Metroidvania gate:** a lava trench under a low vault. The ceiling caps your jump, so only the **Cinder Wings** (air dash) from the undercroft can carry you across.
- **Bosses: the Twin Pyres, fought at the same time.**
  - **Aldous, the Pyre Knight:** a heavier, fire-forged Warden.
  - **Ysolde, the Pyre Witch:** a fire-casting Saint with homing fireballs and fire lances.
  - Neither enters phase 2 on their own. When one dies, the survivor absorbs the fallen twin's power: they heal to 60%, enter phase 2, and rage. Choose who to kill first.

### Level 4: The Frozen Belfry

- **A snow-bound tower of bells**, lit by spirit flames. Bellringers stalk the halls.
- **Bellringers:** slow, armored heavy knights. Their overhead slam is telegraphed for nearly a
  second - parry it at the glint, or roll through. Light hits barely dent them; the heavy third
  strike or a parry opens them up. Worth 200 embers.
- **The gate:** a twelve-tile chasm with spikes far below. Three ways across - hop the
  stepping stones, leap-double leap-dash, or grapple the iron rings (R in mid-air). The
  same rings lead back up from the undercroft, where the grapple itself is found.
- **Boss: Sir Hallowyn, the Rimebound.** A heavier, frost-forged Warden: slam, swipe, dash,
  leap and ground shockwaves, and at half health the rime hardens - combos, fire pillars and
  faster attacks.

### New Game+

Beat the last level and the completion screen offers New Game+: the game loops back to
level 1 with everything you earned. Each cycle raises enemy HP (+35%), damage (+20%) and
ember drops (+50%), and bosses scale too. The title screen shows your cycle on Continue.

## Project layout

```
src/
  main.js            Phaser config (960x540 canvas, world camera at 2.25x zoom)
  art/pixel.js       tiny pixel rasterizer (lines, discs, polygons, outlines)
  art/humanoid.js    skeletal character renderer: pose -> pixel-art frame
  art/characters.js  every animation for hero / hollow / warden, as poses
  art/world.js       tiles, parallax, FX, wisp, bonfire, props, UI icons
  audio.js           WebAudio synth SFX + ambient and boss music
  input.js           keyboard + gamepad with per-frame press edges
  fx.js              particles, hit-stop, shake, after-images, slash arcs
  levels/            common.js (carve + autotile), level1.js..level4.js, index.js (registry + save)
  entities/          Player, Hollow + Wisp + Sentinel + Acolyte + Bellringer, Warden, Saint
                     (bosses take a cfg: level 3 reuses both AIs as fire variants and twins,
                      level 4 reuses the Warden AI as the Rimebound)
  scenes/            Boot (generates art), Title, Game, UI (HUD + level-up menu)
tools/
  serve.py           no-cache dev server
  sprites.html       sprite viewer: http://localhost:8080/tools/sprites.html?only=hero&s=4
scripts/             headless Chrome (CDP) verification harnesses
  probe.mjs          load a URL, wait, evaluate an expression, print it
  shoot.mjs          screenshot harness
  shop-test.mjs      drives the bonfire menu with real key events: 30 checks over
                     tab switching, every purchase, rank caps, ember rejection,
                     save persistence and panel state
  shop-fx-test.mjs   proves the shop multipliers reach the real damage, focus,
                     ember and survivability paths, plus a 4-level boot check
```

### How the animation works

Characters are skeletons. A pose is a set of joint angles (in degrees) plus foot targets that are solved with IK, and `renderStrip` rasterizes each pose into a crisp outlined pixel-art frame. To change an animation, edit its poses in `src/art/characters.js`. To restyle a character (colors, helmet, cape, blade length, bulk), edit `STYLES` in `src/art/humanoid.js`. Use the sprite viewer to see the result.

### Tuning

- Player feel: constants at the top of `src/entities/Player.js` (`RUN`, `JUMP_V`, `ROLL_*`) and the `ATTACKS` table.
- Boss difficulty: `maxHp`, the windup times in `windup()`, the damage values in `hitBox(...)` calls, and the poise threshold in `takeHit` (all in `src/entities/Warden.js`).
- Levels: `src/levels/level1.js` to `src/levels/level3.js`. Air is carved out of solid rock with `carve(x0, y0, x1, y1)` in tile coordinates. Each level also lists its theme, enemies, water, ability pickup and boss type.
- Adding a level: create `src/levels/level5.js` using the same shape, register it in `src/levels/index.js`, and bump `LAST_LEVEL`. A level can list several `bosses`, each with a `cfg` (texture prefix, name, HP, colors, `twin`), plus `anchors` for grapple points.

## Assets for faster development

The game ships zero binary assets - every sprite, tile and sound is generated in code - but
if you want to move to hand-made art or audio, these are offline-friendly, license-clean
sources that fit the project:

- **Kenney** (kenney.nl / kenney.itch.io) - CC0 packs, consistent style, no attribution needed.
- **OpenGameArt.org** - huge CC0/CC-BY archive; filter by license before use.
- **itch.io asset stores** - the biggest indie marketplace; watch for CC0 tags on 2D
  platformer and UI packs.
- **Freesound.org** - CC0/CC-BY SFX; pairs well with the existing WebAudio synth.
- **CraftPix.net** - free 2D game asset bundles (check each pack's license).

For tooling: **Aseprite** (pixel art, one-off license), **Tiled** (tilemaps, free),
**Sfxr / jsfxr** (retro SFX), and **Phaser 3 Examples + phaser3-rex-plugins** for
ready-made UI, input and camera behaviors. Phaser itself is vendored in `vendor/`.

### Debug flags

- `?debug`: shows physics hitboxes.
- `?test`: drives the game loop with timers so it keeps running in a background tab (for automated testing).
- `?level=2` or `?level=3`: jumps straight to a level. The abilities from earlier levels are granted automatically.

Verification runs against a local server (`python3 tools/serve.py 8123`, then
`http://127.0.0.1:8123/index.html?test&level=N`). The harnesses live in `scripts/` and need
only Node and a local Chrome:

```
node scripts/shop-test.mjs        # menu: tabs, purchases, caps, persistence
node scripts/shop-fx-test.mjs     # gameplay: damage, focus, embers, ward, boot check
```

## Building more with Claude Code

Some prompts that fit this codebase:

- "Add level 4: a frozen bell tower. Its gate ability is a grappling hook, and its boss fight is vertical."
- "Add a New Game+ that loops back to level 1 with tougher enemies and keeps your embers."
- "Add a parry on L that staggers hollows when timed within 0.15s of their attack's active frames."
- "Add a level-up menu at bonfires that spends embers on Vigor (HP), Endurance (stamina) or Strength (damage)."
- "Give the hero a plunge attack: Down + Attack in mid-air."
- "Add a new enemy: a shield knight that blocks frontal attacks and must be rolled behind."
- "Save progress (lit bonfires, feather, embers) to localStorage."

## Audio credits

Most sound is synthesized in code. These CC0 files in `assets/audio/` replace or layer over some effects and the exploration music (the game falls back to the synth if they are missing):

- `music_dark_place.ogg`: "Dark Place (loop)" by SkyleTheFrench, https://opengameart.org/node/159643 (CC0)
- `music_cathedral_forest.ogg`: "Cathedral in the forest" by congusbongus, https://opengameart.org/content/cathedral-in-the-forest-ambient-loop (CC0)
- `amb_dungeon.ogg`: "Loopable Dungeon Ambience" by JaggedStone, https://opengameart.org/content/loopable-dungeon-ambience (CC0)
- `sfx/*`: "RPG sounds" by Kenney (www.kenney.nl), https://opengameart.org/content/50-rpg-sound-effects (CC0)
