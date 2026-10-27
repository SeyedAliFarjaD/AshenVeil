import { audio } from '../audio.js';
import { FX } from '../fx.js';
import { Controls } from '../input.js';
import { T } from '../levels/common.js';
import { LEVELS, LAST_LEVEL, save } from '../levels/index.js';
import { TILE } from '../art/world.js';
import { CHARMS, CHARM, MAX_NOTCHES } from '../charms.js';
import { tileIndex } from '../levels/common.js';
import { Player } from '../entities/Player.js';
import { Hollow, Wisp, Sentinel, Acolyte } from '../entities/Enemies.js';
import { Bellringer } from '../entities/Bellringer.js';
import { Warden } from '../entities/Warden.js';
import { Saint } from '../entities/Saint.js';
import { NEW_ENEMY_TYPES, GROUNDED } from '../entities/NewEnemies.js';
import { NEW_BOSSES } from '../entities/NewBosses.js';
import { Hazards } from '../hazards.js';
import { settings, keyLabel } from '../settings.js';

const PICKUPS = {
  feather: { tex: 'feather', glow: 0xffe2a0, flag: 'hasDouble', name: 'ASHEN FEATHER', desc: 'Press Jump again in mid-air to double jump.' },
  claw: { tex: 'claw', glow: 0x7affd8, flag: 'hasWallJump', name: 'GRAVECRAWLER\'S CLAW', desc: 'Hold toward a wall in mid-air to slide down it. Press Jump to leap off.' },
  cinder: { tex: 'cinder', glow: 0xff8a3a, flag: 'hasDash', name: 'CINDER WINGS', desc: 'Press Roll in mid-air to dash. You are untouchable mid-dash.' },
  grapple: { tex: 'hook', glow: 0x9fd8ff, flag: 'hasGrapple', name: 'RIMEWARD GRAPPLE', desc: 'Press R in mid-air to fire the grapple at an iron ring.' },
  glide: { tex: 'mantle', glow: 0xb8c8ff, flag: 'hasGlide', name: 'ASHEN MANTLE', desc: 'Hold Jump while falling to glide down slowly.' },
};
// one-time relics: a permanent boon, remembered in foundSecrets
const RELICS = {
  notch: { name: 'RELIC OF THE FORGE', desc: '+1 charm notch.  Equip charms at a bonfire.', apply: (p) => { p.notches = Math.min(MAX_NOTCHES, p.notches + 1); } },
  vigor: { name: 'RELIC OF THE WOOD', desc: '+1 Vigor, freely given.', apply: (p) => { p.stats.vigor++; p.applyStats(); } },
  flask: { name: 'RELIC OF THE GLASS', desc: '+1 Attunement: another Ember Flask.', apply: (p) => { p.stats.attun++; p.applyStats(); p.flasks = p.maxFlasks; } },
  might: { name: 'RELIC OF THE THRONE', desc: '+1 Strength and +1 Endurance.', apply: (p) => { p.stats.str++; p.stats.endur++; p.applyStats(); } },
};
const BOSSES = { warden: Warden, saint: Saint, ...NEW_BOSSES };

// enemy states that carry it forward without looking where it lands
const COMMITTED = new Set(['attack', 'thrust', 'bash', 'charge', 'lunge', 'leap', 'dash', 'pounce', 'claw', 'swing1', 'swing2', 'backhop', 'stagger', 'broken']);

const TIERS = {
  weak: { tint: 0x86a8ff, hp: 0.65, dmg: 0.7, embers: 0.7 },
  strong: { tint: 0xff6a5a, hp: 1.6, dmg: 1.4, embers: 1.8 },
};

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    const urlLevel = Number(new URLSearchParams(location.search).get('level'));
    this.levelNum = (data && data.level) || (LEVELS[urlLevel] ? urlLevel : 1);
    this.carry = (data && data.carry) || null;
    this.ng = (this.carry && this.carry.ng) || 0; // New Game+ cycle
  }

  create() {
    this.fx = new FX(this);
    this.ctl = new Controls(this);
    this.paused = false;
    this.hitStopping = false;
    this.oneShot = false; // cheat (Shift+O): every connected blow kills
    const c = this.carry || {};
    this.deaths = c.deaths || 0;
    this.startTime = this.time.now - (c.time || 0) * 1000;
    // New Game+ scaling: enemies hit harder, endure more, and are worth more
    // base difficulty: enemies and hazards are 25% tougher and hit 25% harder, and
    // embers drop at 40% (-60%). New Game+ scales on top of this.
    const HARD = 1.25, EMBERS = 0.4;
    this.ngMul = { hp: HARD * (1 + 0.35 * this.ng), dmg: HARD * (1 + 0.2 * this.ng), embers: EMBERS * (1 + 0.5 * this.ng) };
    this.orbs = [];
    this.soulBolts = [];
    this.reflected = []; // enemy projectiles the hero parried back

    const L = this.level = LEVELS[this.levelNum]();
    const theme = L.theme;
    const WW = L.W * T, WH = L.H * T;
    this.physics.world.setBounds(0, 0, WW, WH);
    this.syncPhysicsToDisplay();

    this.buildBackground(theme.sky);

    // --- tilemaps
    const backMap = this.make.tilemap({ data: L.back, tileWidth: T, tileHeight: T });
    const backLayer = this.backLayer = backMap.createLayer(0, backMap.addTilesetImage('tiles'), 0, 0).setDepth(1);
    const map = this.make.tilemap({ data: L.data, tileWidth: T, tileHeight: T });
    this.ground = map.createLayer(0, map.addTilesetImage('tiles'), 0, 0).setDepth(10);
    if (theme.groundTint) this.ground.setTint(theme.groundTint);
    if (theme.backTint) backLayer.setTint(theme.backTint);
    this.ground.setCollisionBetween(0, TILE.PLATFORM);
    this.ground.forEachTile((t) => { if (t.index === TILE.PLATFORM) t.setCollision(false, false, true, false); });

    this.buildDecor();
    this.buildWater();
    this.buildFire();
    this.hazards = new Hazards(this, L);

    // --- grapple anchors (iron rings on the walls)
    for (const a of this.level.anchors || []) {
      this.add.image(a.x, a.y, 'anchor').setOrigin(0.5).setDepth(9);
      const gl = this.fx.glow(a.x, a.y, 0x9fd8ff, 0.7, 0.35, 8);
      this.tweens.add({ targets: gl, alpha: 0.15, yoyo: true, repeat: -1, duration: 900 + Math.random() * 600 });
    }

    // --- bonfires
    this.bonfires = L.bonfires.map((b) => {
      const sprite = this.add.sprite(b.x, b.y, 'bonfire', 6).setOrigin(0.5, 1).setDepth(8);
      const glow = this.fx.glow(b.x, b.y - 14, 0xff8a30, 0.9, 0.15, 7);
      return { ...b, sprite, glow, lit: false };
    });

    // --- messages
    this.messages = L.messages.map((m) => {
      this.add.image(m.x, m.y, 'message').setOrigin(0.5, 1).setDepth(9);
      this.fx.glow(m.x, m.y - 2, 0xff8a30, 0.25, 0.4, 9);
      return m;
    });

    // --- player (abilities and embers carry over between levels)
    this.checkpoint = { x: L.spawn.x, y: L.spawn.y };
    this.player = new Player(this, L.spawn.x, L.spawn.y);
    const P = this.player;
    Object.assign(P, L.startAbilities || {});
    if (c.hasDouble) P.hasDouble = true;
    if (c.hasWallJump) P.hasWallJump = true;
    if (c.hasDash) P.hasDash = true;
    if (c.hasGrapple) P.hasGrapple = true;
    if (c.hasGlide) P.hasGlide = true;
    if (c.stats) Object.assign(P.stats, c.stats);
    if (c.shop) Object.assign(P.shop, c.shop);
    if (c.charms) P.charms = [...c.charms];
    if (c.equipped) P.equipped = [...c.equipped];
    if (c.notches) P.notches = c.notches;
    if (c.foundSecrets) P.foundSecrets = [...c.foundSecrets];
    P.applyStats();
    P.embers = c.embers || 0;
    this.physics.add.collider(P, this.ground, null, (p, tile) => !(tile.index === TILE.PLATFORM && p.dropTimer > 0));

    this.buildSecrets();

    // --- ability pickup (skipped if already owned)
    const pk = L.pickup, relic = pk.type === 'relic' ? RELICS[pk.boon] : null;
    const def = relic ? { tex: 'relic', glow: 0xc9a8ff, flag: null, name: relic.name, desc: relic.desc, relic: pk } : PICKUPS[pk.type];
    this.pickup = null;
    this.add.image(pk.x, pk.y, 'altar').setOrigin(0.5, 1).setDepth(8);
    const relicId = relic ? `relic-${this.levelNum}` : null;
    if (relic ? !P.foundSecrets.includes(relicId) : !P[def.flag]) {
      const img = this.add.image(pk.x, pk.y - 30, def.tex).setDepth(9);
      const glow = this.fx.glow(pk.x, pk.y - 30, def.glow, 0.8, 0.55, 8);
      this.tweens.add({ targets: [img, glow], y: '-=5', yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut' });
      this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 800 });
      this.pickup = { img, glow, def };
    }

    // --- enemies
    this.hollows = L.hollows.map((p) => new Hollow(this, p.x, p.y));
    this.sentinels = (L.sentinels || []).map((p) => new Sentinel(this, p.x, p.y));
    this.acolytes = (L.acolytes || []).map((p) => new Acolyte(this, p.x, p.y));
    this.bellringers = (L.bellringers || []).map((p) => new Bellringer(this, p.x, p.y));
    // levels 5-8: more enemy types, listed by name in the level data
    this.extras = [];
    for (const [key, Cls] of Object.entries(NEW_ENEMY_TYPES)) {
      for (const p of L[key] || []) {
        const e = new Cls(this, p.x, p.y);
        this.extras.push(e);
        if (GROUNDED.has(Cls)) this.physics.add.collider(e, this.ground);
      }
    }
    this.physics.add.collider(this.acolytes, this.ground);
    this.buildSwarms();
    this.wisps = L.wisps.map((p) => new Wisp(this, p.x, p.y));
    this.physics.add.collider(this.hollows, this.ground);
    this.physics.add.collider(this.sentinels, this.ground);
    this.physics.add.collider(this.bellringers, this.ground);
    this.physics.add.collider(this.wisps, this.ground);
    [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.extras, ...this.wisps]
      .forEach((e, i) => this.applyTier(e, i));

    // --- boss + fog gate
    const A = L.arena;
    this.bosses = (L.bosses || [L.boss]).map((d) => new BOSSES[d.type](this, d.x, d.y, A, d.cfg || {}));
    this.physics.add.collider(this.bosses, this.ground);
    this.bosses.forEach((b) => { b.maxHp = Math.round(b.maxHp * this.ngMul.hp); b.hp = b.maxHp; });
    const fg = L.fogGate;
    this.fog = this.add.tileSprite(fg.x + 8, fg.top, 16, fg.bottom - fg.top, 'fog').setOrigin(0.5, 0).setDepth(23).setAlpha(0.85).setBlendMode('ADD');
    this.fogGlow = this.fx.glow(fg.x + 8, (fg.top + fg.bottom) / 2, 0xc8c8ff, 0.7, 0.25, 22);
    this.fogWall = this.add.zone(fg.x + 8, (fg.top + fg.bottom) / 2 - 64, 16, fg.bottom - fg.top + 128);
    this.physics.add.existing(this.fogWall, true);
    this.fogWall.body.enable = false;
    this.physics.add.collider(P, this.fogWall);
    this.physics.add.collider(this.bosses, this.fogWall);
    this.bossStarted = false;
    this.bossDefeated = false;

    // --- camera
    const cam = this.cameras.main;
    cam.setZoom(2.25);
    cam.setBounds(0, 0, WW, WH);
    cam.startFollow(P, true, 0.1, 0.1);
    cam.setFollowOffset(0, 46);
    cam.setRoundPixels(true);
    cam.fadeIn(1200, 0, 0, 0);
    this.buildAtmosphere(theme);

    // ambient motes drifting up through the view (embers outside, spirit motes in the crypt)
    this.ambient = this.add.particles(0, 0, 'px1', {
      x: { min: 0, max: 480 }, y: { min: 0, max: 10 }, lifespan: 7000, frequency: 140,
      speedY: { min: -12, max: -32 }, speedX: { min: -8, max: 10 }, scale: { start: 1, end: 1 },
      alpha: { start: 0.9, end: 0 }, blendMode: 'ADD',
      tint: (theme.sky || theme.ambientTint === 'fire') ? [0xffb347, 0xff7a2a, 0xffe2a0] : [0x7affd8, 0x9ff6ff, 0x4ab0c0],
    }).setDepth(24);

    this.scene.launch('UI');
    audio.playMusic(theme.music);
    this.events.once('shutdown', () => { audio.stopMusic(0.5); });
    this.time.delayedCall(1500, () => this.events.emit('banner', L.name, '#d8cfb8', `Level ${L.id}`));
    this.writeSave();
  }

  // VSync: the loop renders on requestAnimationFrame (locked to the display), but
  // Arcade physics steps at a fixed 60Hz by default, which stutters on 75/120/144Hz
  // screens. Step physics at the display's own refresh rate: one step per vsync.
  syncPhysicsToDisplay() {
    const loop = this.game.loop;
    if (!loop.raf || loop.raf.isSetTimeOut) return; // ?test runs on timers, not vsync
    const RATES = [60, 75, 90, 100, 120, 144, 165, 180, 240];
    const measured = loop.actualFps || 60;
    const hz = RATES.reduce((a, b) => (Math.abs(b - measured) < Math.abs(a - measured) ? b : a));
    this.physics.world.setFPS(hz);
  }

  // Lighting and atmosphere: bloom on bright light (fire, sparks, slashes), a mild
  // color grade, soft contact shadows under every walker, and a drifting
  // foreground mist. Post FX need WebGL; on canvas they are skipped.
  buildAtmosphere(theme) {
    const cam = this.cameras.main;
    // Graphics quality: high = bloom + colour grade + tier glows; low drops the
    // full-screen bloom passes (the main GPU cost on integrated graphics).
    if (cam.postFX) {
      this.bloom = settings.effectiveQuality === 'high' ? cam.postFX.addBloom(0xffffff, 1, 1, 1.1, 0.75, 3) : null;
      const cm = cam.postFX.addColorMatrix();
      cm.contrast(0.12);
      cm.saturate(0.12, true);
    }
    this.perf = { t: 0, frames: 0, slow: 0 };
    this.testMode = new URLSearchParams(location.search).has('test');
    // auto-pause when the window loses focus (alt-tab, tab switch)
    const autoPause = () => {
      const ui = this.scene.get('UI');
      if (!this.testMode && !this.paused && !this.player.dead && !(ui && ui.menuOpen)) this.setPaused(true);
    };
    this.game.events.on('blur', autoPause);
    this.game.events.on('hidden', autoPause);
    this.events.once('shutdown', () => { this.game.events.off('blur', autoPause); this.game.events.off('hidden', autoPause); });
    this.mist = this.add.tileSprite(480, 345, 480, 70, 'bg_fog').setScrollFactor(0).setDepth(25)
      .setAlpha(theme.sky ? 0.22 : 0.16).setBlendMode('ADD').setTint(theme.torchTint || 0xffffff);
    this.shadows = [];
    const walkers = [this.player, ...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.extras.filter((e) => e.constructor.name !== 'Shade' && e.constructor.name !== 'Spider'), ...this.bosses];
    for (const o of walkers) this.shadows.push({ o, img: this.add.image(o.x, o.y, 'shadow').setDepth(o.depth - 1) });
  }

  // Each shadow sits on the ground under its owner (up to 6 tiles down),
  // shrinking and fading the higher the owner is.
  updateAtmosphere() {
    const cam = this.cameras.main;
    this.mist.tilePositionX = cam.worldView.x * 0.9 + this.time.now * 0.01;
    for (const s of this.shadows) {
      const o = s.o, b = o.body;
      if (!o.visible || !b || !b.enable || o.alpha < 0.3) { s.img.setVisible(false); continue; }
      const x = b.center.x;
      let ground = null;
      for (let y = b.bottom + 1; y <= b.bottom + 6 * T; y += T / 2) {
        if (this.isSolidAt(x, y)) { ground = Math.floor(y / T) * T; break; }
      }
      if (ground === null) { s.img.setVisible(false); continue; }
      const k = Phaser.Math.Clamp(1 - (ground - b.bottom) / (6 * T), 0, 1);
      s.img.setVisible(true).setPosition(x, ground + 1).setAlpha(0.55 * k).setScale((b.width * 2.2 / 64) * (0.5 + 0.5 * k), 1);
    }
  }

  writeSave(level = this.levelNum) {
    const p = this.player;
    save.write({
      level, embers: p.embers, hasDouble: p.hasDouble, hasWallJump: p.hasWallJump, hasDash: p.hasDash, hasGrapple: p.hasGrapple, hasGlide: p.hasGlide,
      stats: p.stats, shop: p.shop, charms: p.charms, equipped: p.equipped, notches: p.notches, foundSecrets: p.foundSecrets, ng: this.ng,
      deaths: this.deaths, time: Math.floor((this.time.now - this.startTime) / 1000),
      tutorial: this.tut ? [...this.tut.shown] : (this.carry && this.carry.tutorial) || [],
    });
  }

  carryData() {
    const p = this.player;
    return {
      embers: p.embers, hasDouble: p.hasDouble, hasWallJump: p.hasWallJump, hasDash: p.hasDash, hasGrapple: p.hasGrapple, hasGlide: p.hasGlide,
      stats: p.stats, shop: p.shop, charms: [...p.charms], equipped: [...p.equipped], notches: p.notches, foundSecrets: [...p.foundSecrets], ng: this.ng,
      deaths: this.deaths, time: Math.floor((this.time.now - this.startTime) / 1000),
    };
  }

  // ------------------------------------------------------------ water
  buildWater() {
    this.water = (this.level.water || []).map((w) => this.makeWater(w.x, w.y, w.w, w.h));
    this.flood = null;
  }

  makeWater(x, y, w, h) {
    const body = this.add.rectangle(x, y + h, w, h, 0x1c5a6a, 0.42).setOrigin(0, 1).setDepth(21);
    const surf = this.add.tileSprite(x, y, w, 4, 'watersurf').setOrigin(0, 0.5).setDepth(21).setAlpha(0.85);
    return { x, y, w, h, body, surf };
  }

  // Boss 2 phase 2: the arena floods knee-deep.
  floodArena(on) {
    const A = this.level.arena;
    if (on && !this.flood) {
      const f = this.makeWater(A.x0, A.floor, A.x1 - A.x0, 0);
      this.flood = f;
      this.water.push(f);
      audio.play('splash');
      this.tweens.add({ targets: f, h: 26, duration: 2200, ease: 'Sine.Out', onUpdate: () => this.syncWater(f) });
    } else if (!on && this.flood) {
      const f = this.flood;
      this.flood = null;
      this.tweens.add({ targets: f, h: 0, duration: 2000, onUpdate: () => this.syncWater(f), onComplete: () => {
        f.body.destroy(); f.surf.destroy();
        this.water = this.water.filter((w) => w !== f);
      } });
    }
  }

  syncWater(f) {
    f.y = this.level.arena.floor - f.h;
    f.body.setSize(f.w, f.h);
    f.surf.setY(f.y).setVisible(f.h > 1);
  }

  waterAt(x, y) {
    return this.water.some((w) => w.h > 1 && x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
  }

  // ------------------------------------------------------------ fire: vents, lava, windows
  buildFire() {
    const L = this.level;
    // stained-glass windows with soft light shafts
    for (const [tx, ty] of L.windows || []) {
      const x = tx * T + 8, y = ty * T;
      this.add.image(x, y, 'window').setOrigin(0.5, 0).setDepth(2).setAlpha(0.9);
      this.fx.glow(x, y + 28, 0xff7a3a, 1.0, 0.18, 2);
      const shaft = this.add.image(x + 18, y + 80, 'glow').setScale(0.35, 1.6).setAngle(-18).setTint(0xffb070).setAlpha(0.08).setBlendMode('ADD').setDepth(3);
      this.tweens.add({ targets: shaft, alpha: 0.13, yoyo: true, repeat: -1, duration: 2400 + Math.random() * 1200, ease: 'Sine.InOut' });
    }
    // lava glows + rising embers along every lava run
    const lavaRows = {};
    L.data.forEach((row, y) => row.forEach((v, x) => { if (v === TILE.LAVA) (lavaRows[y] = lavaRows[y] || []).push(x); }));
    for (const [y, xs] of Object.entries(lavaRows)) {
      for (const x of xs) {
        if (x % 2) continue;
        const gl = this.fx.glow(x * T + 8, Number(y) * T + 4, 0xff6a20, 0.5, 0.45, 9);
        this.tweens.add({ targets: gl, alpha: 0.25, yoyo: true, repeat: -1, duration: 500 + Math.random() * 500 });
      }
      const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T;
      this.add.particles(0, 0, 'px', {
        x: { min: x0, max: x1 }, y: Number(y) * T, lifespan: 1400, frequency: 160,
        speedY: { min: -50, max: -20 }, speedX: { min: -10, max: 10 }, scale: { start: 1, end: 0 },
        tint: [0xffb347, 0xff7a2a, 0xfff0b0], blendMode: 'ADD',
      }).setDepth(22);
    }
    this.lavaCooldown = 0;
    // fire vents on a shared rhythm, staggered along the hall
    this.jets = (L.jets || []).map(([tx, ty], i) => {
      const x = tx * T + 8, y = ty * T;
      this.add.image(x, y + 1, 'vent').setOrigin(0.5, 1).setDepth(11);
      const pillar = this.add.sprite(x, y, 'pillar').setOrigin(0.5, 1).setScale(0.8, 0.85).setDepth(21).setBlendMode('ADD').setVisible(false);
      pillar.play('pillar');
      const glow = this.fx.glow(x, y - 6, 0xff6a20, 0.5, 0, 20);
      return { x, y, pillar, glow, offset: (i * 0.9) % 3, hit: false, on: false };
    });
  }

  updateFire(dt, p) {
    const PERIOD = 3, WARN = 1.6, ON = 2.25;
    const now = this.time.now / 1000;
    const view = this.cameras.main.worldView;
    for (const j of this.jets) {
      const t = (now + j.offset) % PERIOD;
      const on = t >= ON;
      j.glow.setAlpha(t >= WARN ? Math.min(0.8, (t - WARN) * 1.4) : 0);
      if (t >= WARN && t < ON && Math.random() < 0.25) this.fx.fire.explode(1, j.x + (Math.random() - 0.5) * 10, j.y - 2);
      if (on && !j.on) {
        j.hit = false;
        if (Phaser.Geom.Rectangle.Contains(view, j.x, j.y - 20)) audio.play('jet', 0.6);
      }
      j.on = on;
      j.pillar.setVisible(on);
      if (on && !j.hit && this.hitPlayer(new Phaser.Geom.Rectangle(j.x - 8, j.y - 72, 16, 72), 22 * this.ngMul.dmg, j.x, 0.8)) j.hit = true;
    }
    // lava: burns through i-frames and returns you to the last safe ground
    this.lavaCooldown -= dt;
    if (!p.dead && this.lavaCooldown <= 0) {
      const b = p.body;
      for (const [x, y] of [[b.left + 2, b.bottom - 2], [b.right - 2, b.bottom - 2], [b.center.x, b.center.y]]) {
        const tile = this.ground.getTileAtWorldXY(x, y);
        if (tile && tile.index === TILE.LAVA) { this.lavaBurn(p); break; }
      }
    }
  }

  lavaBurn(p) {
    this.lavaCooldown = 0.6;
    audio.play('lava');
    audio.play('hurt');
    this.fx.burst('fire', p.x, p.y - 8, 30);
    this.fx.flash(0xff5a10, 200, 0.4);
    this.fx.shake(0.008, 160);
    p.hp -= 30 * this.ngMul.dmg * p.dmgTakenMul;
    if (p.hp <= 0) { p.hp = 0; p.die(); return; }
    p.warpTo(p.lastSafe.x, p.lastSafe.y);
  }

  // A respawn-worthy spot: solid floor under and a little beyond both feet,
  // and no hazard at foot level or just beside it.
  isSafeGround(p) {
    const b = p.body;
    const tile = (x, y) => this.ground.getTileAtWorldXY(x, y);
    const solid = (x) => { const t = tile(x, b.bottom + 2); return t && t.index >= 0 && t.index <= TILE.PLATFORM; };
    const hazard = (x, y) => { const t = tile(x, y); return t && (t.index === TILE.LAVA || t.index === TILE.SPIKES); };
    for (const x of [b.left - 24, b.left - 10, b.center.x, b.right + 10, b.right + 24]) {
      if (hazard(x, b.bottom - 2) || hazard(x, b.bottom + 2)) return false;
    }
    return solid(b.left - 8) && solid(b.right + 8);
  }

  // ------------------------------------------------------------ swarm zones (Silksong style)
  // Step into the zone and foes keep pouring in from its spawn points until the quota is
  // spent. Resting at a bonfire resets the zone, so it can be fought again.
  buildSwarms() {
    this.swarms = (this.level.swarms || []).map((z) => ({
      ...z, rect: new Phaser.Geom.Rectangle(z.x0 * T, z.y0 * T, (z.x1 - z.x0 + 1) * T, (z.y1 - z.y0 + 1) * T),
      state: 'idle', spawned: [], count: 0, cd: 0,
    }));
  }

  // Attack tokens: only a couple of foes press the attack at once; the rest circle and wait.
  canEngage(e) {
    let n = 0;
    const pools = [this.hollows, this.sentinels, this.extras, this.wisps, this.bellringers, this.acolytes];
    for (const pool of pools) for (const o of pool) if (o !== e && o.engaged && !o.dead) n++;
    return n < 2 + (this.ng > 0 ? 1 : 0);
  }

  spawnFoe(kind, x, y) {
    let e;
    if (kind === 'hollow') { e = new Hollow(this, x, y); this.hollows.push(e); this.physics.add.collider(e, this.ground); }
    else if (kind === 'wisp') { e = new Wisp(this, x, y); this.wisps.push(e); this.physics.add.collider(e, this.ground); }
    else {
      const Cls = NEW_ENEMY_TYPES[kind + 's'];
      e = new Cls(this, x, y); this.extras.push(e);
      if (GROUNDED.has(Cls)) this.physics.add.collider(e, this.ground);
    }
    e.swarm = true;
    this.applyTier(e, Math.floor(Math.random() * 1000));
    this.shadows.push({ o: e, img: this.add.image(e.x, e.y, 'shadow').setDepth(e.depth - 1) });
    return e;
  }

  clearSwarm(z) {
    for (const e of z.spawned) {
      this.hollows = this.hollows.filter((o) => o !== e);
      this.extras = this.extras.filter((o) => o !== e);
      if (this.wisps.includes(e)) { this.wisps = this.wisps.filter((o) => o !== e); if (e.glowImg) e.glowImg.destroy(); }
      this.shadows = this.shadows.filter((sh) => { if (sh.o === e) { sh.img.destroy(); return false; } return true; });
      if (e.arrows) e.arrows.forEach((a) => a.sp.destroy());
      if (e.bombs) e.bombs.forEach((b) => b.sp.destroy());
      e.destroy();
    }
    z.spawned = []; z.count = 0; z.state = 'idle'; z.cd = 0;
  }

  updateSwarms(dt, p) {
    for (const z of this.swarms) {
      if (z.state === 'done' || p.dead) continue;
      const inside = Phaser.Geom.Rectangle.Contains(z.rect, p.x, p.y - 12);
      if (z.state === 'idle' && inside) {
        z.state = 'active'; z.cd = 0.6;
        this.events.emit('banner', z.title || 'AMBUSH', '#d86a5a', 'Hold your ground', 2600);
        audio.play('roar', 0.5);
        this.fx.shake(0.005, 400);
      }
      if (z.state !== 'active') continue;
      const alive = z.spawned.filter((e) => !e.dead);
      if (inside && z.count < z.total && alive.length < z.max) {
        z.cd -= dt;
        if (z.cd <= 0) {
          z.cd = z.interval || 2;
          // prefer spawn points away from the hero
          const pts = z.spawns.map(([tx, ty]) => ({ x: tx * T + 8, y: (ty + 1) * T })).filter((q) => Math.abs(q.x - p.x) > 90);
          const q = pts.length ? pts[Math.floor(Math.random() * pts.length)] : null;
          if (q) {
            const kind = z.kinds[z.count % z.kinds.length];
            const e = this.spawnFoe(kind, q.x, kind === 'wisp' ? q.y - 40 : q.y);
            this.fx.burst('spirit', q.x, q.y - 20, 16);
            this.fx.ring(q.x, q.y - 20, 0xd86a5a, 1.6, 300);
            audio.play('vanish', 0.35);
            z.spawned.push(e); z.count++;
          }
        }
      }
      if (z.count >= z.total && z.spawned.every((e) => e.dead)) {
        z.state = 'done';
        this.events.emit('banner', 'THE SWARM IS SPENT', '#e8c36a', null, 2600);
        audio.play('victory', 0.5);
        this.grantEmbers(Math.round((z.reward || 300) * this.ngMul.embers / 0.4 * 0.4), p.x, p.y - 30);
      }
    }
  }

  spawnMinion(x, y) {
    const w = new Wisp(this, x, y);
    this.physics.add.collider(w, this.ground);
    this.wisps.push(w);
    this.fx.burst('spirit', x, y, 16);
    return w;
  }

  removeMinion(w) {
    this.wisps = this.wisps.filter((o) => o !== w);
    w.glowImg.destroy();
    w.destroy();
  }

  buildBackground(sky) {
    const mk = (key, depth) => this.add.tileSprite(480, 270, 480, 270, key).setScrollFactor(0).setDepth(depth).setVisible(sky);
    this.bgSky = mk('bg_sky', -10);
    this.bgFar = mk('bg_far', -9);
    this.bgMid = mk('bg_mid', -8);
    this.bgFog = this.add.tileSprite(480, 330, 480, 90, 'bg_fog').setScrollFactor(0).setDepth(-7).setAlpha(0.8).setVisible(sky);
  }

  buildDecor() {
    const L = this.level;
    for (const [tx, ty] of L.columns) this.add.image(tx * T, ty * T, 'column').setOrigin(0.5, 1).setDepth(2).setTint(0x9a90a8);
    for (const [tx, ty] of L.banners) {
      const b = this.add.image(tx * T + 8, ty * T, 'banner').setOrigin(0.5, 0).setDepth(3);
      this.tweens.add({ targets: b, angle: { from: -1.5, to: 1.5 }, yoyo: true, repeat: -1, duration: 2200 + Math.random() * 800, ease: 'Sine.InOut' });
    }
    for (const [tx, ty] of L.chains) this.add.image(tx * T + 8, ty * T, 'chain').setOrigin(0.5, 0).setDepth(3);
    for (const [tx, ty] of L.torches) {
      const x = tx * T + 8, y = ty * T + 8;
      const key = L.theme.sky ? 'torch' : 'torch_spirit';
      this.add.sprite(x, y, key).setDepth(4).play({ key, startFrame: Math.floor(Math.random() * 4) });
      const g = this.fx.glow(x, y - 4, L.theme.torchTint, 0.9, 0.35, 5);
      this.tweens.add({ targets: g, alpha: 0.22, scale: 0.8, yoyo: true, repeat: -1, duration: 120 + Math.random() * 200 });
    }
  }

  // ------------------------------------------------------------ queries
  isSolidAt(x, y) {
    const t = this.ground.getTileAtWorldXY(x, y);
    return !!(t && t.index >= 0 && t.index <= TILE.PLATFORM);
  }

  // Solid rock only (not one-way platforms): used for wall slides.
  isWallAt(x, y) {
    const t = this.ground.getTileAtWorldXY(x, y);
    return !!(t && t.index >= 0 && t.index < TILE.PLATFORM);
  }

  onPlatform(p) {
    if (this.hazards && this.hazards.standing) return true;
    const b = p.body;
    for (const x of [b.left + 1, b.center.x, b.right - 1]) {
      const t = this.ground.getTileAtWorldXY(x, b.bottom + 2);
      if (t && t.index === TILE.PLATFORM) return true;
    }
    return false;
  }

  bodyRect(o) { const b = o.body; return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height); }

  // ------------------------------------------------------------ combat
  // Regular foes come in three strengths, told apart by tint:
  // ashen blue = weak, unmarked = normal, blood red = strong. Picked from the
  // level and spawn index so a given foe keeps its tier across deaths and reloads.
  applyTier(e, i) {
    const h = ((this.levelNum || 1) * 7919 + i * 104729) % 100;
    const tier = h < 30 ? TIERS.weak : h < 75 ? null : TIERS.strong;
    if (!tier) return;
    e.tier = tier;
    // tint alone barely shows on the dark sprites: add a coloured rim glow (WebGL only)
    if (e.preFX && settings.effectiveQuality === 'high') e.tierGlow = e.preFX.addGlow(tier.tint, 3, 0, false, 0.1, 10);
    e.clearTint = function () { return this.setTint(tier.tint); };
    const reset = e.reset && e.reset.bind(e);
    if (reset) {
      e.reset = (...a) => {
        const r = reset(...a);
        e.hp = Math.max(1, Math.round(e.hp * tier.hp));
        if (e.embers) e.embers = Math.round(e.embers * tier.embers);
        e.setTint(tier.tint);
        return r;
      };
    }
    e.hp = Math.max(1, Math.round(e.hp * tier.hp));
    if (e.embers) e.embers = Math.round(e.embers * tier.embers);
    e.setTint(tier.tint);
    const update = e.update.bind(e);
    e.update = (...a) => { this.dmgMul = tier.dmg; try { return update(...a); } finally { this.dmgMul = 1; } };
  }

  hitPlayer(rect, dmg, fromX, knock = 1) {
    const p = this.player;
    if (p.dead) return false;
    dmg *= this.dmgMul || 1;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, this.bodyRect(p))) return false;
    return p.takeDamage(dmg, fromX, knock);
  }

  // A parry connects when an enemy's active attack frames overlap the front arc.
  tryParry(p) {
    if (this.parryProjectiles(p)) return;
    const arc = new Phaser.Geom.Rectangle(p.facing > 0 ? p.x - 6 : p.x - 44, p.y - 46, 50, 50);
    const foes = [...this.hollows, ...this.sentinels, ...this.bellringers, ...this.wisps, ...this.extras].filter((e) => !e.dead);
    if (this.bossStarted) foes.push(...this.bosses.filter((b) => !b.dead));
    for (const t of foes) {
      let active;
      if (t.parryStates) active = t.parryStates;
      else if (t instanceof Warden) active = ['slam', 'swipe', 'dash'];
      else if (t instanceof Saint) active = ['slamFall'];
      else if (t instanceof Wisp) active = ['swoop'];
      else active = { hollow: ['attack'], sentinel: ['thrust'], bellringer: ['slam'] }[t.constructor.name.toLowerCase()];
      if (!active || !active.includes(t.state)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(arc, this.bodyRect(t))) continue;
      this.landParry(p, t);
      return;
    }
  }

  // shared reward for any clean parry (melee or projectile)
  parryReward(p) {
    p.parryHit = true;
    p.gainFocus(p.charm('queenspoise') ? 50 : 25);
    if (p.charm('secondwind')) {
      p.st = Math.min(p.maxSt, Math.max(0, p.st) + 60);
      p.stDelay = 0;
      this.fx.burst('heal', p.x, p.y - 18, 10);
      this.fx.ring(p.x, p.y - 18, 0x7aff8a, 2, 240);
    }
  }

  // Arrows, fireballs, orbs, bombs and shockwaves can be parried too: they fly back
  // toward whoever threw them, and hurt enemies instead of the hero.
  parryProjectiles(p) {
    const arc = new Phaser.Geom.Rectangle(p.facing > 0 ? p.x - 10 : p.x - 54, p.y - 58, 64, 66);
    const owners = [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.wisps, ...this.extras, ...this.bosses];
    let n = 0, hx = 0, hy = 0;
    for (const o of owners) {
      for (const key of ['shots', 'arrows', 'orbs', 'bombs', 'waves']) {
        const list = o[key];
        if (!Array.isArray(list) || !list.length) continue;
        const keep = list.filter((sh) => {
          const sp = sh.sp;
          if (!sp || !sp.active || sh.dead || !arc.contains(sp.x, sp.y)) return true;
          this.reflectShot(sh, o, p);
          n++; hx = sp.x; hy = sp.y;
          return false;
        });
        if (keep.length !== list.length) o[key] = keep;
      }
    }
    if (!n) return false;
    this.parryReward(p);
    audio.play('parry');
    this.fx.hitStop(110);
    this.fx.shake(0.004, 100);
    this.fx.parryFlash(hx, hy, p.facing);
    p.setAnim('deflect', true);
    p.body.setVelocityX(-p.facing * 70);
    this.events.emit('toast', n > 1 ? `Deflected x${n}!` : 'Deflected!');
    return true;
  }

  reflectShot(sh, owner, p) {
    const sp = sh.sp;
    const speed = Math.max(300, Math.hypot(sh.vx || 0, sh.vy || 0) * 1.25);
    let ang = p.facing > 0 ? -0.05 : Math.PI + 0.05;
    if (owner && !owner.dead && owner.visible && Math.abs(owner.x - p.x) < 320 && Math.sign(owner.x - p.x) === p.facing) {
      ang = Math.atan2(owner.y - 18 - sp.y, owner.x - sp.x);
    }
    sp.setTint(0xbff4ff);
    if (sh.vy !== undefined && sp.texture.key === 'arrow') sp.setRotation(ang);
    this.reflected.push({ sp, glow: sh.glow || null, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, dmg: Math.max(30, (sh.dmg || 20) * 1.8) });
  }

  updateReflected(dt) {
    if (!this.reflected.length) return;
    const foes = [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.wisps, ...this.bellringers, ...this.extras].filter((e) => !e.dead)
      .concat(this.bossStarted ? this.bosses.filter((b) => !b.dead) : []);
    this.reflected = this.reflected.filter((o) => {
      o.t += dt;
      o.sp.x += o.vx * dt; o.sp.y += o.vy * dt;
      if (o.glow) o.glow.setPosition(o.sp.x, o.sp.y);
      if (Math.random() < 0.5) this.fx.burst('spirit', o.sp.x, o.sp.y, 1);
      const r = new Phaser.Geom.Rectangle(o.sp.x - 6, o.sp.y - 6, 12, 12);
      let hit = false;
      for (const t of foes) {
        if (!Phaser.Geom.Intersects.RectangleToRectangle(r, this.bodyRect(t))) continue;
        t.trapT = this.time.now;
        t.takeHit(this.oneShot ? 99999 : o.dmg * this.player.dmgMul, Math.sign(o.vx) || 1, 40);
        this.fx.impact(o.sp.x, o.sp.y, Math.sign(o.vx) || 1, true);
        audio.play('hitHeavy', 0.8);
        hit = true;
        break;
      }
      if (hit || o.t > 2 || this.isWallAt(o.sp.x, o.sp.y)) {
        this.fx.burst('sparks', o.sp.x, o.sp.y, 10);
        o.sp.destroy(); if (o.glow) o.glow.destroy();
        return false;
      }
      return true;
    });
  }

  // Bonfires are sanctuaries: no enemy (or its projectile) can come within SAFE px of one,
  // so you never stand up from a rest or a respawn straight into a blade.
  keepBonfiresSafe() {
    const SAFE = 150;
    const foes = [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.wisps, ...this.extras];
    for (const bf of this.bonfires) {
      for (const e of foes) {
        if (e.dead || !e.body || !e.body.enable) continue;
        const dx = e.x - bf.x;
        if (Math.abs(dx) >= SAFE || Math.abs(e.y - bf.y) > 90) continue;
        const side = Math.sign(dx) || 1;
        e.body.x += bf.x + side * SAFE - e.x; e.x = bf.x + side * SAFE;
        if (Math.sign(e.body.velocity.x) === -side) e.body.setVelocityX(0);
      }
      for (const o of foes) {
        for (const key of ['shots', 'arrows', 'orbs', 'bombs', 'waves']) {
          const list = o[key];
          if (!Array.isArray(list)) continue;
          for (const sh of list) {
            if (!sh.sp || sh.dead || !sh.sp.active) continue;
            if (Math.abs(sh.sp.x - bf.x) < SAFE - 30 && Math.abs(sh.sp.y - bf.y + 20) < 70) { sh.t = 99; sh.life = 0; sh.fuse = 0; sh.sp.x = -9999; }
          }
        }
      }
    }
  }

  // Enemies are not immune to the castle: spikes, lava, saw blades and fire vents kill them too.
  // They know their own halls and patrol around the traps, so a trap only takes one that the
  // hero has just knocked about, or one that is lunging, charging or leaping at the hero.
  updateEnemyTraps() {
    const now = this.time.now;
    const foes = [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.extras];
    const saws = this.hazards.saws;
    for (const e of foes) {
      if (e.dead || !e.body || !e.body.enable || !e.visible) continue;
      if (!(now - (e.trapT ?? -1e9) < 1600 || COMMITTED.has(e.state))) continue;
      const b = e.body;
      let trap = null;
      for (const x of [b.left + 2, b.right - 2]) {
        const t = this.ground.getTileAtWorldXY(x, b.bottom - 3);
        if (t && (t.index === TILE.SPIKES || t.index === TILE.LAVA)) { trap = t.index === TILE.LAVA ? 'lava' : 'spikes'; break; }
      }
      if (!trap) {
        const br = this.bodyRect(e);
        if (saws.some((sw) => Phaser.Geom.Intersects.RectangleToRectangle(br, new Phaser.Geom.Rectangle(sw.spr.x - 9, sw.spr.y - 9, 18, 18)))) trap = 'saw';
        else if (this.jets.some((j) => j.on && Phaser.Geom.Intersects.RectangleToRectangle(br, new Phaser.Geom.Rectangle(j.x - 8, j.y - 72, 16, 72)))) trap = 'fire';
      }
      if (trap) this.trapKill(e, trap);
    }
  }

  trapKill(e, trap) {
    // drop guard state first, so a trap is never "blocked" by a shield the way a blade is
    e.parried = false;
    if ('guarding' in e) { e.state = 'stagger'; e.t = 0.5; }
    const res = e.takeHit(99999, Math.sign(e.x - this.player.x) || 1, 999);
    if (!e.dead && res === 'blocked') return; // wards and phasing shades shrug it off
    const x = e.x, y = e.y - 12;
    if (trap === 'lava' || trap === 'fire') { this.fx.fire.explode(16, x, y); audio.play('lava', 0.5); }
    else { this.fx.burst('blood', x, y, 16); this.fx.burst('sparks', x, y, 8); audio.play('slice', 0.7); }
    if (Phaser.Geom.Rectangle.Contains(this.cameras.main.worldView, x, y)) this.events.emit('toast', 'Slain by a trap');
  }

  landParry(p, t) {
    this.parryReward(p);
    t.parried = true; // riposte window: the next hit deals bonus damage
    audio.play('parry');
    this.fx.hitStop(160);
    this.fx.shake(0.006, 140);
    // the flash sits where the blades meet, between the hero and the attacker
    this.fx.parryFlash(p.x + p.facing * 14, p.y - 24, p.facing);
    this.fx.afterImage(t, 0x9fe8ff);
    p.setAnim('deflect', true);
    // the blow pushes the hero back a step; skid dust under the feet
    p.body.setVelocityX(-p.facing * 110);
    p.squash(1.14, 0.88);
    this.fx.dustPuff(p.x - p.facing * 4, p.y, 6);
    if (t instanceof Wisp) {
      t.state = 'stagger'; t.st = 0.8;
    } else {
      t.state = 'stagger'; t.t = this.bosses.includes(t) ? 1.3 : 1.5;
      if (t.combo) t.combo = []; // a parry breaks the Warden's combo string
      t.setA(t instanceof Warden ? 'kneel' : 'hurt', true);
      if (!this.bosses.includes(t)) t.body.setVelocityX(Math.sign(t.x - p.x) * 40);
    }
    this.events.emit('toast', this.bosses.includes(t) ? 'Parried!' : 'Parried!');
  }

  playerStrike(rect, atk, dir, hitSet) {
    const p = this.player;
    const targets = [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.wisps, ...this.bellringers, ...this.extras].filter((e) => !e.dead);
    if (this.bossStarted) targets.push(...this.bosses.filter((b) => !b.dead));
    let any = false, killed = false;
    for (const t of targets) {
      if (hitSet.has(t)) continue;
      const br = this.bodyRect(t);
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, br)) continue;
      hitSet.add(t);
      const inter = Phaser.Geom.Rectangle.Intersection(rect, br);
      const cx = inter.centerX, cy = inter.centerY;
      // riposte: a parried enemy takes the next hit for bonus damage
      const riposte = !!t.parried;
      // cheat: one-shot mode turns every connected blow lethal
      const dmg = this.oneShot ? 99999 : atk.dmg * p.dmgMul * (riposte ? 1.75 : 1);
      t.trapT = this.time.now; // knocked about: a trap behind it is now lethal
      const res = t.takeHit(dmg, dir, atk.poise);
      if (riposte) { t.parried = false; this.events.emit('toast', 'Riposte!'); }
      if (res === 'blocked') {
        if (t instanceof Sentinel) this.fx.blockFx(cx, cy, -dir);
      } else if (!(this.bosses.includes(t) && t.invuln)) {
        const big = atk.heavy || riposte;
        audio.play(riposte ? 'riposte' : atk.heavy ? 'hitHeavy' : 'hit', atk.heavy ? 1 : 0.8);
        audio.play('slice', big ? 1 : 0.7);
        this.fx.burst('sparks', cx, cy, big ? 14 : 8);
        this.fx.burst('blood', cx, cy, big ? 12 : 6);
        if (settings.damageNumbers) this.damageNumber(cx, cy - 14, dmg, big);
        const s = this.add.image(cx, cy, 'spark').setScale(2.5).setBlendMode('ADD').setDepth(41);
        this.tweens.add({ targets: s, scale: 0.5, alpha: 0, angle: 45, duration: 140, onComplete: () => s.destroy() });
        // "cutting shadow": a white after-image shoved along the hit, plus ring and speed streaks
        this.fx.afterImage(t, 0xffffff);
        this.fx.impact(cx, cy, dir, big);
        // the white cut line: angle follows the swing, mirrored by facing
        const ang = (atk.cut || 0) * dir;
        this.fx.cut(cx, cy, ang, atk.cutLen || (big ? 92 : 64), { thick: big ? 1.4 : 1 });
        if (big) this.fx.cut(cx + Math.sin(ang) * 4, cy - Math.cos(ang) * 4, ang, (atk.cutLen || 92) * 0.7, { thick: 0.7, delay: 45 });
        if (riposte) { this.fx.zoomPunch(0.07, 240); this.fx.flash(0xffe2a0, 120, 0.3); }
        else if (atk.heavy) this.fx.zoomPunch(0.035, 160);
        if (t.dead) {
          killed = true;
          this.tutKills = (this.tutKills || 0) + 1;
          audio.play('killBlow', 0.7);
          this.fx.ring(cx, cy, 0xffb347, 3.2, 340);
          this.fx.cut(cx, cy, ang * 0.5, 150, { thick: 1.2, delay: 70, dur: 320 });
        }
      }
      if (!any) p.gainFocus(atk.heavy ? 12 : 8);
      any = true;
    }
    if (any) {
      this.fx.hitStop(killed ? 130 : atk.heavy ? 110 : 60);
      this.fx.shake(atk.heavy ? 0.006 : 0.003, atk.heavy ? 140 : 80);
    }
    this.hitSecrets(rect, hitSet);
  }

  // ------------------------------------------------------------ secrets (false walls)
  // Hollow Knight style: a stretch of "rock" that cracks after a few blows and
  // opens onto a hidden room with a reward. The false stones are a shade off.
  buildSecrets() {
    const p = this.player;
    this.secrets = (this.level.secrets || []).map((sc, i) => {
      const [x0, y0, x1, y1] = sc.wall;
      const id = `${this.levelNum}-${i}`;
      const s = { wall: sc.wall, def: sc.loot, id, hits: 0, broken: false, loot: null,
        rect: new Phaser.Geom.Rectangle(x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T) };
      if (p.foundSecrets.includes(id)) { this.breakSecret(s, true); return s; }
      this.buildVeil(s, sc);
      // the false stones look exactly like the rock around them; only a rare, faint glint gives them away
      s.glint = 1 + Math.random() * 2;
      const L = sc.loot;
      const owned = L.type === 'charm' && p.charms.includes(L.key);
      if (!owned) {
        this.add.image(L.x, L.y, 'altar').setOrigin(0.5, 1).setDepth(8);
        const color = L.type === 'charm' ? CHARM[L.key].color : 0xffb347;
        const img = this.add.image(L.x, L.y - 28, L.type === 'charm' ? 'star' : 'icon_ember').setDepth(9).setTint(color).setScale(L.type === 'charm' ? 1.2 : 1.6);
        const glow = this.fx.glow(L.x, L.y - 28, color, 0.8, 0.55, 8);
        this.tweens.add({ targets: [img, glow], y: '-=5', yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut' });
        if (L.type === 'charm') this.tweens.add({ targets: img, angle: 360, repeat: -1, duration: 4000 });
        s.loot = { img, glow };
      }
      return s;
    });
  }

  // The hidden room behind a false wall is painted over with rock until the wall falls, so
  // it can't be spotted from outside; only glints, grit and a draft give the wall away.
  buildVeil(s, sc) {
    const L = this.level, G = L.grid, [x0, y0, x1, y1] = sc.wall;
    const start = [Math.floor(sc.loot.x / T), Math.floor((sc.loot.y - 1) / T)];
    const inWall = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const seen = new Set(), cells = [], q = [start];
    while (q.length) {
      const [x, y] = q.pop();
      const k = y * L.W + x;
      if (seen.has(k) || x < 0 || y < 0 || x >= L.W || y >= L.H || inWall(x, y) || G[y][x] === 1) continue;
      seen.add(k); cells.push([x, y]);
      if (cells.length > 500) return; // not a closed room: nothing to hide
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (!cells.length) return;
    const solid = G.map((row) => row.slice());
    for (const [x, y] of cells) solid[y][x] = 1;
    const data = G.map((row) => row.map(() => -1));
    for (const [x, y] of cells) data[y][x] = tileIndex(solid, L.W, L.H, x, y);
    const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
    s.veil = map.createLayer(0, map.addTilesetImage('tiles'), 0, 0).setDepth(15);
    if (L.theme.groundTint) s.veil.setTint(L.theme.groundTint);
    s.veilCells = cells.length;
  }

  hitSecrets(rect, hitSet) {
    for (const s of this.secrets) {
      if (s.broken || hitSet.has(s) || !Phaser.Geom.Intersects.RectangleToRectangle(rect, s.rect)) continue;
      hitSet.add(s);
      s.hits++;
      const ix = Phaser.Math.Clamp(this.player.x, s.rect.left, s.rect.right), iy = Phaser.Math.Clamp(this.player.y - 20, s.rect.top, s.rect.bottom);
      audio.play('shield', 0.8);
      this.fx.burst('rocks', ix, iy, 8);
      this.fx.shake(0.004, 100);
      if (s.hits >= 3) this.breakSecret(s);
    }
  }

  breakSecret(s, silent = false) {
    s.broken = true;
    if (!silent) audio.play('creak', 0.9);
    const L = this.level, [x0, y0, x1, y1] = s.wall;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        L.grid[y][x] = 0;
        this.ground.removeTileAt(x, y);
        this.backLayer.putTileAt((x * 3 + y * 5) % 7 === 0 ? TILE.BACK2 : TILE.BACK, x, y);
      }
    }
    // re-tile the rock around the opening so its new edges read correctly
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (L.grid[y] && L.grid[y][x] === 1) this.ground.putTileAt(tileIndex(L.grid, L.W, L.H, x, y), x, y);
      }
    }
    const theme = L.theme;
    if (theme.groundTint) this.ground.setTint(theme.groundTint, x0 - 1, y0 - 1, x1 - x0 + 3, y1 - y0 + 3);
    if (theme.backTint) this.backLayer.setTint(theme.backTint, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    if (s.veil) {
      const v = s.veil; s.veil = null;
      if (silent) v.destroy();
      else this.tweens.add({ targets: v, alpha: 0, duration: 900, ease: 'Sine.In', onComplete: () => v.destroy() });
    }
    if (silent) return;
    audio.play('guardBreak');
    this.fx.burst('rocks', s.rect.centerX, s.rect.centerY, 30);
    this.fx.dustPuff(s.rect.centerX, s.rect.bottom, 12);
    this.fx.shake(0.012, 260);
    this.events.emit('toast', 'The wall crumbles... a hidden path.');
  }

  // A barely-there shimmer on a false wall: only when the hero is within a few tiles,
  // one tiny pale spark every few seconds somewhere along the stone.
  glintSecrets(dt, p) {
    for (const s of this.secrets) {
      if (s.broken || p.dead) continue;
      if (Math.abs(p.x - s.rect.centerX) > 110 + s.rect.width / 2 || Math.abs(p.y - s.rect.centerY) > 90 + s.rect.height / 2) continue;
      s.glint -= dt;
      s.sign = (s.sign ?? 1.5) - dt;
      if (s.sign <= 0) {
        // other tells: grit trickling from a seam, or a faint cold draft seeping out
        s.sign = 1.6 + Math.random() * 2.4;
        if (Math.random() < 0.55) {
          const dx = s.rect.left + 3 + Math.random() * (s.rect.width - 6);
          for (let i = 0; i < 3; i++) {
            const d = this.add.image(dx + (Math.random() - 0.5) * 2, s.rect.top + 4, 'px1').setTint(0x9a8a78).setDepth(16).setAlpha(0.7);
            this.tweens.add({ targets: d, y: d.y + 18 + Math.random() * 14, alpha: 0, delay: i * 120, duration: 700, ease: 'Quad.In', onComplete: () => d.destroy() });
          }
        } else {
          const side = p.x < s.rect.centerX ? -1 : 1;
          const ox = side < 0 ? s.rect.left : s.rect.right, oy = s.rect.top + 4 + Math.random() * (s.rect.height - 8);
          const w = this.add.image(ox, oy, 'gust').setTint(0xcfe0ff).setAlpha(0).setDepth(16).setBlendMode('ADD').setFlipX(side < 0).setScale(0.6);
          this.tweens.add({ targets: w, x: ox + side * 22, alpha: { from: 0.28, to: 0 }, duration: 1200, ease: 'Sine.Out', onComplete: () => w.destroy() });
        }
      }
      if (s.glint > 0) continue;
      s.glint = 1.4 + Math.random() * 2.2;
      const x = s.rect.left + 2 + Math.random() * (s.rect.width - 4), y = s.rect.top + 2 + Math.random() * (s.rect.height - 4);
      const sp = this.add.image(x, y, 'px1').setTint(0xdfe8ff).setBlendMode('ADD').setDepth(16).setAlpha(0).setScale(1.5);
      this.tweens.add({ targets: sp, alpha: 0.65, yoyo: true, duration: 450, ease: 'Sine.InOut', onComplete: () => sp.destroy() });
      // a hair-thin crack of light along the seam, gone in a blink
      const cy = s.rect.top + 3 + Math.random() * (s.rect.height - 6);
      const crack = this.add.rectangle(s.rect.centerX, cy, Math.min(10, s.rect.width - 4), 1, 0xffe8c0).setDepth(16).setAlpha(0).setBlendMode('ADD');
      this.tweens.add({ targets: crack, alpha: 0.35, yoyo: true, duration: 220, onComplete: () => crack.destroy() });
    }
  }

  updateSecrets(p) {
    this.glintSecrets(1 / 60, p);
    for (const s of this.secrets) {
      if (!s.loot || p.dead) continue;
      const img = s.loot.img;
      if (Math.abs(p.x - img.x) > 16 || Math.abs(p.y - 16 - img.y) > 30) continue;
      img.destroy(); s.loot.glow.destroy(); s.loot = null;
      p.foundSecrets.push(s.id);
      audio.play('pickup');
      this.fx.burst('spirit', p.x, p.y - 24, 40);
      const L = s.def;
      if (L.type === 'charm') {
        const ch = CHARM[L.key];
        if (!p.charms.includes(ch.key)) p.charms.push(ch.key);
        this.events.emit('item', `CHARM  -  ${ch.name}`, `${ch.desc}.  Equip it at a bonfire.`);
      } else {
        this.grantEmbers(L.amount, p.x, p.y - 30);
        this.events.emit('item', 'HIDDEN CACHE', `${L.amount} embers, left by someone who never came back.`);
      }
      this.writeSave();
    }
  }

  // Soul Bolt: a straight soul dart, costs 50 focus
  spawnSoulBolt(x, y, dir, dmg) {
    const sp = this.add.image(x, y, 'orb').setTint(0xffe2a0).setDepth(26).setBlendMode('ADD');
    const glow = this.fx.glow(x, y, 0xffe2a0, 0.5, 0.7, 25);
    this.soulBolts.push({ sp, glow, vx: dir * 300, t: 0, dmg });
    audio.play('orb', 0.5);
  }

  updateBolts(dt) {
    const targets = () => [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.wisps, ...this.bellringers, ...this.extras].filter((e) => !e.dead)
      .concat(this.bossStarted ? this.bosses.filter((b) => !b.dead) : []);
    this.soulBolts = this.soulBolts.filter((o) => {
      o.t += dt;
      o.sp.x += o.vx * dt;
      o.glow.setPosition(o.sp.x, o.sp.y);
      if (Math.random() < 0.4) this.fx.embers.explode(1, o.sp.x, o.sp.y);
      const r = new Phaser.Geom.Rectangle(o.sp.x - 5, o.sp.y - 5, 10, 10);
      let hit = false;
      for (const t of targets()) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.bodyRect(t))) {
          t.trapT = this.time.now;
          t.takeHit(this.oneShot ? 99999 : o.dmg * this.player.dmgMul, Math.sign(o.vx), 20);
          hit = true;
          break;
        }
      }
      if (hit || o.t > 1.2 || this.isSolidAt(o.sp.x, o.sp.y)) {
        this.fx.burst('sparks', o.sp.x, o.sp.y, 8);
        o.sp.destroy(); o.glow.destroy();
        return false;
      }
      return true;
    });
  }

  grantEmbers(n, x, y) {
    const count = Math.min(14, Math.ceil(n / 15));
    for (let i = 0; i < count; i++) {
      const o = this.add.image(x, y, 'px').setTint(0xffb347).setBlendMode('ADD').setDepth(42);
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 90;
      o.vx = Math.cos(a) * sp; o.vy = Math.sin(a) * sp - 60; o.t = 0;
      o.value = i === count - 1 ? n - Math.floor(n / count) * (count - 1) : Math.floor(n / count);
      this.orbs.push(o);
    }
  }

  updateOrbs(dt) {
    const p = this.player;
    this.orbs = this.orbs.filter((o) => {
      o.t += dt;
      const tx = p.x, ty = p.y - 16;
      const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
      const pull = Math.min(1, o.t * 1.6);
      o.vx = o.vx * (1 - pull * 0.12) + (dx / (d || 1)) * 900 * pull * dt;
      o.vy = o.vy * (1 - pull * 0.12) + (dy / (d || 1)) * 900 * pull * dt;
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (Math.random() < 0.4) this.fx.embers.explode(1, o.x, o.y);
      if ((d < 8 && o.t > 0.25) || o.t > 3) {
        p.embers += Math.max(1, Math.round(o.value * p.emberMul));
        audio.play('souls', 0.5);
        o.destroy();
        return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------ interactions
  nearestBonfire() {
    const p = this.player;
    return this.bonfires.find((b) => Math.abs(b.x - p.x) < 22 && Math.abs(b.y - p.y) < 20);
  }

  tryInteract() {
    const b = this.nearestBonfire();
    if (b) { audio.play('draw', 0.6); this.restAt(b); }
  }

  restAt(b) {
    const p = this.player;
    if (!b.lit) {
      b.lit = true;
      b.sprite.play('bonfire_lit');
      this.tweens.add({ targets: b.glow, alpha: 0.6, scale: 1.4, duration: 600 });
      this.tweens.add({ targets: b.glow, alpha: 0.45, yoyo: true, repeat: -1, duration: 300, delay: 600 });
      audio.play('bonfire');
      this.fx.burst('embers', b.x, b.y - 14, 40);
      this.events.emit('banner', 'BONFIRE LIT', '#ffb347');
    } else {
      audio.play('heal', 0.6);
    }
    p.setFlipX(p.x > b.x);
    p.facing = p.x > b.x ? -1 : 1;
    p.rest();
    p.hp = p.maxHp; p.flasks = p.maxFlasks; p.st = p.maxSt;
    this.checkpoint = { x: b.x + (p.x > b.x ? 18 : -18), y: b.y };
    this.resetEnemies();
    this.writeSave();
    this.fx.flash(0xffa040, 400, 0.25);
    this.events.emit('toast', 'You rest. Your wounds close... and the dead rise again.');
    // resting opens the level-up menu (spend embers on stats, Dark Souls style)
    this.time.delayedCall(500, () => this.events.emit('open-levelup'));
  }

  resetEnemies() {
    this.swarms.forEach((z) => this.clearSwarm(z));
    this.extras.forEach((h) => h.reset()); // first: necromancers retire their minions before wisps reset
    this.hollows.forEach((h) => h.reset());
    this.sentinels.forEach((h) => h.reset());
    this.acolytes.forEach((h) => h.reset());
    this.bellringers.forEach((h) => h.reset());
    this.wisps.forEach((w) => w.reset());
  }

  // ------------------------------------------------------------ death & respawn
  onPlayerDeath() {
    this.deaths++;
    const p = this.player;
    if (this.stain) { this.stain.glow.destroy(); this.stain.emit.destroy(); this.stain = null; }
    if (p.embers > 0) {
      // dying in lava or on spikes leaves the stain at the last safe ground, where it can be reached
      const b = p.body;
      const onHazard = [b.left + 2, b.center.x, b.right - 2].some((hx) => [b.bottom - 3, b.bottom + 2].some((hy) => {
        const t = this.ground.getTileAtWorldXY(hx, hy);
        return t && (t.index === TILE.LAVA || t.index === TILE.SPIKES);
      }));
      const x = onHazard ? p.lastSafe.x : p.x, y = onHazard ? p.lastSafe.y : p.y;
      const glow = this.fx.glow(x, y - 10, 0x6aff9a, 0.45, 0.6, 19);
      const emit = this.add.particles(x, y - 6, 'px', {
        speedY: { min: -30, max: -10 }, speedX: { min: -8, max: 8 }, lifespan: 900, frequency: 70,
        scale: { start: 1, end: 0 }, tint: [0x6aff9a, 0xc8ffd8], blendMode: 'ADD',
      }).setDepth(19);
      this.stain = { x, y, amount: p.embers, glow, emit, armed: false };
      p.embers = 0;
    }
    audio.stopMusic(0.8);
    this.time.delayedCall(900, () => { audio.play('died'); this.events.emit('you-died'); });
    this.time.delayedCall(5200, () => {
      this.cameras.main.fadeOut(900, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.respawn());
    });
  }

  respawn() {
    const p = this.player;
    p.respawn(this.checkpoint.x, this.checkpoint.y);
    p.invuln = 2; // a moment of grace on waking
    this.resetEnemies();
    if (!this.bossDefeated) {
      this.bosses.forEach((b) => b.reset());
      this.floodArena(false);
      this.bossStarted = false;
      this.fogWall.body.enable = false;
      this.events.emit('boss-hide');
    }
    if (this.stain) this.stain.armed = true;
    this.events.emit('respawn');
    this.cameras.main.fadeIn(900, 0, 0, 0);
    audio.playMusic(this.level.theme.music);
  }

  // ------------------------------------------------------------ boss flow
  startBoss() {
    this.bossStarted = true;
    this.fogWall.body.enable = true;
    audio.play('fog');
    audio.playMusic(this.level.theme.bossMusic);
    this.bosses.forEach((b) => b.awaken());
    this.time.delayedCall(600, () => this.events.emit('boss-show', this.bosses));
  }

  onBossDeath(boss) {
    // twin fights: the survivor absorbs its partner's power
    const alive = this.bosses.filter((b) => !b.dead);
    if (alive.length) {
      alive.forEach((b) => b.empower());
      this.time.delayedCall(800, () => this.events.emit('toast', `${boss.name.split(',')[0]} falls... and the other pyre flares!`));
      return;
    }
    this.bossDefeated = true;
    audio.stopMusic(2);
    this.time.delayedCall(2200, () => {
      audio.play('victory');
      this.events.emit('banner', this.level.felled, '#e8c36a', null, 4200, true);
      this.events.emit('boss-hide');
      this.grantEmbers(Math.round((1000 + 1000 * this.levelNum) * this.ngMul.embers), boss.x, boss.y - 40);
      this.fogWall.body.enable = false;
      this.tweens.add({ targets: [this.fog, this.fogGlow], alpha: 0, duration: 2000 });
    });
    // the boss leaves its charm behind, and the hero gains a notch to wear it
    const drop = CHARMS.find((ch) => ch.drop === this.levelNum);
    const p = this.player;
    if (drop && !p.charms.includes(drop.key)) {
      this.time.delayedCall(5000, () => {
        p.charms.push(drop.key);
        p.notches = Math.min(MAX_NOTCHES, p.notches + 1);
        audio.play('pickup');
        this.fx.burst('spirit', p.x, p.y - 20, 40);
        this.events.emit('item', `CHARM  -  ${drop.name}`, `${drop.desc}.  +1 charm notch.  Equip it at a bonfire.`);
      });
    }
    this.time.delayedCall(8500, () => {
      const next = this.levelNum < LAST_LEVEL ? this.levelNum + 1 : null;
      const carry = this.carryData();
      // the final boss: keep the save, marked cleared, ready for New Game+
      if (next) this.writeSave(next);
      else save.write({ ...carry, level: 1, ng: this.ng + 1, cleared: ((save.load() || {}).cleared || 0) + 1 });
      this.events.emit('complete', { ...carry, name: this.level.name, next, carry, ng: this.ng });
    });
  }

  // First-run tutorial: level 1 of a fresh game shows each control once, at the
  // moment it is needed, with the player's own key bindings.
  updateTutorial(delta) {
    if (this.levelNum !== 1 || this.ng || this.testMode || this.player.dead) return;
    const T = this.tut || (this.tut = { shown: new Set(this.carry && this.carry.tutorial || []), active: null, t: 0, sx: this.player.x });
    const k = (a) => keyLabel(settings.primaryKey(a));
    const p = this.player;
    const foeNear = this.allFoes().some((e) => !e.dead && e.visible && Math.abs(e.x - p.x) < 260 && Math.abs(e.y - p.y) < 90);
    const steps = [
      ['move', () => true, `${k('left')} / ${k('right')}  move      ${k('jump')}  jump (tap again in the air to double jump later)`, () => Math.abs(p.x - T.sx) > 160],
      ['fight', () => foeNear, `${k('attack')}  attack (press again to chain)      ${k('roll')}  roll through attacks`, () => this.tutKills > 0],
      ['parry', () => T.shown.has('fight') && foeNear && p.hp < p.maxHp, `${k('parry')}  parry just before a blow lands, then ${k('attack')} to riposte`, () => false],
      ['heal', () => p.hp < p.maxHp * 0.6 && p.flasks > 0, `${k('heal')}  drink an Ember Flask to heal`, () => p.state === 'heal'],
      ['rest', () => !!this.nearestBonfire(), `${k('interact')}  rest at the bonfire: refills flasks, sets your respawn, spend embers`, () => p.state === 'rest'],
      ['plunge', () => T.shown.has('fight') && !p.body.blocked.down && foeNear, `${k('down')} + ${k('attack')} in the air  plunge (bounce off foes and spikes)`, () => p.state === 'plunge'],
    ];
    if (T.active) {
      T.t += delta;
      const st = steps.find((x) => x[0] === T.active);
      if ((st && st[3]()) || T.t > 9000) { this.events.emit('hint', null); T.active = null; T.t = 0; }
      return;
    }
    for (const [id, when, text] of steps) {
      if (T.shown.has(id) || !when()) continue;
      T.shown.add(id); T.active = id; T.t = 0;
      this.events.emit('hint', text);
      break;
    }
  }

  // Auto quality: watch the real frame rate; if it stays low, drop to the low
  // preset live (bloom and tier glows off) and remember it for next time.
  watchPerformance(delta) {
    if (settings.quality !== 'auto' || settings.effectiveQuality === 'low' || this.testMode || this.paused) return;
    const P = this.perf;
    P.t += delta; P.frames++;
    if (P.t < 2000) return;
    const fps = P.frames * 1000 / P.t;
    P.t = 0; P.frames = 0;
    P.slow = fps < 48 ? P.slow + 1 : 0;
    if (P.slow >= 2) this.setQuality('low');
  }

  setQuality(q) {
    settings.effectiveQuality = q;
    const cam = this.cameras.main;
    if (q === 'low') {
      if (this.bloom) { cam.postFX.remove(this.bloom); this.bloom = null; }
      this.allFoes().forEach((e) => { if (e.tierGlow) { e.preFX.remove(e.tierGlow); e.tierGlow = null; } });
    } else if (cam.postFX && !this.bloom) {
      this.bloom = cam.postFX.addBloom(0xffffff, 1, 1, 1.1, 0.75, 3);
      this.allFoes().forEach((e) => { if (e.tier && e.preFX && !e.tierGlow) e.tierGlow = e.preFX.addGlow(e.tier.tint, 3, 0, false, 0.1, 10); });
    }
  }

  allFoes() {
    return [...this.hollows, ...this.sentinels, ...this.acolytes, ...this.bellringers, ...this.extras, ...this.wisps];
  }

  // ------------------------------------------------------------ pause
  setPaused(v) {
    this.paused = v;
    this.time.paused = v;
    if (v) { this.physics.world.pause(); this.anims.pauseAll(); this.tweens.pauseAll(); }
    else { if (!this.hitStopping) { this.physics.world.resume(); this.anims.resumeAll(); } this.tweens.resumeAll(); }
    this.events.emit('pause', v);
  }

  // ------------------------------------------------------------ loop
  damageNumber(x, y, n, big) {
    const t = this.add.text(x + Phaser.Math.Between(-6, 6), y, String(Math.round(n)), {
      fontFamily: 'monospace', fontSize: big ? '15px' : '11px', color: big ? '#ffcf6a' : '#f2e6d0',
      stroke: '#1a0e08', strokeThickness: 3 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 650, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    this.updateParallax();
    this.updateAtmosphere();
    this.watchPerformance(delta);
    if (this.hitStopping) return;
    if (!this.paused) this.updateTutorial(delta);
    this.ctl.update();
    const ui = this.scene.get('UI');
    if (this.ctl.pressed.pause && !this.player.dead && !(ui && (ui.menuOpen || (ui.pauseMenu && ui.pauseMenu.open)))) { this.setPaused(!this.paused); return; }
    if (this.paused) return;

    const p = this.player;
    this.hazards.update(dt, p);
    p.update(dt, this.ctl);
    p.inWater = this.waterAt(p.body.center.x, p.body.center.y);
    if (p.inWater !== this.wasInWater && Math.abs(p.body.velocity.y) > 40) {
      audio.play('splash', 0.6);
      this.fx.burst('spirit', p.x, p.body.center.y, 10);
    }
    this.wasInWater = p.inWater;
    for (const e of this.extras) e.update(dt, p);
    for (const h of this.hollows) h.update(dt, p);
    for (const h of this.sentinels) h.update(dt, p);
    for (const h of this.bellringers) h.update(dt, p);
    for (const w of this.wisps) w.update(dt, p);
    for (const a of this.acolytes) a.update(dt, p);
    for (const b of this.bosses) b.update(dt, p);
    this.updateFire(dt, p);
    this.updateOrbs(dt);
    this.updateBolts(dt);
    this.updateReflected(dt);
    this.updateEnemyTraps();
    this.keepBonfiresSafe();

    // spikes
    if (!p.dead) {
      const b = p.body;
      for (const x of [b.left + 2, b.right - 2]) {
        const t = this.ground.getTileAtWorldXY(x, b.bottom - 3);
        if (t && t.index === TILE.SPIKES) {
          if (p.takeDamage(25 * this.ngMul.dmg, p.x - p.facing * 4, 0.6) && !p.dead) p.body.setVelocityY(-280);
          else if (!p.dead && p.invuln > 0 && b.blocked.down) p.body.setVelocityY(-200);
          break;
        }
      }
    }

    // bloodstain recovery
    if (this.stain && this.stain.armed && !p.dead && Math.abs(p.x - this.stain.x) < 16 && Math.abs(p.y - this.stain.y) < 24) {
      this.grantEmbers(this.stain.amount, this.stain.x, this.stain.y - 10);
      this.events.emit('toast', 'Embers recovered');
      this.stain.glow.destroy(); this.stain.emit.destroy();
      this.stain = null;
    }

    this.updateSecrets(p);
    this.updateSwarms(dt, p);

    // ability pickup
    const pk = this.pickup;
    if (pk && !p.dead && Math.abs(p.x - pk.img.x) < 16 && Math.abs(p.y - 16 - pk.img.y) < 30) {
      if (pk.def.relic) { p.foundSecrets.push(`relic-${this.levelNum}`); RELICS[pk.def.relic.boon].apply(p); } else p[pk.def.flag] = true;
      audio.play('pickup');
      this.fx.burst('spirit', pk.img.x, pk.img.y, 40);
      pk.img.destroy(); pk.glow.destroy(); this.pickup = null;
      this.events.emit('item', pk.def.name, pk.def.desc);
      this.writeSave();
    }

    // prompts
    let prompt = null;
    if (!p.dead && p.state !== 'rest') {
      if (this.nearestBonfire()) prompt = 'E / W  -  Rest at bonfire';
    }
    if (p.state === 'rest') prompt = 'Move to stand up';
    const msg = this.messages.find((m) => Math.abs(m.x - p.x) < 24 && Math.abs(m.y - p.y) < 24);
    this.events.emit('hud', { prompt, message: msg ? msg.text : null });

    // boss trigger
    const A = this.level.arena;
    if (!this.bossStarted && !this.bossDefeated && !p.dead && p.x > A.trigger && (A.triggerY ? p.y > A.triggerY : p.y <= A.floor + 2 * T)) this.startBoss(); // rooms below the arena (secrets) don't wake the boss

    for (const w of this.water) w.surf.tilePositionX += dt * 10;

    // camera look-ahead
    const cam = this.cameras.main;
    cam.followOffset.x += ((-p.facing * 26) - cam.followOffset.x) * Math.min(1, dt * 2.5);

    this.fog.tilePositionY -= dt * 14;
    this.fog.tilePositionX += dt * 4;
  }

  updateParallax() {
    const cam = this.cameras.main;
    const v = cam.worldView;
    const sx = v.x, sy = v.y;
    this.bgFar.tilePositionX = sx * 0.12;
    this.bgMid.tilePositionX = sx * 0.3;
    this.bgFog.tilePositionX = sx * 0.5 + this.time.now * 0.004;
    this.bgFar.y = 270 + (330 - sy) * 0.12;
    this.bgMid.y = 270 + (330 - sy) * 0.3;
    this.bgFog.y = 330 + (330 - sy) * 0.45;
    this.ambient.setPosition(v.x, v.bottom);
  }
}
