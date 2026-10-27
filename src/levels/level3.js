// Level 3: "The Burning Cathedral". A nave of fire and stained glass.
// Gate: a low-ceilinged gallery over a lava trench. The ceiling caps your
// jump height, so only the air dash (Cinder Wings) can carry you across.
import { T, makeGrid, autotile, at } from './common.js';

const W = 172, H = 46;

export function buildLevel3() {
  const { g, carve, fill } = makeGrid(W, H);

  // --- Narthex (entry), floor at y=26
  carve(2, 10, 26, 25);
  // --- The nave, the burning gallery, and the transept: one long hall, floor 26
  carve(27, 3, 70, 25);                 // nave
  fill(31, 21, 35, 21, 2);
  fill(40, 18, 44, 18, 2);
  fill(50, 21, 54, 21, 2);
  fill(57, 16, 61, 16, 2);
  // --- Stairwell down to the undercroft (column 65 stays open for dropping)
  carve(63, 26, 65, 33);
  carve(30, 34, 68, 41);                // undercroft, floor 42
  fill(63, 38, 64, 38, 2);
  fill(63, 34, 64, 34, 2);
  fill(63, 30, 64, 30, 2);
  fill(45, 42, 47, 42, 4);              // lava pools in the floor
  fill(54, 42, 56, 42, 4);
  // --- SECRET: an ash-choked chapel behind the undercroft's west wall
  carve(20, 38, 27, 41);
  fill(28, 39, 29, 41, 1);              // the false wall (breakable)
  // --- THE GATE: the burning gallery (4 tiles tall) over a 7-wide lava trench
  carve(71, 22, 92, 25);
  carve(76, 26, 82, 27);
  fill(76, 28, 82, 28, 4);
  // --- Transept, floor 26
  carve(93, 3, 118, 25);
  fill(104, 20, 108, 20, 2);
  fill(102, 26, 103, 26, 4);            // a small lava seam
  // --- Fog gate opening + the twin pyres' sanctuary, floor 26
  carve(119, 20, 119, 25);
  carve(120, 2, 167, 25);
  fill(128, 20, 132, 20, 2);
  fill(155, 20, 159, 20, 2);
  fill(141, 14, 146, 14, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 3, name: 'THE BURNING CATHEDRAL',
    theme: {
      sky: false, music: 'cathedral', bossMusic: 'boss3', torchTint: 0xff8a30,
      groundTint: 0xe8b49c, backTint: 0xc08070, ambientTint: 'fire',
    },
    startAbilities: { hasDouble: true, hasWallJump: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [28, 39, 29, 41], loot: { type: 'embers', amount: 1100, ...at(22, 41) } }],
    spawn: at(5, 25),
    bonfires: [
      { id: 'narthex', ...at(9, 25) },
      { id: 'choir', ...at(86, 25) },
      { id: 'transept', ...at(116, 25) },
    ],
    hollows: [at(34, 25), at(66, 25), at(38, 41), at(101, 25)],
    sentinels: [at(52, 25), at(100, 25)],
    acolytes: [at(42, 17), at(59, 15), at(50, 41), at(61, 41), at(106, 19)],
    wisps: [{ x: 48 * T, y: 10 * T }, { x: 110 * T, y: 12 * T }],
    water: [],
    // fire vents: [tileX, floorRow]
    jets: [[38, 26], [47, 26], [56, 26], [40, 42], [51, 42], [97, 26], [110, 26]],
    pickup: { type: 'cinder', ...at(33, 41) },
    messages: [
      { ...at(13, 25), text: 'The cathedral has burned for a hundred years,\nand still it is not ash.' },
      { ...at(28, 25), text: 'Pyre Acolytes hurl fire from afar.\nClose the distance: they cannot stand against steel.' },
      { ...at(36, 25), text: 'The vents breathe fire in rhythm.\nWatch the glow, then pass.' },
      { ...at(61, 25), text: 'A stairwell descends to the undercroft.' },
      { ...at(73, 25), text: 'A trench of fire beneath a low vault...\nOnly wings of ash could carry you across.\n(Leap, then dash at once.)' },
      { ...at(113, 25), text: 'The Twin Pyres burn as one.\nShould one fall, the other will rage.' },
    ],
    torches: [[10, 18], [30, 14], [44, 12], [66, 14], [80, 23], [88, 23], [96, 14], [112, 14], [124, 12], [144, 8], [164, 12], [34, 38], [58, 38]],
    banners: [[20, 11], [50, 4], [132, 3], [156, 3]],
    chains: [[40, 3], [64, 3], [140, 2], [150, 2]],
    columns: [[24, 26], [52, 26], [68, 26], [104, 26], [122, 26], [166, 26]],
    windows: [[29, 12], [47, 12], [66, 12], [96, 12], [114, 12], [124, 13], [136, 13], [149, 9], [162, 13]],
    fogGate: { x: 119 * T, top: 20 * T, bottom: 26 * T },
    arena: { x0: 120 * T, x1: 168 * T, y0: 2 * T, floor: 26 * T, trigger: 122 * T },
    felled: 'THE PYRES GUTTER OUT',
    bosses: [
      {
        type: 'warden', ...at(150, 25),
        cfg: { prefix: 'pyreknight', name: 'Aldous, the Pyre Knight', maxHp: 560, twin: true, phaseMsg: 'Aldous takes up his sister\'s flame!' },
      },
      {
        type: 'saint', ...at(160, 25),
        cfg: {
          prefix: 'pyrewitch', name: 'Ysolde, the Pyre Witch', maxHp: 440, twin: true, fire: true, flood: false,
          color: 0xff8a3a, colorLight: 0xfff0b0, orb: 'fireorb', phaseMsg: 'Ysolde drinks her brother\'s fire!',
        },
      },
    ],
  };
}
