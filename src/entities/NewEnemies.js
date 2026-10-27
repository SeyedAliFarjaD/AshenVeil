// Enemies added with levels 5-8. All share the same contract as the originals:
//   update(dt, player), takeHit(dmg, dir, poise), reset(), dead, parried, state,
//   embers, and `parryStates` (states whose active frames the hero can parry).
import { audio } from '../audio.js';
import { Sentinel } from './Enemies.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const LOB_G = 520;

function flashWhite(sprite) {
  sprite.setTintFill(0xffffff);
  sprite.scene.time.delayedCall(70, () => { if (sprite.active) sprite.clearTint(); });
}

// A humanoid walker built on a character strip (idle / walk / windup / attack / hurt / death).
class Foe extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, prefix, size, body, cfg) {
    super(scene, x, y, `${prefix}_idle`, 0);
    this.prefix = prefix;
    this.cfg = cfg;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const feet = size - 4;
    this.setOrigin(0.5, feet / size);
    this.body.setSize(body.w, body.h).setOffset((size - body.w) / 2, feet - body.h);
    this.body.setMaxVelocity(body.maxVx || 420, 700);
    this.setDepth(18);
    this.spawn = { x, y };
    this.parryStates = [];
    this.on('animationupdate', this.onFrame, this);
  }

  baseReset() {
    if (this.scene) this.scene.tweens.killTweensOf(this);
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(this.cfg.hp * m.hp);
    this.embers = Math.round(this.cfg.embers * m.embers);
    this.poise = 0; this.dead = false; this.parried = false; this.engaged = false; this.hopT = 0; this.hopCd = 0;
    this.state = 'patrol'; this.t = 0; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.setVisible(true).setAlpha(1).clearTint();
    this.anim = '';
  }

  setA(k, restart = false) {
    if (this.anim === k && !restart) return;
    const key = `${this.prefix}_${k}`;
    if (!this.scene.anims.exists(key)) return;
    this.anim = k; this.play(key);
  }

  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }
  onFrame() { /* subclasses */ }

  glintAt(dx, dy, tint = 0xffd27a, scale = 1.6) {
    const s = this.scene;
    const g = s.add.image(this.x + dx * (this.dir || 1), this.y + dy, 'spark').setTint(tint).setBlendMode('ADD').setDepth(30).setScale(0.4);
    s.tweens.add({ targets: g, scale, angle: 90, alpha: 0, duration: 400, onComplete: () => g.destroy() });
    audio.play('glint', 0.5);
  }

  patrolStep(speed, range = 70) {
    const b = this.body;
    const ground = this.scene.isSolidAt(this.x + this.dir * 9, this.y + 6);
    if (!ground || (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right)
      || (Math.abs(this.x - this.spawn.x) > range && Math.sign(this.x - this.spawn.x) === this.dir)) this.face(-this.dir);
    b.setVelocityX(this.dir * speed);
    this.setA('walk');
  }

  hurtReact(dir, poiseDmg, threshold, kb = 110, t = 0.4) {
    this.poise += poiseDmg;
    if (this.poise >= threshold) {
      this.poise = 0;
      this.state = 'stagger'; this.t = t;
      this.setA('hurt', true);
      this.body.setVelocityX(dir * kb);
    }
  }

  takeHit(dmg, dir, poiseDmg) {
    if (this.dead) return null;
    this.hp -= dmg;
    flashWhite(this);
    this.onHurt(dir, poiseDmg);
    if (this.hp <= 0) this.kill();
    return 'hit';
  }

  onHurt(dir, poiseDmg) { this.hurtReact(dir, poiseDmg, 0, 110, 0.4); }

  kill() {
    this.dead = true;
    this.engaged = false;
    this.state = 'dead';
    this.body.setVelocityX(0);
    this.setA('death', true);
    audio.play('enemyDie');
    this.scene.grantEmbers(this.embers, this.x, this.y - 16);
    this.onKilled();
    this.scene.time.delayedCall(800, () => {
      if (!this.dead || !this.scene) return;
      this.scene.fx.burst('embers', this.x, this.y - 8, 24);
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
    });
  }

  onKilled() { /* subclasses */ }
}

// ------------------------------------------------------------------ Marksman (ranged)
// Keeps its distance and looses a fast arrow after a glint. Arrows fly straight:
// roll through them or jump them; close the gap and it scrambles back.
export class Archer extends Foe {
  constructor(scene, x, y) {
    super(scene, x, y, 'archer', 64, { w: 10, h: 24 }, { hp: 55, embers: 85 });
    this.arrows = [];
    this.reset();
  }

  reset() {
    this.baseReset();
    this.cd = 1 + Math.random();
    this.arrows.forEach((a) => a.sp.destroy());
    this.arrows = [];
    this.setA('walk');
  }

  update(dt, player) {
    this.updateArrows(dt);
    if (this.dead) return;
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const aware = adx < 280 && Math.abs(dy) < 80 && !player.dead;
    this.t -= dt; this.cd -= dt;
    switch (this.state) {
      case 'patrol':
        this.patrolStep(24);
        if (aware) { this.state = 'kite'; this.t = 0; }
        break;
      case 'kite': {
        this.face(Math.sign(dx));
        const back = -this.dir;
        const floorBack = s.isSolidAt(this.x + back * 10, this.y + 6);
        const floorFwd = s.isSolidAt(this.x + this.dir * 10, this.y + 6);
        this.hopCd -= dt;
        if (this.hopT > 0) { this.hopT -= dt; b.setVelocityX(back * 200 * Math.max(0.2, this.hopT / 0.22)); }
        else if (adx < 56 && floorBack && this.hopCd <= 0) { this.hopT = 0.22; this.hopCd = 2.2; s.fx.dustPuff(this.x, this.y, 4); }
        else if (adx < 85 && floorBack) { b.setVelocityX(back * 70); this.setA('walk'); }
        else if (adx > 220 && floorFwd) { b.setVelocityX(this.dir * 36); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (this.cd <= 0 && adx > 40) { this.state = 'draw'; this.t = 0.65; this.setA('windup', true); this.glintAt(8, -34, 0xe8d84a); }
        if (!aware) this.state = 'patrol';
        break;
      }
      case 'draw':
        b.setVelocityX(0);
        this.face(Math.sign(dx) || this.dir);
        if (this.t <= 0) {
          this.shoot(player); this.state = 'kite'; this.cd = 1.8 + Math.random() * 0.7; this.setA('attack', true);
          // from range it looses a second arrow right behind the first
          if (adx > 110 && Math.random() < 0.55) this.scene.time.delayedCall(260, () => { if (!this.dead && this.state !== 'stagger') this.shoot(this.scene.player); });
        }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'kite'; this.cd = Math.max(this.cd, 0.6); }
        break;
      default: break;
    }
  }

  shoot(player) {
    const s = this.scene;
    const ox = this.x + this.dir * 12, oy = this.y - 30;
    // leads a running target a little
    const lead = Math.abs(player.x - ox) / 320 * 0.6;
    const tx = player.x + Phaser.Math.Clamp(player.body.velocity.x, -140, 140) * lead, ty = player.y - 18;
    const ang = Math.atan2(ty - oy, tx - ox);
    const sp = s.add.image(ox, oy, 'arrow').setDepth(26).setRotation(ang).setFlipY(false);
    this.arrows.push({ sp, vx: Math.cos(ang) * 320, vy: Math.sin(ang) * 320, t: 0 });
    audio.play('swing', 0.45);
  }

  updateArrows(dt) {
    const s = this.scene;
    this.arrows = this.arrows.filter((a) => {
      a.t += dt;
      a.sp.x += a.vx * dt; a.sp.y += a.vy * dt;
      const hit = s.hitPlayer(new Phaser.Geom.Rectangle(a.sp.x - 6, a.sp.y - 2, 12, 4), 18 * s.ngMul.dmg, a.sp.x - Math.sign(a.vx) * 8, 0.7);
      if (hit || a.t > 2 || s.isWallAt(a.sp.x, a.sp.y)) {
        if (!hit) s.fx.burst('sparks', a.sp.x, a.sp.y, 4);
        a.sp.destroy();
        return false;
      }
      return true;
    });
  }

  onHurt(dir, poise) { this.hurtReact(dir, poise, 0, 130, 0.45); }
  onKilled() { this.arrows.forEach((a) => a.sp.destroy()); this.arrows = []; }
}

// ------------------------------------------------------------------ Gorehound Brute (charger)
// Sees you from afar, paws the ground, then charges in a straight line. Roll through it,
// parry it, or step aside: if it hits a wall it is stunned and takes extra damage.
export class Brute extends Foe {
  constructor(scene, x, y) {
    super(scene, x, y, 'brute', 80, { w: 16, h: 32 }, { hp: 125, embers: 150 });
    this.parryStates = ['charge', 'smash'];
    this.reset();
  }

  reset() {
    this.baseReset();
    this.cd = 0.5;
    this.setA('walk');
  }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const sees = adx < 280 && adx > 50 && Math.abs(dy) < 40 && !player.dead;
    this.t -= dt; this.cd -= dt;
    switch (this.state) {
      case 'patrol':
        this.patrolStep(22, 60);
        if (sees && this.cd <= 0) { this.face(Math.sign(dx)); this.state = 'paw'; this.t = 0.8; this.setA('windup', true); this.glintAt(14, -44, 0xff5a2a, 2); }
        else if (adx <= 62 && Math.abs(dy) < 40 && this.cd <= 0 && !player.dead) {
          this.face(Math.sign(dx)); this.hits = 2; this.state = 'smashwind'; this.t = 0.5; this.setA('windup', true); this.glintAt(12, -48, 0xffd25a, 2);
        } else if (adx <= 140 && adx > 62 && Math.abs(dy) < 40 && !player.dead) {
          this.face(Math.sign(dx)); b.setVelocityX(this.dir * 40);
        }
        break;
      case 'smashwind':
        b.setVelocityX(0);
        if (this.t <= 0) {
          this.state = 'smash'; this.t = 0.4; this.setA('slam', true); audio.play('swingHeavy', 0.8);
          s.time.delayedCall(120, () => {
            if (this.dead || this.state !== 'smash') return;
            s.fx.shake(0.008, 160); s.fx.burst('rocks', this.x + this.dir * 24, this.y - 4, 8);
            s.hitPlayer(new Phaser.Geom.Rectangle(this.dir > 0 ? this.x - 6 : this.x - 56, this.y - 40, 62, 40), (this.hits === 2 ? 24 : 30) * s.ngMul.dmg, this.x, this.hits === 2 ? 1.2 : 1.8);
          });
        }
        break;
      case 'smash':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          if (--this.hits > 0) { this.face(Math.sign(dx) || this.dir); this.state = 'smashwind'; this.t = 0.34; this.setA('windup', true); }
          else { this.state = 'recover'; this.t = 1.0; this.cd = 1.4; this.setA('idle'); }
        }
        break;
      case 'paw':
        b.setVelocityX(0);
        this.face(Math.sign(dx) || this.dir);
        if (Math.random() < 0.3) s.fx.dustPuff(this.x + this.dir * 12, this.y, 1);
        if (this.t <= 0) { this.state = 'charge'; this.t = 1.1; this.from = this.x; this.hitDone = false; this.setA('walk', true); audio.play('whoosh', 0.6); }
        break;
      case 'charge': {
        b.setVelocityX(this.dir * 285);
        this.anims.timeScale = 2.2;
        if (Math.random() < 0.6) s.fx.afterImage(this, 0xff7a4a);
        if (Math.random() < 0.5) s.fx.dustPuff(this.x - this.dir * 10, this.y, 1);
        if (!this.hitDone && s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 14, this.y - 36, 28, 36), 32 * s.ngMul.dmg, this.x - this.dir * 20, 1.5)) this.hitDone = true;
        const wall = (this.dir > 0 && b.blocked.right) || (this.dir < 0 && b.blocked.left);
        const edge = !s.isSolidAt(this.x + this.dir * 14, this.y + 6);
        if (wall) { this.stun(); }
        else if (edge || this.t <= 0 || Math.abs(this.x - this.from) > 360) { this.anims.timeScale = 1; this.state = 'recover'; this.t = 0.9; this.setA('idle'); }
        break;
      }
      case 'stunned':
        b.setVelocityX(0);
        if (this.t <= 0) { this.state = 'patrol'; this.cd = 1.2; this.setA('walk'); }
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 700 * dt));
        if (this.t <= 0) { this.state = 'patrol'; this.cd = 1.0; this.setA('walk'); }
        break;
      case 'stagger':
        this.anims.timeScale = 1;
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'patrol'; this.cd = 0.8; this.setA('walk'); }
        break;
      default: break;
    }
    if (this.state !== 'charge') this.anims.timeScale = 1;
  }

  stun() {
    const s = this.scene;
    this.anims.timeScale = 1;
    this.state = 'stunned'; this.t = 2.0;
    this.body.setVelocityX(-this.dir * 60);
    this.setA('hurt', true);
    audio.play('slam', 0.7);
    s.fx.shake(0.008, 180);
    s.fx.burst('rocks', this.x + this.dir * 14, this.y - 20, 12);
    s.fx.ring(this.x + this.dir * 14, this.y - 20, 0xffc070, 2.2, 260);
    s.events.emit('toast', 'Stunned!');
  }

  takeHit(dmg, dir, poise) {
    if (this.dead) return null;
    const stunned = this.state === 'stunned';
    this.hp -= dmg * (stunned ? 1.8 : 1);
    flashWhite(this);
    if (this.state === 'patrol') { this.state = 'paw'; this.t = 0.5; this.setA('windup', true); }
    else if (!stunned && this.state !== 'charge' && (poise >= 50 || this.poise + poise >= 90)) {
      this.poise = 0; this.state = 'stagger'; this.t = 0.5; this.setA('hurt', true); this.body.setVelocityX(dir * 90);
    } else this.poise += poise;
    if (this.hp <= 0) this.kill();
    return 'hit';
  }
}

// ------------------------------------------------------------------ Cinder Sapper (bomber)
// Lobs fused powder kegs that explode on a timer, and is itself a walking keg:
// kill it up close and it blows.
export class Sapper extends Foe {
  constructor(scene, x, y) {
    super(scene, x, y, 'sapper', 64, { w: 10, h: 24 }, { hp: 45, embers: 75 });
    this.bombs = [];
    this.reset();
  }

  reset() {
    this.baseReset();
    this.cd = 1 + Math.random();
    this.bombs.forEach((b) => b.sp.destroy());
    this.bombs = [];
    this.fuse = null;
    this.setA('walk');
  }

  update(dt, player) {
    this.updateBombs(dt);
    if (this.dead) {
      if (this.fuse != null) {
        this.fuse -= dt;
        this.setTint(Math.floor(this.fuse * 14) % 2 ? 0xffb060 : 0xffffff);
        if (this.fuse <= 0) { this.fuse = null; this.clearTint(); this.explode(this.x, this.y - 12, 44, 30); }
      }
      return;
    }
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const aware = adx < 230 && Math.abs(dy) < 90 && !player.dead;
    this.t -= dt; this.cd -= dt;
    switch (this.state) {
      case 'patrol':
        this.patrolStep(26);
        if (aware) this.state = 'kite';
        break;
      case 'kite': {
        this.face(Math.sign(dx));
        const back = -this.dir;
        if (adx < 70 && s.isSolidAt(this.x + back * 10, this.y + 6)) { b.setVelocityX(back * 60); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (this.cd <= 0) { this.state = 'wind'; this.t = 0.55; this.setA('windup', true); this.glintAt(8, -38, 0xffb347); }
        if (!aware) this.state = 'patrol';
        break;
      }
      case 'wind':
        b.setVelocityX(0);
        this.face(Math.sign(dx) || this.dir);
        if (this.t <= 0) {
          this.lob(player); this.state = 'kite'; this.cd = 2.6 + Math.random() * 0.6; this.setA('attack', true);
          if (Math.random() < 0.6) this.scene.time.delayedCall(420, () => { if (!this.dead && this.state !== 'stagger') this.lob(this.scene.player, this.dir * 48); });
        }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) this.state = 'kite';
        break;
      default: break;
    }
  }

  lob(player, off = 0) {
    const s = this.scene;
    const ox = this.x + this.dir * 8, oy = this.y - 36;
    const tx = player.x + off, ty = player.y - 4;
    const T = Phaser.Math.Clamp(Math.abs(tx - ox) / 150, 0.6, 1.1);
    const vx = (tx - ox) / T, vy = (ty - oy - 0.5 * LOB_G * T * T) / T;
    const sp = s.add.image(ox, oy, 'bomb').setDepth(26);
    this.bombs.push({ sp, vx, vy, t: 0, fuse: 1.15 });
    audio.play('orb', 0.5);
  }

  updateBombs(dt) {
    const s = this.scene;
    this.bombs = this.bombs.filter((o) => {
      o.t += dt; o.fuse -= dt;
      o.vy += LOB_G * dt;
      const nx = o.sp.x + o.vx * dt, ny = o.sp.y + o.vy * dt;
      if (s.isSolidAt(nx, o.sp.y)) o.vx *= -0.3; else o.sp.x = nx;
      if (s.isSolidAt(o.sp.x, ny)) { o.vy *= -0.3; o.vx *= 0.6; if (Math.abs(o.vy) < 20) o.vy = 0; } else o.sp.y = ny;
      o.sp.rotation += dt * 6;
      o.sp.setTint(o.fuse < 0.4 && Math.floor(o.fuse * 16) % 2 ? 0xffb060 : 0xffffff);
      if (Math.random() < 0.5) s.fx.embers.explode(1, o.sp.x, o.sp.y - 6);
      if (o.fuse <= 0) {
        this.explode(o.sp.x, o.sp.y, 40, 28);
        o.sp.destroy();
        return false;
      }
      return true;
    });
  }

  explode(x, y, r, dmg) {
    const s = this.scene;
    audio.play('fire', 0.7);
    s.fx.burst('fire', x, y, 30);
    s.fx.burst('sparks', x, y, 14);
    s.fx.ring(x, y, 0xffb347, 2.6, 300);
    s.fx.shake(0.008, 160);
    s.hitPlayer(new Phaser.Geom.Rectangle(x - r, y - r, r * 2, r * 2), dmg * s.ngMul.dmg, x, 1.4);
  }

  onHurt(dir, poise) { this.hurtReact(dir, poise, 0, 120, 0.4); }
  onKilled() { this.fuse = 0.55; }
}

// ------------------------------------------------------------------ Grave Ghoul (leaper)
// Lurks low, then pounces from far away. The leap is parryable mid-air; once it lands
// it needs a moment to recover.
export class Ghoul extends Foe {
  constructor(scene, x, y) {
    super(scene, x, y, 'ghoul', 64, { w: 12, h: 22 }, { hp: 60, embers: 80 });
    this.parryStates = ['leap', 'claw'];
    this.reset();
  }

  reset() {
    this.baseReset();
    this.cd = 0.4;
    this.setA('walk');
  }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const sees = adx < 210 && dy > -120 && dy < 60 && !player.dead;
    this.t -= dt; this.cd -= dt;
    const onGround = b.blocked.down;
    switch (this.state) {
      case 'patrol':
        this.patrolStep(30, 90);
        if (sees && this.cd <= 0) {
          this.face(Math.sign(dx));
          if (s.canEngage(this)) { this.engaged = true; this.state = 'crouch'; this.t = 0.5; this.setA('windup', true); this.glintAt(6, -30, 0xc8ff7a); }
          else { this.state = 'stalk'; this.t = 0.9 + Math.random() * 0.8; this.strafe = Math.random() < 0.5 ? -1 : 1; }
        }
        break;
      case 'crouch':
        b.setVelocityX(0);
        this.face(Math.sign(dx) || this.dir);
        if (this.t <= 0) {
          const T = 0.7;
          const vx = Phaser.Math.Clamp((player.x - this.x) / T, -280, 280);
          const vy = Phaser.Math.Clamp(-300 + Math.min(0, dy) * 0.9, -420, -240);
          b.setVelocity(vx, vy);
          this.state = 'leap'; this.t = 1.6; this.hitDone = false; this.airborne = false;
          this.setA('attack', true);
          audio.play('whoosh', 0.5);
        }
        break;
      case 'leap': {
        if (!onGround) this.airborne = true;
        if (!this.hitDone && s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 12, this.y - 30, 24, 30), 22 * s.ngMul.dmg, this.x, 1.1)) this.hitDone = true;
        if (Math.random() < 0.5) s.fx.afterImage(this, 0xc8ff7a);
        if ((this.airborne && onGround) || this.t <= 0) {
          b.setVelocityX(0); s.fx.dustPuff(this.x, this.y, 5);
          // landing next to the hero: rake twice before recovering
          if (adx < 56 && Math.abs(dy) < 30) { this.face(Math.sign(dx) || this.dir); this.hits = 2; this.state = 'clawwind'; this.t = 0.2; this.setA('windup', true); }
          else { this.state = 'recover'; this.t = 0.9; this.setA('idle'); this.engaged = false; }
        }
        break;
      }
      case 'stalk': {
        // waiting its turn: shadow the hero from a few steps away
        this.face(Math.sign(dx) || this.dir);
        const back = -this.dir;
        if (adx < 80 && s.isSolidAt(this.x + back * 10, this.y + 6)) b.setVelocityX(back * 44);
        else if (adx > 130 && s.isSolidAt(this.x + this.dir * 10, this.y + 6)) b.setVelocityX(this.dir * 40);
        else { if (!s.isSolidAt(this.x + this.strafe * 10, this.y + 6)) this.strafe = -this.strafe; b.setVelocityX(this.strafe * 24); }
        this.setA('walk');
        if (this.t <= 0 || player.dead) { this.state = 'patrol'; this.cd = 0; }
        if (adx > 260) this.state = 'patrol';
        break;
      }
      case 'clawwind':
        b.setVelocityX(0);
        if (this.t <= 0) {
          this.state = 'claw'; this.t = 0.22; this.hitDone = false; this.setA('attack', true);
          b.setVelocityX(this.dir * 110); audio.play('swing', 0.5);
          if (s.hitPlayer(new Phaser.Geom.Rectangle(this.dir > 0 ? this.x - 4 : this.x - 34, this.y - 30, 38, 30), 15 * s.ngMul.dmg, this.x, 0.9)) this.hitDone = true;
        }
        break;
      case 'claw':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          if (--this.hits > 0) { this.face(Math.sign(dx) || this.dir); this.state = 'clawwind'; this.t = 0.16; this.setA('windup', true); }
          else { this.state = 'recover'; this.t = 0.8; this.setA('idle'); this.engaged = false; }
        }
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 900 * dt));
        if (this.t <= 0) { this.state = 'patrol'; this.cd = 0.9; this.engaged = false; }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'patrol'; this.cd = 0.6; this.engaged = false; }
        break;
      default: break;
    }
  }

  onHurt(dir, poise) { if (this.state !== 'leap' && this.state !== 'claw') { this.hurtReact(dir, poise, 0, 120, 0.4); this.engaged = false; } }
}

// ------------------------------------------------------------------ Hollow Champion (mini-boss)
// A heavy, armored knight guarding a bonfire: two sweeping cuts and a ground shockwave.
// Has its own health bar overhead. Parry the second cut to open it up.
export class Champion extends Foe {
  constructor(scene, x, y) {
    super(scene, x, y, 'champion', 80, { w: 14, h: 34 }, { hp: 380, embers: 520 });
    this.parryStates = ['swing1', 'swing2'];
    this.bar = scene.add.graphics().setDepth(40);
    this.waves = [];
    this.reset();
  }

  reset() {
    this.baseReset();
    this.state = 'chase';
    this.cd = 0.5;
    this.waves.forEach((w) => { w.glow.destroy(); w.sp.destroy(); });
    this.waves = [];
    this.setA('idle');
    this.drawBar();
  }

  drawBar() {
    const g = this.bar;
    g.clear();
    if (this.dead || this.hp >= this.cfg.hp * (this.scene.ngMul || { hp: 1 }).hp - 1) return;
    const maxHp = this.cfg.hp * this.scene.ngMul.hp, w = 40;
    g.fillStyle(0x000000, 0.7).fillRect(this.x - w / 2 - 1, this.y - 62, w + 2, 5);
    g.fillStyle(0xc43c3c, 1).fillRect(this.x - w / 2, this.y - 61, w * Math.max(0, this.hp / maxHp), 3);
  }

  update(dt, player) {
    this.updateWaves(dt);
    this.drawBar();
    if (this.dead) return;
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    this.t -= dt; this.cd -= dt;
    const near = adx < 220 && Math.abs(dy) < 60 && !player.dead;
    switch (this.state) {
      case 'chase': {
        if (!near) { b.setVelocityX(0); this.setA('idle'); break; }
        this.face(Math.sign(dx) || this.dir);
        const ground = s.isSolidAt(this.x + this.dir * 12, this.y + 6);
        if (adx > 46 && ground) { b.setVelocityX(this.dir * 64); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (adx <= 60 && this.cd <= 0) { this.state = 'wind1'; this.t = 0.55; this.setA('windup', true); this.glintAt(8, -48, 0xffd25a, 2); }
        break;
      }
      case 'wind1':
        b.setVelocityX(0); if (this.t <= 0) this.swing('swing1', 0.42, 'wind2', 0.32);
        break;
      case 'wind2':
        b.setVelocityX(0); this.face(Math.sign(dx) || this.dir);
        if (this.t <= 0) this.swing('swing2', 0.42, 'quake', 0.6);
        break;
      case 'swing1': case 'swing2':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) { this.state = this.next; this.t = this.nextT; this.setA('windup', true); if (this.next === 'quake') this.glintAt(0, -52, 0xff7a2a, 2.4); }
        break;
      case 'quake':
        b.setVelocityX(0);
        if (this.t <= 0) this.quake();
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 700 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.cd = 0.9; this.setA('idle'); }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.cd = 0.6; }
        break;
      default: break;
    }
  }

  swing(name, dur, next, nextT) {
    this.state = name; this.t = dur; this.next = next; this.nextT = nextT;
    this.hitDone = false;
    this.setA('attack', true);
    audio.play('swingHeavy', 0.8);
    this.body.setVelocityX(this.dir * 150);
    this.scene.time.delayedCall(110, () => {
      if (this.dead || this.state !== name) return;
      this.scene.hitPlayer(new Phaser.Geom.Rectangle(this.dir > 0 ? this.x - 4 : this.x - 60, this.y - 52, 64, 52), 28 * this.scene.ngMul.dmg, this.x, 1.3);
    });
  }

  quake() {
    const s = this.scene;
    this.state = 'recover'; this.t = 1.1;
    this.setA('attack', true);
    audio.play('slam');
    s.fx.shake(0.01, 240);
    s.fx.dustPuff(this.x - 16, this.y, 8); s.fx.dustPuff(this.x + 16, this.y, 8);
    s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 50, this.y - 28, 100, 28), 24 * s.ngMul.dmg, this.x, 1.5);
    for (const d of [-1, 1]) {
      const sp = s.add.sprite(this.x + d * 28, this.y, 'wave').setOrigin(0.5, 1).setDepth(21).setBlendMode('ADD').setFlipX(d < 0).setScale(0.8);
      sp.play('wave');
      const glow = s.fx.glow(sp.x, sp.y - 8, 0xffd25a, 0.4, 0.4, 20);
      this.waves.push({ sp, glow, vx: d * 150, hit: false, t: 0 });
    }
  }

  updateWaves(dt) {
    const s = this.scene;
    this.waves = this.waves.filter((w) => {
      w.t += dt;
      w.sp.x += w.vx * dt;
      w.glow.setPosition(w.sp.x, w.sp.y - 8);
      if (!w.hit && s.hitPlayer(new Phaser.Geom.Rectangle(w.sp.x - 6, w.sp.y - 18, 12, 18), 18 * s.ngMul.dmg, w.sp.x, 1)) w.hit = true;
      if (w.t > 1.6 || s.isWallAt(w.sp.x + Math.sign(w.vx) * 8, w.sp.y - 6)) { w.sp.destroy(); w.glow.destroy(); return false; }
      return true;
    });
  }

  takeHit(dmg, dir, poise) {
    if (this.dead) return null;
    this.hp -= dmg;
    flashWhite(this);
    this.poise += poise;
    const armored = ['swing1', 'swing2', 'quake'].includes(this.state);
    if (this.state === 'chase') this.state = 'chase';
    if (this.poise >= (armored ? 120 : 70) && this.state !== 'recover') {
      this.poise = 0; this.state = 'stagger'; this.t = 0.9; this.setA('hurt', true); this.body.setVelocityX(dir * 90);
    }
    if (this.hp <= 0) this.kill();
    return 'hit';
  }

  onKilled() { this.bar.clear(); this.scene.events.emit('toast', 'A champion falls'); }
}

// ------------------------------------------------------------------ Spider (ceiling ambusher)
// Hangs from the ceiling, drops on a thread when you walk beneath it, bites, and
// climbs back up if you get away.
export class Spider extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'spider', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(18, 11).setOffset(5, 6);
    this.setDepth(18);
    this.spawn = { x, y };
    this.parryStates = ['bite'];
    this.thread = scene.add.graphics().setDepth(9);
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this);
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true; this.body.setAllowGravity(false); this.body.setVelocity(0, 0);
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(32 * m.hp); this.embers = Math.round(55 * m.embers);
    this.dead = false; this.parried = false; this.state = 'hang'; this.t = 0; this.cd = 0; this.dir = 1;
    this.setVisible(true).setAlpha(1).clearTint().setAngle(0).setFlipY(false);
    this.play('spider_crawl'); this.anims.pause();
    this.drawThread();
  }

  setA() { /* single animation */ }
  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }

  drawThread() {
    const g = this.thread;
    g.clear();
    if (this.dead || this.state === 'crawl' || this.state === 'bite' || this.state === 'stagger') return;
    g.lineStyle(1, 0xc8c8d8, 0.55).lineBetween(this.spawn.x, this.spawn.y - 8, this.x, this.y - 6);
  }

  update(dt, player) {
    if (this.dead) { this.drawThread(); return; }
    const b = this.body, s = this.scene;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    this.t -= dt; this.cd -= dt;
    switch (this.state) {
      case 'hang':
        b.setVelocity(0, 0);
        this.anims.pause();
        if (!player.dead && Math.abs(player.x - this.spawn.x) < 38 && player.y > this.spawn.y && player.y - this.spawn.y < 170 && this.cd <= 0) {
          this.state = 'drop'; this.t = 0.9; audio.play('whoosh', 0.3);
        }
        break;
      case 'drop':
        this.anims.resume();
        b.setVelocity(0, 230);
        if (b.blocked.down || this.t <= 0 || this.y > player.y - 6) { this.state = 'crawl'; this.t = 6; b.setAllowGravity(true); }
        break;
      case 'crawl': {
        this.face(Math.sign(dx) || this.dir);
        const ground = s.isSolidAt(this.x + this.dir * 8, this.y + 8);
        if (adx > 22 && ground) { b.setVelocityX(this.dir * 78); this.anims.resume(); }
        else { b.setVelocityX(0); this.anims.pause(); }
        if (adx < 26 && Math.abs(dy) < 20 && this.cd <= 0) {
          this.state = 'bite'; this.t = 0.4; this.hitDone = false; this.cd = 1.0;
          b.setVelocity(this.dir * 170, -150);
          audio.play('swing', 0.4);
        }
        if (this.t <= 0 || adx > 260 || player.dead) { this.state = 'climb'; b.setAllowGravity(false); b.setVelocity(0, 0); }
        break;
      }
      case 'bite':
        if (!this.hitDone && s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 14, this.y - 12, 28, 22), 18 * s.ngMul.dmg, this.x, 0.9)) this.hitDone = true;
        if (this.t <= 0) { this.state = 'crawl'; this.t = Math.max(this.t, 3); b.setVelocityX(0); }
        break;
      case 'climb': {
        const up = this.spawn.y - this.y;
        b.setVelocity((this.spawn.x - this.x) * 3, Math.max(-140, up * 3));
        this.anims.resume();
        if (Math.abs(up) < 3 && Math.abs(this.spawn.x - this.x) < 3) { this.state = 'hang'; this.cd = 1.5; this.setPosition(this.spawn.x, this.spawn.y); b.reset(this.spawn.x, this.spawn.y); }
        break;
      }
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) { this.state = 'crawl'; this.t = 3; b.setAllowGravity(true); }
        break;
      default: break;
    }
    this.drawThread();
  }

  takeHit(dmg, dir) {
    if (this.dead) return null;
    this.hp -= dmg;
    flashWhite(this);
    this.scene.fx.burst('blood', this.x, this.y, 6);
    if (this.hp <= 0) {
      this.dead = true; this.state = 'dead';
      this.body.setVelocity(dir * 80, -120); this.body.setAllowGravity(true);
      audio.play('enemyDie', 0.7);
      this.scene.grantEmbers(this.embers, this.x, this.y - 6);
      this.setFlipY(true);
      this.scene.time.delayedCall(500, () => {
        if (!this.dead || !this.scene) return;
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
      });
      return 'hit';
    }
    if (this.state === 'hang') { this.state = 'drop'; this.t = 0.9; }
    else if (this.state === 'crawl' || this.state === 'climb') { this.state = 'stagger'; this.t = 0.35; this.body.setAllowGravity(true); this.body.setVelocityX(dir * 120); }
    return 'hit';
  }
}

// ------------------------------------------------------------------ Wraith Shade
// Drifts through walls, untouchable. It must solidify to strike: a violet tell, a
// lunge, and then a short window where it can be cut down. Parry the lunge.
export class Shade extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'shade_float', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 92 / 96);
    this.body.setAllowGravity(false);
    this.body.setSize(16, 30).setOffset(40, 62);
    this.setDepth(19);
    this.spawn = { x, y };
    this.parryStates = ['lunge'];
    this.glowImg = scene.fx.glow(x, y - 20, 0xb888ff, 0.5, 0.3, 18);
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this);
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true; this.body.setVelocity(0, 0);
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(72 * m.hp); this.embers = Math.round(125 * m.embers);
    this.dead = false; this.parried = false; this.state = 'drift'; this.t = 0; this.cd = 1.5; this.dir = 1; this.phase = Math.random() * 6;
    this.setVisible(true).clearTint().setAlpha(0.3);
    this.glowImg.setVisible(true);
    this.anim = ''; this.setA('float');
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play(`shade_${k}`); }
  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }
  get solid() { return this.state === 'manifest' || this.state === 'lunge' || this.state === 'exposed'; }

  update(dt, player) {
    this.glowImg.setPosition(this.x, this.y - 20);
    if (this.dead) return;
    this.phase += dt;
    this.t -= dt; this.cd -= dt;
    const b = this.body, s = this.scene;
    const px = player.x, py = player.y - 18;
    const dx = px - this.x, dy = py - this.y, dist = Math.hypot(dx, dy);
    this.face(Math.sign(dx));
    switch (this.state) {
      case 'drift': {
        this.setAlpha(0.28 + Math.sin(this.phase * 2.4) * 0.07);
        this.glowImg.setAlpha(0.15);
        const away = Math.hypot(this.spawn.x - this.x, this.spawn.y - this.y);
        if (!player.dead && dist < 260 && dist > 70) { b.setVelocity(dx / dist * 46, dy / dist * 46 + Math.sin(this.phase * 3) * 10); }
        else if (!player.dead && dist <= 70) b.setVelocity(-dx / dist * 20, Math.sin(this.phase * 3) * 12);
        else if (away > 8) b.setVelocity((this.spawn.x - this.x) / away * 40, (this.spawn.y - this.y) / away * 40);
        else b.setVelocity(0, Math.sin(this.phase * 2) * 8);
        if (!player.dead && dist < 110 && this.cd <= 0) {
          this.state = 'manifest'; this.t = 0.75; b.setVelocity(0, 0);
          this.setA('cast', true);
          audio.play('wisp', 0.6);
          this.glintAt(6, -42, 0xc898ff, 2);
        }
        break;
      }
      case 'manifest':
        b.setVelocity(0, 0);
        this.setAlpha(0.3 + 0.7 * (1 - Math.max(0, this.t) / 0.75));
        this.glowImg.setAlpha(0.5);
        if (this.t <= 0) {
          const n = Math.max(1, dist);
          this.vx = dx / n * 245; this.vy = dy / n * 245;
          this.state = 'lunge'; this.t = 0.55; this.hitDone = false;
          this.setA('slam', true);
          audio.play('whoosh', 0.6);
        }
        break;
      case 'lunge':
        b.setVelocity(this.vx, this.vy);
        this.setAlpha(1);
        if (Math.random() < 0.7) s.fx.afterImage(this, 0xb888ff);
        if (!this.hitDone && s.hitPlayer(new Phaser.Geom.Rectangle(this.x - 12, this.y - 34, 24, 34), 26 * s.ngMul.dmg, this.x, 1.2)) this.hitDone = true;
        if (this.t <= 0) { this.state = 'exposed'; this.t = 1.5; b.setVelocity(0, 0); this.setA('float'); }
        break;
      case 'exposed':
        { const k = Math.pow(0.9, dt * 60); b.setVelocity(b.velocity.x * k, b.velocity.y * k); }
        this.setAlpha(1);
        if (this.t <= 0) { this.state = 'fade'; this.t = 0.5; }
        break;
      case 'fade':
        this.setAlpha(Math.max(0.28, this.t / 0.5));
        if (this.t <= 0) { this.state = 'drift'; this.cd = 2.2; }
        break;
      case 'stagger':
        { const k = Math.pow(0.9, dt * 60); b.setVelocity(b.velocity.x * k, b.velocity.y * k); }
        if (this.t <= 0) { this.state = 'exposed'; this.t = 1.0; this.setA('float'); }
        break;
      default: break;
    }
  }

  takeHit(dmg, dir, poise) {
    if (this.dead) return null;
    const s = this.scene;
    if (!this.solid) {
      // out of phase: the blade passes through
      s.fx.burst('spirit', this.x, this.y - 20, 4);
      audio.play('vanish', 0.25);
      return 'blocked';
    }
    this.hp -= dmg * (this.state === 'exposed' ? 1.25 : 1);
    flashWhite(this);
    if (this.hp <= 0) {
      this.dead = true; this.state = 'dead';
      this.body.setVelocity(0, 0);
      audio.play('enemyDie');
      s.fx.burst('spirit', this.x, this.y - 20, 40);
      s.grantEmbers(this.embers, this.x, this.y - 16);
      this.glowImg.setVisible(false);
      s.tweens.add({ targets: this, alpha: 0, duration: 500, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
      return 'hit';
    }
    if (this.state === 'lunge' || this.state === 'manifest') { /* committed */ } else {
      this.state = 'stagger'; this.t = 0.5; this.setA('hurt', true);
      this.body.setVelocity(dir * 100, -20);
    }
    return 'hit';
  }
}

// ------------------------------------------------------------------ Shield Duelist
// A faster, sharper Crypt Sentinel: a quick double thrust, and it answers a blocked blow
// with an immediate riposte. Break its guard with a heavy strike, parry the thrusts, or
// get behind it.
export class Duelist extends Sentinel {
  constructor(scene, x, y) {
    super(scene, x, y, 'duelist');
    this.parryStates = ['thrust'];
  }

  reset() {
    super.reset();
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(95 * m.hp); this.embers = Math.round(170 * m.embers);
    this.second = false; this.engaged = false;
  }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const sees = adx < 190 && Math.abs(dy) < 44 && !player.dead;
    this.t -= dt;
    this.guard = Math.max(0, this.guard - 20 * dt);
    switch (this.state) {
      case 'patrol': {
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (!ground || (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right) || (Math.abs(this.x - this.spawn.x) > 70 && Math.sign(this.x - this.spawn.x) === this.dir)) this.face(-this.dir);
        b.setVelocityX(this.dir * 30);
        this.setA('walk');
        if (sees) this.state = 'chase';
        break;
      }
      case 'chase': {
        const want = Math.sign(dx) || this.dir;
        if (want !== this.dir) { this.turnT += dt; if (this.turnT > 0.22) { this.face(want); this.turnT = 0; } } else this.turnT = 0;
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (adx > 44 && ground && want === this.dir) { b.setVelocityX(this.dir * 84); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (adx <= 58 && want === this.dir && Math.abs(dy) < 30 && this.t <= 0 && this.scene.canEngage(this)) { this.engaged = true; this.beginThrust(0.38); }
        if (adx > 280 || player.dead) this.state = 'patrol';
        break;
      }
      case 'block':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.setA('idle'); }
        break;
      case 'windup':
        b.setVelocityX(0);
        if (this.t <= 0) { this.state = 'thrust'; this.t = 0.34; this.hitDone = false; this.setA('thrust', true); audio.play('swing', 0.9); }
        break;
      case 'thrust':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          if (!this.second && Math.abs(dx) < 80) { this.second = true; this.beginThrust(0.2); }
          else if (adx < 46 && Math.abs(dy) < 30 && Math.random() < 0.55) { this.second = false; this.beginBash(); }
          else { this.second = false; this.state = 'recover'; this.t = 0.55; this.setA('idle'); }
        }
        break;
      case 'bashwind': case 'bash':
        this.bashStep(dt);
        break;
      case 'recover':
        b.setVelocityX(0);
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.45; this.engaged = false; }
        break;
      case 'stagger': case 'broken':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.25; this.setA('idle'); }
        break;
      default: break;
    }
  }

  beginThrust(wind) {
    this.state = 'windup'; this.t = wind; this.setA('windup', true);
    this.glint();
  }

  takeHit(dmg, dir, poise) {
    const res = super.takeHit(dmg, dir, poise);
    if (res === 'blocked' && !this.dead) {
      // riposte: answer the blocked blow at once
      this.face(-dir);
      this.state = 'windup'; this.t = 0.2; this.second = true; this.setA('windup', true);
    }
    return res;
  }
}

// ------------------------------------------------------------------ Necromancer
// Raises wisps and hides behind them: while any of its minions live, a ward shields it.
// Cut the minions down, then punish it before it blinks away or raises more.
export class Necromancer extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'necromancer_float', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 76 / 80);
    this.body.setSize(10, 24).setOffset(35, 52);
    this.setDepth(18);
    this.spawn = { x, y };
    this.parryStates = [];
    this.minions = [];
    this.ward = scene.fx.glow(x, y - 28, 0x7aff9a, 1.1, 0, 21);
    this.glowImg = scene.fx.glow(x, y - 32, 0x7aff9a, 0.35, 0.3, 17);
    this.on('animationcomplete', (a) => { if (a.key === 'necromancer_cast' && !this.dead && this.state !== 'windup') this.play('necromancer_float'); });
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this);
    this.minions.forEach((w) => { if (this.scene.wisps.includes(w)) this.scene.removeMinion(w); });
    this.minions = [];
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(85 * m.hp); this.embers = Math.round(190 * m.embers);
    this.dead = false; this.parried = false; this.state = 'idle'; this.t = 1; this.cd = 0; this.dir = -1;
    this.setVisible(true).setAlpha(1).clearTint();
    this.glowImg.setVisible(true);
    this.ward.setAlpha(0);
    this.play('necromancer_float');
  }

  setA(k, restart = false) { const key = `necromancer_${k}`; if (this.scene.anims.exists(key)) this.play(key, !restart); }
  face(d) { if (d) { this.dir = d; this.setFlipX(d < 0); } }
  get warded() { return this.minions.some((w) => !w.dead && w.active); }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body, s = this.scene;
    this.glowImg.setPosition(this.x + this.dir * 10, this.y - 32);
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const aware = adx < 260 && Math.abs(dy) < 120 && !player.dead;
    this.t -= dt; this.cd -= dt;
    this.ward.setPosition(this.x, this.y - 28).setAlpha(this.warded ? 0.32 + Math.sin(s.time.now / 160) * 0.08 : 0);
    switch (this.state) {
      case 'idle':
        b.setVelocityX(0);
        if (aware) { this.face(Math.sign(dx)); this.state = 'watch'; this.t = 0.7; }
        break;
      case 'watch': {
        this.face(Math.sign(dx));
        const back = -this.dir;
        if (adx < 56) {
          if (this.cd <= -0.0 && this.blinkReady) this.blink();
          else if (s.isSolidAt(this.x + back * 10, this.y + 6)) b.setVelocityX(back * 50);
          else b.setVelocityX(0);
        } else b.setVelocityX(0);
        if (this.t <= 0 && aware && !this.warded) { this.state = 'summon'; this.t = 1.1; this.setA('channel', true); this.glintAt(8, -48, 0x7aff9a, 2.2); audio.play('wail', 0.4); }
        if (!aware) this.state = 'idle';
        break;
      }
      case 'summon':
        b.setVelocityX(0);
        if (Math.random() < 0.5) s.fx.burst('spirit', this.x, this.y - 40, 1);
        if (this.t <= 0) {
          for (const d of [-1, 1]) {
            const w = s.spawnMinion(this.x + d * 34, this.y - 54);
            w.minion = true;
            this.minions.push(w);
          }
          this.state = 'watch'; this.t = 4 + Math.random() * 1.5;
          this.setA('float', true);
          audio.play('fireball', 0.4);
        }
        break;
      case 'stagger':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'watch'; this.t = 1; }
        break;
      default: break;
    }
    this.blinkReady = this.cd <= 0;
  }

  blink() {
    const s = this.scene;
    s.fx.burst('spirit', this.x, this.y - 20, 18);
    audio.play('vanish', 0.4);
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (const d of [dir, -dir]) {
      const nx = Phaser.Math.Clamp(this.spawn.x + d * (60 + Math.random() * 70), this.spawn.x - 140, this.spawn.x + 140);
      if (s.isSolidAt(nx, this.spawn.y + 6) && Math.abs(nx - s.player.x) > 80) {
        this.setPosition(nx, this.y); this.body.reset(nx, this.y);
        s.fx.burst('spirit', nx, this.y - 20, 18);
        break;
      }
    }
    this.cd = 3;
  }

  takeHit(dmg, dir) {
    if (this.dead) return null;
    const s = this.scene;
    if (this.warded) {
      audio.play('clang', 0.5);
      s.fx.ring(this.x, this.y - 28, 0x7aff9a, 1.6, 200);
      s.fx.burst('spirit', this.x, this.y - 28, 6);
      return 'blocked';
    }
    this.hp -= dmg;
    flashWhite(this);
    this.state = 'stagger'; this.t = 0.5;
    this.setA('hurt', true);
    this.body.setVelocityX(dir * 110);
    if (this.hp <= 0) {
      this.dead = true; this.state = 'dead';
      this.body.setVelocityX(0);
      this.setA('death', true);
      audio.play('enemyDie');
      this.glowImg.setVisible(false); this.ward.setAlpha(0);
      s.grantEmbers(this.embers, this.x, this.y - 16);
      this.minions.forEach((w) => { if (!w.dead) w.takeHit(999, dir); });
      s.time.delayedCall(900, () => {
        if (!this.dead || !this.scene) return;
        s.fx.burst('embers', this.x, this.y - 8, 24);
        s.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
      });
    }
    return 'hit';
  }
}

// Spider, Shade and Necromancer are not Foes but share its telegraph glint
for (const C of [Spider, Shade, Necromancer]) if (!C.prototype.glintAt) C.prototype.glintAt = Foe.prototype.glintAt;

export const NEW_ENEMY_TYPES = {
  archers: Archer, brutes: Brute, sappers: Sapper, ghouls: Ghoul, champions: Champion,
  spiders: Spider, shades: Shade, duelists: Duelist, necromancers: Necromancer,
};
// enemies with a ground collider (the rest drift or hang)
export const GROUNDED = new Set([Archer, Brute, Sapper, Ghoul, Champion, Spider, Duelist, Necromancer]);
