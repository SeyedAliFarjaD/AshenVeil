import { audio } from '../audio.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const HOVER = 26; // feet height above the floor while floating

// Boss 2: a floating caster. Keeps her distance, fires homing soul orbs,
// teleports behind you to slam (then sits exposed), and sweeps spirit lances.
export class Saint extends Phaser.Physics.Arcade.Sprite {
  // cfg: { prefix, name, maxHp, twin, fire, flood, color, colorLight, orb, phaseMsg }
  constructor(scene, x, y, arena, cfg = {}) {
    super(scene, x, y, `${cfg.prefix || 'saint'}_float`, 0);
    this.cfg = cfg;
    this.prefix = cfg.prefix || 'saint';
    this.twin = !!cfg.twin;
    // Morwen's spirit cyan unless the cfg gives a palette (the Pyre Witch is fire orange)
    this.col = cfg.color || 0x7affd8;
    this.colLight = cfg.colorLight || 0xd8fff4;
    this.pfx = cfg.fire ? scene.fx.fire : scene.fx.spirit;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 108 / 112);
    this.body.setSize(20, 44).setOffset(46, 64);
    this.body.setAllowGravity(false);
    this.setDepth(17);
    this.arena = arena;
    this.spawn = { x, y: arena.floor - HOVER };
    this.maxHp = cfg.maxHp || 780;
    this.name = cfg.name || 'Morwen, the Drowned Saint';
    this.aura = scene.fx.glow(x, y, this.col, 1.3, 0, 16);
    this.orbs = [];
    this.minions = [];
    this.on('animationcomplete', this.onDone, this);
    this.reset();
  }

  reset() {
    this.clearProjectiles();
    this.minions.forEach((w) => this.scene.removeMinion(w));
    this.minions = [];
    if (this.lanceGfx) { this.lanceGfx.destroy(); this.lanceGfx = null; }
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    this.hp = this.maxHp; this.poise = 0; this.phase = 1; this.phasePending = false;
    this.state = 'dormant'; this.t = 0; this.bob = 0; this.last = [];
    this.dead = false; this.invuln = true; this.parried = false;
    this.twin = !!this.cfg.twin; // empower() clears it; a rematch starts the pair over
    this.setAlpha(0).setVisible(true).clearTint().setFlipX(true);
    this.aura.setAlpha(0);
    this.anim = '';
    this.setA('float');
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play(`${this.prefix}_${k}`); }
  get speedMul() { return this.phase === 2 ? 0.75 : 1; }
  get floor() { return this.arena.floor; }

  awaken() {
    if (this.state !== 'dormant') return;
    this.state = 'intro'; this.t = 2.4;
    const s = this.scene;
    s.tweens.add({ targets: this, alpha: 1, duration: 1400 });
    s.tweens.add({ targets: this.aura, alpha: 0.35, duration: 1400 });
    const ev = s.time.addEvent({ delay: 60, repeat: 20, callback: () => this.pfx.explode(3, this.x + (Math.random() - 0.5) * 40, this.floor - 4) });
    s.time.delayedCall(1300, () => { ev.remove(); this.wail(1.1); });
  }

  wail(time) {
    this.state = 'wail'; this.t = time; this.invuln = true;
    this.setA('channel', true);
    audio.play('wail');
    const s = this.scene;
    s.fx.shake(0.006, time * 800);
    const ring = s.add.image(this.x, this.y - 40, 'glow').setTint(this.col).setBlendMode('ADD').setDepth(25).setAlpha(0.8).setScale(0.3);
    s.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
  }

  // ------------------------------------------------------------ movement
  hoverToward(dt, tx, ty, speed = 95) {
    const dx = tx - this.x, dy = ty - this.y;
    const k = Math.min(1, dt * 60);
    this.body.setVelocity(Phaser.Math.Clamp(dx * 2.2, -speed, speed) * k, Phaser.Math.Clamp(dy * 3, -160, 160) * k);
  }

  keepDistance(dt, player) {
    const a = this.arena;
    let side = Math.sign(this.x - player.x) || 1;
    let tx = player.x + side * 120;
    if (tx < a.x0 + 30 || tx > a.x1 - 30) tx = Phaser.Math.Clamp(tx, a.x0 + 30, a.x1 - 30);
    this.hoverToward(dt, tx, this.floor - HOVER + Math.sin(this.bob * 2) * 3);
    this.setFlipX(player.x < this.x);
  }

  update(dt, player) {
    this.bob += dt;
    this.aura.setPosition(this.x, this.y - 34);
    this.updateProjectiles(dt, player);
    if (this.dead || this.state === 'dormant') { this.body.setVelocity(0, 0); return; }
    this.t -= dt;
    this.poise = Math.max(0, this.poise - 25 * dt);
    if (this.phase === 2 && Math.random() < 0.35) this.pfx.explode(1, this.x + (Math.random() - 0.5) * 24, this.y - Math.random() * 50);

    switch (this.state) {
      case 'intro':
        this.body.setVelocity(0, 0);
        break;
      case 'wail':
        this.body.setVelocity(0, 0);
        if (this.t <= 0) { this.invuln = false; this.state = 'cooldown'; this.t = 0.6; this.setA('float'); }
        break;
      case 'cooldown':
        this.keepDistance(dt, player);
        if (this.t <= 0) this.state = 'decide';
        break;
      case 'decide':
        this.decide(player);
        break;
      case 'volley':
        this.keepDistance(dt, player);
        if (this.t <= 0) this.fireVolley(player);
        break;
      case 'vanish':
        this.body.setVelocity(0, 0);
        if (this.t <= 0) this.reappear(player);
        break;
      case 'appear':
        this.body.setVelocity(0, 0);
        if (this.t <= 0) { this.state = 'slamWind'; this.t = 0.45 * this.speedMul; this.setA('slam', true); this.anims.pause(); this.glint(); }
        break;
      case 'slamWind':
        this.body.setVelocity(0, -10);
        if (this.t <= 0) { this.state = 'slamFall'; this.anims.resume(); }
        break;
      case 'slamFall':
        this.body.setVelocity(0, 420);
        if (this.y >= this.floor - 1) this.slamImpact();
        break;
      case 'grounded':
        this.body.setVelocity(0, 0);
        if (this.t <= 0) { this.state = 'rise'; this.setA('float'); }
        break;
      case 'rise':
        this.hoverToward(dt, this.x, this.floor - HOVER);
        if (Math.abs(this.y - (this.floor - HOVER)) < 3) { this.state = 'cooldown'; this.t = 0.5 * this.speedMul; }
        break;
      case 'lanceWind':
        this.body.setVelocity(0, 0);
        this.drawLance(false);
        if (this.t <= 0) this.fireLance();
        break;
      case 'lance':
        this.body.setVelocity(0, 0);
        this.drawLance(true);
        if (!this.lanceHit) {
          const r = new Phaser.Geom.Rectangle(this.arena.x0, this.lanceY - 6, this.arena.x1 - this.arena.x0, 12);
          if (this.scene.hitPlayer(r, 28 * this.scene.ngMul.dmg, this.x, 1)) this.lanceHit = true;
        }
        if (this.t <= 0) this.endLance();
        break;
      case 'channel':
        this.keepDistance(dt * 0.4, player);
        if (this.t <= 0) this.release(player);
        break;
      case 'stagger':
        this.hoverToward(dt, this.x, this.floor, 200);
        if (this.t <= 0) { this.state = 'rise'; this.setA('float'); }
        break;
      default: break;
    }
  }

  decide(player) {
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    const near = Math.abs(player.x - this.x) < 90;
    const p2 = this.phase === 2;
    let opts = near ? ['vanish', 'volley', 'lance', 'vanish'] : ['volley', 'volley', 'lance', 'vanish'];
    if (p2) {
      opts = opts.concat(['rain', 'lance']);
      if (this.minions.filter((m) => !m.dead).length === 0) opts.push('summon');
    }
    let c = pick(opts);
    if (this.last[0] === c && this.last[1] === c) c = c === 'volley' ? 'vanish' : 'volley';
    this.last.unshift(c); this.last.length = Math.min(this.last.length, 3);

    if (c === 'volley') { this.state = 'volley'; this.t = 0.6 * this.speedMul; this.setA('cast', true); this.glint(); }
    else if (c === 'vanish') this.vanish();
    else if (c === 'lance') { this.lances = p2 ? 2 : 1; this.startLance(player, 0); }
    else { this.state = 'channel'; this.move = c; this.t = (c === 'rain' ? 1.0 : 0.8) * this.speedMul; this.setA('channel', true); audio.play('wisp'); }
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x + (this.flipX ? -14 : 14), this.y - 66, 'spark').setTint(this.colLight).setBlendMode('ADD').setDepth(30).setScale(0.5);
    s.tweens.add({ targets: g, scale: 3, angle: 90, alpha: 0, duration: 420, onComplete: () => g.destroy() });
    audio.play('glint');
  }

  // ------------------------------------------------------------ attacks
  fireVolley(player) {
    const n = this.phase === 2 ? 5 : 3;
    const ox = this.x + (this.flipX ? -16 : 16), oy = this.y - 64;
    const base = Math.atan2(player.y - 14 - oy, player.x - ox);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.32;
      this.spawnOrb(ox, oy, Math.cos(a) * 115, Math.sin(a) * 115, true);
    }
    audio.play('orb');
    this.state = 'cooldown'; this.t = (this.phase === 2 ? 0.8 : 1.2);
  }

  spawnOrb(x, y, vx, vy, homing) {
    const s = this.scene;
    const sp = s.add.image(x, y, this.cfg.orb || 'orb').setDepth(26).setBlendMode('ADD');
    const glow = s.fx.glow(x, y, this.col, 0.35, 0.6, 25);
    this.orbs.push({ sp, glow, vx, vy, t: 0, homing });
  }

  updateProjectiles(dt, player) {
    const a = this.arena;
    this.orbs = this.orbs.filter((o) => {
      o.t += dt;
      if (o.homing && o.t < 0.9 && !player.dead) {
        const want = Math.atan2(player.y - 14 - o.sp.y, player.x - o.sp.x);
        const cur = Math.atan2(o.vy, o.vx);
        const turn = Phaser.Math.Angle.Wrap(want - cur);
        const na = cur + Phaser.Math.Clamp(turn, -1.6 * dt, 1.6 * dt);
        const sp = Math.hypot(o.vx, o.vy);
        o.vx = Math.cos(na) * sp; o.vy = Math.sin(na) * sp;
      }
      o.sp.x += o.vx * dt; o.sp.y += o.vy * dt;
      o.glow.setPosition(o.sp.x, o.sp.y);
      if (Math.random() < 0.3) this.pfx.explode(1, o.sp.x, o.sp.y);
      const hit = this.scene.hitPlayer(new Phaser.Geom.Rectangle(o.sp.x - 4, o.sp.y - 4, 8, 8), 18 * this.scene.ngMul.dmg, o.sp.x, 0.8);
      const out = o.t > 4.5 || o.sp.x < a.x0 || o.sp.x > a.x1 || o.sp.y > a.floor || this.scene.isWallAt(o.sp.x, o.sp.y);
      if (hit || out) {
        this.pfx.explode(8, o.sp.x, Math.min(o.sp.y, a.floor - 2));
        if (o.sp.y >= a.floor - 2) audio.play('splash', 0.4);
        o.sp.destroy(); o.glow.destroy();
        return false;
      }
      return true;
    });
  }

  clearProjectiles() {
    (this.orbs || []).forEach((o) => { o.sp.destroy(); o.glow.destroy(); });
    this.orbs = [];
  }

  vanish() {
    this.state = 'vanish'; this.t = 0.4; this.invuln = true;
    audio.play('vanish');
    this.pfx.explode(24, this.x, this.y - 30);
    this.scene.tweens.add({ targets: [this, this.aura], alpha: 0, duration: 300 });
  }

  reappear(player) {
    const a = this.arena;
    const behind = -player.facing || 1;
    let x = player.x + behind * 38;
    if (x < a.x0 + 24 || x > a.x1 - 24) x = player.x - behind * 38;
    x = Phaser.Math.Clamp(x, a.x0 + 24, a.x1 - 24);
    const y = this.floor - HOVER - 30;
    this.setPosition(x, y); this.body.reset(x, y);
    this.setFlipX(player.x < x);
    this.state = 'appear'; this.t = 0.25;
    this.pfx.explode(20, x, y - 30);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 220 });
    this.scene.tweens.add({ targets: this.aura, alpha: this.phase === 2 ? 0.55 : 0.35, duration: 220 });
    this.scene.time.delayedCall(120, () => { if (!this.dead) this.invuln = false; });
  }

  slamImpact() {
    const s = this.scene;
    this.setY(this.floor); this.body.reset(this.x, this.floor);
    this.state = 'grounded'; this.t = 1.25 * this.speedMul;
    audio.play('slam');
    audio.play('splash');
    s.fx.shake(0.012, 260);
    this.pfx.explode(30, this.x, this.floor - 4);
    s.fx.dustPuff(this.x - 16, this.floor, 8); s.fx.dustPuff(this.x + 16, this.floor, 8);
    s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 44, this.floor - 40, 88, 40), 30 * s.ngMul.dmg, this.x, 1.4);
    if (this.phase === 2) { this.spawnWave(-1); this.spawnWave(1); }
  }

  spawnWave(dir) {
    // a low spirit wave rolling along the floor: jump it
    const s = this.scene;
    const w = s.add.sprite(this.x + dir * 20, this.floor, 'wave').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(this.col).setFlipX(dir < 0);
    w.play('wave');
    const glow = s.fx.glow(w.x, w.y - 10, this.col, 0.5, 0.5, 20);
    let hit = false;
    const ev = s.time.addEvent({ delay: 16, loop: true, callback: () => {
      w.x += dir * 170 * 0.016;
      glow.setPosition(w.x, w.y - 10);
      if (!hit && s.hitPlayer(new Phaser.Geom.Rectangle(w.x - 6, w.y - 20, 12, 20), 20 * s.ngMul.dmg, w.x, 1)) hit = true;
      if (w.x < this.arena.x0 + 8 || w.x > this.arena.x1 - 8 || this.dead) { ev.remove(); w.destroy(); glow.destroy(); }
    } });
  }

  startLance(player, i) {
    // low lance = jump over it, high lance (phase 2) = stay on the ground
    const high = this.phase === 2 && i === 1;
    this.lanceY = high ? this.floor - 40 : this.floor - 12;
    this.state = 'lanceWind'; this.t = 0.85 * this.speedMul; this.lanceIdx = i;
    this.setA('channel', true);
    audio.play('wisp');
  }

  drawLance(active) {
    const s = this.scene, a = this.arena;
    if (!this.lanceGfx) this.lanceGfx = s.add.graphics().setDepth(27).setBlendMode('ADD');
    const g = this.lanceGfx;
    g.clear();
    if (active) {
      g.fillStyle(this.col, 0.5); g.fillRect(a.x0, this.lanceY - 7, a.x1 - a.x0, 14);
      g.fillStyle(this.colLight, 0.95); g.fillRect(a.x0, this.lanceY - 3, a.x1 - a.x0, 6);
    } else {
      const on = Math.floor(this.t * 14) % 2 === 0;
      g.fillStyle(this.col, on ? 0.55 : 0.2); g.fillRect(a.x0, this.lanceY - 1, a.x1 - a.x0, 2);
    }
  }

  fireLance() {
    this.state = 'lance'; this.t = 0.25; this.lanceHit = false;
    audio.play('beam');
    this.scene.fx.shake(0.006, 200);
    for (let x = this.arena.x0; x < this.arena.x1; x += 40) this.pfx.explode(2, x, this.lanceY);
  }

  endLance() {
    if (this.lanceGfx) this.lanceGfx.clear();
    if (this.lanceIdx + 1 < this.lances) { this.startLance(this.scene.player, this.lanceIdx + 1); this.t = 0.6; return; }
    this.state = 'cooldown'; this.t = 0.7 * this.speedMul; this.setA('float');
  }

  release(player) {
    const s = this.scene, a = this.arena;
    if (this.move === 'summon') {
      for (const d of [-1, 1]) {
        const w = s.spawnMinion(Phaser.Math.Clamp(this.x + d * 50, a.x0 + 20, a.x1 - 20), this.y - 60);
        this.minions.push(w);
      }
      audio.play('wisp');
    } else if (this.move === 'rain') {
      for (let i = 0; i < 7; i++) {
        const x = Phaser.Math.Clamp(player.x + (i - 3) * 44 + (Math.random() - 0.5) * 16, a.x0 + 12, a.x1 - 12);
        s.time.delayedCall(i * 90, () => {
          if (this.dead) return;
          const mark = s.add.image(x, a.floor, 'mark').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(this.col);
          s.tweens.add({ targets: mark, alpha: { from: 0.3, to: 1 }, yoyo: true, repeat: 3, duration: 90 });
          s.time.delayedCall(650, () => { mark.destroy(); if (!this.dead) this.spawnOrb(x, a.y0 + 20, 0, 320, false); });
        });
      }
    }
    this.state = 'cooldown'; this.t = 1.0 * this.speedMul; this.setA('float');
  }

  onDone(anim) {
    if (anim.key === `${this.prefix}_cast` && this.state === 'cooldown') this.setA('float');
    if (anim.key === `${this.prefix}_hurt` && !this.dead && this.state !== 'stagger') this.setA('float');
  }

  enterPhase2() {
    this.phase = 2;
    this.wail(1.6);
    this.scene.fx.flash(this.col, 220, 0.35);
    this.scene.tweens.add({ targets: this.aura, alpha: 0.55, scale: 1.8, duration: 800 });
    if (this.cfg.flood !== false) this.scene.floodArena(true);
    this.scene.events.emit('boss-phase2', this.cfg.phaseMsg || 'The waters rise to meet their Saint...');
  }

  takeHit(dmg, dir, poiseDmg) {
    if (this.dead || this.state === 'dormant') return null;
    const fx = this.scene.fx;
    if (this.invuln || this.alpha < 0.6) { audio.play('glint', 0.6); this.pfx.explode(6, this.x, this.y - 30); return 'blocked'; }
    // she takes extra damage while grounded after a slam
    const mult = this.state === 'grounded' || this.state === 'stagger' ? 1.3 : 1;
    this.hp -= dmg * mult;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.active) this.clearTint(); });
    this.poise += poiseDmg;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    if (this.phase === 1 && !this.twin && this.hp <= this.maxHp * 0.5) this.phasePending = true;
    if (this.poise >= 110 && ['cooldown', 'volley', 'channel', 'rise'].includes(this.state)) {
      this.poise = 0;
      this.state = 'stagger'; this.t = 1.4;
      this.setA('hurt', true);
      audio.play('clang');
      this.pfx.explode(20, this.x, this.y - 30);
      fx.ring(this.x, this.y - 40, this.colLight, 3.5, 320);
      fx.zoomPunch(0.05, 200);
      this.scene.events.emit('toast', 'Staggered!');
    }
    return 'hit';
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.hp = 0;
    this.body.setVelocity(0, 0);
    this.clearProjectiles();
    if (this.lanceGfx) this.lanceGfx.clear();
    this.minions.forEach((w) => { if (!w.dead) w.takeHit(999, 1); });
    const s = this.scene;
    s.fx.hitStop(450);
    s.fx.flash(0xffffff, 300, 0.8);
    s.fx.shake(0.015, 500);
    audio.play('wail', 0.8);
    this.setA('death', true);
    if (this.cfg.flood !== false) s.floodArena(false);
    const ev = s.time.addEvent({ delay: 60, repeat: 40, callback: () => this.pfx.explode(4, this.x + (Math.random() - 0.5) * 30, this.y - Math.random() * 60) });
    s.tweens.add({ targets: this, y: this.y - 40, alpha: 0, duration: 2600, delay: 800, onUpdate: () => this.aura.setPosition(this.x, this.y - 34), onComplete: () => { this.setVisible(false); ev.remove(); } });
    s.tweens.add({ targets: this.aura, alpha: 0, duration: 2600, delay: 800 });
    s.onBossDeath(this);
  }

  // Twin fights: the survivor absorbs its partner's power.
  empower() {
    if (this.dead) return;
    this.twin = false;
    this.hp = Math.max(this.hp, this.maxHp * 0.6);
    if (this.phase === 1) this.phasePending = true;
  }
}
