import { settings } from './settings.js';
const SLASH_CENTER = { slash: 18 / 64, slashBig: 24 / 80, bslash: 40 / 140 };

// Game-feel helpers: particles, hit-stop, shake, after-images, glows.
export class FX {
  constructor(scene) {
    this.scene = scene;
    const mk = (tex, cfg, depth = 30) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      return e;
    };
    this.sparks = mk('px', {
      speed: { min: 60, max: 220 }, lifespan: { min: 150, max: 380 }, scale: { start: 1, end: 0 },
      tint: [0xffffff, 0xffe2a0, 0xffb347], gravityY: 300, blendMode: 'ADD',
    }, 40);
    this.blood = mk('px', {
      speed: { min: 40, max: 160 }, lifespan: { min: 300, max: 700 }, scale: { start: 1.2, end: 0.4 },
      tint: [0x3a1418, 0x5c1a22, 0x24161c], gravityY: 500,
    }, 35);
    this.dust = mk('dust', {
      speed: { min: 10, max: 50 }, lifespan: { min: 300, max: 600 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 0.5, end: 0 }, tint: 0x8a8090, gravityY: -20,
    }, 25);
    this.embers = mk('px', {
      speed: { min: 20, max: 80 }, lifespan: { min: 600, max: 1400 }, scale: { start: 1, end: 0 },
      tint: [0xffb347, 0xff7a2a, 0xffe2a0], gravityY: -60, blendMode: 'ADD',
    }, 40);
    this.heal = mk('px', {
      speed: { min: 10, max: 40 }, lifespan: { min: 500, max: 1000 }, scale: { start: 1, end: 0 },
      tint: [0xffd27a, 0xffb347, 0xfff2c4], gravityY: -80, blendMode: 'ADD',
    }, 40);
    this.spirit = mk('px', {
      speed: { min: 20, max: 100 }, lifespan: { min: 500, max: 1100 }, scale: { start: 1.2, end: 0 },
      tint: [0xc4b8ff, 0x8a7dff, 0xffffff], gravityY: -40, blendMode: 'ADD',
    }, 40);
    this.fire = mk('px', {
      speed: { min: 20, max: 120 }, lifespan: { min: 300, max: 800 }, scale: { start: 1.5, end: 0 },
      tint: [0xfff0b0, 0xff9a3a, 0xd4421c], gravityY: -160, blendMode: 'ADD',
    }, 40);
    this.rocks = mk('px', {
      speed: { min: 80, max: 260 }, angle: { min: 200, max: 340 }, lifespan: { min: 500, max: 900 },
      scale: { start: 1.3, end: 0.8 }, tint: [0x3b3645, 0x55504f, 0x2b2733], gravityY: 700,
    }, 35);
  }

  burst(name, x, y, n) {
    this[name].explode(n, x, y);
  }

  dustPuff(x, y, n = 6) {
    this.dust.explode(n, x, y);
  }

  shake(intensity = 0.004, dur = 120) {
    if (!settings.shake) return;
    this.scene.cameras.main.shake(dur, intensity);
  }

  // Freeze the action for a few frames on impact: sells weight.
  hitStop(ms = 60) {
    const s = this.scene;
    if (s.hitStopping) return;
    s.hitStopping = true;
    s.physics.world.pause();
    s.anims.pauseAll();
    s.time.delayedCall(ms, () => {
      s.hitStopping = false;
      if (!s.paused) { s.physics.world.resume(); s.anims.resumeAll(); }
    });
  }

  flash(color = 0xffffff, dur = 80, alpha = 0.6) {
    if (!settings.flashes) alpha *= 0.25; // reduced flashing (accessibility)
    const ui = this.scene.scene.get('UI');
    if (ui && ui.flash) ui.flash(color, dur, alpha);
  }

  glow(x, y, tint, scale = 1, alpha = 0.5, depth = 5) {
    const g = this.scene.add.image(x, y, 'glow').setTint(tint).setScale(scale).setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    return g;
  }

  afterImage(sprite, tint = 0x9fdcff) {
    const img = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY).setFlipX(sprite.flipX).setTint(tint)
      .setAlpha(0.45).setDepth(sprite.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }

  // The "one white line" cut: a needle-thin line shoots across the point, then
  // thins to nothing. A dark shadow line underneath keeps it readable on bright
  // backgrounds. Tweens keep running through hit-stop, so it draws during the freeze.
  cut(x, y, angle, len = 60, { thick = 1, dur = 220, delay = 0, tint = 0xffffff } = {}) {
    const s = this.scene;
    const sx = len / 64;
    const mk = (t, alpha, sy, depth) => s.add.image(x, y, 'cutline').setRotation(angle).setTint(t).setAlpha(alpha)
      .setScale(sx * 0.15, sy).setDepth(depth).setVisible(delay === 0);
    const shadow = mk(0x000000, 0.45, thick * 1.6, 42);
    const line = mk(tint, 1, thick * 0.7, 43);
    s.tweens.add({
      targets: [shadow, line], scaleX: sx, duration: 55, delay, ease: 'Expo.Out',
      onStart: () => { shadow.setVisible(true); line.setVisible(true); },
      onComplete: () => s.tweens.add({
        targets: [shadow, line], scaleY: 0, scaleX: sx * 1.12, duration: dur, ease: 'Quad.In',
        onComplete: () => { shadow.destroy(); line.destroy(); },
      }),
    });
  }

  // Expanding shockwave ring.
  ring(x, y, tint = 0xffffff, scaleTo = 2, dur = 220, alpha = 0.9, depth = 41) {
    const r = this.scene.add.image(x, y, 'ring').setTint(tint).setScale(0.25).setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    this.scene.tweens.add({ targets: r, scale: scaleTo, alpha: 0, duration: dur, ease: 'Cubic.Out', onComplete: () => r.destroy() });
    return r;
  }

  // Speed streaks flying out of an impact. dir: +1/-1 sprays along the hit, 0 sprays all around.
  streaks(x, y, dir, n, tint = 0xffffff, { spread = 0.8, len = 14, dist = 22, dur = 170, depth = 41 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = dir === 0 ? (i / n) * Math.PI * 2 + Math.random() * 0.3
        : (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2 * spread;
      const k = 0.6 + Math.random() * 0.7;
      const s = this.scene.add.image(x, y, 'streak').setOrigin(0, 0.5).setRotation(a).setTint(tint)
        .setScale((len / 8) * k, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(a) * dist * k, y: y + Math.sin(a) * dist * k, scaleX: 0, alpha: 0,
        duration: dur * k, ease: 'Quad.Out', onComplete: () => s.destroy(),
      });
    }
  }

  // A quick camera zoom-in that eases back: makes big blows land.
  zoomPunch(amt = 0.04, dur = 160) {
    if (!settings.shake) return;
    const cam = this.scene.cameras.main;
    if (this.baseZoom === undefined) this.baseZoom = cam.zoom;
    if (this.zoomTween) this.zoomTween.stop();
    cam.setZoom(this.baseZoom * (1 + amt));
    this.zoomTween = this.scene.tweens.addCounter({
      from: amt, to: 0, duration: dur, ease: 'Quad.Out',
      onUpdate: (tw) => cam.setZoom(this.baseZoom * (1 + tw.getValue())),
      onComplete: () => { cam.setZoom(this.baseZoom); this.zoomTween = null; },
    });
  }

  // Blade connecting with flesh: ring + streaks along the swing.
  impact(x, y, dir, heavy = false) {
    this.ring(x, y, 0xfff2d0, heavy ? 2.4 : 1.4, heavy ? 260 : 180);
    this.streaks(x, y, dir, heavy ? 7 : 4, 0xffe8b0, { len: heavy ? 18 : 12, dist: heavy ? 30 : 20 });
    const g = this.glow(x, y, 0xffe2a0, heavy ? 0.5 : 0.3, 0.8, 40);
    this.scene.tweens.add({ targets: g, alpha: 0, scale: g.scale * 1.6, duration: 140, onComplete: () => g.destroy() });
  }

  // A clean deflect: four-point star, double ring, radial streaks, zoom punch.
  parryFlash(x, y, dir = 1) {
    const s = this.scene;
    const star = s.add.image(x, y, 'star').setTint(0xdff8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(42).setScale(0.6);
    s.tweens.add({ targets: star, scale: 2.8, angle: 45, alpha: 0, duration: 300, ease: 'Cubic.Out', onComplete: () => star.destroy() });
    this.ring(x, y, 0xbfeaff, 3.2, 300);
    s.time.delayedCall(60, () => this.ring(x, y, 0xffffff, 2, 220, 0.7));
    this.streaks(x, y, 0, 10, 0xcff2ff, { len: 18, dist: 34, dur: 220 });
    this.burst('sparks', x, y, 24);
    // one clean white line through the clash, along the guarding blade
    this.cut(x, y, (Math.PI / 2 - 0.5) * dir, 78, { thick: 1.3, dur: 280 });
    this.zoomPunch(0.06, 240);
    this.flash(0xcff0ff, 120, 0.3);
  }

  // A shield takes the blow: orange sparks spray back at the attacker.
  blockFx(x, y, dir) {
    this.ring(x, y, 0xffc070, 1.2, 160, 0.8);
    this.streaks(x, y, dir, 5, 0xffc070, { len: 10, dist: 18, spread: 0.6 });
  }

  // A guard shatters.
  guardBreak(x, y, dir) {
    this.ring(x, y, 0xffd27a, 3, 300);
    this.streaks(x, y, 0, 8, 0xffd27a, { len: 16, dist: 30 });
    this.burst('rocks', x, y, 16);
    this.burst('sparks', x, y, 20);
    this.zoomPunch(0.05, 200);
  }

  // The hero gets hit: a red ring and streaks thrown away from the attacker.
  hurtFx(x, y, dir) {
    this.ring(x, y, 0xff4a3a, 1.8, 220, 0.8);
    this.streaks(x, y, dir, 5, 0xff6a5a, { len: 12, dist: 22 });
    this.zoomPunch(0.03, 140);
  }

  slash(x, y, key, flipX, flipY = false, scale = 1, depth = 22) {
    const cx = SLASH_CENTER[key] || 0.3;
    const s = this.scene.add.sprite(x, y, key, 0).setFlipX(flipX).setFlipY(flipY).setScale(scale)
      .setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    s.setOrigin(flipX ? 1 - cx : cx, 0.5);
    s.play(key);
    s.on('animationcomplete', () => s.destroy());
    return s;
  }
}
