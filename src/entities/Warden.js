import { audio } from '../audio.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Warden extends Phaser.Physics.Arcade.Sprite {
  // cfg: { prefix, name, maxHp, twin } lets the same AI drive boss variants.
  constructor(scene, x, y, arena, cfg = {}) {
    super(scene, x, y, `${cfg.prefix || 'warden'}_kneel`, 0);
    this.cfg = cfg;
    this.prefix = cfg.prefix || 'warden';
    this.twin = !!cfg.twin;
    this.frost = !!cfg.frost; // the Rimebound: ice moves of his own, faster and heavier
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 124 / 128);
    this.body.setSize(22, 52).setOffset(53, 72);
    this.body.setMaxVelocity(600, 700);
    this.setDepth(17);
    this.arena = arena;
    this.spawn = { x, y };
    this.maxHp = cfg.maxHp || 900;
    this.name = cfg.name || 'Ser Caedric, the Ashen Warden';
    this.on('animationupdate', this.onFrame, this);
    this.on('animationcomplete', this.onDone, this);
    this.aura = scene.fx.glow(x, y - 50, this.frost ? 0x9fd8ff : 0xff5a20, 1.6, 0, 16);
    this.reset();
  }

  reset() {
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.hp = this.maxHp; this.poise = 0; this.phase = 1; this.phasePending = false;
    this.state = 'dormant'; this.t = 0; this.dir = -1; this.last = []; this.combo = [];
    this.dead = false; this.invuln = true; this.parried = false;
    this.twin = !!this.cfg.twin; // empower() clears it; a rematch starts the pair over
    this.setFlipX(true).setAlpha(1).setVisible(true).clearTint();
    this.body.enable = true;
    this.aura.setAlpha(0);
    this.anim = '';
    this.setA('kneel');
    if (this.waves) this.waves.forEach((w) => w.destroy());
    this.waves = [];
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play(`${this.prefix}_${k}`); }
  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }
  get speedMul() { return (this.phase === 2 ? 0.72 : 1) * (this.frost ? 0.85 : 1); }

  awaken() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.t = 1.1;
    this.scene.time.delayedCall(500, () => { this.setA('idle'); });
  }

  update(dt, player) {
    const b = this.body;
    this.aura.setPosition(this.x, this.y - 50);
    if (this.dead || this.state === 'dormant') { b.setVelocityX(0); return; }
    this.t -= dt;
    this.poise = Math.max(0, this.poise - 30 * dt);
    const dx = player.x - this.x, adx = Math.abs(dx);
    const onGround = b.blocked.down;

    if (this.phase === 2 && Math.random() < 0.5) {
      (this.frost ? this.scene.fx.spirit : this.scene.fx.fire).explode(1, this.x + (Math.random() - 0.5) * 30, this.y - Math.random() * 70);
    }

    switch (this.state) {
      case 'intro':
        if (this.t <= 0) this.roar(1.3);
        break;
      case 'roar':
        b.setVelocityX(0);
        if (Math.random() < 0.3) this.scene.fx.shake(0.003, 60);
        if (this.t <= 0) {
          this.invuln = false;
          this.state = 'recover'; this.t = 0.4; this.setA('idle');
        }
        break;
      case 'decide':
        this.decide(player, adx, Math.sign(dx));
        break;
      case 'walk':
        this.face(Math.sign(dx));
        b.setVelocityX(this.dir * (this.phase === 2 ? 72 : 52));
        this.setA('walk');
        if (adx < 72 || this.t <= 0) { b.setVelocityX(0); this.startMelee(); }
        break;
      case 'windup':
        b.setVelocityX(approach(b.velocity.x, 0, 900 * dt));
        if (this.t <= 0) this.release();
        break;
      case 'slam': case 'swipe': case 'stab':
        b.setVelocityX(approach(b.velocity.x, 0, 700 * dt));
        break;
      case 'dash': {
        b.setVelocityX(this.dir * 360);
        if (Math.random() < 0.8) this.scene.fx.afterImage(this, 0xff7a2a);
        if (Math.random() < 0.5) this.scene.fx.dustPuff(this.x - this.dir * 10, this.y, 1);
        this.hitBox(this.dir > 0 ? this.x - 12 : this.x - 58, this.y - 60, 70, 58, 30, 1.4);
        const passed = (player.x - this.x) * this.dir < -70;
        const blocked = (this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left);
        if (Math.abs(this.x - this.dashFrom) > 300 || passed || blocked || this.t <= 0) {
          this.state = 'recover'; this.t = 0.75 * this.speedMul; this.setA('idle');
          this.scene.fx.dustPuff(this.x + this.dir * 10, this.y, 10);
          audio.play('land');
        }
        break;
      }
      case 'leap':
        if (b.velocity.y > 0 && this.anim !== 'leap') this.setA('leap');
        if (!onGround) this.airborne = true;
        if ((this.airborne && onGround) || this.t <= 0) this.land();
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 900 * dt));
        if (this.anim !== 'idle' && !this.anims.isPlaying) this.setA('idle');
        if (this.t <= 0) this.state = 'decide';
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.2; this.setA('idle'); }
        break;
      default: break;
    }
    this.updateWaves(dt);
  }

  decide(player, adx, sdx) {
    this.face(sdx);
    if (this.phasePending) { this.phasePending = false; this.enterPhase2(); return; }
    let choice;
    const p2 = this.phase === 2;
    if (this.frost) {
      // the Rimebound fights at every range from the start
      if (adx < 75) choice = pick(p2 ? ['combo', 'combo', 'slam', 'frostline', 'icicles'] : ['slam', 'combo', 'swipe', 'frostline']);
      else if (adx < 180) choice = pick(p2 ? ['dash', 'frostline', 'icicles', 'leap'] : ['dash', 'frostline', 'walk', 'icicles']);
      else choice = pick(p2 ? ['icicles', 'frostline', 'leap', 'dash'] : ['icicles', 'leap', 'dash']);
    } else if (adx < 75) choice = pick(p2 ? ['slam', 'combo', 'combo', 'swipe', 'pillars'] : ['slam', 'slam', 'swipe']);
    else if (adx < 180) choice = pick(p2 ? ['dash', 'walk', 'pillars', 'leap'] : ['dash', 'walk', 'walk']);
    else choice = pick(p2 ? ['leap', 'dash', 'pillars'] : ['leap', 'dash']);
    // avoid repeating the same move three times
    if (this.last.length >= 2 && this.last[0] === choice && this.last[1] === choice) choice = adx < 75 ? 'swipe' : 'walk';
    this.last.unshift(choice); this.last.length = Math.min(this.last.length, 3);

    if (choice === 'walk') { this.state = 'walk'; this.t = 1.3; return; }
    if (choice === 'combo') { this.combo = ['swipe', 'slam', 'swipe']; this.windup(this.combo.shift(), 0.4); return; }
    this.windup(choice);
  }

  startMelee() {
    const p2 = this.phase === 2;
    if (p2 && Math.random() < 0.5) { this.combo = ['swipe', 'slam']; this.windup(this.combo.shift(), 0.4); }
    else this.windup(Math.random() < 0.6 ? 'slam' : 'swipe');
  }

  windup(move, time) {
    this.move = move;
    this.state = 'windup';
    const m = this.speedMul;
    const T = { slam: 0.7, swipe: 0.5, dash: 0.55, leap: 0.45, pillars: 0.6, frostline: 0.55, icicles: 0.65 };
    this.t = (time || T[move]) * m;
    const anim = { slam: 'raise', swipe: 'crouch', dash: 'crouch', leap: 'crouch', pillars: 'raise', frostline: 'raise', icicles: 'raise' }[move];
    this.setA(anim, true);
    this.scene.time.delayedCall(Math.max(0, this.t * 1000 - 260), () => this.glint());
  }

  glint() {
    if (this.dead) return;
    const s = this.scene;
    const up = ['slam', 'pillars', 'frostline', 'icicles'].includes(this.move);
    const gx = this.x - this.dir * (up ? 14 : 30), gy = this.y - (up ? 100 : 30);
    const g = s.add.image(gx, gy, 'spark').setTint(0xffc070).setBlendMode('ADD').setDepth(30).setScale(0.5);
    s.tweens.add({ targets: g, scale: 3, angle: 90, alpha: 0, duration: 420, onComplete: () => g.destroy() });
    audio.play('glint');
  }

  release() {
    const m = this.move;
    this.hitDone = false;
    if (m === 'slam') { this.state = 'slam'; this.setA('slam', true); audio.play('swingHeavy'); this.body.setVelocityX(this.dir * 120); }
    else if (m === 'swipe') { this.state = 'swipe'; this.setA('swipe', true); audio.play('swingHeavy'); this.body.setVelocityX(this.dir * 160); }
    else if (m === 'dash') {
      this.state = 'dash'; this.t = 1.0; this.dashFrom = this.x; this.setA('dash', true);
      audio.play('whoosh');
    } else if (m === 'leap') {
      const target = this.scene.player.x;
      const T = 0.8;
      const vx = Phaser.Math.Clamp((target - this.x) / T, -320, 320);
      this.body.setVelocity(vx, -360);
      this.state = 'leap'; this.t = 2.0; this.hitDone = false; this.airborne = false;
      this.face(Math.sign(vx));
      this.setA('raise', true);
      audio.play('whoosh');
      this.scene.fx.dustPuff(this.x, this.y, 10);
    } else if (m === 'pillars' || m === 'frostline' || m === 'icicles') {
      this.state = 'stab'; this.setA('stab', true);
    }
  }

  land() {
    this.state = 'recover';
    this.t = 0.95 * this.speedMul;
    this.setA('slam', true);
    this.anims.setProgress(0.4);
    this.body.setVelocityX(0);
    audio.play('slam');
    const fx = this.scene.fx;
    fx.shake(0.014, 300);
    fx.dustPuff(this.x - 20, this.y, 12); fx.dustPuff(this.x + 20, this.y, 12);
    fx.burst('rocks', this.x, this.y - 4, 18);
    this.hitBox(this.x - 64, this.y - 34, 128, 36, 38, 1.6);
    if (this.phase === 2) { this.spawnWave(-1); this.spawnWave(1); }
  }

  onFrame(anim, frame) {
    const f = frame.index - 1;
    const fx = this.scene.fx;
    if (anim.key === `${this.prefix}_slam` && this.state === 'slam') {
      if (f === 1) {
        audio.play('slam');
        fx.shake(0.012, 260);
        fx.slash(this.x + this.dir * 4, this.y - 50, 'bslash', this.dir < 0, false, 1);
        const tipX = this.x + this.dir * 62;
        fx.dustPuff(tipX, this.y, 12);
        fx.burst('rocks', tipX, this.y - 2, 14);
        fx.burst('sparks', tipX, this.y - 4, 12);
        if (this.phase === 2 || this.frost) this.spawnWave(this.dir);
      }
      if (f >= 1 && f <= 2) this.hitBox(this.dir > 0 ? this.x - 10 : this.x - 80, this.y - 80, 90, 82, 36, 1.4);
    }
    if (anim.key === `${this.prefix}_swipe` && this.state === 'swipe') {
      if (f === 1) fx.slash(this.x + this.dir * 4, this.y - 50, 'bslash', this.dir < 0, true, 1);
      if (f >= 1 && f <= 2) this.hitBox(this.dir > 0 ? this.x - 10 : this.x - 78, this.y - 100, 88, 100, 28, 1.2);
    }
    if (anim.key === `${this.prefix}_stab` && this.state === 'stab' && f === 1) {
      audio.play('slam');
      fx.shake(0.01, 200);
      fx.burst(this.frost ? 'spirit' : 'fire', this.x + this.dir * 10, this.y, 30);
      if (this.move === 'frostline') this.spawnFrostLine();
      else if (this.move === 'icicles') this.spawnIcicles();
      else this.spawnPillars();
    }
  }

  onDone(anim) {
    const k = anim.key;
    if ((k === `${this.prefix}_slam` && this.state === 'slam') || (k === `${this.prefix}_swipe` && this.state === 'swipe')) {
      if (this.combo.length) {
        this.face(Math.sign(this.scene.player.x - this.x));
        this.windup(this.combo.shift(), 0.26);
      } else {
        this.state = 'recover';
        this.t = (k === `${this.prefix}_slam` ? 0.85 : 0.6) * this.speedMul;
      }
    } else if (k === `${this.prefix}_stab` && this.state === 'stab') {
      this.state = 'recover'; this.t = 1.1 * this.speedMul;
    } else if (k === `${this.prefix}_death`) {
      this.dissolve();
    }
  }

  hitBox(x, y, w, h, dmg, knock) {
    if (this.hitDone) return;
    if (this.scene.hitPlayer(new Phaser.Geom.Rectangle(x, y, w, h), dmg * this.scene.ngMul.dmg * (this.cfg.dmgMul || 1), this.x, knock)) this.hitDone = true;
  }

  // --- phase 2 projectiles
  spawnWave(dir) {
    const s = this.scene;
    const w = s.add.sprite(this.x + dir * 30, this.y, 'wave').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setFlipX(dir < 0);
    w.play('wave');
    w.vx = dir * 175;
    w.hit = false;
    w.glowImg = s.fx.glow(w.x, w.y - 10, this.frost ? 0x9fd8ff : 0xff6a20, 0.5, 0.5, 20);
    if (this.frost) w.setTint(0xbfe8ff);
    this.waves.push(w);
  }

  updateWaves(dt) {
    const a = this.arena;
    this.waves = this.waves.filter((w) => {
      w.x += w.vx * dt;
      w.glowImg.setPosition(w.x, w.y - 10);
      if (Math.random() < 0.3) this.scene.fx.fire.explode(1, w.x, w.y - 4);
      if (!w.hit && this.scene.hitPlayer(new Phaser.Geom.Rectangle(w.x - 6, w.y - 22, 12, 22), 22 * this.scene.ngMul.dmg, w.x, 1)) w.hit = true;
      if (w.x < a.x0 + 8 || w.x > a.x1 - 8) { w.glowImg.destroy(); w.destroy(); return false; }
      return true;
    });
  }

  spawnPillars() {
    const s = this.scene;
    const px = s.player.x;
    const xs = [px, px - 70, px + 70].map((x) => Phaser.Math.Clamp(x, this.arena.x0 + 20, this.arena.x1 - 20));
    xs.forEach((x, i) => {
      s.time.delayedCall(i * 140, () => {
        if (this.dead) return;
        const mark = s.add.image(x, this.arena.floor, 'mark').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD');
        s.tweens.add({ targets: mark, alpha: { from: 0.3, to: 1 }, yoyo: true, repeat: 3, duration: 90 });
        s.time.delayedCall(720, () => {
          mark.destroy();
          if (this.dead) return;
          audio.play('fire');
          const p = s.add.sprite(x, this.arena.floor, 'pillar').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD');
          p.play('pillar');
          const g = s.fx.glow(x, this.arena.floor - 40, 0xff6a20, 1.1, 0.7, 20);
          s.fx.burst('fire', x, this.arena.floor - 10, 20);
          s.fx.shake(0.004, 100);
          let hit = false;
          const ev = s.time.addEvent({ delay: 30, repeat: 12, callback: () => {
            if (!hit && s.hitPlayer(new Phaser.Geom.Rectangle(x - 10, this.arena.floor - 90, 20, 90), 26 * s.ngMul.dmg, x, 1.2)) hit = true;
          } });
          s.tweens.add({ targets: [p, g], alpha: 0, delay: 380, duration: 200, onComplete: () => { p.destroy(); g.destroy(); ev.remove(); } });
        });
      });
    });
  }

  // Rimebound: a line of ice spikes bursts from the floor, racing toward the hero
  spawnFrostLine() {
    const s = this.scene, a = this.arena, dir = Math.sign(s.player.x - this.x) || this.dir;
    for (let i = 0; i < 7; i++) {
      const x = this.x + dir * (34 + i * 26);
      if (x < a.x0 + 10 || x > a.x1 - 10) break;
      s.time.delayedCall(i * 85, () => {
        if (this.dead) return;
        const mark = s.add.image(x, a.floor, 'mark').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(0x9fd8ff).setScale(0.6, 1);
        s.time.delayedCall(330, () => {
          mark.destroy();
          if (this.dead) return;
          audio.play('shield', 0.5);
          const sp = s.add.sprite(x, a.floor, 'pillar').setOrigin(0.5, 1).setDepth(21).setTint(0xbfe8ff).setScale(0.7, 0.05);
          s.tweens.add({ targets: sp, scaleY: 0.6, duration: 70, ease: 'Back.Out' });
          s.fx.burst('spirit', x, a.floor - 6, 8);
          s.hitPlayer(new Phaser.Geom.Rectangle(x - 8, a.floor - 52, 16, 52), 24 * s.ngMul.dmg * (this.cfg.dmgMul || 1), x, 1.2);
          s.tweens.add({ targets: sp, alpha: 0, scaleY: 0.2, delay: 260, duration: 200, onComplete: () => sp.destroy() });
        });
      });
    }
  }

  // Rimebound: icicles break from the vault and fall where the hero stands
  spawnIcicles() {
    const s = this.scene, a = this.arena;
    const n = this.phase === 2 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      s.time.delayedCall(i * 110, () => {
        if (this.dead) return;
        const x = Phaser.Math.Clamp(s.player.x + (i - (n - 1) / 2) * 38 + (Math.random() - 0.5) * 14, a.x0 + 12, a.x1 - 12);
        const mark = s.add.image(x, a.floor, 'mark').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setTint(0x9fd8ff);
        s.tweens.add({ targets: mark, alpha: { from: 0.3, to: 1 }, yoyo: true, repeat: 3, duration: 90 });
        const ice = s.add.image(x, a.y0 + 8, 'icicle').setOrigin(0.5, 1).setDepth(22);
        s.tweens.add({
          targets: ice, y: a.floor, delay: 520, duration: 260, ease: 'Quad.In',
          onUpdate: () => { if (!ice.hit && s.hitPlayer(new Phaser.Geom.Rectangle(x - 4, ice.y - 16, 8, 16), 22 * s.ngMul.dmg * (this.cfg.dmgMul || 1), x, 0.9)) ice.hit = true; },
          onComplete: () => {
            mark.destroy(); ice.destroy();
            audio.play('shield', 0.6);
            s.fx.burst('spirit', x, a.floor - 4, 12);
            s.fx.ring(x, a.floor - 4, 0xbfe8ff, 1.4, 180);
          },
        });
      });
    }
  }

  roar(time) {
    this.state = 'roar'; this.t = time; this.invuln = true;
    this.setA('roar', true);
    audio.play('roar');
    this.scene.fx.shake(0.01, time * 1000);
    const ring = this.scene.add.image(this.x, this.y - 50, 'glow').setTint(0xff7a2a).setBlendMode('ADD').setDepth(25).setAlpha(0.8).setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
  }

  enterPhase2() {
    this.phase = 2;
    this.roar(1.5);
    this.scene.fx.flash(0xff5a20, 200, 0.35);
    this.scene.fx.burst('fire', this.x, this.y - 40, 60);
    this.scene.tweens.add({ targets: this.aura, alpha: 0.45, duration: 800 });
    this.setTint(0xffd0b8);
    this.scene.events.emit('boss-phase2', this.cfg.phaseMsg);
    // shove the player away
    const p = this.scene.player;
    if (Math.abs(p.x - this.x) < 90) this.scene.hitPlayer(new Phaser.Geom.Rectangle(this.x - 90, this.y - 100, 180, 100), 10 * this.scene.ngMul.dmg, this.x, 1.8);
  }

  takeHit(dmg, dir, poiseDmg) {
    if (this.dead || this.state === 'dormant') return;
    const fx = this.scene.fx;
    if (this.invuln) { audio.play('clang', 0.6); fx.burst('sparks', this.x, this.y - 50, 6); return; }
    this.hp -= dmg;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.active) { this.clearTint(); if (this.phase === 2) this.setTint(0xffd0b8); } });
    this.poise += poiseDmg;
    if (this.hp <= 0) { this.die(); return; }
    if (this.phase === 1 && !this.twin && this.hp <= this.maxHp * (this.cfg.phaseAt || 0.5)) this.phasePending = true;
    const canStagger = ['walk', 'recover', 'windup', 'decide', 'slam', 'swipe'].includes(this.state);
    if (this.poise >= 150 && canStagger) {
      this.poise = 0;
      this.combo = [];
      this.state = 'stagger'; this.t = 1.1;
      this.setA('kneel', true);
      this.body.setVelocityX(dir * 60);
      audio.play('clang');
      fx.burst('sparks', this.x, this.y - 40, 20);
      fx.ring(this.x, this.y - 50, 0xffc070, 3.5, 320);
      fx.zoomPunch(0.05, 200);
      this.scene.events.emit('toast', 'Staggered!');
    }
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.hp = 0;
    this.combo = [];
    this.body.setVelocityX(0);
    this.waves.forEach((w) => { w.glowImg.destroy(); w.destroy(); });
    this.waves = [];
    const s = this.scene;
    s.fx.hitStop(450);
    s.fx.flash(0xffffff, 300, 0.8);
    s.fx.shake(0.02, 500);
    audio.play('roar', 0.7);
    this.setA('death', true);
    s.onBossDeath(this);
  }

  // Twin fights: the survivor absorbs its partner's power.
  empower() {
    if (this.dead) return;
    this.twin = false;
    this.hp = Math.max(this.hp, this.maxHp * 0.6);
    if (this.phase === 1) this.phasePending = true;
  }

  dissolve() {
    const s = this.scene;
    const ev = s.time.addEvent({ delay: 60, repeat: 30, callback: () => {
      s.fx.embers.explode(4, this.x + (Math.random() - 0.5) * 50, this.y - Math.random() * 60);
    } });
    s.tweens.add({ targets: [this, this.aura], alpha: 0, duration: 2000, delay: 300, onComplete: () => { this.setVisible(false); ev.remove(); } });
  }
}
