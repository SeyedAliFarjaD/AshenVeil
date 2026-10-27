// Level 8: "The Ashen Throne". The finale: the road to the throne passes through echoes of
// every land before it: lava and saws, crumbling stones, frozen glass, an updraft and spring
// pads, with necromancers raising the dead along the way. Boss: the Ashen King, in three stages.
import { T, makeGrid, autotile, at } from './common.js';

const W = 240, H = 50;

export function buildLevel8() {
  const { g, carve, fill } = makeGrid(W, H);

  // ---- carve everything first (a later carve would erase earlier fills)
  carve(2, 16, 30, 29);                 // the ash steps, floor y=30
  carve(31, 12, 68, 29);                // the forge echo
  carve(36, 30, 62, 33);                // lava trench
  carve(69, 14, 92, 33);                // the frozen echo, floor y=34
  carve(93, 6, 118, 33);                // the rising echo, floor y=34
  carve(119, 6, 140, 13);               // high bridge, floor y=14
  carve(141, 6, 152, 31);               // the wood echo: a long drop
  carve(153, 18, 196, 31);              // the procession, floor y=32
  carve(197, 26, 197, 31);              // fog doorway
  carve(198, 8, 237, 31);               // the throne hall

  // ---- then fills
  fill(36, 33, 62, 33, 4);              // lava
  fill(31, 30, 35, 30, 1);
  fill(63, 30, 68, 30, 1);
  fill(46, 24, 49, 24, 2);
  fill(56, 21, 60, 21, 2);
  fill(69, 30, 72, 33, 1);              // a step down into the frost
  fill(80, 28, 84, 28, 2);
  fill(98, 29, 102, 29, 2);             // the rising echo
  fill(106, 24, 110, 24, 2);
  fill(98, 19, 102, 19, 2);
  fill(108, 14, 118, 14, 2);
  fill(114, 30, 118, 33, 1);            // the false wall (breakable)
  fill(141, 14, 143, 14, 1);
  fill(141, 31, 152, 31, 1);
  fill(160, 31, 162, 31, 3);            // thorns on the procession
  fill(176, 31, 178, 31, 3);
  fill(158, 27, 164, 27, 2);
  fill(174, 27, 180, 27, 2);
  fill(186, 24, 190, 24, 2);

  const { data, back } = autotile(g, W, H, [[0, 0, W - 1, H - 1]]);

  return {
    id: 8, name: 'THE ASHEN THRONE',
    theme: {
      sky: false, music: 'throne', bossMusic: 'boss6', torchTint: 0xff7040,
      groundTint: 0xc8a898, backTint: 0x806058, ambientTint: 'fire',
    },
    startAbilities: { hasDouble: true, hasWallJump: true, hasDash: true, hasGrapple: true, hasGlide: true },
    W, H, data, back, grid: g,
    secrets: [{ wall: [114, 30, 118, 33], loot: { type: 'embers', amount: 1600, ...at(116, 33) } }],
    spawn: at(5, 29),
    bonfires: [
      { id: 'ash-steps', ...at(10, 29) },
      { id: 'frozen-echo', ...at(76, 33) },
      { id: 'high-bridge', ...at(124, 13) },
      { id: 'procession', ...at(156, 31) },
      { id: 'throne-door', ...at(193, 31) },
    ],
    anchors: [],
    movers: [{ x: 38, y: 27, w: 4, axis: 'x', range: 8, speed: 44, phase: 0 }],
    crumbles: [{ x: 51, y: 27, w: 2 }, { x: 54, y: 26, w: 2 }],
    saws: [
      { x0: 52, y0: 18, x1: 52, y1: 25, speed: 60, phase: 0 },
      { x0: 170, y0: 26, x1: 170, y1: 31, speed: 70, phase: 30 },
    ],
    ice: [[73, 34, 92, 34]],
    winds: [{ x: 111, y: 6, w: 3, h: 28, fy: -520 }],
    bouncers: [{ x: 95, y: 34 }],
    hollows: [at(22, 29), at(88, 33), at(168, 31)],
    brutes: [at(64, 29)],
    archers: [at(58, 20), at(109, 23), at(188, 23)],
    necromancers: [at(86, 33), at(182, 31)],
    duelists: [at(26, 29)],
    shades: [at(138, 9), at(146, 20)],
    ghouls: [at(100, 33), at(172, 31)],
    champions: [at(134, 13)],
    wisps: [{ x: 48 * T, y: 18 * T }, { x: 104 * T, y: 12 * T }, { x: 146 * T, y: 14 * T }],
    swarms: [{
      title: 'THE LAST PROCESSION', x0: 163, y0: 18, x1: 185, y1: 31, max: 5, total: 14, interval: 2.0, reward: 1000,
      spawns: [[165, 31], [184, 31], [161, 26], [177, 26]], kinds: ['ghoul', 'hollow', 'duelist', 'shade', 'brute'],
    }],
    water: [],
    pickup: { type: 'relic', boon: 'might', ...at(130, 13) },
    messages: [
      { ...at(14, 29), text: 'Every land you crossed burned for him.\nHere, they burn again.' },
      { ...at(70, 29), text: 'The necromancers are shielded\nwhile their dead still walk.' },
      { ...at(140, 13), text: 'A long fall ahead.\nGlide if your nerve fails.' },
      { ...at(195, 31), text: 'The Ashen King waits on his throne.\nThis is the end of the vigil.' },
    ],
    torches: [[14, 26], [26, 26], [34, 24], [44, 22], [64, 24], [74, 30], [86, 30], [96, 30], [104, 20], [122, 10], [134, 10], [156, 28], [166, 28], [184, 28], [194, 28], [208, 24], [222, 24], [232, 24]],
    banners: [[20, 16], [50, 12], [100, 6], [130, 6], [170, 18], [205, 8], [225, 8]],
    chains: [[40, 12], [62, 12], [96, 6], [148, 6], [212, 8], [230, 8]],
    columns: [[18, 30], [66, 30], [94, 34], [154, 32], [190, 32], [200, 32], [236, 32]],
    felled: 'THE ASHEN KING IS DETHRONED',
    fogGate: { x: 197 * T, top: 26 * T, bottom: 32 * T },
    arena: { x0: 197 * T, x1: W * T, y0: 8 * T, floor: 32 * T, trigger: 200 * T },
    boss: {
      type: 'king', ...at(226, 31),
      cfg: { prefix: 'ashenking', name: 'Vaelor, the Ashen King', maxHp: 2600, dmgMul: 1.25, phaseAt: 0.66, phaseMsg: 'The crown flares  -  the king rises in fury!' },
    },
  };
}
