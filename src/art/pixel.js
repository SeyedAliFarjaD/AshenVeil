// Tiny software rasterizer for crisp, procedural pixel art.
// Everything is drawn at 1:1 pixel scale into an ImageData buffer,
// then turned into a canvas that Phaser can use as a texture.

export function hex(h, a = 255) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function shade(c, f) {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * f))),
    Math.max(0, Math.min(255, Math.round(c[1] * f))),
    Math.max(0, Math.min(255, Math.round(c[2] * f))),
    c[3],
  ];
}

// Deterministic RNG so generated art is identical every run.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.data = this.img.data;
    // Clip region (used to keep each animation frame inside its cell).
    this.cx0 = 0; this.cy0 = 0; this.cx1 = w; this.cy1 = h;
    this.ox = 0; this.oy = 0;
  }

  cell(x, y, w, h) {
    this.ox = x; this.oy = y;
    this.cx0 = x; this.cy0 = y; this.cx1 = x + w; this.cy1 = y + h;
  }

  set(x, y, c) {
    x = Math.round(x) + this.ox;
    y = Math.round(y) + this.oy;
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    const i = (y * this.w + x) * 4;
    const a = c[3] === undefined ? 255 : c[3];
    if (a >= 255) {
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
    } else if (a > 0) {
      // simple "over" blend
      const da = this.data[i + 3] / 255, sa = a / 255;
      const oa = sa + da * (1 - sa);
      for (let k = 0; k < 3; k++) {
        this.data[i + k] = Math.round((c[k] * sa + this.data[i + k] * da * (1 - sa)) / (oa || 1));
      }
      this.data[i + 3] = Math.round(oa * 255);
    }
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  disc(cx, cy, r, c) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  // Thick line using a square brush (reads well as pixel art).
  line(x0, y0, x1, y1, c, w = 1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * 2));
    const off = Math.floor((w - 1) / 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(x0 + (x1 - x0) * t) - off;
      const y = Math.round(y0 + (y1 - y0) * t) - off;
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    }
  }

  poly(pts, c) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        if (inPoly(x + 0.01, y + 0.01, pts)) this.set(x, y, c);
      }
    }
  }

  // Adds a 1px dark outline around opaque pixels inside a cell.
  outline(x, y, w, h, c) {
    const add = [];
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (this.alphaAt(i, j) > 0) continue;
        if (this.alphaAt(i + 1, j) > 100 || this.alphaAt(i - 1, j) > 100 ||
            this.alphaAt(i, j + 1) > 100 || this.alphaAt(i, j - 1) > 100) add.push(i, j);
      }
    }
    for (let k = 0; k < add.length; k += 2) {
      const i = (add[k + 1] * this.w + add[k]) * 4;
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
    }
  }

  flush() {
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Registers a horizontal strip of frames as a Phaser texture with numbered frames.
export function registerSheet(scene, key, canvas, fw, fh, count) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  for (let i = 0; i < count; i++) tex.add(i, 0, i * fw, 0, fw, fh);
  return tex;
}
