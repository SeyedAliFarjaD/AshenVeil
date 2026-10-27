// Level 2: "The Drowned Crypt". A flooded catacomb beneath the ramparts.
// Gate: a sheer shaft that needs the wall jump (Gravecrawler's Claw).
import { T, makeGrid, autotile, at } from './common.js';

const W = 196, H = 54;

export function buildLevel2() {
  const { g, carve, fill } = makeGrid(W, H);

  // --- Entry hall, floor at y=16
  carve(2, 4, 24, 15);
  // --- Descending steps
  carve(25, 8, 34, 19);                 // floor 20
  carve(35, 12, 44, 23);                // floor 24
  carve(45, 16, 54, 27);                // floor 28
  // --- Flooded gallery, floor at y=32 (water surface at y=29)
  carve(55, 16, 100, 31);
  fill(62, 26, 65, 26, 2);
  fill(70, 23, 73, 23, 2);
  fill(79, 26, 82, 26, 2);
  fill(88, 23, 91, 23, 2);
  // --- The gate: a sheer 3-wide shaft up to the catacombs (wall jump only)
  carve(101, 10, 103, 31);
  fill(100, 16, 100, 27, 1);            // shaft walls reach down to a doorway on each side
  // --- Lower corridor and the drop to the ossuary
  carve(104, 28, 104, 31);              // doorway
  carve(105, 24, 125, 31);              // floor 32
  carve(117, 32, 121, 41);
  carve(105, 42, 135, 49);              // ossuary, floor 50 (carved before the platforms, or it erases them)
  fill(118, 47, 119, 47, 2);
  fill(120, 44, 121, 44, 2);
  fill(118, 41, 119, 41, 2);
  fill(120, 38, 121, 38, 2);
  fill(118, 35, 119, 35, 2);            // column 117 stays open for dropping
  fill(126, 49, 127, 49, 3);
  // --- SECRET: a sealed reliquary past the ossuary's east wall
  carve(138, 45, 146, 49);
  fill(136, 47, 137, 49, 1);            // the false wall (breakable)
  // --- Upper catacombs, floor at y=10
  carve(96, 4, 150, 9);
  fill(110, 6, 113, 6, 2);
  fill(132, 10, 134, 10, 3);            // spike trench
  // --- Boss arena (drop down through the fog), floor at y=18
  carve(151, 4, 151, 9);
  carve(152, 2, 191, 17);
  fill(157, 13, 161, 13, 2);
  fill(182, 13, 186, 13, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 2, name: 'THE DROWNED CRYPT',
    theme: {
      sky: false, music: 'crypt', bossMusic: 'boss2', torchTint: 0x5affd0,
      groundTint: 0xa9c2cc, backTint: 0x86a6b0,
    },
    startAbilities: { hasDouble: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [136, 47, 137, 49], loot: { type: 'charm', key: 'gravebloom', ...at(143, 49) } }],
    spawn: at(5, 15),
    bonfires: [
      { id: 'crypt-gate', ...at(9, 15) },
      { id: 'catacombs', ...at(146, 9) },
    ],
    hollows: [at(30, 19), at(110, 31), at(124, 49), at(126, 9)],
    sentinels: [at(50, 27), at(98, 31), at(113, 49), at(130, 49), at(116, 9), at(131, 9)],
    wisps: [{ x: 68 * T, y: 19 * T }, { x: 85 * T, y: 19 * T }, { x: 114 * T, y: 27 * T }, { x: 121 * T, y: 6 * T }],
    water: [
      { x: 58 * T, y: 29 * T, w: 39 * T, h: 3 * T },
    ],
    pickup: { type: 'claw', ...at(108, 49) },
    messages: [
      { ...at(13, 15), text: 'The crypt drinks the light.\nFollow the spirit flames downward.' },
      { ...at(38, 23), text: 'Crypt Sentinels guard their front.\nStrike from behind, or break the guard\nwith your heavy third blow.' },
      { ...at(57, 31), text: 'The dark water slows your stride.' },
      { ...at(100, 31), text: 'These walls are sheer...\nA climber\'s claw might find purchase.' },
      { ...at(122, 31), text: 'S + Space  -  Drop through the platforms.' },
      { ...at(143, 9), text: 'Below the fog, the Drowned Saint\nsings to those who will never leave.' },
    ],
    torches: [[10, 12], [30, 16], [40, 19], [60, 20], [76, 20], [94, 20], [108, 28], [110, 46], [130, 46], [100, 7], [120, 7], [140, 7], [160, 8], [172, 6], [184, 8]],
    banners: [[16, 5], [163, 3], [178, 3]],
    chains: [[70, 16], [86, 16], [166, 2], [180, 2]],
    columns: [[20, 16], [65, 32], [85, 32], [132, 50], [155, 18], [188, 18]],
    felled: 'SAINT LAID TO REST',
    fogGate: { x: 151 * T, top: 4 * T, bottom: 10 * T },
    arena: { x0: 152 * T, x1: 192 * T, y0: 2 * T, floor: 18 * T, trigger: 154 * T, triggerY: 12 * T },
    boss: { type: 'saint', ...at(176, 17) },
  };
}
