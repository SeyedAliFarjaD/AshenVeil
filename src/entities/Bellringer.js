import { audio } from '../audio.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

function flashWhite(sprite) {
  sprite.setTintFill(0xffffff);
  sprite.scene.time.delayedCall(70, () => { if (sprite.active) sprite.clearTint(); });
}

// ------------------------------------------------------------------ Bellringer (heavy hammer knight)
// Slow, armored, and hits like a bell. The overhead slam is telegraphed for a
// full second: parry it at the glint, or roll through it. High poise, so light
// hits barely stagger it; the heavy third strike or a parry opens it up.
export class Bellringer extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bellringer_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 75 / 80);
    this.body.setSize(12, 30).setOffset(34, 44);
    this.body.setMaxVelocity(300, 700);
    this.setDepth(18);
    this.spawn = { x, y };
    this.embers = 200;
    this.on('animationupdate', this.onFrame, this);
    this.reset();
  }

  reset() {
    if (this.scene) this.scene.tweens.killTweensOf(this); // stop a death fade still in progress
    this.setPosition(this.spawn.x, this.spawn.y);
    this.body.reset(this.spawn.x, this.spawn.y);
    this.body.enable = true;
    const m = this.scene.ngMul || { hp: 1, embers: 1 };
    this.hp = Math.round(170 * m.hp); this.embers = Math.round(200 * m.embers);
    this.poise = 0; this.dead = false; this.parried = false; this.second = false;
    this.state = 'patrol'; this.t = 0; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.setVisible(true).setAlpha(1).clearTint();
    this.anim = '';
    this.setA('walk');
  }

  setA(k, restart = false) { if (this.anim === k && !restart) return; this.anim = k; this.play('bellringer_' + k); }
  face(d) { this.dir = d; this.setFlipX(d < 0); }

  update(dt, player) {
    if (this.dead) return;
    const b = this.body;
    const dx = player.x - this.x, adx = Math.abs(dx), dy = player.y - this.y;
    const sees = adx < 150 && Math.abs(dy) < 46 && !player.dead;
    this.t -= dt;
    switch (this.state) {
      case 'patrol': {
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (!ground || (this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right) || (Math.abs(this.x - this.spawn.x) > 55 && Math.sign(this.x - this.spawn.x) === this.dir)) this.face(-this.dir);
        b.setVelocityX(this.dir * 16);
        this.setA('walk');
        if (sees) this.state = 'chase';
        break;
      }
      case 'chase': {
        this.face(Math.sign(dx) || this.dir);
        const ground = this.scene.isSolidAt(this.x + this.dir * 10, this.y + 6);
        if (adx > 34 && ground) { b.setVelocityX(this.dir * 30); this.setA('walk'); }
        else { b.setVelocityX(0); this.setA('idle'); }
        if (adx <= 44 && Math.abs(dy) < 32 && this.t <= 0) { this.state = 'windup'; this.t = 0.85; this.setA('windup', true); this.glint(); }
        if (adx > 240 || player.dead) this.state = 'patrol';
        break;
      }
      case 'windup':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) { this.state = 'slam'; this.t = 0.5; this.hitDone = false; this.setA('slam', true); audio.play('swingHeavy', 0.8); }
        break;
      case 'slam':
        b.setVelocityX(approach(b.velocity.x, 0, 600 * dt));
        if (this.t <= 0) {
          // sometimes it follows through with a second, quicker slam
          if (!this.second && adx < 70 && Math.abs(dy) < 32 && Math.random() < 0.45) {
            this.second = true; this.face(Math.sign(dx) || this.dir);
            this.state = 'windup'; this.t = 0.5; this.setA('windup', true); this.glint();
          } else { this.second = false; this.state = 'recover'; this.t = 1.1; this.setA('idle'); }
        }
        break;
      case 'recover':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.7; }
        break;
      case 'stagger': case 'broken':
        b.setVelocityX(approach(b.velocity.x, 0, 400 * dt));
        if (this.t <= 0) { this.state = 'chase'; this.t = 0.4; this.setA('idle'); }
        break;
      default: break;
    }
  }

  glint() {
    const s = this.scene;
    const g = s.add.image(this.x - this.dir * 6, this.y - 56, 'spark').setTint(0xbfe8ff).setBlendMode('ADD').setDepth(30).setScale(0.5);
    s.tweens.add({ targets: g, scale: 2.4, angle: 90, alpha: 0, duration: 700, onComplete: () => g.destroy() });
    audio.play('glint');
  }

  onFrame(anim, frame) {
    if (this.state !== 'slam' || anim.key !== 'bellringer_slam') return;
    const f = frame.index - 1;
    if (f === 1) {
      const fx = this.scene.fx;
      audio.play('slam', 0.9);
      fx.shake(0.012, 240);
      fx.dustPuff(this.x - 14, this.y, 10); fx.dustPuff(this.x + 14, this.y, 10);
      fx.burst('rocks', this.x, this.y - 4, 16);
      const tipX = this.x + this.dir * 26;
      fx.burst('sparks', tipX, this.y - 6, 14);
    }
    if (f >= 1 && f <= 2 && !this.hitDone) {
      const r = new Phaser.Geom.Rectangle(this.dir > 0 ? this.x - 6 : this.x - 62, this.y - 46, 68, 48);
      if (this.scene.hitPlayer(r, 30 * this.scene.ngMul.dmg, this.x, 1.3)) this.hitDone = true;
    }
  }

  takeHit(dmg, dir, poiseDmg) {
    if (this.dead) return null;
    this.hp -= dmg;
    flashWhite(this);
    this.poise += poiseDmg;
    // heavy armor: only heavy blows, guard breaks, or a parry stagger it
    const heavy = poiseDmg >= 55;
    if (heavy || this.poise >= 120) {
      this.poise = 0;
      this.state = 'stagger'; this.t = 0.55;
      this.setA('hurt', true);
      this.body.setVelocityX(dir * 90);
    }
    if (this.state === 'patrol') this.state = 'chase';
    if (this.hp <= 0) this.die();
    return 'hit';
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.body.setVelocityX(0);
    this.setA('death', true);
    audio.play('enemyDie');
    this.scene.grantEmbers(this.embers, this.x, this.y - 16);
    this.scene.time.delayedCall(700, () => {
      if (!this.dead) return; // revived by a bonfire rest before the fade began
      this.scene.fx.burst('embers', this.x, this.y - 8, 24);
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => { if (this.dead) { this.setVisible(false); this.body.enable = false; } } });
    });
  }
}
