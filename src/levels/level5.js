// Level 5: "The Sunken Foundry". A drowned forge of lava, saw rails and moving platforms.
// Gate: a 22-tile chasm below the upper gallery. Only the Ashen Mantle (glide), found in the
// Quench below the first hall, carries you across. Boss: Gorrak, the Forge Golem.
import { T, makeGrid, autotile, at } from './common.js';

const W = 228, H = 50;

export function buildLevel5() {
  const { g, carve, fill } = makeGrid(W, H);

  // ---- carve everything first (a later carve would erase earlier fills)
  carve(2, 16, 26, 29);                 // the yard, floor y=30
  carve(27, 12, 70, 29);                // slag hall
  carve(41, 30, 52, 33);                // the crumble pit
  carve(62, 30, 65, 38);                // drop shaft to the Quench
  carve(36, 39, 78, 45);                // the Quench (cavern), floor y=46
  carve(26, 41, 33, 45);                // secret alcove
  carve(71, 12, 90, 29);                // mover chasm
  carve(71, 30, 90, 33);
  carve(91, 12, 130, 29);               // the casting hall
  carve(131, 6, 135, 29);               // elevator shaft
  carve(136, 9, 148, 13);               // upper gallery (floor y=14)
  carve(149, 9, 170, 43);               // THE GATE: the glide chasm
  carve(171, 14, 182, 29);              // landing hall
  carve(183, 24, 183, 29);              // fog doorway
  carve(184, 6, 226, 29);               // the Golem's sanctuary

  // ---- then fills
  fill(41, 33, 52, 33, 4);              // lava under the crumbling stones
  fill(71, 33, 90, 33, 4);              // lava under the movers
  fill(149, 44, 170, 44, 4);            // lava at the bottom of the chasm
  fill(54, 23, 58, 23, 2);              // sapper ledge
  fill(67, 20, 70, 20, 2);              // archer ledge
  fill(100, 24, 105, 24, 2);
  fill(112, 21, 117, 21, 2);
  fill(121, 24, 126, 24, 2);
  fill(103, 17, 107, 17, 2);
  fill(124, 17, 128, 17, 2);
  fill(138, 10, 141, 10, 2);
  // the Quench: a stair of ledges up the drop shaft, lava pools, a few ledges
  fill(62, 43, 63, 43, 2);
  fill(64, 40, 65, 40, 2);
  fill(62, 37, 63, 37, 2);
  fill(64, 34, 65, 34, 2);
  fill(62, 31, 63, 31, 2);
  fill(44, 46, 46, 46, 4);
  fill(52, 46, 53, 46, 4);
  fill(48, 42, 50, 42, 2);
  fill(70, 42, 74, 42, 2);
  fill(34, 41, 35, 45, 1);              // the false wall (breakable)
  fill(160, 44, 163, 44, 1);            // a rock in the lava: a last footing for the unlucky
  fill(172, 30, 172, 30, 1);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 5, name: 'THE SUNKEN FOUNDRY',
    theme: {
      sky: false, music: 'cathedral', bossMusic: 'boss3', torchTint: 0xffa050,
      groundTint: 0xd8b8a0, backTint: 0xa88068, ambientTint: 'fire',
    },
    gate: 'hasGlide',
    startAbilities: { hasDouble: true, hasWallJump: true, hasDash: true, hasGrapple: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [34, 41, 35, 45], loot: { type: 'embers', amount: 900, ...at(29, 45) } }],
    spawn: at(5, 29),
    bonfires: [
      { id: 'foundry-gate', ...at(10, 29) },
      { id: 'quench', ...at(40, 45) },
      { id: 'casting-hall', ...at(96, 29) },
      { id: 'golem-door', ...at(176, 29) },
    ],
    anchors: [],
    movers: [
      { x: 71, y: 29, w: 4, axis: 'x', range: 6, speed: 42, phase: 0 },
      { x: 83, y: 29, w: 4, axis: 'x', range: 5, speed: 42, phase: 0.5 },
      { x: 132, y: 14, w: 4, axis: 'y', range: 15, speed: 48, phase: 0 },
    ],
    crumbles: [
      { x: 41, y: 28, w: 2 }, { x: 44, y: 26, w: 2 }, { x: 47, y: 28, w: 2 }, { x: 50, y: 28, w: 2 },
    ],
    saws: [
      { x0: 60, y0: 22, x1: 60, y1: 28, speed: 55, phase: 0 },
      { x0: 66, y0: 24, x1: 66, y1: 28, speed: 70, phase: 60 },
      { x0: 44, y0: 41, x1: 56, y1: 41, speed: 60, phase: 0 },
      { x0: 110, y0: 20, x1: 110, y1: 28, speed: 75, phase: 40 },
    ],
    hollows: [at(36, 29), at(54, 45), at(68, 45), at(120, 29)],
    brutes: [at(31, 29), at(112, 29)],
    sappers: [at(56, 22), at(72, 45)],
    archers: [at(69, 19), at(114, 20), at(140, 13), at(146, 13)],
    ghouls: [at(57, 29), at(64, 45)],
    champions: [at(58, 45)],
    wisps: [{ x: 80 * T, y: 22 * T }, { x: 158 * T, y: 22 * T }, { x: 164 * T, y: 26 * T }, { x: 125 * T, y: 10 * T }],
    swarms: [{
      title: 'THE CRUCIBLE', x0: 114, y0: 12, x1: 129, y1: 29, max: 4, total: 12, interval: 2.2, reward: 600,
      spawns: [[115, 29], [128, 29], [123, 23], [105, 16], [127, 16]], kinds: ['ghoul', 'hollow', 'sapper', 'ghoul', 'wisp'],
    }],
    water: [],
    pickup: { type: 'glide', ...at(74, 45) },
    messages: [
      { ...at(14, 29), text: 'The foundry never cooled.\nSomething still tends the fires.' },
      { ...at(38, 29), text: 'The stones over the pit give way\nunder your weight. Do not linger.' },
      { ...at(63, 29), text: 'A shaft leads down to the Quench.\nS + Space on a ledge drops through it.' },
      { ...at(70, 29), text: 'The platforms ride their tracks.\nStep on as they pass.' },
      { ...at(150, 13), text: 'Hold Jump while falling  -  glide.\nThe far ledge is lower than this one.' },
      { ...at(180, 29), text: 'Beyond the fog, the Forge Golem\nstill hammers an empty anvil.' },
    ],
    torches: [[14, 26], [22, 26], [32, 24], [48, 24], [58, 26], [74, 24], [86, 24], [96, 26], [108, 24], [120, 26], [140, 11], [156, 12], [168, 14], [176, 26], [192, 24], [204, 24], [216, 24], [40, 42], [60, 42], [74, 40]],
    banners: [[30, 12], [64, 12], [100, 12], [128, 12], [190, 6], [210, 6]],
    chains: [[34, 12], [76, 12], [110, 12], [138, 9], [196, 6], [222, 6]],
    columns: [[20, 30], [45, 30], [78, 30], [104, 30], [126, 30], [176, 30], [200, 30]],
    felled: 'THE FORGE GOLEM IS UNMADE',
    fogGate: { x: 183 * T, top: 24 * T, bottom: 30 * T },
    arena: { x0: 183 * T, x1: W * T, y0: 6 * T, floor: 30 * T, trigger: 186 * T },
    boss: {
      type: 'golem', ...at(216, 29),
      cfg: { prefix: 'forgegolem', name: 'Gorrak, the Forge Golem', maxHp: 1700, dmgMul: 1.1, phaseAt: 0.5, phaseMsg: 'The furnace roars  -  he burns white-hot!' },
    },
  };
}
