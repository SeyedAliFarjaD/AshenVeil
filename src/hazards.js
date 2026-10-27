// Platforming hazards for levels 5-8, driven by level data:
//   movers:   [{ x, y, w, axis: 'x'|'y', range, speed, phase }]   one-way platforms on a track (tiles)
//   crumbles: [{ x, y, w }]                                        one-way platforms that give way
//   saws:     [{ x0, y0, x1, y1, speed }]                          blades on rails (tile centres)
//   winds:    [{ x, y, w, h, fx, fy }]                             tile rect, accelerations in px/s^2
//   ice:      [[x0, y, x1]]                                        slippery floor surface (tile row y = the solid row)
//   bouncers: [{ x, y }]                                           spring pads standing on tile (x, y-1)
import { audio } from './audio.js';
import { T } from './levels/common.js';

const MOVER_H = 8;

export class Hazards {
  constructor(scene, L) {
    this.s = scene;
    this.movers = []; this.crumbles = []; this.saws = []; this.winds = []; this.ice = []; this.bouncers = [];
    this.standing = null;     // the platform the hero is standing on this frame
    this.time = 0;

    for (const m of L.movers || []) {
      const w = m.w * T;
      const spr = scene.add.tileSprite(m.x * T, m.y * T, w, MOVER_H, 'plat_move').setOrigin(0, 0).setDepth(12);
      const mv = { kind: 'mover', spr, w, h: MOVER_H, x0: m.x * T, y0: m.y * T, axis: m.axis || 'x', range: (m.range || 4) * T, speed: m.speed || 40, phase: m.phase || 0, x: m.x * T, y: m.y * T, px: m.x * T, py: m.y * T, active: true, dx: 0, dy: 0 };
      this.movers.push(mv);
    }
    for (const c of L.crumbles || []) {
      const w = c.w * T;
      const spr = scene.add.tileSprite(c.x * T, c.y * T, w, MOVER_H, 'plat_crumble').setOrigin(0, 0).setDepth(12);
      this.crumbles.push({ kind: 'crumble', spr, w, h: MOVER_H, x: c.x * T, y: c.y * T, px: c.x * T, py: c.y * T, state: 'idle', t: 0, active: true, dx: 0, dy: 0 });
    }
    for (const sw of L.saws || []) {
      const x0 = sw.x0 * T + 8, y0 = sw.y0 * T + 8, x1 = (sw.x1 ?? sw.x0) * T + 8, y1 = (sw.y1 ?? sw.y0) * T + 8;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len > 0) {
        const n = Math.ceil(len / 8);
        for (let i = 0; i <= n; i++) scene.add.image(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 'rail').setDepth(5).setAlpha(0.8);
      }
      const spr = scene.add.image(x0, y0, 'saw').setDepth(13);
      const glow = scene.fx.glow(x0, y0, 0xffd8a0, 0.35, 0.25, 12);
      this.saws.push({ spr, glow, x0, y0, x1, y1, len, speed: sw.speed || 70, t: sw.phase || 0, cd: 0 });
    }
    for (const w of L.winds || []) this.winds.push({ r: new Phaser.Geom.Rectangle(w.x * T, w.y * T, w.w * T, w.h * T), fx: w.fx || 0, fy: w.fy || 0, emit: 0 });
    for (const [x0, y, x1] of L.ice || []) {
      scene.add.tileSprite(x0 * T, y * T - 1, (x1 - x0 + 1) * T, 3, 'icefloor').setOrigin(0, 0).setDepth(11);
      this.ice.push({ x0: x0 * T, x1: (x1 + 1) * T, y: y * T });
    }
    for (const b of L.bouncers || []) {
      const spr = scene.add.image(b.x * T + 8, b.y * T, 'bounce').setOrigin(0.5, 1).setDepth(11);
      this.bouncers.push({ spr, x: b.x * T + 8, y: b.y * T, cd: 0 });
    }
  }

  // positions of every dynamic one-way platform (movers & crumbles that are solid)
  solids() { return [...this.movers, ...this.crumbles.filter((c) => c.active)]; }

  update(dt, p) {
    this.time += dt;
    const s = this.s;
    // --- movers glide on a triangle wave
    for (const m of this.movers) {
      m.px = m.x; m.py = m.y;
      const span = m.range * 2, q = ((this.time * m.speed + m.phase * m.range) % span + span) % span;
      const off = q < m.range ? q : span - q;
      if (m.axis === 'x') { m.x = m.x0 + off; m.y = m.y0; } else { m.x = m.x0; m.y = m.y0 + off; }
      m.dx = m.x - m.px; m.dy = m.y - m.py;
      m.spr.setPosition(m.x, m.y);
    }
    // --- crumbles
    for (const c of this.crumbles) {
      if (c.state === 'shake') {
        c.t -= dt;
        c.spr.x = c.x + (Math.random() - 0.5) * 1.6;
        if (Math.random() < 0.4) s.fx.dustPuff(c.x + Math.random() * c.w, c.y + 8, 1);
        if (c.t <= 0) {
          c.state = 'fallen'; c.active = false; c.t = 3.2;
          audio.play('land', 0.5);
          s.tweens.add({ targets: c.spr, y: c.y + 70, alpha: 0, duration: 450, ease: 'Quad.In' });
          s.fx.burst('rocks', c.x + c.w / 2, c.y + 4, 8);
        }
      } else if (c.state === 'fallen') {
        c.t -= dt;
        if (c.t <= 0) {
          c.state = 'idle'; c.active = true; c.spr.setPosition(c.x, c.y).setAlpha(0);
          s.tweens.add({ targets: c.spr, alpha: 1, duration: 400 });
        }
      }
    }

    // --- landing on platforms (one-way, from above)
    this.standing = null;
    if (!p.dead) {
      const b = p.body;
      const prevBottom = b.prev.y + b.height;
      const falling = b.velocity.y >= 0 || b.prev.y + b.height <= b.bottom;
      for (const o of this.solids()) {
        if (p.dropTimer > 0) break;
        const top = o.y, ptop = o.py;
        const overlapX = b.right > o.x + 1 && b.left < o.x + o.w - 1;
        if (!overlapX) continue;
        const wasAbove = prevBottom <= ptop + 3;
        const nowBelow = b.bottom >= top - 1 && b.bottom <= top + 10;
        const rising = b.velocity.y < -20;
        if (wasAbove && nowBelow && falling && !rising) {
          b.y += top - b.bottom;   // snap onto the surface
          b.setVelocityY(0);
          b.blocked.down = true; b.touching.down = true;
          this.standing = o;
          if (o.dx) b.x += o.dx;      // ride the platform
          if (o.dy > 0) b.y += 0;     // falling platforms: gravity keeps us glued
          break;
        }
      }
    }
    if (this.standing && this.standing.kind === 'crumble' && this.standing.state === 'idle') {
      this.standing.state = 'shake'; this.standing.t = 0.5;
      audio.play('shield', 0.3);
    }

    // --- saws
    for (const sw of this.saws) {
      sw.cd -= dt;
      if (sw.len > 0) {
        const span = sw.len * 2, q = ((sw.t += dt * sw.speed) % span + span) % span;
        const k = (q < sw.len ? q : span - q) / sw.len;
        sw.spr.setPosition(sw.x0 + (sw.x1 - sw.x0) * k, sw.y0 + (sw.y1 - sw.y0) * k);
      }
      sw.spr.rotation += dt * 14;
      sw.glow.setPosition(sw.spr.x, sw.spr.y);
      if (sw.cd <= 0 && !p.dead) {
        const r = new Phaser.Geom.Rectangle(sw.spr.x - 10, sw.spr.y - 10, 20, 20);
        if (s.hitPlayer(r, 28 * s.ngMul.dmg, sw.spr.x, 1.1)) {
          sw.cd = 0.7;
          s.fx.burst('sparks', sw.spr.x, sw.spr.y, 10);
          audio.play('clang', 0.5);
        }
      }
    }

    // --- wind zones
    for (const w of this.winds) {
      if (!p.dead && Phaser.Geom.Rectangle.Contains(w.r, p.x, p.y - 12) && p.state !== 'rest') {
        const b = p.body;
        if (w.fx) b.velocity.x = Phaser.Math.Clamp(b.velocity.x + w.fx * dt, -160, 160);
        if (w.fy) {
          b.velocity.y = Math.max(b.velocity.y + w.fy * dt, -170);
          p.usedDouble = false;
        }
      }
      // visible gusts
      w.emit -= dt;
      if (w.emit <= 0) {
        w.emit = 0.08;
        const view = s.cameras.main.worldView;
        if (Phaser.Geom.Rectangle.Overlaps(view, w.r)) {
          const g = s.add.image(w.r.x + Math.random() * w.r.width, w.r.y + Math.random() * w.r.height, 'gust').setAlpha(0.5).setDepth(22).setBlendMode('ADD');
          if (w.fx) g.setFlipX(w.fx < 0);
          if (w.fy) g.setAngle(w.fy < 0 ? -90 : 90);
          s.tweens.add({ targets: g, x: g.x + Math.sign(w.fx) * 60, y: g.y + Math.sign(w.fy) * 60, alpha: 0, duration: 700, onComplete: () => g.destroy() });
        }
      }
    }

    // --- bounce pads
    for (const bp of this.bouncers) {
      bp.cd -= dt;
      if (bp.cd > 0 || p.dead) continue;
      const b = p.body;
      if (Math.abs(b.center.x - bp.x) < 13 && b.bottom >= bp.y - 6 && b.bottom <= bp.y + 4 && b.velocity.y >= -20) {
        bp.cd = 0.4;
        b.setVelocityY(-500);
        p.usedDouble = false; p.usedDash = false;
        audio.play('djump');
        s.fx.burst('spirit', bp.x, bp.y - 4, 10);
        s.tweens.add({ targets: bp.spr, scaleY: 0.5, yoyo: true, duration: 90 });
      }
    }

    // --- ice: the floor loses its grip
    p.floorGrip = 1;
    if (!p.dead && p.grounded) {
      const b = p.body;
      for (const i of this.ice) {
        if (b.center.x >= i.x0 && b.center.x <= i.x1 && Math.abs(b.bottom - i.y) < 3) { p.floorGrip = 0.09; break; }
      }
    }
  }
}
