// Level 7: "The Glass Citadel". A frozen palace of mirrored halls: ice floors that carry you
// past where you meant to stop, spring pads up the glass spire, shades in the mirrors and
// duelists who guard every stair. Boss: Seraphine, the Duelist Queen.
import { T, makeGrid, autotile, at } from './common.js';

const W = 210, H = 48;

export function buildLevel7() {
  const { g, carve, fill } = makeGrid(W, H);

  // ---- carve everything first (a later carve would erase earlier fills)
  carve(2, 16, 34, 29);                 // the outer court, floor y=30
  carve(35, 12, 72, 29);                // the hall of mirrors
  carve(40, 30, 66, 33);                // the shatter pit
  carve(73, 18, 96, 35);                // the cold stair down, floor y=36
  carve(97, 6, 126, 35);                // the glass spire, floor y=36
  carve(127, 6, 140, 13);               // spire gallery, floor y=14
  carve(141, 6, 150, 29);               // the long drop
  carve(151, 18, 172, 29);              // the throne approach, floor y=30
  carve(173, 24, 173, 29);              // fog doorway
  carve(174, 8, 207, 29);               // the queen's ballroom

  // ---- then fills
  fill(40, 33, 66, 33, 3);              // shards
  fill(35, 30, 39, 30, 1);
  fill(67, 30, 72, 30, 1);
  fill(44, 26, 47, 26, 2);              // glass ledges across the mirror hall
  fill(51, 23, 54, 23, 2);
  fill(58, 26, 61, 26, 2);
  fill(64, 22, 67, 22, 2);
  fill(73, 30, 78, 35, 1);              // stair blocks
  fill(79, 33, 84, 35, 1);
  fill(86, 28, 90, 28, 2);
  // the spire: spring pads and ledges up to the gallery
  fill(100, 30, 104, 30, 2);
  fill(108, 26, 112, 26, 2);
  fill(116, 22, 120, 22, 2);
  fill(108, 18, 112, 18, 2);
  fill(100, 14, 104, 14, 2);
  fill(116, 14, 126, 14, 2);
  fill(122, 30, 126, 35, 1);            // the false mirror (breakable)
  fill(141, 14, 143, 14, 1);            // gallery lip over the drop
  fill(141, 29, 150, 29, 1);
  fill(156, 26, 159, 26, 2);
  fill(165, 26, 168, 26, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 7, name: 'THE GLASS CITADEL',
    theme: {
      sky: false, music: 'crypt', bossMusic: 'boss2', torchTint: 0xc8e0ff,
      groundTint: 0xc8d8f0, backTint: 0x7888a8, ambientTint: 'spirit',
    },
    startAbilities: { hasDouble: true, hasWallJump: true, hasDash: true, hasGrapple: true, hasGlide: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [122, 30, 126, 35], loot: { type: 'embers', amount: 1300, ...at(124, 35) } }],
    spawn: at(5, 29),
    bonfires: [
      { id: 'outer-court', ...at(10, 29) },
      { id: 'cold-stair', ...at(93, 35) },
      { id: 'spire-gallery', ...at(132, 13) },
      { id: 'throne-approach', ...at(155, 29) },
    ],
    anchors: [],
    ice: [[2, 30, 34], [151, 30, 172], [174, 30, 207]],
    bouncers: [{ x: 106, y: 36 }, { x: 114, y: 26 }],
    crumbles: [{ x: 48, y: 28, w: 2 }, { x: 55, y: 28, w: 2 }],
    hollows: [at(24, 29), at(70, 29)],
    duelists: [at(31, 29), at(81, 32), at(168, 29)],
    shades: [at(52, 22), at(110, 25), at(146, 20)],
    archers: [at(66, 21), at(118, 21)],
    champions: [at(103, 35)],
    wisps: [{ x: 60 * T, y: 18 * T }, { x: 112 * T, y: 10 * T }, { x: 146 * T, y: 12 * T }],
    swarms: [{
      title: 'THE MIRROR WALTZ', x0: 98, y0: 15, x1: 121, y1: 35, max: 4, total: 10, interval: 2.4, reward: 700,
      spawns: [[99, 35], [120, 35], [110, 25], [102, 29]], kinds: ['duelist', 'shade', 'hollow', 'ghoul'],
    }],
    water: [],
    pickup: { type: 'relic', boon: 'flask', ...at(138, 13) },
    messages: [
      { ...at(14, 29), text: 'The floors here are glass and frost.\nYou will slide. Plan your stops.' },
      { ...at(36, 29), text: 'Every mirror holds a shade.\nThey strike only when they show themselves.' },
      { ...at(97, 35), text: 'Spring pads carry you up the spire.' },
      { ...at(170, 29), text: 'She waits on the ice.\nShe answers every careless blow.' },
    ],
    torches: [[14, 26], [26, 26], [40, 24], [56, 20], [70, 24], [82, 30], [94, 32], [100, 32], [118, 18], [130, 10], [138, 10], [156, 26], [168, 26], [184, 24], [198, 24]],
    banners: [[22, 16], [50, 12], [110, 6], [160, 18], [190, 8]],
    chains: [[44, 12], [64, 12], [104, 6], [124, 6], [182, 8], [200, 8]],
    columns: [[18, 30], [38, 30], [76, 30], [98, 36], [152, 30], [176, 30], [204, 30]],
    felled: 'THE DUELIST QUEEN YIELDS',
    fogGate: { x: 173 * T, top: 24 * T, bottom: 30 * T },
    arena: { x0: 173 * T, x1: W * T, y0: 8 * T, floor: 30 * T, trigger: 176 * T },
    boss: {
      type: 'queen', ...at(196, 29),
      cfg: { prefix: 'queen', name: 'Seraphine, the Duelist Queen', maxHp: 2000, dmgMul: 1.2, phaseAt: 0.5, phaseMsg: 'She casts aside her guard  -  the dance quickens!' },
    },
  };
}
