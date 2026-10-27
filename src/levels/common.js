// Shared level-building helpers: carve air out of solid rock, then autotile.
import { TILE } from '../art/world.js';

export const T = 16;

// Grid values: 1 = solid, 0 = air, 2 = one-way platform, 3 = spikes, 4 = lava
export function makeGrid(W, H) {
  const g = Array.from({ length: H }, () => new Array(W).fill(1));
  const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = 0; };
  const fill = (x0, y0, x1, y1, v = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = v; };
  return { g, carve, fill };
}

// Tile coords -> world position of the feet standing on that tile's floor.
export const at = (tx, ty) => ({ x: tx * T + T / 2, y: (ty + 1) * T });

// Tileset index for one grid cell (rock picks its edge variant from its neighbours).
export function tileIndex(g, W, H, x, y) {
  const solid = (a, b) => (a < 0 || b < 0 || a >= W || b >= H) ? true : g[b][a] === 1;
  const v = g[y][x];
  if (v === 1) {
    const mask = (solid(x, y - 1) ? 0 : 1) | (solid(x + 1, y) ? 0 : 2) | (solid(x, y + 1) ? 0 : 4) | (solid(x - 1, y) ? 0 : 8);
    return mask === 0 && ((x * 7 + y * 13) % 5 === 0) ? TILE.ALT : mask;
  }
  return v === 2 ? TILE.PLATFORM : v === 3 ? TILE.SPIKES : v === 4 ? TILE.LAVA : -1;
}

// Converts the grid to tileset indices for the ground layer and the back-wall layer.
export function autotile(g, W, H, backwall) {
  const data = [], back = [];
  for (let y = 0; y < H; y++) {
    const row = [], brow = [];
    for (let x = 0; x < W; x++) {
      const v = g[y][x];
      row.push(tileIndex(g, W, H, x, y));
      let b = -1;
      if (v !== 1) for (const [x0, y0, x1, y1] of backwall) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) b = ((x * 3 + y * 5) % 7 === 0) ? TILE.BACK2 : TILE.BACK;
      brow.push(b);
    }
    data.push(row);
    back.push(brow);
  }
  return { data, back };
}
