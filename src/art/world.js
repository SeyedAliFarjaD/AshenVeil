// Procedural textures for the world: tiles, parallax, FX, props, small enemies.
import { PixelCanvas, hex, shade, rng, registerSheet } from './pixel.js';
import { buildExpansionProps } from './expansion.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ tiles
// Tileset layout (16x16 each):
//  0..15  stone, index = exposed-edge mask (1 top, 2 right, 4 bottom, 8 left)
//  16     stone interior variant
//  17     one-way wooden platform
//  18     spikes
//  19,20  back wall bricks
//  21     lava
export const TILE = { PLATFORM: 17, SPIKES: 18, BACK: 19, BACK2: 20, ALT: 16, LAVA: 21 };

function drawStone(pc, ox, mask, seed) {
  const r = rng(seed);
  const base = hex('#2b2733'), mortar = hex('#18151e'), hi = hex('#3a3544');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(ox + x, y, base);
  // bricks
  const rows = [[0, 5, 0], [5, 10, 5], [10, 16, 2]];
  for (const [y0, y1, off] of rows) {
    for (let x = 0; x < 16; x++) pc.set(ox + x, y1 - 1, mortar);
    for (let x = off; x < 16; x += 8) for (let y = y0; y < y1; y++) pc.set(ox + x, y, mortar);
    for (let x = off + 1; x < 16; x += 8) pc.set(ox + x, y0, hi);
  }
  for (let i = 0; i < 10; i++) {
    const c = r() < 0.5 ? shade(base, 0.8) : shade(base, 1.18);
    pc.set(ox + Math.floor(r() * 16), Math.floor(r() * 16), c);
  }
  if (mask & 8) for (let y = 0; y < 16; y++) { pc.set(ox, y, hex('#100d14')); pc.set(ox + 1, y, hex('#363140')); }
  if (mask & 2) for (let y = 0; y < 16; y++) { pc.set(ox + 15, y, hex('#100d14')); pc.set(ox + 14, y, hex('#221e29')); }
  if (mask & 4) for (let x = 0; x < 16; x++) { pc.set(ox + x, 15, hex('#0e0c12')); pc.set(ox + x, 14, hex('#1d1a23')); }
  if (mask & 1) {
    for (let x = 0; x < 16; x++) {
      pc.set(ox + x, 0, hex('#6a6276'));
      pc.set(ox + x, 1, hex('#4a4455'));
      pc.set(ox + x, 2, hex('#332e3b'));
    }
    // moss tufts
    for (let x = 0; x < 16; x++) {
      const v = r();
      if (v < 0.55) pc.set(ox + x, 0, hex(v < 0.25 ? '#5f7a46' : '#435c37'));
      if (v < 0.2) pc.set(ox + x, 1, hex('#3a5030'));
      if (v < 0.08) { pc.set(ox + x, 2, hex('#2e4027')); pc.set(ox + x, 3, hex('#2e4027')); }
    }
    if (mask & 8) { pc.set(ox, 0, hex('#100d14')); }
    if (mask & 2) { pc.set(ox + 15, 0, hex('#100d14')); }
  }
}

function drawBackWall(pc, ox, seed, cracked) {
  const r = rng(seed);
  const base = hex('#17141d'), mortar = hex('#0e0c12'), hi = hex('#1e1a25');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.set(ox + x, y, base);
  for (const [y0, y1, off] of [[0, 8, 0], [8, 16, 4]]) {
    for (let x = 0; x < 16; x++) pc.set(ox + x, y1 - 1, mortar);
    for (let x = off; x < 16; x += 8) for (let y = y0; y < y1; y++) pc.set(ox + x, y, mortar);
    for (let x = off + 1; x < 16; x += 8) pc.set(ox + x, y0, hi);
  }
  for (let i = 0; i < 6; i++) pc.set(ox + Math.floor(r() * 16), Math.floor(r() * 16), shade(base, 0.75));
  if (cracked) {
    let x = 4 + Math.floor(r() * 8), y = 0;
    while (y < 16) { pc.set(ox + x, y, mortar); y++; if (r() < 0.4) x += r() < 0.5 ? -1 : 1; }
  }
}

export function buildTiles(scene) {
  const n = 22;
  const pc = new PixelCanvas(16 * n, 16);
  for (let m = 0; m < 16; m++) drawStone(pc, m * 16, m, 100 + m);
  drawStone(pc, 16 * 16, 0, 999);
  // platform
  const px = 17 * 16;
  for (let x = 0; x < 16; x++) {
    pc.set(px + x, 0, hex('#8a6440'));
    pc.set(px + x, 1, hex('#6a4a30'));
    pc.set(px + x, 2, hex('#5a3e28'));
    pc.set(px + x, 3, hex('#2e1f17'));
  }
  pc.set(px + 3, 1, hex('#2e1f17')); pc.set(px + 11, 1, hex('#2e1f17'));
  pc.set(px + 7, 2, hex('#3e2a1c'));
  for (let i = 0; i < 4; i++) { pc.set(px + 2 + i, 4 + i, hex('#3e2a1c')); pc.set(px + 13 - i, 4 + i, hex('#3e2a1c')); }
  // spikes
  const sx = 18 * 16;
  for (let k = 0; k < 4; k++) {
    const cx = sx + 2 + k * 4;
    for (let h = 0; h < 9; h++) {
      const w = Math.max(0, Math.round((9 - h) / 4.5));
      for (let i = -w; i <= w; i++) pc.set(cx + i, 15 - h, i < 0 ? hex('#8d929c') : hex('#4c5059'));
    }
    pc.set(cx, 6, hex('#c6cad2'));
    pc.set(cx, 7, hex('#7a2a24'));
  }
  for (let x = 0; x < 16; x++) pc.set(sx + x, 15, hex('#2a2a30'));
  drawBackWall(pc, 19 * 16, 7, false);
  drawBackWall(pc, 20 * 16, 8, true);
  // lava: bright molten surface with a dark crust
  {
    const lx = 21 * 16, r = rng(21);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = Math.sin(x * 0.7 + y * 0.4) + Math.sin(x * 0.3 - y * 0.9) + r() * 0.6;
        const c = y < 2 ? hex('#fff0a0') : v > 1.1 ? hex('#ffd25a') : v > 0 ? hex('#ff8a2a') : v > -1 ? hex('#d4421c') : hex('#5a1a10');
        pc.set(lx + x, y, c);
      }
    }
  }
  const canvas = pc.flush();
  if (scene.textures.exists('tiles')) scene.textures.remove('tiles');
  scene.textures.addCanvas('tiles', canvas);
}

// ------------------------------------------------------------------ parallax backgrounds
function wrapDraw(W, fn) { fn(0); fn(-W); fn(W); }

export function buildBackgrounds(scene) {
  const W = 480, Hh = 270;
  // sky
  {
    const pc = new PixelCanvas(W, Hh);
    const top = hex('#2b2140'), bot = hex('#0d0a13');
    for (let y = 0; y < Hh; y++) {
      const t = Math.min(1, y / (Hh * 0.9));
      // dithered gradient bands
      for (let x = 0; x < W; x++) {
        const tt = t + (((x + y) & 1) ? 0.012 : -0.012);
        const c = [0, 1, 2].map((k) => Math.round(top[k] + (bot[k] - top[k]) * Math.min(1, Math.max(0, tt))));
        pc.set(x, y, [...c, 255]);
      }
    }
    const r = rng(42);
    for (let i = 0; i < 90; i++) pc.set(Math.floor(r() * W), Math.floor(r() * 150), r() < 0.3 ? hex('#cfc6e0') : hex('#6f6588'));
    // moon + halo
    const mx = 370, my = 62;
    for (let rad = 44; rad > 22; rad -= 3) pc.disc(mx, my, rad, [180, 160, 200, 8]);
    pc.disc(mx, my, 20, hex('#d9d0c2'));
    pc.disc(mx + 4, my - 3, 17, hex('#e9e2d4'));
    pc.disc(mx - 6, my + 5, 3, hex('#bfb5a5'));
    pc.disc(mx + 7, my + 8, 2, hex('#c7bdad'));
    pc.disc(mx - 2, my - 8, 2, hex('#cbc1b1'));
    scene.textures.addCanvas('bg_sky', pc.flush());
  }
  // far castle
  {
    const pc = new PixelCanvas(W, Hh);
    const c = hex('#211b2e'), win = hex('#a8642c');
    const r = rng(7);
    const towers = [];
    for (let x = 0; x < W; x += 18 + Math.floor(r() * 30)) towers.push([x, 8 + Math.floor(r() * 12), 70 + Math.floor(r() * 90)]);
    wrapDraw(W, (o) => {
      pc.rect(0 + o, 200, W, 70, c);
      for (const [x, w, h] of towers) {
        pc.rect(x + o, 210 - h, w, h, c);
        // spire
        for (let i = 0; i < w / 2 + 6; i++) pc.rect(x + o + Math.min(i, w / 2) * 0 + i * 0.5, 210 - h - i, Math.max(1, w - i), 1, c);
        // battlements
        for (let k = 0; k < w; k += 4) pc.rect(x + o + k, 210 - h - 2, 2, 2, c);
      }
    });
    for (const [x, w, h] of towers) {
      if (r() < 0.6) {
        const wx = x + Math.floor(w / 2), wy = 215 - h + 12 + Math.floor(r() * 30);
        wrapDraw(W, (o) => { pc.rect(wx + o, wy, 1, 2, win); });
      }
    }
    scene.textures.addCanvas('bg_far', pc.flush());
  }
  // mid ruins (arches + pillars)
  {
    const pc = new PixelCanvas(W, Hh);
    const c = hex('#15111c'), c2 = hex('#1c1724');
    wrapDraw(W, (o) => {
      pc.rect(o, 236, W, 34, c);
      for (let x = 0; x < W; x += 120) {
        const ax = x + o;
        // two pillars + arch
        pc.rect(ax + 10, 120, 12, 120, c);
        pc.rect(ax + 78, 140, 12, 100, c);
        for (let a = 0; a <= 180; a += 2) {
          const t = a * Math.PI / 180;
          const cx = ax + 50, cy = 130;
          for (let th = 0; th < 8; th++) pc.set(cx - Math.cos(t) * (40 - th), cy - Math.sin(t) * (34 - th) + (x % 240 === 0 && a > 120 ? 999 : 0), c);
        }
        pc.rect(ax + 12, 122, 2, 116, c2);
        // rubble
        pc.rect(ax + 95, 228, 14, 8, c);
        pc.rect(ax + 100, 222, 6, 6, c);
      }
    });
    scene.textures.addCanvas('bg_mid', pc.flush());
  }
  // fog band
  {
    const pc = new PixelCanvas(W, 90);
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = 30 + r() * 50, rad = 8 + r() * 22;
      wrapDraw(W, (o) => pc.disc(x + o, y, rad, [150, 140, 175, 10]));
    }
    scene.textures.addCanvas('bg_fog', pc.flush());
  }
}

// ------------------------------------------------------------------ FX
function arcStrip(scene, key, w, h, cx, cy, R, maxT, a0, a1, core, edge) {
  const frames = 4;
  const pc = new PixelCanvas(w * frames, h);
  for (let f = 0; f < frames; f++) {
    pc.cell(f * w, 0, w, h);
    const uStart = [0, 0.15, 0.45, 0.75][f];
    const thinMul = [1, 0.85, 0.6, 0.35][f];
    const alpha = [255, 235, 170, 90][f];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        let a = Math.atan2(dy, dx);
        const u = (a - a0) / (a1 - a0);
        if (u < uStart || u > 1) continue;
        const thick = maxT * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.6) * thinMul;
        const inner = R - thick;
        if (r > R || r < inner) continue;
        const k = (r - inner) / Math.max(1, thick);
        const c = k > 0.6 ? core : edge;
        pc.set(x, y, [c[0], c[1], c[2], alpha]);
      }
    }
  }
  registerSheet(scene, key, pc.flush(), w, h, frames);
  scene.anims.create({ key, frames: [0, 1, 2, 3].map((i) => ({ key, frame: i })), frameRate: 24, repeat: 0 });
}

export function buildFX(scene) {
  const D = Math.PI / 180;
  arcStrip(scene, 'slash', 64, 64, 18, 32, 28, 9, -105 * D, 55 * D, hex('#ffffff'), hex('#9fdcff'));
  arcStrip(scene, 'slashBig', 80, 80, 24, 40, 36, 13, -110 * D, 70 * D, hex('#fff6dc'), hex('#ffb35c'));
  arcStrip(scene, 'bslash', 140, 120, 40, 60, 62, 18, -110 * D, 60 * D, hex('#fff1d6'), hex('#ff7a2a'));

  const simple = (key, w, h, draw, linear = false) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
    if (linear) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  simple('px', 2, 2, (pc) => pc.rect(0, 0, 2, 2, hex('#ffffff')));
  simple('px1', 1, 1, (pc) => pc.rect(0, 0, 1, 1, hex('#ffffff')));
  simple('spark', 5, 5, (pc) => { pc.rect(2, 0, 1, 5, hex('#ffffff')); pc.rect(0, 2, 5, 1, hex('#ffffff')); });
  simple('dust', 4, 4, (pc) => pc.disc(1.5, 1.5, 1.8, hex('#ffffff')));
  // impact shockwave: a thin hollow ring, scaled up and faded by FX.ring()
  simple('ring', 24, 24, (pc) => {
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const r = Math.hypot(x - 11.5, y - 11.5);
        if (r <= 11 && r >= 9.2) pc.set(x, y, hex('#ffffff', r > 10.2 ? 255 : 170));
      }
    }
  });
  // cut line: a long, needle-thin slash that tapers to points at both ends
  simple('cutline', 64, 3, (pc) => {
    for (let x = 0; x < 64; x++) {
      const t = 1 - Math.abs(x - 31.5) / 32;
      if (t > 0.04) pc.set(x, 1, hex('#ffffff'));
      if (t > 0.5) { pc.set(x, 0, hex('#ffffff', 200)); pc.set(x, 2, hex('#ffffff', 200)); }
    }
  });
  // icicle: a falling shard of ice, point down (Rimebound boss)
  simple('icicle', 7, 16, (pc) => {
    for (let y = 0; y < 16; y++) {
      const half = 3 * (1 - y / 16);
      for (let x = -3; x <= 3; x++) {
        if (Math.abs(x) > half + 0.2) continue;
        pc.set(3 + x, y, Math.abs(x) >= half - 0.8 ? hex('#ffffff') : hex(x < 0 ? '#d8f2ff' : '#8ac8ef'));
      }
    }
  });
  // speed streak: bright head, fading tail (origin at the tail)
  simple('streak', 8, 1, (pc) => { for (let x = 0; x < 8; x++) pc.set(x, 0, hex('#ffffff', 60 + x * 27)); });
  // parry star: a four-point glint
  simple('star', 15, 15, (pc) => {
    for (let i = 0; i <= 7; i++) {
      const w = Math.max(0, 2 - Math.floor(i / 3));
      for (let k = -w; k <= w; k++) {
        const a = k === 0 ? 255 : 150;
        pc.set(7 + i, 7 + k, hex('#ffffff', a)); pc.set(7 - i, 7 + k, hex('#ffffff', a));
        pc.set(7 + k, 7 + i, hex('#ffffff', a)); pc.set(7 + k, 7 - i, hex('#ffffff', a));
      }
    }
  });
  // soft glow via canvas gradient
  const glow = (key, size) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    scene.textures.addCanvas(key, c);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  glow('glow', 128);
  // soft contact shadow: a dark blurred ellipse
  {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 16;
    const g = c.getContext('2d');
    g.translate(32, 8); g.scale(1, 0.25);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
    scene.textures.addCanvas('shadow', c);
    scene.textures.get('shadow').setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  // boss ground shockwave (3 frames)
  {
    const w = 18, h = 26, n = 3;
    const pc = new PixelCanvas(w * n, h);
    for (let f = 0; f < n; f++) {
      pc.cell(f * w, 0, w, h);
      const r = rng(30 + f);
      for (let i = 0; i < 40; i++) {
        const x = 3 + r() * 12, top = h - 4 - r() * (16 + f * 2);
        const c = r() < 0.4 ? hex('#fff0b0') : r() < 0.7 ? hex('#ff9a3a') : hex('#d4421c');
        pc.line(x, h - 1, x + (r() - 0.5) * 3, top, c, 1);
      }
    }
    registerSheet(scene, 'wave', pc.flush(), w, h, n);
    scene.anims.create({ key: 'wave', frames: [0, 1, 2].map((i) => ({ key: 'wave', frame: i })), frameRate: 14, repeat: -1 });
  }
  // fire pillar (4 frames)
  {
    const w = 28, h = 96, n = 4;
    const pc = new PixelCanvas(w * n, h);
    for (let f = 0; f < n; f++) {
      pc.cell(f * w, 0, w, h);
      const r = rng(50 + f);
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const half = 4 + t * 7 + Math.sin(y * 0.3 + f * 1.7) * 2;
        for (let x = -half; x <= half; x++) {
          const k = Math.abs(x) / half;
          if (r() < 0.12 * (1 - t)) continue;
          const c = k < 0.35 ? hex('#fff3c4') : k < 0.7 ? hex('#ffa040') : hex('#c8361a');
          pc.set(w / 2 + x, y, c);
        }
      }
    }
    registerSheet(scene, 'pillar', pc.flush(), w, h, n);
    scene.anims.create({ key: 'pillar', frames: [0, 1, 2, 3].map((i) => ({ key: 'pillar', frame: i })), frameRate: 16, repeat: -1 });
  }
  simple('mark', 32, 6, (pc) => {
    for (let x = 0; x < 32; x++) {
      const k = 1 - Math.abs(x - 15.5) / 16;
      pc.rect(x, 5 - Math.round(k * 3), 1, Math.round(k * 3) + 1, [255, 110, 40, Math.round(120 + k * 120)]);
    }
  });
}

// ------------------------------------------------------------------ wisp (flying skull)
export function buildWisp(scene) {
  const w = 32, h = 28, n = 4;
  const pc = new PixelCanvas(w * n, h);
  const bone = hex('#ddd5c0'), boneD = hex('#9d947f'), flame = hex('#8a7dff'), flameL = hex('#d2c9ff'), dark = hex('#14101c');
  for (let f = 0; f < n; f++) {
    pc.cell(f * w, 0, w, h);
    const flap = Math.sin(f / n * TAU);
    const cx = 16, cy = 14 + Math.round(flap);
    // wings (spectral flames)
    for (const s of [-1, 1]) {
      const tipX = cx + s * 14, tipY = cy - 6 - flap * 6;
      pc.poly([[cx + s * 3, cy - 2], [tipX, tipY], [cx + s * 10, cy + 1 + flap * 2], [cx + s * 4, cy + 3]], flame);
      pc.line(cx + s * 4, cy - 1, tipX - s * 2, tipY + 2, flameL, 1);
    }
    pc.disc(cx, cy - 1, 5.2, bone);
    pc.rect(cx - 3, cy + 3, 7, 3, bone);
    pc.rect(cx - 2, cy + 6, 1, 1, boneD); pc.rect(cx, cy + 6, 1, 1, boneD); pc.rect(cx + 2, cy + 6, 1, 1, boneD);
    pc.disc(cx - 2, cy, 1.4, dark); pc.disc(cx + 2.5, cy, 1.4, dark);
    pc.set(cx - 2, cy, hex('#ff5a3a')); pc.set(cx + 2, cy, hex('#ff5a3a'));
    pc.set(cx, cy + 2, dark);
    pc.rect(cx - 4, cy - 5, 3, 1, hex('#f3ecd9'));
  }
  pc.cell(0, 0, pc.w, pc.h); pc.ox = 0;
  for (let f = 0; f < n; f++) pc.outline(f * w, 0, w, h, hex('#0b0910'));
  registerSheet(scene, 'wisp', pc.flush(), w, h, n);
  scene.anims.create({ key: 'wisp_fly', frames: [0, 1, 2, 3].map((i) => ({ key: 'wisp', frame: i })), frameRate: 10, repeat: -1 });
}

// ------------------------------------------------------------------ props
export function buildProps(scene) {
  // bonfire: frames 0..5 lit, frame 6 unlit
  {
    const w = 32, h = 44, n = 7;
    const pc = new PixelCanvas(w * n, h);
    for (let f = 0; f < n; f++) {
      pc.cell(f * w, 0, w, h);
      // ash mound + bones
      pc.poly([[4, 44], [9, 37], [16, 35], [23, 37], [28, 44]], hex('#3b3638'));
      pc.poly([[7, 44], [11, 39], [16, 38], [21, 39], [25, 44]], hex('#55504f'));
      pc.rect(8, 41, 3, 1, hex('#bdb3a0')); pc.rect(21, 42, 3, 1, hex('#bdb3a0'));
      // coiled sword
      pc.line(17, 38, 14, 9, hex('#6c6a70'), 2);
      pc.line(17, 37, 14.5, 10, hex('#a9a6ad'), 1);
      pc.rect(11, 13, 7, 1, hex('#5a4630'));
      pc.line(15, 12, 14, 7, hex('#4a3a28'), 2);
      for (let k = 0; k < 4; k++) pc.line(12, 18 + k * 5, 19, 20 + k * 5, hex('#2e2a2c'), 1);
      if (f < 6) {
        const r = rng(200 + f);
        for (let i = 0; i < 70; i++) {
          const t = r();
          const fx = 16 + (r() - 0.5) * 16 * (1 - t * 0.7) + Math.sin(f + t * 6) * 1.5;
          const fy = 38 - t * 26;
          const c = t < 0.25 ? hex('#fff2b0') : t < 0.6 ? hex('#ffb040') : hex('#e0501c');
          pc.line(fx, fy, fx + (r() - 0.5), fy - 2 - r() * 3, c, 1);
        }
      } else {
        pc.set(13, 39, hex('#e0501c')); pc.set(19, 40, hex('#ffb040'));
      }
    }
    registerSheet(scene, 'bonfire', pc.flush(), w, h, n);
    scene.anims.create({ key: 'bonfire_lit', frames: [0, 1, 2, 3, 4, 5].map((i) => ({ key: 'bonfire', frame: i })), frameRate: 10, repeat: -1 });
  }
  // wall torches (4 frames): orange fire, and cyan spirit flame for the crypt
  for (const [key, cols] of [['torch', ['#fff2b0', '#ffb040', '#e0501c']], ['torch_spirit', ['#eaffff', '#7affd8', '#2a8a9a']]]) {
    const w = 12, h = 22, n = 4;
    const pc = new PixelCanvas(w * n, h);
    for (let f = 0; f < n; f++) {
      pc.cell(f * w, 0, w, h);
      pc.rect(4, 12, 4, 2, hex('#4a4048')); pc.rect(5, 14, 2, 7, hex('#3a3238'));
      const r = rng(300 + f);
      for (let i = 0; i < 26; i++) {
        const t = r();
        const fx = 6 + (r() - 0.5) * 5 * (1 - t);
        const fy = 12 - t * 10;
        pc.set(fx, fy, hex(t < 0.3 ? cols[0] : t < 0.65 ? cols[1] : cols[2]));
      }
    }
    registerSheet(scene, key, pc.flush(), w, h, n);
    scene.anims.create({ key, frames: [0, 1, 2, 3].map((i) => ({ key, frame: i })), frameRate: 9, repeat: -1 });
  }
  const simple = (key, w, h, draw) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
  };
  simple('feather', 16, 20, (pc) => {
    pc.line(4, 18, 12, 2, hex('#c9a24a'), 1);
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const x = 4 + 8 * t, y = 18 - 16 * t;
      const len = 4 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
      pc.line(x, y, x - len, y - len * 0.4, hex('#fff6dd'), 1);
      pc.line(x, y, x + len * 0.8, y + len * 0.2, hex('#ffe3a0'), 1);
    }
    pc.outline(0, 0, 16, 20, hex('#2a1a10'));
  });
  simple('altar', 28, 18, (pc) => {
    pc.rect(2, 14, 24, 4, hex('#3a3544'));
    pc.rect(6, 4, 16, 10, hex('#2f2a38'));
    pc.rect(4, 2, 20, 3, hex('#4a4455'));
    pc.rect(4, 2, 20, 1, hex('#6a6276'));
    pc.rect(9, 7, 10, 1, hex('#c9a24a'));
    pc.outline(0, 0, 28, 18, hex('#0b0910'));
  });
  simple('message', 18, 6, (pc) => {
    const c = hex('#ff9a3a');
    const r = rng(77);
    for (let i = 0; i < 14; i++) pc.set(1 + Math.floor(r() * 16), 1 + Math.floor(r() * 4), c);
    pc.line(2, 3, 6, 2, c); pc.line(8, 4, 12, 2, c); pc.line(13, 3, 16, 4, c);
  });
  simple('fog', 16, 64, (pc) => {
    const r = rng(11);
    for (let i = 0; i < 60; i++) pc.disc(r() * 16, r() * 64, 2 + r() * 4, [235, 235, 255, 26]);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) if (r() < 0.04) pc.set(x, y, [255, 255, 255, 90]);
  });
  simple('banner', 14, 40, (pc) => {
    pc.rect(0, 0, 14, 2, hex('#4a3a28'));
    pc.poly([[1, 2], [13, 2], [13, 34], [10, 30], [7, 38], [4, 31], [1, 36]], hex('#5e1a22'));
    pc.poly([[3, 6], [11, 6], [11, 26], [3, 26]], hex('#7a2430'));
    pc.line(7, 9, 7, 22, hex('#c39a3e')); pc.line(4, 13, 10, 13, hex('#c39a3e'));
    pc.outline(0, 0, 14, 40, hex('#0b0910'));
  });
  simple('chain', 5, 48, (pc) => {
    for (let y = 0; y < 48; y += 4) { pc.rect(1, y, 3, 3, hex('#3a3842')); pc.set(2, y + 1, hex('#14121a')); }
  });
  simple('column', 20, 80, (pc) => {
    pc.rect(3, 6, 14, 74, hex('#221e2a'));
    pc.rect(5, 6, 2, 74, hex('#2c2735'));
    pc.rect(13, 6, 2, 74, hex('#1a1720'));
    pc.rect(0, 0, 20, 6, hex('#2a2532'));
    pc.poly([[3, 6], [17, 6], [17, 2], [12, 0], [6, 3]], hex('#221e2a'));
  });
  // UI icons
  simple('icon_flask', 10, 14, (pc) => {
    pc.rect(4, 0, 2, 3, hex('#c9b38a'));
    pc.disc(4.5, 8.5, 4.3, hex('#ffb347'));
    pc.disc(3.5, 7.5, 1.5, hex('#fff2c4'));
    pc.outline(0, 0, 10, 14, hex('#1a0e08'));
  });
  simple('icon_flask_empty', 10, 14, (pc) => {
    pc.rect(4, 0, 2, 3, hex('#7a6c55'));
    pc.disc(4.5, 8.5, 4.3, hex('#3a3440'));
    pc.outline(0, 0, 10, 14, hex('#1a0e08'));
  });
  simple('icon_ember', 10, 10, (pc) => {
    pc.poly([[5, 0], [9, 5], [5, 10], [1, 5]], hex('#ff9a3a'));
    pc.poly([[5, 2], [7, 5], [5, 8], [3, 5]], hex('#fff0b0'));
  });
}

// ------------------------------------------------------------------ level 2 props
export function buildCryptProps(scene) {
  const simple = (key, w, h, draw) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
  };
  // soul orb projectile
  simple('orb', 12, 12, (pc) => {
    pc.disc(5.5, 5.5, 5, [127, 240, 255, 90]);
    pc.disc(5.5, 5.5, 3.6, hex('#7ff0ff'));
    pc.disc(5, 5, 2, hex('#e8ffff'));
  });
  // Gravecrawler's Claw: a bone gauntlet with hooked talons
  const claw = (pc, ox, oy, k) => {
    pc.rect(ox + 3, oy + 8, 7, 6, hex('#5a4a3a'));
    pc.rect(ox + 3, oy + 8, 7, 1, hex('#7a6a52'));
    for (let i = 0; i < 4; i++) {
      const x = ox + 3 + i * 2;
      pc.line(x, oy + 8, x - 1, oy + 3, hex('#e2d8c0'), 1);
      pc.set(x - 2, oy + 2, hex('#e2d8c0'));
    }
    pc.set(ox + 6, oy + 11, hex('#7affd8'));
    pc.outline(ox, oy, 14 * k, 16 * k, hex('#120c08'));
  };
  simple('claw', 14, 16, (pc) => claw(pc, 0, 0, 1));
  simple('icon_claw', 14, 16, (pc) => claw(pc, 0, 0, 1));
  // water surface strip (tiles horizontally)
  simple('watersurf', 32, 4, (pc) => {
    for (let x = 0; x < 32; x++) {
      const h = Math.round(1 + Math.sin(x / 32 * Math.PI * 4));
      pc.rect(x, 2 - h, 1, 1, [190, 240, 255, 200]);
      pc.rect(x, 3 - h, 1, 2, [120, 200, 220, 110]);
    }
  });
}

// ------------------------------------------------------------------ level 3 props
export function buildCathedralProps(scene) {
  const simple = (key, w, h, draw) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
  };
  simple('fireorb', 12, 12, (pc) => {
    pc.disc(5.5, 5.5, 5, [255, 140, 40, 90]);
    pc.disc(5.5, 5.5, 3.6, hex('#ff9a3a'));
    pc.disc(5, 5, 2, hex('#fff2b0'));
  });
  // stained-glass window: lancet arch with colored panes and lead lines
  simple('window', 28, 56, (pc) => {
    const r = rng(33);
    const cols = ['#c0392b', '#e67e22', '#8e44ad', '#d4a017', '#a93226', '#6c3483'];
    const inside = (x, y) => {
      if (y >= 14) return x >= 3 && x <= 24 && y <= 53;
      const dx = Math.abs(x - 13.5), dy = 14 - y;
      return dx * dx / 110 + dy * dy / 150 <= 1;
    };
    for (let y = 0; y < 56; y++) for (let x = 0; x < 28; x++) {
      if (!inside(x, y)) continue;
      const cell = Math.floor(x / 5) + Math.floor(y / 7) * 7;
      pc.set(x, y, hex(cols[(cell * 7 + 3) % cols.length]));
      if (x % 5 === 0 || y % 7 === 0 || r() < 0.03) pc.set(x, y, hex('#1a1014'));
    }
    pc.rect(13, 14, 1, 40, hex('#1a1014'));
    pc.outline(0, 0, 28, 56, hex('#3a2a2c'));
  });
  // floor fire vent (grate)
  simple('vent', 18, 5, (pc) => {
    pc.rect(0, 1, 18, 4, hex('#2a2224'));
    for (let x = 2; x < 17; x += 3) pc.rect(x, 2, 1, 2, hex('#ff7a2a'));
    pc.rect(0, 1, 18, 1, hex('#5a4a48'));
  });
  // Cinder Wings: a pair of burning wings
  const wings = (pc) => {
    for (const sx of [-1, 1]) {
      const cx = 8;
      pc.poly([[cx, 10], [cx + sx * 7, 2], [cx + sx * 8, 7], [cx + sx * 6, 12], [cx + sx * 2, 13]], hex('#ff8a3a'));
      pc.line(cx + sx, 10, cx + sx * 6, 4, hex('#fff0b0'), 1);
      pc.line(cx + sx * 2, 12, cx + sx * 6, 10, hex('#ffd25a'), 1);
    }
    pc.disc(8, 11, 1.5, hex('#fff6dd'));
    pc.outline(0, 0, 17, 16, hex('#2a0e06'));
  };
  simple('cinder', 17, 16, wings);
  simple('icon_cinder', 17, 16, wings);
}

// ------------------------------------------------------------------ level 4 props (Frozen Belfry)
export function buildBelfryProps(scene) {
  const simple = (key, w, h, draw) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
  };
  // wall anchor: an iron ring bolted to the stone (grapple target)
  simple('anchor', 20, 20, (pc) => {
    pc.disc(10, 10, 8, hex('#3a4450'));
    pc.disc(10, 10, 6.4, hex('#222a33'));
    pc.disc(10, 10, 4.6, hex('#10161d'));
    for (let a = 0; a < Math.PI * 2; a += 0.5) pc.set(10 + Math.cos(a) * 7.2, 10 + Math.sin(a) * 7.2, hex('#8fa8c8'));
    pc.line(10, 3, 10, 6, hex('#c8d8e8'), 1);
    pc.outline(0, 0, 20, 20, hex('#070a0e'));
  });
  // Rimeward Grapple: a hooked claw with a coil of rope
  const hook = (pc) => {
    pc.rect(3, 12, 11, 3, hex('#4a3a28'));       // coil
    pc.rect(3, 12, 11, 1, hex('#6a5442'));
    for (let k = 0; k < 3; k++) pc.line(4 + k * 4, 13, 4 + k * 4, 15, hex('#2e241c'), 1);
    pc.line(8, 12, 8, 8, hex('#c8d8e8'), 1);     // shank
    // hook proper
    pc.line(8, 8, 8, 4, hex('#c8d8e8'), 1);
    pc.line(8, 4, 11, 3, hex('#c8d8e8'), 1);
    pc.line(11, 3, 12, 5, hex('#c8d8e8'), 1);
    pc.line(12, 5, 10, 6, hex('#c8d8e8'), 1);
    pc.set(8, 8, hex('#ffffff'));
    pc.disc(8, 12, 1.2, hex('#9fd8ff'));
    pc.outline(0, 0, 17, 17, hex('#0a0e14'));
  };
  simple('hook', 17, 17, hook);
  simple('icon_hook', 17, 17, hook);
}

export function buildWorld(scene) {
  buildCryptProps(scene);
  buildCathedralProps(scene);
  buildBelfryProps(scene);
  buildExpansionProps(scene);
  buildTiles(scene);
  buildBackgrounds(scene);
  buildFX(scene);
  buildWisp(scene);
  buildProps(scene);
}
