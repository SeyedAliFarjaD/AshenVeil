import { audio } from '../audio.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

function flashWhite(sprite) {
  sprite.setTintFill(0xffffff);
  sprite.scene.time.delayedCall(70, () => { if (sprite.active) sprite.clearTint(); });
}

// ------------------------------------------------------------------ Hollow soldier
// Fights in a group: only a couple of them press the attack at once, the rest circle and
// wait their turn. Each attacker throws a 1-3 swing combo that ends in a heavier finisher,
// backsteps out of reach afterward, and will sometimes dodge your swing and counter.
export class Hollow extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'hollow_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 60 / 64);
    this.body.setSize(10, 24).setOffset(27, 36);
    this.setDepth(18);
    this.spawn = { x, y };
    this.embers = 60;
    this.reset();
    this.on('animationupdate', this.onFrame, this);
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this); // stop a death fade still in progress
    this.setPosition(this.spawn.x, this.spawn.y);
    if (this.body) { this.body.reset(this.spawn.x, this.spawn.y); this.body.enable = true; }
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(70 * m.hp); this.embers = Math.round(60 * m.embers);
    this.poise = 0; this.dead = false; this.parried = false;
    this.state = 'patrol'; this.t = 0; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.engaged = false; this.comboLeft = 0; this.finisher = false; this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.dodgeCd = 1 + Math.random() * 2; this.seenAtk = false; this.backstep = false; this.crossCd = 0;
    this.setVisible(true).setAlpha(1).clearTint();
    this.anim = '';
    this.setA('walk');
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play('hollow_' + k); }

  face(d) { this.dir = d; this.setFlipX(d < 0); }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    // louder fights are noticed from further away
    const sees = (adx < 150 || (adx < 230 && player.state === 'attack')) && Math.abs(dy) < 44 && !player.dead;
    const ground = s.isSolidAt(this.x + this.dir * 9, this.y + 6);
    this.t -= dt; this.dodgeCd -= dt; this.crossCd -= dt;
    if (player.state !== 'attack') this.seenAtk = false;
    // Slipping behind it (a roll through, a jump over) no longer leaves it helpless: it hops
    // away from you, spinning round in the air, so it lands at sword's length and swings.
    if (this.crossCd <= 0 && ['chase', 'circle', 'recover'].includes(this.state) && !player.dead
      && Math.sign(dx) === -this.dir && adx < 50 && Math.abs(dy) < 30) {
      const away = this.dir;
      this.face(Math.sign(dx) || this.dir);
      if ([16, 32, 48].every((d) => this.safeAt(this.x + away * d))) b.setVelocity(away * 90, -140);
      else b.setVelocityY(-170);
      this.state = 'backhop'; this.t = 0.3; this.crossCd = 1.4 + Math.random() * 0.6;
      this.setA('idle', true);
      s.fx.afterImage(this, 0xbfe8ff);
      s.fx.dustPuff(this.x, this.y, 4);
      audio.play('roll', 0.5);
    }
    switch (this.state) {
      case 'backhop':
        if (Math.random() < 0.5) s.fx.afterImage(this, 0xbfe8ff);
        if (this.t < 0.15 && b.blocked.down) b.setVelocityX(0); // plant the feet on landing
        if (this.t <= 0 && b.blocked.down) {
          this.face(Math.sign(dx) || this.dir);
          this.engaged = true; this.comboLeft = Math.random() < 0.5 ? 1 : 0; this.finisher = false;
          this.state = 'windup'; this.t = 0.16; this.setA('windup', true); this.glint();
        }
        break;
      case 'patrol': {
        if (!ground || (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right) || Math.abs(this.x - this.spawn.x) > 70 && Math.sign(this.x - this.spawn.x) === this.dir) this.face(-this.dir);
        b.setVelocityX(this.dir * 28);
        this.setA('walk');
        if (sees) { this.face(Math.sign(dx) || this.dir); this.state = 'chase'; this.t = 0.25; }
        break;
      }
      case 'chase': {
        this.face(Math.sign(dx) || this.dir);
        if (this.maybeDodge(player, adx)) break;
        const g2 = s.isSolidAt(this.x + this.dir * 9, this.y + 6);
        // a hero drinking a flask, or out of stamina, is an opening: rush in
        const opening = player.state === 'heal' || player.st <= 0;
        if (adx > 30 && g2) { b.setVelocityX(this.dir * (opening ? 120 : 58)); this.setA('walk'); }
        if (opening && adx < 120) this.t = Math.min(this.t, 0);
        else { b.setVelocityX(0); this.setA('idle'); }
        if (adx <= 34 && Math.abs(dy) < 30 && this.t <= 0) {
          if (s.canEngage(this)) this.beginCombo(player);
          else { this.state = 'circle'; this.t = 0.8 + Math.random() * 0.8; this.strafe = Math.random() < 0.5 ? -1 : 1; }
        }
        if (adx > 240 || player.dead) this.state = 'patrol';
        break;
      }
      case 'circle': {
        // waiting for a turn: hover just outside reach, shuffling side to side
        this.face(Math.sign(dx) || this.dir);
        const back = -this.dir;
        const floorBack = s.isSolidAt(this.x + back * 10, this.y + 6), floorFwd = s.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (adx < 62 && floorBack) b.setVelocityX(back * 48);
        else if (adx > 100 && floorFwd) b.setVelocityX(this.dir * 40);
        else {
          const sx = this.x + this.strafe * 10;
          if (!s.isSolidAt(sx, this.y + 6)) this.strafe = -this.strafe;
          b.setVelocityX(this.strafe * 20);
        }
        this.setA('walk');
        this.maybeDodge(player, adx);
        if (this.t <= 0 || player.dead) { this.state = 'chase'; this.t = 0; }
        if (adx > 260) this.state = 'patrol';
        break;
      }
      case 'dodge':
        b.setVelocityX(approach(b.velocity.x, 0, 700 * dt));
        if (Math.random() < 0.6) s.fx.afterImage(this, 0xbfe8ff);
        if (this.t <= 0) {
          // answer the miss with a quick strike
          this.face(Math.sign(dx) || this.dir);
          if (adx < 90 && s.canEngage(this)) { this.beginCombo(player, 1); this.t = 0.24; }
          else { this.state = 'chase'; this.t = 0.2; }
        }
        break;
      case 'windup':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          this.state = 'attack'; this.t = this.finisher ? 0.5 : 0.42; this.hitDone = false;
          this.setA('attack', true); audio.play(this.finisher ? 'swingHeavy' : 'swing', 0.7);
          // step into the swing (closes the gap if the hero backed off during the wind-up)
          this.face(Math.sign(dx) || this.dir);
          if (adx > 14 && this.safeAt(this.x + this.dir * 34)) b.setVelocityX(this.dir * Phaser.Math.Clamp(adx * 3.2, 90, this.finisher ? 230 : 170));
        }
        break;
      case 'attack':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) {
          if (this.comboLeft > 0 && !player.dead) {
            this.comboLeft--;
            this.face(Math.sign(player.x - this.x) || this.dir);
            this.finisher = this.comboLeft === 0;
            this.state = 'windup'; this.t = this.finisher ? 0.34 : 0.2;
            this.setA('windup', true);
            if (this.finisher) this.glint();
          } else {
            this.state = 'recover'; this.t = 0.55; this.setA('idle');
            this.backstep = adx < 60 && Math.random() < 0.55;
            if (this.backstep && s.isSolidAt(this.x - this.dir * 12, this.y + 6)) b.setVelocityX(-this.dir * 150);
            this.engaged = false; this.finisher = false;
          }
        }
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 420 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.5; }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.35; }
        break;
      default: break;
    }
  }

  // solid floor under x with no spikes or lava on it: somewhere it is willing to step
  safeAt(x) {
    const s = this.scene;
    if (!s.isSolidAt(x, this.y + 6)) return false;
    const t = s.ground.getTileAtWorldXY(x, this.y - 3);
    return !(t && (t.index === 18 || t.index === 21));
  }

  // Swing at the hero: a 1-3 hit string; the last swing is the slower, harder finisher.
  beginCombo(player, hits) {
    this.engaged = true;
    const roll = Math.random();
    const total = hits || (roll < 0.4 ? 1 : roll < 0.82 ? 2 : 3);
    this.comboLeft = total - 1;
    this.finisher = total > 1 && this.comboLeft === 0;
    this.state = 'windup'; this.t = 0.38; this.setA('windup', true); this.glint();
  }

  // Sometimes sidesteps a swing it saw coming, rather than standing there to be hit.
  maybeDodge(player, adx) {
    if (player.state === 'attack' && !this.seenAtk) {
      this.seenAtk = true;
      if (this.dodgeCd <= 0 && adx < 58 && Math.random() < 0.5 && this.scene.isSolidAt(this.x - this.dir * 14, this.y + 6)) {
        this.dodgeCd = 3 + Math.random() * 2;
        this.state = 'dodge'; this.t = 0.24;
        this.body.setVelocityX(-this.dir * 230);
        this.setA('idle');
        return true;
      }
    }
    return false;
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x - this.dir * 6, this.y - 40, 'spark').setTint(this.finisher ? 0xff7a5a : 0xffd27a).setBlendMode('ADD').setDepth(30).setScale(0.4);
    s.tweens.add({ targets: g, scale: 1.6, angle: 90, alpha: 0, duration: 380, onComplete: () => g.destroy() });
  }

  onFrame(anim, frame) {
    if (this.state !== 'attack' || anim.key !== 'hollow_attack') return;
    const f = frame.index - 1;
    if ((f === 1 || f === 2) && !this.hitDone) {
      const r = new Phaser.Geom.Rectangle(this.dir > 0 ? this.x - 4 : this.x - 36, this.y - 34, 40, 34);
      if (this.scene.hitPlayer(r, (this.finisher ? 27 : 18) * this.scene.ngMul.dmg, this.x, this.finisher ? 1.5 : 1)) this.hitDone = true;
    }
  }

  takeHit(dmg, dir, poiseDmg) {
    if (this.dead) return;
    this.hp -= dmg;
    flashWhite(this);
    this.poise += poiseDmg;
    const armored = this.state === 'attack' || (this.state === 'windup' && this.finisher);
    if (!armored || this.poise >= 40) {
      this.poise = 0;
      this.state = 'stagger'; this.t = 0.4;
      this.comboLeft = 0; this.finisher = false; this.engaged = false;
      this.setA('hurt', true);
      this.body.setVelocityX(dir * 110);
    }
    if (this.state === 'patrol') this.state = 'chase';
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.engaged = false;
    this.state = 'dead';
    this.body.setVelocityX(0);
    this.setA('death', true);
    audio.play('enemyDie');
    this.scene.grantEmbers(this.embers, this.x, this.y - 16);
    this.scene.time.delayedCall(700, () => {
      if (!this.dead || !this.scene) return; // destroyed (swarm cleared) or revived by a bonfire rest before the fade began
      this.scene.fx.burst('embers', this.x, this.y - 8, 24);
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
    });
  }
}

// ------------------------------------------------------------------ Wisp (flying skull)
export class Wisp extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'wisp', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.body.setSize(14, 14).setOffset(9, 7);
    this.setDepth(19);
    this.spawn = { x, y };
    this.embers = 40;
    this.glowImg = scene.fx.glow(x, y, 0x8a7dff, 0.5, 0.35, 18);
    this.play('wisp_fly');
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this); // stop a death fade still in progress
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(35 * m.hp); this.embers = Math.round(40 * m.embers);
    this.dead = false; this.parried = false; this.state = 'hover'; this.t = Math.random() * 3; this.cd = 0; this.engaged = false; this.chain = false;
    this.setVisible(true).setAlpha(1).clearTint();
    this.glowImg.setVisible(true);
  }

  update(dt, player) {
    if (this.dead) return;
    this.t += dt;
    this.cd -= dt;
    this.glowImg.setPosition(this.x, this.y);
    const px = player.x, py = player.y - 16;
    const dx = px - this.x, dy = py - this.y, dist = Math.hypot(dx, dy);
    this.setFlipX(dx < 0);
    const b = this.body;
    switch (this.state) {
      case 'hover': {
        const tx = this.spawn.x + Math.sin(this.t * 0.9) * 24, ty = this.spawn.y + Math.sin(this.t * 1.7) * 8;
        b.setVelocity((tx - this.x) * 3, (ty - this.y) * 3);
        if (dist < 130 && this.cd <= 0 && !player.dead && this.scene.canEngage(this)) {
          this.state = 'charge'; this.st = 0.6; audio.play('wisp');
          this.engaged = true; this.chain = dist < 100 && Math.random() < 0.5;
        }
        break;
      }
      case 'charge':
        this.st -= dt;
        b.setVelocity(-Math.sign(dx) * 20, -10);
        this.x += (Math.random() - 0.5) * 1.5;
        if (Math.random() < 0.4) this.scene.fx.burst('spirit', this.x, this.y, 1);
        if (this.st <= 0) {
          const n = Math.max(1, dist);
          this.vx = dx / n * 200; this.vy = dy / n * 200;
          this.state = 'swoop'; this.st = 0.7;
        }
        break;
      case 'swoop':
        this.st -= dt;
        b.setVelocity(this.vx, this.vy);
        if (Math.random() < 0.6) this.scene.fx.afterImage(this, 0x8a7dff);
        if (this.st <= 0 || b.blocked.down || b.blocked.up || b.blocked.left || b.blocked.right) {
          if (this.chain && !player.dead) { this.chain = false; this.state = 'charge'; this.st = 0.3; audio.play('wisp', 0.6); }
          else this.state = 'return';
        }
        break;
      case 'return': {
        const rx = this.spawn.x - this.x, ry = this.spawn.y - this.y, rd = Math.hypot(rx, ry);
        b.setVelocity(rx / Math.max(1, rd) * 80, ry / Math.max(1, rd) * 80);
        if (rd < 10) { this.state = 'hover'; this.cd = 1.2; this.engaged = false; }
        break;
      }
      case 'stagger':
        this.st -= dt;
        { const k = Math.pow(0.92, dt * 60); b.setVelocity(b.velocity.x * k, b.velocity.y * k); }
        if (this.st <= 0) this.state = 'return';
        break;
      default: break;
    }
    if (this.state === 'swoop' || this.state === 'hover' || this.state === 'charge') {
      const r = new Phaser.Geom.Rectangle(this.x - 7, this.y - 7, 14, 14);
      this.scene.hitPlayer(r, 15 * this.scene.ngMul.dmg, this.x);
    }
  }

  takeHit(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    flashWhite(this);
    this.state = 'stagger'; this.st = 0.35; this.engaged = false; this.chain = false;
    this.body.setVelocity(dir * 160, -40);
    this.scene.fx.burst('spirit', this.x, this.y, 8);
    if (this.hp <= 0) {
      this.dead = true;
      audio.play('enemyDie');
      this.scene.fx.burst('spirit', this.x, this.y, 30);
      this.scene.grantEmbers(this.embers, this.x, this.y);
      this.body.enable = false;
      this.setVisible(false);
      this.glowImg.setVisible(false);
    }
  }
}

// ------------------------------------------------------------------ Crypt Sentinel (shield + spear)
// Blocks frontal hits. Break its guard with a heavy blow, or roll behind it:
// it turns slowly, which leaves a window to strike its back.
export class Sentinel extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, prefix = 'sentinel') {
    super(scene, x, y, `${prefix}_idle`, 0);
    this.prefix = prefix;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 60 / 64);
    this.body.setSize(12, 26).setOffset(26, 34);
    this.setDepth(18);
    this.spawn = { x, y };
    this.embers = 120;
    this.on('animationupdate', this.onFrame, this);
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this); // stop a death fade still in progress
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(110 * m.hp); this.embers = Math.round(120 * m.embers);
    this.guard = 0; this.dead = false; this.parried = false; this.engaged = false;
    this.state = 'patrol'; this.t = 0; this.turnT = 0;
    this.face(Math.random() < 0.5 ? -1 : 1);
    this.setVisible(true).setAlpha(1).clearTint();
    this.anim = '';
    this.setA('walk');
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play(`${this.prefix}_${k}`); }
  face(d) { this.dir = d; this.setFlipX(d < 0); }
  get guarding() { return ['patrol', 'chase', 'block', 'recover', 'windup', 'bashwind'].includes(this.state); }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const sees = adx < 160 && Math.abs(dy) < 44 && !player.dead;
    this.t -= dt;
    this.guard = Math.max(0, this.guard - 10 * dt);
    switch (this.state) {
      case 'patrol': {
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (!ground || (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right) || (Math.abs(this.x - this.spawn.x) > 60 && Math.sign(this.x - this.spawn.x) === this.dir)) this.face(-this.dir);
        b.setVelocityX(this.dir * 22);
        this.setA('walk');
        if (sees) this.state = 'chase';
        break;
      }
      case 'chase': {
        // slow to turn around: the opening for getting behind it
        const want = Math.sign(dx) || this.dir;
        if (want !== this.dir) { this.turnT += dt; if (this.turnT > 0.3) { this.face(want); this.turnT = 0; } }
        else this.turnT = 0;
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (adx > 40 && ground && want === this.dir) { b.setVelocityX(this.dir * 40); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (adx <= 48 && want === this.dir && Math.abs(dy) < 30 && this.t <= 0 && this.scene.canEngage(this)) {
          this.engaged = true;
          this.state = 'windup'; this.t = 0.6; this.setA('windup', true); this.glint();
        }
        if (adx > 260 || player.dead) this.state = 'patrol';
        break;
      }
      case 'block':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.setA('idle'); }
        break;
      case 'windup':
        b.setVelocityX(0);
        if (this.t <= 0) { this.state = 'thrust'; this.t = 0.5; this.hitDone = false; this.setA('thrust', true); audio.play('swing', 0.8); }
        break;
      case 'thrust':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          if (adx < 44 && Math.abs(dy) < 30 && Math.random() < 0.5) this.beginBash();
          else { this.state = 'recover'; this.t = 0.7; this.setA('idle'); }
        }
        break;
      case 'bashwind': case 'bash':
        this.bashStep(dt);
        break;
      case 'recover':
        b.setVelocityX(0);
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.6; this.engaged = false; }
        break;
      case 'stagger': case 'broken':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.3; this.setA('idle'); this.engaged = false; }
        break;
      default: break;
    }
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x + this.dir * 24, this.y - 22, 'spark').setTint(0x7affd8).setBlendMode('ADD').setDepth(30).setScale(0.4);
    s.tweens.add({ targets: g, scale: 1.8, angle: 90, alpha: 0, duration: 420, onComplete: () => g.destroy() });
  }

  onFrame(anim, frame) {
    if (this.state !== 'thrust' || anim.key !== `${this.prefix}_thrust`) return;
    const f = frame.index - 1;
    if (f === 0) this.body.setVelocityX(this.dir * 190);
    if (f >= 0 && f <= 2 && !this.hitDone) {
      const r = new Phaser.Geom.Rectangle(this.dir > 0 ? this.x : this.x - 52, this.y - 30, 52, 14);
      if (this.scene.hitPlayer(r, 24 * this.scene.ngMul.dmg, this.x)) this.hitDone = true;
    }
  }

  // Third strike of the combo: slam the shield into the hero's face.
  beginBash() {
    this.state = 'bashwind'; this.t = 0.3;
    this.body.setVelocityX(0);
    this.setA('block', true);
    this.glint();
  }

  bashStep(dt) {
    const s = this.scene, b = this.body;
    if (this.state === 'bashwind') {
      b.setVelocityX(0);
      if (this.t <= 0) {
        this.state = 'bash'; this.t = 0.32; b.setVelocityX(this.dir * 140);
        audio.play('shield', 0.9);
        const hit = s.hitPlayer(new Phaser.Geom.Rectangle(this.dir > 0 ? this.x : this.x - 34, this.y - 34, 34, 34), 12 * s.ngMul.dmg, this.x, 2.2);
        if (hit) s.player.spendStamina(25);
        s.fx.burst('sparks', this.x + this.dir * 16, this.y - 18, 8);
      }
    } else {
      b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
      if (this.t <= 0) { this.state = 'recover'; this.t = 0.7; this.setA('idle'); }
    }
  }

  // Returns 'blocked' when the shield takes the hit.
  takeHit(dmg, dir, poiseDmg) {
    if (this.dead) return null;
    const s = this.scene;
    const fromFront = this.dir === -dir;
    if (this.guarding && fromFront) {
      this.guard += poiseDmg;
      // the shield holds far longer now: a lone heavy blow no longer breaks it outright
      if (poiseDmg >= 100 || this.guard >= 115) {
        this.guard = 0;
        this.state = 'broken'; this.t = 1.4;
        this.setA('hurt', true);
        this.body.setVelocityX(dir * 120);
        audio.play('guardBreak');
        s.fx.guardBreak(this.x + this.dir * 8, this.y - 18, dir);
        s.events.emit('toast', 'Guard broken!');
        return this.damage(dmg * 0.5, dir);
      }
      this.state = 'block'; this.t = 0.3;
      this.setA('block', true);
      audio.play('shield');
      s.fx.burst('sparks', this.x + this.dir * 8, this.y - 18, 10);
      const p = s.player;
      p.body.setVelocityX(dir * -150);
      p.spendStamina(10);
      s.fx.hitStop(50);
      return 'blocked';
    }
    if (this.state === 'patrol') this.state = 'chase';
    const mult = this.state === 'broken' ? 1.5 : fromFront ? 1 : 1.25;
    if (!['thrust', 'broken'].includes(this.state)) {
      this.state = 'stagger'; this.t = 0.45;
      this.setA('hurt', true);
      this.body.setVelocityX(dir * 90);
    }
    return this.damage(dmg * mult, dir);
  }

  damage(n, dir) {
    this.hp -= n;
    flashWhite(this);
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.body.setVelocityX(0);
      this.setA('death', true);
      audio.play('enemyDie');
      this.scene.grantEmbers(this.embers, this.x, this.y - 16);
      this.scene.time.delayedCall(700, () => {
        if (!this.dead || !this.scene) return; // destroyed (swarm cleared) or revived by a bonfire rest before the fade began
        this.scene.fx.burst('embers', this.x, this.y - 8, 24);
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
      });
    }
    return 'hit';
  }
}

// ------------------------------------------------------------------ Pyre Acolyte (ranged caster)
// Keeps its distance and lobs arcing fireballs. Fragile up close.
const LOB_G = 520;
export class Acolyte extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'acolyte_float', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 76 / 80);
    this.body.setSize(10, 24).setOffset(35, 52);
    this.setDepth(18);
    this.spawn = { x, y };
    this.embers = 90;
    this.shots = [];
    this.glowImg = scene.fx.glow(x, y - 30, 0xff8a3a, 0.35, 0.3, 17);
    this.on('animationcomplete', (a) => { if (a.key === 'acolyte_cast' && !this.dead) this.play('acolyte_float'); });
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this); // stop a death fade still in progress
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(50 * m.hp); this.embers = Math.round(90 * m.embers);
    this.dead = false; this.parried = false; this.state = 'idle'; this.t = 1 + Math.random(); this.dir = -1; this.hopT = 0; this.hopCd = 0;
    this.setVisible(true).setAlpha(1).clearTint();
    this.glowImg.setVisible(true);
    this.shots.forEach((s) => { s.sp.destroy(); s.glow.destroy(); });
    this.shots = [];
    this.play('acolyte_float');
  }

  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }

  update(dt, player) {
    this.updateShots(dt);
    if (this.dead) return;
    const b = this.body;
    this.glowImg.setPosition(this.x + this.dir * 10, this.y - 32);
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const aware = adx < 220 && Math.abs(dy) < 120 && !player.dead;
    this.t -= dt;
    switch (this.state) {
      case 'idle':
        b.setVelocityX(0);
        if (aware) { this.face(Math.sign(dx)); this.state = 'watch'; this.t = 0.6; }
        break;
      case 'watch': {
        this.face(Math.sign(dx));
        // back away when crowded, if there is floor behind
        const back = -this.dir;
        const floorBack = this.scene.isSolidAt(this.x + back * 14, this.y + 6);
        this.hopCd -= dt;
        if (this.hopT > 0) { this.hopT -= dt; b.setVelocityX(back * 190 * Math.max(0.2, this.hopT / 0.22)); }
        else if (adx < 46 && floorBack && this.hopCd <= 0) { this.hopT = 0.22; this.hopCd = 2.4; this.scene.fx.burst('embers', this.x, this.y - 10, 6); }
        else if (adx < 64 && floorBack) b.setVelocityX(back * 45);
        else b.setVelocityX(0);
        if (this.t <= 0 && aware) { this.state = 'windup'; this.t = 0.55; this.play('acolyte_cast'); this.anims.pause(); this.glint(); }
        if (!aware) this.state = 'idle';
        break;
      }
      case 'windup':
        b.setVelocityX(0);
        if (this.t <= 0) {
          this.anims.resume(); this.throwAt(player); this.state = 'watch'; this.t = 2.2 + Math.random() * 0.6;
          // a volley: the second (and sometimes third) fireball follows close behind
          const n = Math.random() < 0.35 ? 2 : Math.random() < 0.6 ? 1 : 0;
          for (let i = 1; i <= n; i++) this.scene.time.delayedCall(i * 300, () => { if (!this.dead && this.state !== 'stagger') this.throwAt(this.scene.player); });
        }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'watch'; this.t = 0.8; }
        break;
      default: break;
    }
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x + this.dir * 12, this.y - 44, 'spark').setTint(0xffb347).setBlendMode('ADD').setDepth(30).setScale(0.4);
    s.tweens.add({ targets: g, scale: 1.8, angle: 90, alpha: 0, duration: 450, onComplete: () => g.destroy() });
  }

  throwAt(player) {
    const s = this.scene;
    const ox = this.x + this.dir * 10, oy = this.y - 40;
    // leads a moving target: aims where the hero will be when the fireball lands
    const T0 = Phaser.Math.Clamp(Math.abs(player.x - ox) / 170, 0.55, 1.2);
    const tx = player.x + Phaser.Math.Clamp(player.body.velocity.x, -140, 140) * T0 * 0.7, ty = player.y - 10;
    const T = Phaser.Math.Clamp(Math.abs(tx - ox) / 170, 0.55, 1.2);
    const vx = (tx - ox) / T, vy = (ty - oy - 0.5 * LOB_G * T * T) / T;
    const sp = s.add.image(ox, oy, 'fireorb').setDepth(26).setBlendMode('ADD');
    const glow = s.fx.glow(ox, oy, 0xff8a3a, 0.35, 0.6, 25);
    this.shots.push({ sp, glow, vx, vy, t: 0 });
    audio.play('fireball');
  }

  updateShots(dt) {
    const s = this.scene;
    this.shots = this.shots.filter((o) => {
      o.t += dt;
      o.vy += LOB_G * dt;
      o.sp.x += o.vx * dt; o.sp.y += o.vy * dt;
      o.glow.setPosition(o.sp.x, o.sp.y);
      if (Math.random() < 0.5) s.fx.fire.explode(1, o.sp.x, o.sp.y);
      const hit = s.hitPlayer(new Phaser.Geom.Rectangle(o.sp.x - 4, o.sp.y - 4, 8, 8), 20 * s.ngMul.dmg, o.sp.x, 0.8);
      if (hit || o.t > 3 || s.isSolidAt(o.sp.x, o.sp.y)) {
        s.fx.fire.explode(12, o.sp.x, o.sp.y - 2);
        o.sp.destroy(); o.glow.destroy();
        return false;
      }
      return true;
    });
  }

  takeHit(dmg, dir) {
    if (this.dead) return null;
    this.hp -= dmg;
    flashWhite(this);
    this.state = 'stagger'; this.t = 0.4;
    this.anims.resume();
    this.play('acolyte_hurt');
    this.body.setVelocityX(dir * 110);
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.body.setVelocityX(0);
      this.play('acolyte_death');
      audio.play('enemyDie');
      this.glowImg.setVisible(false);
      this.scene.grantEmbers(this.embers, this.x, this.y - 16);
      this.scene.time.delayedCall(900, () => {
        if (!this.dead || !this.scene) return; // destroyed (swarm cleared) or revived by a bonfire rest before the fade began
        this.scene.fx.burst('embers', this.x, this.y - 8, 24);
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
      });
    }
    return 'hit';
  }
}
