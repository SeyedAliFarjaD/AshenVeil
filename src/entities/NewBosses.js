// Bosses for levels 5-8. They extend the Warden state machine (so poise, parry, staggers,
// phases, hit-stop and the boss bar all work unchanged) and layer new move sets on top.
import { audio } from '../audio.js';
import { Warden } from './Warden.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const BASE_MOVES = new Set(['slam', 'swipe', 'dash', 'leap', 'pillars', 'frostline', 'icicles']);

class BossBase extends Warden {
  constructor(scene, x, y, arena, cfg = {}) {
    super(scene, x, y, arena, cfg);
    this.parryStates = ['slam', 'swipe', 'dash'];
  }

  reset() {
    super.reset();
    this.act = null;
    this.moveCount = 0;
    this.flurry = 0;
    if (this.shots) this.shots.forEach((o) => this.killShot(o));
    this.shots = [];
    this.setAlpha(1);
    this.extraReset();
  }

  extraReset() { /* subclasses */ }
  clearExtras() { /* subclasses */ }
  say(msg) { this.scene.events.emit('toast', msg); }

  // --- scripted one-shot actions: play an animation, fire on a frame, then recover
  startAct(state, anim, frame, fire, recoverT) {
    this.state = state;
    this.hitDone = false;
    this.act = { state, anim: `${this.prefix}_${anim}`, frame, fire, recoverT, fired: false };
    this.setA(anim, true);
  }

  onFrame(anim, frame) {
    super.onFrame(anim, frame);
    const a = this.act;
    if (a && !a.fired && this.state === a.state && anim.key === a.anim && frame.index - 1 >= a.frame) {
      a.fired = true;
      a.fire.call(this);
    }
  }

  onDone(anim) {
    const a = this.act;
    if (a && this.state === a.state && anim.key === a.anim) {
      if (!a.fired) { a.fired = true; a.fire.call(this); }
      this.act = null;
      if (this.state === a.state) { this.state = 'recover'; this.t = a.recoverT * this.speedMul; this.setA('idle'); }
      return;
    }
    super.onDone(anim);
  }

  windup(move, time) {
    if (BASE_MOVES.has(move)) return super.windup(move, time);
    this.move = move;
    this.state = 'windup';
    this.t = (time || this.windTimes[move] || 0.6) * this.speedMul;
    this.setA(this.windAnims[move] || 'raise', true);
    this.scene.time.delayedCall(Math.max(0, this.t * 1000 - 260), () => this.glint());
  }

  release() {
    const fn = this.moves[this.move];
    if (fn) { this.hitDone = false; fn.call(this); return; }
    super.release();
  }

  update(dt, player) {
    super.update(dt, player);
    if (this.dead) return;
    if (this.act && this.state !== this.act.state) this.act = null;
    this.updateShots(dt);
    this.tick(dt, player);
  }

  tick() { /* subclasses */ }

  decideBase(player, adx, sdx, choice) {
    // shared tail of every decide(): avoid triple repeats, then dispatch
    if (this.last.length >= 2 && this.last[0] === choice && this.last[1] === choice) choice = adx < 75 ? 'swipe' : 'walk';
    this.last.unshift(choice); this.last.length = Math.min(this.last.length, 3);
    this.moveCount++;
    if (choice === 'walk') { this.state = 'walk'; this.t = 1.3; return; }
    if (choice === 'combo') { this.combo = this.comboList.slice(); this.windup(this.combo.shift(), 0.4); return; }
    this.windup(choice);
  }

  // --- projectiles shared by all of them
  shot(o) {
    const s = this.scene;
    const sp = s.add.image(o.x, o.y, o.tex).setDepth(26);
    if (o.add !== false) sp.setBlendMode('ADD');
    if (o.tint) sp.setTint(o.tint);
    if (o.rot !== undefined) sp.setRotation(o.rot);
    if (o.sx) sp.setScale(o.sx, o.sy || o.sx);
    const glow = o.glow ? s.fx.glow(o.x, o.y, o.glow, o.glowScale || 0.5, 0.5, 25) : null;
    this.shots.push({ gy: 0, life: 3, w: 12, h: 12, dmg: 20, knock: 1, ...o, sp, glow, t: 0, hit: false });
  }

  killShot(o) { if (o.sp) o.sp.destroy(); if (o.glow) o.glow.destroy(); o.dead = true; }

  updateShots(dt) {
    const s = this.scene, a = this.arena;
    this.shots = this.shots.filter((o) => {
      o.t += dt;
      o.vy += o.gy * dt;
      o.sp.x += o.vx * dt; o.sp.y += o.vy * dt;
      if (o.spin) o.sp.rotation += o.spin * dt;
      if (o.glow) o.glow.setPosition(o.sp.x, o.sp.y);
      if (o.trail && Math.random() < 0.5) s.fx[o.trail].explode(1, o.sp.x, o.sp.y);
      if (!o.hit && s.hitPlayer(new Phaser.Geom.Rectangle(o.sp.x - o.w / 2, o.sp.y - o.h / 2, o.w, o.h), o.dmg * s.ngMul.dmg * (this.cfg.dmgMul || 1), o.sp.x - Math.sign(o.vx || 1) * 8, o.knock)) {
        o.hit = true;
        if (!o.pierce) { this.killShot(o); return false; }
      }
      const out = o.sp.x < a.x0 - 10 || o.sp.x > a.x1 + 10 || o.t > o.life || o.sp.y > a.floor + 8;
      if (out || (!o.pass && s.isWallAt(o.sp.x, o.sp.y))) {
        if (o.burst) s.fx.burst(o.burst, o.sp.x, o.sp.y, 8);
        this.killShot(o);
        return false;
      }
      return true;
    });
  }

  markAt(x, tint, dur = 700, scale = 1) {
    const s = this.scene;
    const mark = s.add.image(x, this.arena.floor, 'mark').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(tint).setScale(scale, 1);
    s.tweens.add({ targets: mark, alpha: { from: 0.3, to: 1 }, yoyo: true, repeat: Math.max(1, Math.round(dur / 180)), duration: 90 });
    s.time.delayedCall(dur, () => mark.destroy());
    return mark;
  }

  die() {
    this.clearExtras();
    this.shots.forEach((o) => this.killShot(o));
    this.shots = [];
    this.act = null;
    super.die();
  }

  // rooted pillar/thorn eruption at x, after a telegraph
  erupt(x, { tint = 0xff7a2a, delay = 650, w = 18, h = 70, dmg = 24, tex = 'pillar', sound = 'fire', burst = 'fire' } = {}) {
    const s = this.scene, a = this.arena;
    x = Phaser.Math.Clamp(x, a.x0 + 14, a.x1 - 14);
    this.markAt(x, tint, delay);
    s.time.delayedCall(delay, () => {
      if (this.dead) return;
      audio.play(sound, 0.6);
      const sp = s.add.sprite(x, a.floor, tex).setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(tint).setScale(0.85, 0.9);
      if (tex === 'pillar') sp.play('pillar');
      s.fx.burst(burst, x, a.floor - 8, 16);
      s.fx.shake(0.004, 100);
      let hit = false;
      const ev = s.time.addEvent({ delay: 30, repeat: 10, callback: () => {
        if (!hit && s.hitPlayer(new Phaser.Geom.Rectangle(x - w / 2, a.floor - h, w, h), dmg * s.ngMul.dmg * (this.cfg.dmgMul || 1), x, 1.2)) hit = true;
      } });
      s.tweens.add({ targets: sp, alpha: 0, delay: 320, duration: 220, onComplete: () => { sp.destroy(); ev.remove(); } });
    });
  }

  // a falling hazard that lands at x
  dropAt(x, { tex = 'drop', tint = null, delay = 600, fall = 280, dmg = 22, burst = 'fire', ringTint = 0xffb347 } = {}) {
    const s = this.scene, a = this.arena;
    x = Phaser.Math.Clamp(x, a.x0 + 12, a.x1 - 12);
    this.markAt(x, ringTint, delay, 0.6);
    const d = s.add.image(x, a.y0 + 8, tex).setOrigin(0.5, 1).setDepth(22);
    if (tint) d.setTint(tint);
    const glow = s.fx.glow(x, a.y0, ringTint, 0.4, 0.5, 22);
    s.tweens.add({
      targets: [d, glow], y: a.floor, delay, duration: fall, ease: 'Quad.In',
      onUpdate: () => { if (!d.hit && s.hitPlayer(new Phaser.Geom.Rectangle(x - 5, d.y - 18, 10, 18), dmg * s.ngMul.dmg * (this.cfg.dmgMul || 1), x, 0.9)) d.hit = true; },
      onComplete: () => {
        d.destroy(); glow.destroy();
        if (this.dead) return;
        audio.play('fire', 0.4);
        s.fx.burst(burst, x, a.floor - 4, 12);
        s.fx.ring(x, a.floor - 4, ringTint, 1.4, 200);
        if (s.hitPlayer(new Phaser.Geom.Rectangle(x - 16, a.floor - 14, 32, 14), dmg * 0.6 * s.ngMul.dmg * (this.cfg.dmgMul || 1), x, 0.8)) { /* splash */ }
      },
    });
  }

  stompWaves() {
    const s = this.scene;
    audio.play('slam');
    s.fx.shake(0.014, 280);
    s.fx.dustPuff(this.x - 24, this.y, 10); s.fx.dustPuff(this.x + 24, this.y, 10);
    s.fx.burst('rocks', this.x, this.y - 4, 16);
    this.hitBox(this.x - 74, this.y - 34, 148, 36, 36, 1.6);
    this.spawnWave(-1); this.spawnWave(1);
  }

  get windTimes() { return {}; }
  get windAnims() { return {}; }
  get moves() { return {}; }
  get comboList() { return ['swipe', 'slam', 'swipe']; }
}

// ================================================================== Level 5: the Forge Golem
// Slow and enormous. Molten rain, ground stomps, and every few moves the furnace vents:
// he kneels, steaming, and takes far more damage. That is the window to strike.
export class ForgeGolem extends BossBase {
  extraReset() { this.venting = false; this.sinceVent = 0; }
  get speedMul() { return this.phase === 2 ? 0.8 : 1.12; }
  get windTimes() { return { stomp: 0.85, moltenrain: 0.8 }; }
  get windAnims() { return { stomp: 'raise', moltenrain: 'raise' }; }

  constructor(scene, x, y, arena, cfg) {
    super(scene, x, y, arena, cfg);
    this.parryStates = ['slam', 'swipe', 'dash', 'stomp'];
  }

  get moves() {
    return {
      stomp: () => this.startAct('stomp', 'slam', 1, () => this.stompWaves(), 0.95),
      moltenrain: () => this.startAct('rain', 'stab', 1, () => this.moltenRain(), 1.2),
    };
  }

  decide(player, adx, sdx) {
    this.face(sdx);
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    // every fourth move the furnace needs to breathe
    if (this.sinceVent >= 4) { this.sinceVent = 0; this.beginVent(); return; }
    this.sinceVent++;
    const p2 = this.phase === 2;
    let choice;
    if (adx < 85) choice = pick(p2 ? ['slam', 'stomp', 'swipe', 'combo', 'pillars'] : ['slam', 'swipe', 'stomp']);
    else if (adx < 210) choice = pick(p2 ? ['leap', 'moltenrain', 'pillars', 'walk', 'stomp'] : ['walk', 'leap', 'moltenrain']);
    else choice = pick(p2 ? ['moltenrain', 'pillars', 'leap'] : ['moltenrain', 'leap', 'walk']);
    this.decideBase(player, adx, sdx, choice);
  }

  beginVent() {
    this.state = 'vent'; this.t = 3.4; this.venting = true;
    this.body.setVelocityX(0);
    this.setA('kneel', true);
    audio.play('roar', 0.5);
    this.say('The furnace vents  -  strike now!');
    this.scene.fx.ring(this.x, this.y - 50, 0xffc070, 3.5, 400);
  }

  tick(dt) {
    if (this.state === 'vent') {
      this.body.setVelocityX(0);
      if (Math.random() < 0.7) this.scene.fx.dust.explode(1, this.x + (Math.random() - 0.5) * 40, this.y - 20 - Math.random() * 60);
      if (Math.random() < 0.4) this.scene.fx.embers.explode(2, this.x + (Math.random() - 0.5) * 30, this.y - 40);
      if (this.t <= 0) { this.venting = false; this.state = 'recover'; this.t = 0.5; this.setA('idle'); }
    }
  }

  takeHit(dmg, dir, poise) {
    if (this.state === 'vent') { dmg *= 1.7; poise = 0; }
    super.takeHit(dmg, dir, poise);
  }

  moltenRain() {
    const s = this.scene, a = this.arena, p2 = this.phase === 2;
    const n = p2 ? 13 : 9;
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 190, () => {
        if (this.dead) return;
        const targeted = i % 3 !== 2;
        const x = targeted ? s.player.x + (Math.random() - 0.5) * 120 : a.x0 + 30 + Math.random() * (a.x1 - a.x0 - 60);
        this.dropAt(x, { delay: 620, fall: 260 });
      });
    }
  }
}

// ================================================================== Level 6: the Stag Spirit
// Fast. Telegraphed charges that carry him across the whole arena; if he hits the wall he
// is stunned. Howls spirit wolves, and in the second phase thorns erupt around you.
export class StagSpirit extends BossBase {
  extraReset() { this.minions = []; this.dbl = false; }
  get speedMul() { return this.phase === 2 ? 0.62 : 0.85; }
  get windTimes() { return { charge: 0.8, howl: 0.5, thorns: 0.7 }; }
  get windAnims() { return { charge: 'crouch', howl: 'raise', thorns: 'raise' }; }

  constructor(scene, x, y, arena, cfg) {
    super(scene, x, y, arena, cfg);
    this.parryStates = ['slam', 'swipe', 'dash', 'charge'];
  }

  get moves() {
    return {
      charge: () => this.beginCharge(),
      howl: () => this.beginHowl(),
      thorns: () => this.startAct('thorns', 'stab', 1, () => this.thorns(), 1.0),
    };
  }

  windup(move, time) {
    super.windup(move, time);
    if (move === 'charge') {
      // telegraph: a line of green marks across the floor in front of him
      const dir = Math.sign(this.scene.player.x - this.x) || this.dir;
      this.face(dir);
      for (let i = 0; i < 9; i++) {
        const x = this.x + dir * (30 + i * 52);
        if (x < this.arena.x0 + 8 || x > this.arena.x1 - 8) break;
        this.scene.time.delayedCall(i * 40, () => { if (!this.dead && this.state === 'windup') this.markAt(x, 0x7affa0, 420, 0.5); });
      }
    }
  }

  decide(player, adx, sdx) {
    this.face(sdx);
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    const p2 = this.phase === 2;
    let choice;
    if (adx < 80) choice = pick(p2 ? ['swipe', 'combo', 'slam', 'thorns'] : ['swipe', 'slam', 'swipe']);
    else if (adx < 200) choice = pick(p2 ? ['charge', 'dash', 'thorns', 'howl'] : ['dash', 'charge', 'walk']);
    else choice = pick(p2 ? ['charge', 'charge', 'howl', 'leap'] : ['charge', 'howl', 'leap']);
    if (choice === 'howl' && this.minions.filter((m) => !m.dead).length >= 2) choice = 'charge';
    this.decideBase(player, adx, sdx, choice);
  }

  beginCharge() {
    this.state = 'charge'; this.t = 1.5; this.hitDone = false; this.dashFrom = this.x;
    this.setA('dash', true);
    audio.play('whoosh');
  }

  beginHowl() {
    this.state = 'howl'; this.t = 1.1;
    this.body.setVelocityX(0);
    this.setA('roar', true);
    audio.play('howl', 0.9);
    this.scene.fx.shake(0.006, 800);
  }

  tick(dt) {
    const b = this.body, s = this.scene;
    if (this.state === 'charge') {
      b.setVelocityX(this.dir * 440);
      if (Math.random() < 0.9) s.fx.afterImage(this, 0x7affa0);
      if (Math.random() < 0.5) s.fx.dustPuff(this.x - this.dir * 12, this.y, 1);
      this.hitBox(this.dir > 0 ? this.x - 12 : this.x - 60, this.y - 62, 72, 60, 32, 1.5);
      const wall = (this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left) || this.x < this.arena.x0 + 40 || this.x > this.arena.x1 - 40;
      if (wall) {
        audio.play('slam');
        s.fx.shake(0.016, 320);
        s.fx.burst('rocks', this.x + this.dir * 20, this.y - 40, 22);
        s.fx.ring(this.x + this.dir * 20, this.y - 40, 0x9affc0, 4, 360);
        this.state = 'stunned'; this.t = 1.7; b.setVelocityX(-this.dir * 50);
        this.setA('kneel', true);
        this.say('Staggered against the wall!');
        // antler-crash: a few falling stones
        for (let i = 0; i < 3; i++) s.time.delayedCall(i * 220, () => { if (!this.dead) this.dropAt(s.player.x + (Math.random() - 0.5) * 100, { tex: 'icicle', tint: 0x9a9080, delay: 450, ringTint: 0xcfc4a0, burst: 'rocks', dmg: 16 }); });
      } else if (this.t <= 0 || Math.abs(this.x - this.dashFrom) > 900) {
        this.state = 'recover'; this.t = 0.8 * this.speedMul; this.setA('idle');
        s.fx.dustPuff(this.x + this.dir * 10, this.y, 10);
      }
    } else if (this.state === 'stunned') {
      b.setVelocityX(b.velocity.x * Math.pow(0.9, dt * 60));
      if (this.t <= 0) {
        if (this.phase === 2 && Math.random() < 0.6) { this.face(Math.sign(s.player.x - this.x)); this.windup('charge', 0.45); }
        else { this.state = 'recover'; this.t = 0.4; this.setA('idle'); }
      }
    } else if (this.state === 'howl') {
      b.setVelocityX(0);
      if (Math.random() < 0.5) s.fx.burst('spirit', this.x, this.y - 70, 2);
      if (this.t <= 0) {
        for (const d of [-1, 1]) {
          const w = s.spawnMinion(Phaser.Math.Clamp(this.x + d * 60, this.arena.x0 + 20, this.arena.x1 - 20), this.y - 40);
          w.setTint(0x9affc0);
          this.minions.push(w);
        }
        this.state = 'recover'; this.t = 0.8 * this.speedMul; this.setA('idle');
      }
    }
  }

  takeHit(dmg, dir, poise) {
    if (this.state === 'stunned') { dmg *= 1.5; poise = 0; }
    super.takeHit(dmg, dir, poise);
  }

  thorns() {
    const px = this.scene.player.x;
    const n = this.phase === 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = px + (i - (n - 1) / 2) * 46 + (Math.random() - 0.5) * 16;
      this.scene.time.delayedCall(i * 90, () => { if (!this.dead) this.erupt(x, { tint: 0x7affa0, delay: 600, w: 16, h: 58, dmg: 22, burst: 'spirit', sound: 'shield' }); });
    }
  }

  clearExtras() { (this.minions || []).forEach((w) => { if (this.scene.wisps.includes(w)) this.scene.removeMinion(w); }); this.minions = []; }
  reset() { this.clearExtras(); super.reset(); }
}

// ================================================================== Level 7: the Duelist Queen
// Quick and exacting. Lunges and flurries (all parryable), spectral blade volleys, a
// blink behind you, and a counter-stance: strike her while she guards and she answers
// instantly. Wait it out, and she tires.
export class DuelistQueen extends BossBase {
  extraReset() { this.guarding = false; this.flurry = 0; }
  get speedMul() { return this.phase === 2 ? 0.6 : 0.8; }
  get windTimes() { return { lunge: 0.45, flurry: 0.4, volley: 0.55, blink: 0.1, guard: 0.2 }; }
  get windAnims() { return { lunge: 'crouch', flurry: 'crouch', volley: 'raise', blink: 'crouch', guard: 'crouch' }; }

  constructor(scene, x, y, arena, cfg) {
    super(scene, x, y, arena, cfg);
    this.parryStates = ['slam', 'swipe', 'dash', 'lunge', 'counter'];
  }

  get moves() {
    return {
      lunge: () => this.beginLunge(),
      flurry: () => { this.flurry = this.phase === 2 ? 3 : 2; this.beginLunge(); },
      volley: () => this.startAct('volley', 'stab', 1, () => this.volley(), 0.9),
      blink: () => this.beginBlink(),
      guard: () => this.beginGuard(),
    };
  }

  decide(player, adx, sdx) {
    this.face(sdx);
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    const p2 = this.phase === 2;
    let choice;
    if (adx < 90) choice = pick(p2 ? ['flurry', 'guard', 'swipe', 'blink', 'lunge'] : ['swipe', 'lunge', 'guard', 'slam']);
    else if (adx < 220) choice = pick(p2 ? ['flurry', 'blink', 'volley', 'lunge'] : ['lunge', 'flurry', 'volley', 'walk']);
    else choice = pick(p2 ? ['volley', 'blink', 'lunge', 'dash'] : ['volley', 'lunge', 'dash']);
    this.decideBase(player, adx, sdx, choice);
  }

  beginLunge() {
    this.state = 'lunge'; this.t = 0.3; this.hitDone = false; this.dashFrom = this.x;
    this.face(Math.sign(this.scene.player.x - this.x) || this.dir);
    this.setA('dash', true);
    audio.play('swingHeavy', 0.8);
  }

  beginGuard() {
    this.state = 'guard'; this.t = 2.2; this.guarding = true;
    this.body.setVelocityX(0);
    this.setA('kneel', true);
    this.setTint(0xbfd8ff);
    this.say('Her guard is up  -  do not strike!');
  }

  beginBlink() {
    this.state = 'blink'; this.t = 0.3; this.invuln = true;
    this.body.setVelocityX(0);
    audio.play('chime', 0.8); audio.play('vanish', 0.4);
    this.scene.fx.burst('spirit', this.x, this.y - 40, 24);
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 200 });
  }

  tick(dt, player) {
    const b = this.body, s = this.scene;
    if (this.state === 'lunge') {
      b.setVelocityX(this.dir * 400);
      if (Math.random() < 0.9) s.fx.afterImage(this, 0xff8aa0);
      this.hitBox(this.dir > 0 ? this.x - 6 : this.x - 90, this.y - 62, 96, 58, 26, 1.3);
      if (this.t <= 0 || (this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left)) {
        b.setVelocityX(0);
        if (this.flurry > 0) {
          this.flurry--;
          this.face(Math.sign(player.x - this.x) || this.dir);
          this.state = 'windup'; this.move = 'lunge'; this.t = 0.26 * this.speedMul; this.setA('crouch', true);
        } else { this.state = 'recover'; this.t = 0.6 * this.speedMul; this.setA('idle'); }
      }
    } else if (this.state === 'guard') {
      b.setVelocityX(0);
      if (this.t <= 0) {
        this.guarding = false; this.clearTint();
        this.state = 'winded'; this.t = 1.5; this.setA('kneel', true);
        this.say('She tires  -  now!');
      }
    } else if (this.state === 'counter') {
      b.setVelocityX(this.dir * 360);
      if (Math.random() < 0.9) s.fx.afterImage(this, 0xffffff);
      this.hitBox(this.dir > 0 ? this.x - 6 : this.x - 100, this.y - 62, 106, 58, 32, 1.5);
      if (this.t <= 0) { b.setVelocityX(0); this.state = 'recover'; this.t = 0.7 * this.speedMul; this.setA('idle'); }
    } else if (this.state === 'winded') {
      b.setVelocityX(0);
      if (this.t <= 0) { this.state = 'recover'; this.t = 0.3; this.setA('idle'); }
    } else if (this.state === 'blink') {
      b.setVelocityX(0);
      if (this.t <= 0) {
        const a = this.arena;
        const side = -(player.facing || 1);
        const x = Phaser.Math.Clamp(player.x + side * 64, a.x0 + 40, a.x1 - 40);
        this.setPosition(x, this.y); b.reset(x, this.y);
        this.face(Math.sign(player.x - x) || 1);
        this.invuln = false;
        s.tweens.add({ targets: this, alpha: 1, duration: 120 });
        s.fx.burst('spirit', x, this.y - 40, 24);
        audio.play('vanish', 0.7);
        this.windup('swipe', 0.28);
      }
    } else if (this.state === 'stagger') {
      this.flurry = 0;
      if (this.guarding) { this.guarding = false; this.clearTint(); }
    }
  }

  takeHit(dmg, dir, poise) {
    if (this.state === 'guard') {
      // riposte: she answers a blow with an immediate counter
      audio.play('parry', 0.8);
      this.scene.fx.parryFlash(this.x + this.dir * 20, this.y - 50, this.dir);
      this.scene.fx.ring(this.x, this.y - 50, 0xbfd8ff, 3, 300);
      this.guarding = false; this.clearTint();
      this.face(-dir);
      this.state = 'counter'; this.t = 0.3; this.hitDone = false;
      this.setA('dash', true);
      return 'blocked';
    }
    if (this.state === 'winded') { dmg *= 1.5; poise = 0; }
    super.takeHit(dmg, dir, poise);
  }

  volley() {
    const s = this.scene;
    const dir = Math.sign(s.player.x - this.x) || this.dir;
    audio.play('whoosh', 0.7);
    const ys = [-8, -42, -8];
    ys.forEach((dy, i) => {
      s.time.delayedCall(i * 380, () => {
        if (this.dead) return;
        audio.play('swing', 0.8);
        this.shot({ x: this.x + dir * 30, y: this.arena.floor + dy, vx: dir * 250, vy: 0, tex: 'cutline', tint: 0xff8aa0, sx: 0.75, sy: 3, w: 46, h: dy > -20 ? 14 : 18, dmg: 24, life: 4, glow: 0xff6a8a, glowScale: 0.4, pass: false });
      });
    });
  }
}

// ================================================================== Level 8: the Ashen King
// Three stages. Stage one is the Warden's art perfected; stage two calls meteors and
// summons; in stage three an ember crown orbits him and everything comes faster.
export class AshenKing extends BossBase {
  extraReset() { this.stage = 1; this.stage3Pending = false; this.minions = []; this.crown = null; this.crownT = 0; }
  get speedMul() { return this.stage === 3 ? 0.58 : this.phase === 2 ? 0.76 : 0.95; }
  get windTimes() { return { stomp: 0.7, meteors: 0.75, summon: 0.7 }; }
  get windAnims() { return { stomp: 'raise', meteors: 'raise', summon: 'raise' }; }
  get comboList() { return this.stage === 3 ? ['swipe', 'slam', 'swipe', 'slam'] : ['swipe', 'slam', 'swipe']; }

  constructor(scene, x, y, arena, cfg) {
    super(scene, x, y, arena, cfg);
    this.parryStates = ['slam', 'swipe', 'dash', 'stomp'];
  }

  get moves() {
    return {
      stomp: () => this.startAct('stomp', 'slam', 1, () => this.stompWaves(), 0.8),
      meteors: () => this.startAct('meteors', 'stab', 1, () => this.meteors(), 1.1),
      summon: () => this.startAct('summon', 'stab', 1, () => this.summon(), 1.0),
    };
  }

  decide(player, adx, sdx) {
    this.face(sdx);
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    if (this.stage3Pending) { this.stage3Pending = false; this.enterStage3(); return; }
    const st = this.stage;
    let choice;
    if (adx < 80) choice = pick(st === 1 ? ['slam', 'slam', 'swipe'] : st === 2 ? ['slam', 'combo', 'stomp', 'swipe', 'pillars'] : ['combo', 'stomp', 'combo', 'meteors', 'swipe']);
    else if (adx < 190) choice = pick(st === 1 ? ['dash', 'walk', 'walk'] : st === 2 ? ['dash', 'leap', 'pillars', 'meteors', 'summon'] : ['leap', 'dash', 'meteors', 'pillars', 'stomp']);
    else choice = pick(st === 1 ? ['leap', 'dash'] : st === 2 ? ['meteors', 'leap', 'summon', 'pillars'] : ['meteors', 'meteors', 'leap', 'summon']);
    if (choice === 'summon' && this.minions.filter((m) => !m.dead).length >= 2) choice = 'meteors';
    this.decideBase(player, adx, sdx, choice);
  }

  takeHit(dmg, dir, poise) {
    if (this.stage === 2 && !this.stage3Pending && this.hp - dmg <= this.maxHp * 0.3 && !this.dead) this.stage3Pending = true;
    super.takeHit(dmg, dir, poise);
  }

  enterPhase2() {
    super.enterPhase2();
    this.stage = 2;
  }

  enterStage3() {
    this.stage = 3;
    this.roar(1.6);
    const s = this.scene;
    s.fx.flash(0xffe26a, 260, 0.5);
    s.fx.burst('fire', this.x, this.y - 40, 80);
    s.events.emit('boss-phase2', this.cfg.stage3Msg || 'The crown ignites!');
    this.setTint(0xffe8a0);
    this.hp = Math.max(this.hp, this.maxHp * 0.28);
    const p = s.player;
    if (Math.abs(p.x - this.x) < 100) s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 100, this.y - 100, 200, 100), 10 * s.ngMul.dmg, this.x, 1.9);
    this.crown = [0, 1, 2].map((i) => {
      const sp = s.add.image(this.x, this.y, 'fireorb').setDepth(26).setBlendMode('ADD').setScale(1.3);
      const glow = s.fx.glow(this.x, this.y, 0xffc84a, 0.7, 0.6, 25);
      return { sp, glow, a: (i / 3) * Math.PI * 2, cd: 0 };
    });
  }

  clearExtras() {
    if (this.crown) this.crown.forEach((c) => { c.sp.destroy(); c.glow.destroy(); });
    this.crown = null;
    (this.minions || []).forEach((w) => { if (this.scene.wisps.includes(w)) this.scene.removeMinion(w); });
    this.minions = [];
  }

  reset() { this.clearExtras(); super.reset(); }

  tick(dt, player) {
    if (this.crown) {
      const s = this.scene;
      this.crownT += dt;
      this.crown.forEach((c, i) => {
        const ang = this.crownT * 2.2 + (i / 3) * Math.PI * 2;
        const r = 62 + Math.sin(this.crownT * 1.5 + i) * 10;
        c.sp.setPosition(this.x + Math.cos(ang) * r, this.y - 62 + Math.sin(ang) * r * 0.55);
        c.glow.setPosition(c.sp.x, c.sp.y);
        c.cd -= dt;
        if (c.cd <= 0 && s.hitPlayer(new Phaser.Geom.Rectangle(c.sp.x - 7, c.sp.y - 7, 14, 14), 14 * s.ngMul.dmg * (this.cfg.dmgMul || 1), c.sp.x, 0.8)) c.cd = 0.9;
        if (Math.random() < 0.3) s.fx.fire.explode(1, c.sp.x, c.sp.y);
      });
    }
  }

  meteors() {
    const s = this.scene, a = this.arena;
    const n = this.stage === 3 ? 12 : 8;
    audio.play('roar', 0.5);
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 170, () => {
        if (this.dead) return;
        const x = i % 2 ? s.player.x + (Math.random() - 0.5) * 90 : a.x0 + 30 + Math.random() * (a.x1 - a.x0 - 60);
        this.dropAt(x, { tex: 'fireorb', delay: 640, fall: 300, dmg: 24, ringTint: 0xffc84a });
      });
    }
  }

  summon() {
    const s = this.scene;
    audio.play('wail', 0.5);
    for (const d of [-1, 1]) {
      const w = s.spawnMinion(Phaser.Math.Clamp(this.x + d * 70, this.arena.x0 + 20, this.arena.x1 - 20), this.y - 60);
      w.setTint(0xffc060);
      this.minions.push(w);
    }
  }
}

export const NEW_BOSSES = { golem: ForgeGolem, stag: StagSpirit, queen: DuelistQueen, king: AshenKing };
