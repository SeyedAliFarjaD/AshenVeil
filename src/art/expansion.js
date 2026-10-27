// Procedural textures for levels 5-8: hazards, platforms, projectiles, new pickups.
import { PixelCanvas, hex, shade, registerSheet } from './pixel.js';

const TAU = Math.PI * 2;

export function buildExpansionProps(scene) {
  const simple = (key, w, h, draw) => {
    const pc = new PixelCanvas(w, h);
    draw(pc);
    scene.textures.addCanvas(key, pc.flush());
  };

  // arrow: shaft, steel head on the right, feathers on the left
  simple('arrow', 14, 5, (pc) => {
    pc.rect(1, 2, 11, 1, hex('#a88a5a'));
    pc.rect(0, 1, 3, 1, hex('#e8e0c8')); pc.rect(0, 3, 3, 1, hex('#e8e0c8'));
    pc.poly([[12, 0.5], [14, 2.5], [12, 4.5]], hex('#d8dce4'));
  });
  // bomb: a black powder keg with a lit fuse
  simple('bomb', 11, 12, (pc) => {
    pc.disc(5.5, 7, 4.6, hex('#2a2622'));
    pc.disc(4.2, 5.6, 1.5, hex('#4a443c'));
    pc.rect(4, 1, 2, 3, hex('#8a6a3a'));
    pc.set(5, 0, hex('#ffcf5a')); pc.set(6, 0, hex('#ff7a2a'));
    pc.outline(0, 0, 11, 12, hex('#0a0806'));
  });
  // molten drop (forge golem / foundry)
  simple('drop', 7, 11, (pc) => {
    pc.poly([[3.5, 0], [6.5, 6], [3.5, 10.5], [0.5, 6]], hex('#ff8a2a'));
    pc.poly([[3.5, 3], [5, 6.5], [3.5, 9], [2, 6.5]], hex('#fff0b0'));
  });
  // spider: 4-frame crawl, drawn facing right
  {
    const w = 28, h = 18, n = 4;
    const pc = new PixelCanvas(w * n, h);
    const body = hex('#2c2a34'), bodyL = hex('#4e4a5c'), leg = hex('#1c1a22'), eye = hex('#ff4a5a');
    for (let f = 0; f < n; f++) {
      pc.cell(f * w, 0, w, h);
      const cx = 14, cy = 9;
      for (let i = 0; i < 4; i++) {
        const ph = (f / n + i * 0.25) % 1;
        const lift = Math.sin(ph * TAU) * 2.2;
        for (const s of [-1, 1]) {
          const bx = cx + s * 2 + (i - 1.5) * 1.6;
          const kx = bx + s * 6, ky = cy - 6 + (s > 0 ? lift : -lift) * 0.4;
          const fx = bx + s * (9 + i * 0.6), fy = cy + 7 - Math.max(0, lift) * 0.8;
          pc.line(bx, cy, kx, ky, leg, 1);
          pc.line(kx, ky, fx, fy, leg, 1);
        }
      }
      pc.disc(cx - 3, cy + 1, 4.6, body);   // abdomen
      pc.disc(cx + 4, cy, 3.4, body);       // head
      pc.disc(cx - 4, cy - 0.5, 1.8, bodyL);
      pc.set(cx + 6, cy - 1, eye); pc.set(cx + 5, cy - 2, eye);
    }
    pc.cell(0, 0, pc.w, pc.h); pc.ox = 0;
    for (let f = 0; f < n; f++) pc.outline(f * w, 0, w, h, hex('#08070b'));
    registerSheet(scene, 'spider', pc.flush(), w, h, n);
    scene.anims.create({ key: 'spider_crawl', frames: [0, 1, 2, 3].map((i) => ({ key: 'spider', frame: i })), frameRate: 12, repeat: -1 });
  }
  // saw blade: a toothed steel disc (rotated by the game)
  simple('saw', 28, 28, (pc) => {
    const c = 14;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, a2 = a + TAU / 24;
      pc.poly([[c + Math.cos(a - 0.15) * 9, c + Math.sin(a - 0.15) * 9], [c + Math.cos(a2) * 13.4, c + Math.sin(a2) * 13.4], [c + Math.cos(a + 0.28) * 9, c + Math.sin(a + 0.28) * 9]], hex('#c8ccd4'));
    }
    pc.disc(c, c, 10, hex('#8a909c'));
    pc.disc(c, c, 8, hex('#a6acb8'));
    pc.disc(c, c, 3.2, hex('#3a3e48'));
    pc.disc(c, c, 1.6, hex('#14161c'));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; pc.line(c, c, c + Math.cos(a) * 7, c + Math.sin(a) * 7, hex('#6a707c'), 1); }
    pc.outline(0, 0, 28, 28, hex('#07080a'));
  });
  // rail marker the saw rides on
  simple('rail', 8, 4, (pc) => { pc.rect(0, 1, 8, 2, hex('#2a2c34')); pc.rect(0, 1, 8, 1, hex('#4a4e5c')); });

  // platforms: tiled horizontally in 16px pieces
  simple('plat_move', 16, 8, (pc) => {
    pc.rect(0, 0, 16, 8, hex('#4a4e5c'));
    pc.rect(0, 0, 16, 2, hex('#8a92a6'));
    pc.rect(0, 6, 16, 2, hex('#2a2c38'));
    pc.rect(0, 2, 1, 4, hex('#363a48')); pc.rect(15, 2, 1, 4, hex('#363a48'));
    pc.set(4, 4, hex('#a8b0c4')); pc.set(11, 4, hex('#a8b0c4'));
    pc.outline(0, 0, 16, 8, hex('#07080a'));
  });
  simple('plat_crumble', 16, 8, (pc) => {
    pc.rect(0, 0, 16, 8, hex('#6a5a48'));
    pc.rect(0, 0, 16, 2, hex('#9a8a70'));
    pc.rect(0, 5, 16, 3, hex('#3e3428'));
    for (const [x, y] of [[3, 3], [8, 4], [12, 3]]) pc.set(x, y, hex('#2a2218'));
    pc.line(5, 2, 7, 7, hex('#2a2218'), 1);
    pc.line(10, 2, 9, 6, hex('#2a2218'), 1);
    pc.outline(0, 0, 16, 8, hex('#0a0806'));
  });
  simple('plat_ice', 16, 8, (pc) => {
    pc.rect(0, 0, 16, 8, hex('#7ab8e0'));
    pc.rect(0, 0, 16, 2, hex('#d8f2ff'));
    pc.rect(0, 5, 16, 3, hex('#4a88b8'));
    pc.line(3, 3, 6, 5, hex('#eaf8ff'), 1); pc.line(10, 2, 13, 4, hex('#eaf8ff'), 1);
    pc.outline(0, 0, 16, 8, hex('#06101a'));
  });
  simple('icefloor', 16, 3, (pc) => {
    pc.rect(0, 0, 16, 3, hex('#bfe8ff', 120));
    pc.rect(0, 0, 16, 1, hex('#ffffff', 190));
    pc.set(4, 2, hex('#ffffff', 220)); pc.set(11, 1, hex('#ffffff', 220));
  });
  // bounce pad: a coiled spring under a plate
  simple('bounce', 20, 10, (pc) => {
    pc.rect(1, 0, 18, 3, hex('#e0a83a'));
    pc.rect(1, 0, 18, 1, hex('#ffe08a'));
    for (let y = 3; y < 8; y += 2) { pc.line(3, y, 17, y + 1, hex('#8a8e9a'), 1); }
    pc.rect(0, 8, 20, 2, hex('#3a3e48'));
    pc.outline(0, 0, 20, 10, hex('#07080a'));
  });
  // wind streak particle
  simple('gust', 10, 2, (pc) => { for (let x = 0; x < 10; x++) pc.set(x, 0, hex('#ffffff', 40 + x * 20)); });

  // pickups: Ashen Mantle (glide), and relic shards
  const mantle = (pc) => {
    pc.poly([[2, 3], [14, 3], [16, 16], [8, 12], [0, 16]], hex('#5a6a88'));
    pc.poly([[4, 4], [12, 4], [13, 12], [8, 10], [3, 12]], hex('#8aa0c8'));
    pc.rect(1, 2, 14, 2, hex('#d8c070'));
    pc.set(8, 3, hex('#fff2c4'));
    pc.outline(0, 0, 17, 18, hex('#070a10'));
  };
  simple('mantle', 17, 18, mantle);
  simple('icon_mantle', 17, 18, mantle);
  const relic = (pc) => {
    pc.poly([[7, 0], [13, 7], [7, 14], [1, 7]], hex('#c9a8ff'));
    pc.poly([[7, 2], [11, 7], [7, 12], [3, 7]], hex('#efe0ff'));
    pc.set(6, 5, hex('#ffffff'));
    pc.outline(0, 0, 14, 15, hex('#0a0610'));
  };
  simple('relic', 14, 15, relic);
  simple('icon_relic', 14, 15, relic);
}
