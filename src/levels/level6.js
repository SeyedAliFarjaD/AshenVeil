// Level 6: "The Hollow Wood". A dead forest grown through a ruined abbey: crumbling branches
// over thorn pits, webbed hollows full of spiders, and a great hollow tree whose canopy hides
// the Relic of the Wood. Boss: Oakhart, the Stag Spirit.
import { T, makeGrid, autotile, at } from './common.js';

const W = 200, H = 46;

export function buildLevel6() {
  const { g, carve, fill } = makeGrid(W, H);

  // ---- carve everything first (a later carve would erase earlier fills)
  carve(2, 14, 40, 29);                 // the glade, floor y=30
  carve(41, 10, 70, 29);                // the thicket
  carve(44, 30, 58, 33);                // thorn pit under the branches
  carve(71, 14, 100, 33);               // the webbed hollow, floor y=34
  carve(101, 8, 140, 33);               // the great tree, floor y=34
  carve(105, 2, 125, 7);                // the canopy
  carve(141, 20, 165, 33);              // the stag path
  carve(166, 26, 166, 33);              // fog doorway
  carve(167, 10, 197, 33);              // the stag's clearing

  // ---- then fills
  fill(44, 33, 58, 33, 3);              // thorns
  fill(41, 30, 43, 30, 1);
  fill(59, 30, 70, 30, 1);
  fill(48, 24, 52, 24, 2);              // ledges in the thicket
  fill(60, 21, 65, 21, 2);
  fill(80, 28, 85, 28, 2);              // webbed hollow ledges
  fill(90, 25, 95, 25, 2);
  fill(76, 33, 77, 33, 3);
  // the great tree: a stair of branches up to the canopy
  fill(104, 30, 108, 30, 2);
  fill(111, 26, 115, 26, 2);
  fill(104, 22, 108, 22, 2);
  fill(111, 18, 115, 18, 2);
  fill(104, 14, 108, 14, 2);
  fill(111, 11, 115, 11, 2);
  fill(105, 8, 125, 8, 2);              // the canopy floor
  fill(128, 30, 131, 33, 1);            // the false root (breakable)
  fill(148, 33, 150, 33, 3);            // briars on the stag path
  fill(156, 33, 157, 33, 3);
  fill(152, 29, 154, 29, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 6, name: 'THE HOLLOW WOOD',
    theme: {
      sky: false, music: 'wood', bossMusic: 'boss4', torchTint: 0x9fe8a0,
      groundTint: 0xa8c098, backTint: 0x6e8064, ambientTint: 'spirit',
    },
    startAbilities: { hasDouble: true, hasWallJump: true, hasDash: true, hasGrapple: true, hasGlide: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [128, 30, 131, 33], loot: { type: 'embers', amount: 1100, ...at(135, 33) } }],
    spawn: at(5, 29),
    bonfires: [
      { id: 'wood-edge', ...at(10, 29) },
      { id: 'webbed-hollow', ...at(73, 33) },
      { id: 'great-tree', ...at(102, 33) },
      { id: 'stag-path', ...at(162, 33) },
    ],
    anchors: [],
    crumbles: [
      { x: 45, y: 28, w: 2 }, { x: 49, y: 27, w: 2 }, { x: 53, y: 28, w: 2 }, { x: 56, y: 28, w: 2 },
    ],
    winds: [
      { x: 117, y: 8, w: 3, h: 26, fy: -520 },     // an updraft through the hollow trunk
    ],
    hollows: [at(26, 29), at(58, 29), at(124, 33)],
    archers: [at(62, 20), at(113, 25), at(113, 17)],
    ghouls: [at(34, 29), at(88, 33), at(144, 33)],
    spiders: [at(84, 33), at(91, 33), at(136, 33)],
    shades: [at(120, 7), at(150, 28)],
    wisps: [{ x: 56 * T, y: 18 * T }, { x: 92 * T, y: 20 * T }, { x: 158 * T, y: 24 * T }],
    swarms: [{
      title: 'THE WEB', x0: 79, y0: 14, x1: 99, y1: 33, max: 4, total: 10, interval: 2.4, reward: 650,
      spawns: [[82, 33], [97, 33], [92, 24], [82, 27]], kinds: ['spider', 'ghoul', 'hollow', 'spider'],
    }],
    water: [],
    pickup: { type: 'relic', boon: 'vigor', ...at(122, 7) },
    messages: [
      { ...at(14, 29), text: 'The wood grew through the abbey.\nNothing here remembers the sun.' },
      { ...at(40, 29), text: 'The branches over the thorns are rotten.\nKeep moving.' },
      { ...at(100, 33), text: 'The great tree is hollow.\nClimb its branches to the canopy.' },
      { ...at(160, 33), text: 'Hoofbeats beyond the fog.\nWhen he charges, step aside: he cannot turn.' },
    ],
    torches: [[14, 26], [24, 26], [36, 26], [56, 20], [68, 22], [78, 30], [92, 30], [104, 31], [118, 20], [130, 31], [146, 30], [160, 30], [176, 26], [188, 26]],
    banners: [[30, 14], [60, 10], [110, 8], [180, 10]],
    chains: [[46, 10], [86, 14], [132, 8], [190, 10]],
    columns: [[20, 30], [64, 30], [74, 34], [140, 34], [170, 34]],
    felled: 'THE STAG SPIRIT IS LAID TO REST',
    fogGate: { x: 166 * T, top: 26 * T, bottom: 34 * T },
    arena: { x0: 166 * T, x1: W * T, y0: 10 * T, floor: 34 * T, trigger: 169 * T },
    boss: {
      type: 'stag', ...at(188, 33),
      cfg: { prefix: 'stagspirit', name: 'Oakhart, the Stag Spirit', maxHp: 1900, dmgMul: 1.15, phaseAt: 0.5, phaseMsg: 'The wood answers his call  -  thorns rise!' },
    },
  };
}
