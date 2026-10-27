// Level 1: "The Ashen Ramparts". Built by carving air out of solid rock.
import { T, makeGrid, autotile, at } from './common.js';

const W = 176, H = 50;

export function buildLevel1() {
  const { g, carve, fill } = makeGrid(W, H);

  // --- Start courtyard (open sky)
  carve(2, 0, 29, 29);
  // --- Great hall (open sky), floor at y=28
  carve(30, 0, 79, 27);
  fill(46, 28, 48, 28, 3);              // spike dip
  fill(34, 24, 38, 24, 2);              // platforms
  fill(40, 21, 44, 21, 2);
  // --- Shaft down to the depths
  carve(61, 28, 65, 35);
  carve(36, 36, 92, 44);                // cavern, floor at y=45
  // staggered climbing platforms; column 65 stays open for dropping down
  fill(61, 42, 62, 42, 2);
  fill(63, 39, 64, 39, 2);
  fill(61, 36, 62, 36, 2);
  fill(63, 33, 64, 33, 2);
  fill(61, 30, 62, 30, 2);
  fill(52, 44, 54, 44, 3);              // spikes in the depths
  // --- The gate: ledge + high wall (needs the double jump)
  fill(74, 24, 79, 27, 1);
  // --- Ramparts corridor, floor at y=20
  carve(80, 6, 132, 19);
  fill(95, 16, 100, 16, 2);
  fill(104, 13, 107, 13, 2);
  // --- Boss arena
  carve(133, 4, 172, 19);
  // --- SECRET: a forgotten cellar behind a false wall, west of the depths
  carve(26, 41, 33, 44);
  fill(34, 42, 35, 44, 1);              // the false wall (breakable)

  const backwall = [
    [36, 36, 92, 44], [61, 28, 65, 35],
    [80, 6, 132, 19], [133, 4, 172, 19], [26, 41, 35, 44],
  ];

  const { data, back } = autotile(g, W, H, backwall);

  return {
    id: 1, name: 'THE ASHEN RAMPARTS',
    theme: { sky: true, music: 'ambient', bossMusic: 'boss', torchTint: 0xff8a30 },
    W, H, data, back, grid: g,
    secrets: [{ wall: [34, 42, 35, 44], loot: { type: 'embers', amount: 700, ...at(29, 44) } }],
    spawn: at(5, 29),
    bonfires: [
      { id: 'courtyard', ...at(9, 29) },
      { id: 'undercroft', ...at(63, 44) },
      { id: 'ramparts', ...at(126, 19) },
    ],
    hollows: [at(38, 27), at(57, 27), at(70, 27), at(47, 44), at(80, 44), at(92, 19), at(113, 19)],
    wisps: [{ x: 53 * T, y: 20 * T }, { x: 74 * T, y: 39 * T }, { x: 103 * T, y: 11 * T }],
    pickup: { type: 'feather', ...at(39, 44) },
    sentinels: [],
    water: [],
    messages: [
      { ...at(13, 29), text: 'J / Click  -  Attack.\nPress again to chain up to three strikes.' },
      { ...at(21, 29), text: 'Shift / K  -  Roll.\nYou are untouchable mid-roll.' },
      { ...at(33, 27), text: 'F  -  Drink an Ember Flask to heal.\nResting at a bonfire (E) refills them.' },
      { ...at(43, 27), text: 'Space  -  Jump. Hold for height.' },
      { ...at(68, 27), text: 'The wall is too high to climb...\nPerhaps the depths below hold an answer.' },
      { ...at(58, 27), text: 'S + Space  -  Drop through wooden platforms.' },
      { ...at(121, 19), text: 'Beyond the fog,\nthe Ashen Warden keeps his vigil.' },
    ],
    torches: [[84, 15], [104, 16], [124, 15], [138, 13], [152, 13], [167, 13], [44, 41], [84, 41]],
    banners: [[90, 7], [116, 7], [142, 5], [163, 5]],
    chains: [[98, 6], [148, 4], [157, 4]],
    columns: [[18, 30], [26, 30], [52, 28], [66, 28]],
    felled: 'WARDEN FELLED',
    fogGate: { x: 133 * T, top: 15 * T, bottom: 20 * T },
    arena: { x0: 133 * T, x1: 173 * T, y0: 4 * T, floor: 20 * T, trigger: 137 * T },
    boss: { type: 'warden', ...at(162, 19) },
  };
}
