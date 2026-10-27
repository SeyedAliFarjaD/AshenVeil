// Level 4: "The Frozen Belfry". A snow-bound tower of bells.
// Gate: a twelve-tile chasm with spikes far below. Cross it by hopping the
// stepping stones, by leap-double leap-dash, or by grappling the iron rings
// bolted above the drop.
import { T, makeGrid, autotile, at } from './common.js';

const W = 184, H = 52;

export function buildLevel4() {
  const { g, carve, fill } = makeGrid(W, H);

  // --- Entry court (open sky, snow), floor at y=29
  carve(2, 0, 30, 28);
  // --- Bell hall, floor at y=28
  carve(31, 0, 58, 27);
  fill(38, 22, 41, 22, 2);
  fill(48, 19, 51, 19, 2);
  // --- THE GATE: the chasm (x 59..70), spikes far below
  carve(59, 4, 70, 43);                 // open above, so the halls on either side connect
  fill(59, 44, 70, 44, 3);
  // stepping stones across the drop: hop them, or grapple the iron rings overhead
  fill(59, 26, 62, 26, 2);
  fill(64, 26, 66, 26, 2);
  fill(68, 26, 70, 26, 2);
  // --- The nave, floor at y=28
  carve(71, 4, 120, 27);
  fill(78, 21, 82, 21, 2);
  fill(86, 14, 89, 14, 2);
  fill(90, 17, 94, 17, 2);
  fill(100, 27, 103, 27, 3);            // spike trench in the floor
  // --- The undercroft (drop through the floor at x 104..106), floor at y=41.
  // Carved from row 29 so the nave keeps its floor (row 28) above it.
  carve(96, 29, 118, 40);
  fill(104, 28, 106, 28, 2);            // the hole: a one-way trapdoor (S + Space drops, jump up through it)
  fill(108, 37, 109, 37, 2);
  fill(112, 34, 113, 34, 2);
  fill(103, 32, 110, 32, 2);            // the way back up, under the trapdoor
  fill(113, 40, 114, 40, 3);
  // --- SECRET: a frozen vault behind the undercroft's east wall
  carve(121, 36, 130, 40);
  fill(119, 38, 120, 40, 1);            // the false wall (breakable)
  // --- Gate wall + doorway into the sanctuary, floor at y=28
  fill(121, 4, 121, 27, 1);
  carve(121, 21, 121, 26);
  // --- Boss sanctuary
  carve(122, 2, 182, 27);               // keep the last column solid: the map edge has no wall
  fill(130, 21, 134, 21, 2);
  fill(150, 21, 154, 21, 2);
  fill(166, 18, 170, 18, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 4, name: 'THE FROZEN BELFRY',
    theme: {
      sky: false, music: 'crypt', bossMusic: 'boss2', torchTint: 0x9fd8ff,
      groundTint: 0xa8c4dc, backTint: 0x8aa8c4,
    },
    startAbilities: { hasDouble: true, hasWallJump: true, hasDash: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [119, 38, 120, 40], loot: { type: 'charm', key: 'shadowveil', ...at(127, 40) } }],
    spawn: at(5, 28),
    bonfires: [
      { id: 'belfry-gate', ...at(9, 28) },
      { id: 'nave', ...at(116, 27) },
    ],
    // grapple anchors: iron rings bolted to the walls above the chasm and the undercroft shaft
    anchors: [[59, 23], [65, 18], [69, 22], [116, 33], [105, 24]]
      .map(([x, y]) => ({ x: x * T + 8, y: y * T + 8 })),
    hollows: [at(38, 27), at(52, 27), at(80, 27), at(97, 40), at(109, 40)],
    sentinels: [at(46, 27), at(88, 27), at(106, 27)],
    bellringers: [at(56, 27), at(92, 16), at(126, 27)],
    wisps: [{ x: 66 * T, y: 20 * T }, { x: 100 * T, y: 12 * T }, { x: 132 * T, y: 12 * T }],
    water: [],
    pickup: { type: 'grapple', ...at(99, 40) },
    messages: [
      { ...at(13, 28), text: 'The belfry keeps the cold...\nand older things than cold.' },
      { ...at(36, 27), text: 'L  -  Parry.\nTime it as the blow lands:\na parried enemy is left open.' },
      { ...at(44, 22), text: 'I  -  Soul Bolt (50 focus).\nU  -  Force, the focused strike (100).\nFocus builds as you land hits.' },
      { ...at(57, 27), text: 'The chasm is wide, but not too wide:\nhop the platforms  -  or leap, leap, dash.' },
      { ...at(78, 27), text: 'Down + Attack in mid-air  -  Plunge.\nBounce off an enemy to pogo upward.' },
      { ...at(108, 27), text: 'A trapdoor. S + Space drops through it.\nThe undercroft below holds the old hook.' },
      { ...at(97, 40), text: 'R in mid-air  -  Grapple an iron ring.\nThe rings will carry you back up.' },
      { ...at(119, 27), text: 'Beyond the fog, the Rimebound\nkeeps his vigil in the snow.' },
    ],
    torches: [[12, 25], [24, 25], [36, 24], [46, 24], [56, 24], [74, 24], [86, 24], [96, 24], [112, 24], [100, 38], [110, 38], [126, 24], [140, 24], [158, 24], [172, 24]],
    banners: [[30, 6], [60, 6], [100, 6], [130, 3], [160, 3]],
    chains: [[66, 3], [100, 3], [148, 2], [176, 2]],
    columns: [[20, 29], [44, 28], [70, 28], [94, 28], [130, 28], [166, 28]],
    felled: 'THE RIMEBOUND SHATTERS',
    fogGate: { x: 121 * T, top: 21 * T, bottom: 27 * T },
    arena: { x0: 121 * T, x1: 184 * T, y0: 2 * T, floor: 28 * T, trigger: 123 * T },
    boss: {
      type: 'warden', ...at(172, 27),
      // not a reskin: frost moves (ice line, falling icicles), faster, heavier, and enraged at 60%
      cfg: { prefix: 'rimeknight', name: 'Sir Hallowyn, the Rimebound', maxHp: 1500, frost: true, dmgMul: 1.2, phaseAt: 0.6, phaseMsg: 'The rime hardens around him!' },
    },
  };
}
