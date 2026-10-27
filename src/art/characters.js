// All character animations, authored as poses (angles in degrees).
import { PixelCanvas, registerSheet } from './pixel.js';
import { STYLES, pose, lerpPose, renderStrip } from './humanoid.js';

const TAU = Math.PI * 2;
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// ------------------------------------------------------------------ hero
function heroAnims() {
  const idle = range(6, (i) => {
    const t = i / 6, b = (1 - Math.cos(TAU * t)) / 2;
    return { ...pose({ y: b, lean: 6 + b * 2, fa: [25 + b * 3, 80 + b * 5], ba: [-15, 20 + b * 4], sw: 120 - b * 6, cape: -20 - b * 7, ff: [3, 0], bf: [-3, 0] }), wave: TAU * t };
  });
  const run = range(8, (i) => {
    const p = i / 8;
    const foot = (q) => {
      q = ((q % 1) + 1) % 1;
      return [6 * Math.cos(TAU * q), q < 0.5 ? 0 : -4.5 * Math.sin(TAU * (q - 0.5))];
    };
    const c = Math.cos(TAU * p);
    return {
      ...pose({
        y: 1.4 + 0.7 * Math.cos(2 * TAU * p), lean: 16, head: -4,
        ff: foot(p), bf: foot(p + 0.5),
        ba: [10 + 40 * c, 60 + 40 * c], fa: [-5 - 30 * c, 30 - 20 * c],
        sw: -70 - 12 * c, cape: -72 + 8 * Math.sin(2 * TAU * p),
      }), wave: TAU * p * 2,
    };
  });
  const jump = [
    pose({ y: -1, lean: 8, ff: [4, -6], bf: [-4, -2], ba: [-40, -10], fa: [40, 100], sw: 150, cape: -8 }),
    pose({ y: -1, lean: 10, ff: [4, -7], bf: [-3, -4], ba: [-50, -20], fa: [45, 105], sw: 155, cape: -12 }),
  ];
  const fall = [0, 1].map((i) => ({
    ...pose({ y: 0, lean: 4, ff: [3, -2], bf: [-5, -4], ba: [-110, -150], fa: [70, 120], sw: 140, cape: -140 - i * 10 }),
    wave: i * 2,
  }));
  // apex: the in-between of the rise and the fall, so the arms don't snap overhead
  const apex = [{ ...lerpPose(jump[1], fall[0], 0.5), wave: 1 }];
  const land = [
    pose({ y: 3.5, lean: 18, ff: [5, 0], bf: [-5, 0], ba: [-30, 10], fa: [40, 90], sw: 110, cape: -40 }),
    pose({ y: 1.5, lean: 10, ff: [4, 0], bf: [-4, 0], ba: [-20, 15], fa: [30, 85], sw: 118, cape: -28 }),
  ];
  const attack1 = [
    pose({ y: 1, lean: -6, ff: [5, 0], bf: [-5, 0], fa: [210, 200], ba: [20, 60], sw: 200, cape: -30 }),
    pose({ y: 2, lean: -8, ff: [5, 0], bf: [-5, 0], fa: [215, 212], ba: [25, 65], sw: 216, cape: -34 }),
    pose({ y: 1, lean: 10, ff: [8, 0], bf: [-5, 0], fa: [150, 120], ba: [-20, 10], sw: 130, cape: -50 }),
    pose({ y: 2, lean: 22, ff: [9, 0], bf: [-5, 0], fa: [80, 70], ba: [-40, -10], sw: 55, cape: -60 }),
    pose({ y: 2, lean: 20, ff: [9, 0], bf: [-5, 0], fa: [55, 45], ba: [-40, -10], sw: 30, cape: -45 }),
    pose({ y: 1, lean: 12, ff: [6, 0], bf: [-4, 0], fa: [40, 70], ba: [-25, 15], sw: 80, cape: -30 }),
  ];
  const attack2 = [
    pose({ y: 2, lean: 14, ff: [6, 0], bf: [-5, 0], fa: [-40, -70], ba: [30, 60], sw: -50, cape: -40 }),
    pose({ y: 2, lean: 16, ff: [6, 0], bf: [-5, 0], fa: [-30, -50], ba: [35, 65], sw: -40, cape: -44 }),
    pose({ y: 1, lean: 6, ff: [8, 0], bf: [-5, 0], fa: [60, 90], ba: [0, 30], sw: 120, cape: -55 }),
    pose({ y: 0, lean: -4, ff: [8, 0], bf: [-4, 0], fa: [140, 160], ba: [-30, 0], sw: 175, cape: -50 }),
    pose({ y: 0, lean: -6, ff: [7, 0], bf: [-4, 0], fa: [160, 175], ba: [-35, -5], sw: 190, cape: -35 }),
    pose({ y: 1, lean: 4, ff: [5, 0], bf: [-4, 0], fa: [90, 110], ba: [-20, 15], sw: 140, cape: -25 }),
  ];
  const attack3 = [
    pose({ y: 3, lean: 20, ff: [5, 0], bf: [-5, 0], fa: [200, 190], ba: [-60, -30], sw: 200, cape: -40 }),
    pose({ y: 0, lean: -10, ff: [5, -2], bf: [-4, 0], fa: [200, 215], ba: [-70, -40], sw: 225, cape: -20 }),
    pose({ y: -1, lean: -8, ff: [5, -4], bf: [-4, -2], fa: [205, 220], ba: [-70, -40], sw: 230, cape: -10 }),
    pose({ y: 0, lean: 15, ff: [7, -1], bf: [-5, -1], fa: [140, 120], ba: [-40, -10], sw: 120, cape: -70 }),
    pose({ y: 3, lean: 30, ff: [9, 0], bf: [-6, 0], fa: [70, 50], ba: [-50, -20], sw: 25, cape: -80 }),
    pose({ y: 3, lean: 30, ff: [9, 0], bf: [-6, 0], fa: [68, 48], ba: [-50, -20], sw: 24, cape: -50 }),
    pose({ y: 3, lean: 25, ff: [8, 0], bf: [-6, 0], fa: [60, 50], ba: [-40, -10], sw: 30, cape: -35 }),
    pose({ y: 1, lean: 12, ff: [6, 0], bf: [-4, 0], fa: [40, 70], ba: [-25, 15], sw: 80, cape: -25 }),
  ];
  const curl = { y: 5, lean: 70, head: 20, ff: [4, -6], bf: [0, -5], fa: [90, 150], ba: [60, 120], sw: -100, cape: -90 };
  const roll = [
    pose({ y: 3, lean: 40, ff: [5, 0], bf: [-4, 0], fa: [80, 130], ba: [40, 90], sw: -80, cape: -70 }),
    ...[50, 110, 180, 250, 310].map((r) => pose({ ...curl, rot: r, piv: [0, -7] })),
    pose({ y: 3, lean: 30, ff: [5, 0], bf: [-4, 0], fa: [60, 110], ba: [20, 60], sw: 60, cape: -60 }),
  ];
  roll.forEach((p) => { if (p.piv === undefined) p.piv = [0, -7]; });
  const reel = pose({ y: 1, lean: -18, head: -15, ff: [4, 0], bf: [-4, 0], fa: [40, 20], ba: [-60, -30], sw: 60, cape: -50 });
  // hurt: snapped back by the blow, reeling, then catching the balance
  const hurt = [
    pose({ y: 2, lean: -28, head: -24, ff: [5, 0], bf: [-4, 0], fa: [55, 25], ba: [-80, -45], sw: 65, cape: -25 }),
    reel,
    pose({ y: 1, lean: -12, head: -10, ff: [4, 0], bf: [-4, 0], fa: [35, 25], ba: [-50, -20], sw: 70, cape: -40 }),
    pose({ y: 1, lean: -2, head: -4, ff: [4, 0], bf: [-4, 0], fa: [30, 60], ba: [-25, 10], sw: 90, cape: -35 }),
  ];
  const kneelP = { y: 6, lean: 20, head: 20, ff: [5, 0], bf: [-8, 0], fa: [20, 10], ba: [10, 30], sw: 10, cape: -10 };
  const death = [
    reel,
    pose({ y: 4, lean: 10, head: 10, ff: [5, 0], bf: [-7, 0], fa: [25, 15], ba: [0, 20], sw: 20, cape: -20 }),
    pose(kneelP),
    pose({ ...kneelP, y: 7, lean: 35, head: 30, fa: [40, 30], sw: 60 }),
    pose({ ...kneelP, y: 7, lean: 40, head: 30, fa: [60, 50], sw: 80, rot: 40, piv: [0, -1] }),
    pose({ ...kneelP, y: 7, lean: 40, head: 30, fa: [80, 70], sw: 90, rot: 75, piv: [0, -1] }),
    pose({ ...kneelP, y: 7, lean: 40, head: 35, fa: [85, 80], sw: 95, rot: 86, piv: [0, -1] }),
  ];
  const kneel = [pose(kneelP)];
  const heal = [
    pose({ y: 1, lean: 6, fa: [10, 20], sw: 20, ba: [-10, 30], flask: true }),
    pose({ y: 1, lean: 4, fa: [10, 20], sw: 20, ba: [30, 110], flask: true }),
    pose({ y: 1, lean: 0, head: -10, fa: [10, 20], sw: 20, ba: [60, 165], flask: true }),
    pose({ y: 1, lean: -4, head: -22, fa: [10, 20], sw: 20, ba: [75, 190], flask: true }),
    pose({ y: 1, lean: -4, head: -24, fa: [10, 20], sw: 20, ba: [76, 192], flask: true }),
    pose({ y: 1, lean: 0, head: -12, fa: [10, 20], sw: 20, ba: [50, 140], flask: true }),
    pose({ y: 1, lean: 4, fa: [15, 40], sw: 50, ba: [10, 60], flask: true }),
    pose({ y: 0.5, lean: 6, fa: [25, 80], sw: 115, ba: [-15, 20] }),
  ];
  // wall slide: back to the wall, back hand and foot dragging on the stone
  const wall = [0, 1].map((i) => ({
    ...pose({ y: 0, lean: -4, head: 4, ff: [3, -3], bf: [-5, -5], ba: [-95 - i * 4, -70], fa: [40, 100], sw: 140, cape: -150 - i * 12 }),
    wave: i * 2,
  }));
  // glide (Ashen Mantle): the back hand holds the mantle up like a sail that ripples
  // overhead, the sword arm reaches forward for balance, legs trail loose beneath
  const glide = range(4, (i) => {
    const t = i / 4, s = Math.sin(TAU * t);
    return {
      ...pose({ y: -1 + s * 0.4, lean: 20 + s * 2, head: -12, ff: [2, -3 + s * 0.5], bf: [-6, -2 - s * 0.5],
        ba: [-112 + s * 5, -122 + s * 6], fa: [62 + s * 3, 48 + s * 3], sw: 62 + s * 4, cape: -118 + s * 7 }),
      capeScale: 1.45, wave: TAU * t,
    };
  });
  // air dash: stretched forward, sword trailing, cape streaming
  const dash = [0, 1].map((i) => ({
    ...pose({ y: -2, lean: 58, head: -20, ff: [6, -7], bf: [-8, -4], fa: [-70, -50], ba: [-90, -70], sw: -95, cape: -95 - i * 6 }),
    wave: i * 3,
  }));
  // parry: weight shifts back with the blade cocked, then the hero steps into a
  // braced two-handed guard (back hand on the pommel), holds it, and eases off
  const parry = [
    pose({ y: 2, lean: -12, head: -8, ff: [3, 0], bf: [-6, 0], fa: [175, 185], ba: [40, 70], sw: 205, cape: -28 }),
    pose({ y: 2.5, lean: 13, head: 6, ff: [8, 0], bf: [-6, 0], fa: [105, 135], ba: [55, 100], sw: 128, cape: -68 }),
    pose({ y: 3, lean: 11, head: 5, ff: [8, 0], bf: [-7, 0], fa: [98, 130], ba: [58, 105], sw: 137, cape: -60 }),
    pose({ y: 3, lean: 10, head: 5, ff: [8, 0], bf: [-7, 0], fa: [96, 128], ba: [57, 104], sw: 140, cape: -52 }),
    pose({ y: 2.5, lean: 8, head: 4, ff: [7, 0], bf: [-6, 0], fa: [94, 126], ba: [50, 95], sw: 142, cape: -45 }),
    pose({ y: 1, lean: 3, head: 0, ff: [5, 0], bf: [-5, 0], fa: [70, 100], ba: [10, 40], sw: 125, cape: -34 }),
  ];
  // deflect (successful parry): the blow knocks the blade up, the hero rides it
  // into an overhead flick, overshoots, and rolls the blade back down to ready
  const deflect = [
    pose({ y: 2.5, lean: 2, head: 2, ff: [7, 0], bf: [-8, 0], fa: [125, 150], ba: [50, 95], sw: 162, cape: -50 }),
    pose({ y: 1, lean: -10, head: -8, ff: [6, 0], bf: [-7, 0], fa: [155, 175], ba: [25, 55], sw: 195, cape: -22 }),
    pose({ y: 0.5, lean: -13, head: -9, ff: [6, 0], bf: [-7, 0], fa: [162, 182], ba: [18, 48], sw: 208, cape: -14 }),
    pose({ y: 1, lean: -3, head: -2, ff: [6, 0], bf: [-6, 0], fa: [132, 152], ba: [10, 40], sw: 172, cape: -24 }),
    pose({ y: 2, lean: 9, head: 3, ff: [6, 0], bf: [-6, 0], fa: [92, 112], ba: [0, 30], sw: 132, cape: -42 }),
    pose({ y: 1, lean: 6, head: 0, ff: [4, 0], bf: [-4, 0], fa: [40, 90], ba: [-15, 20], sw: 115, cape: -30 }),
  ];
  // plunge: overhead stab straight down
  const plunge = [
    pose({ y: -1, lean: -10, head: -8, ff: [5, -3], bf: [-5, -3], fa: [200, 205], ba: [-30, 0], sw: 185, cape: -15 }),
    pose({ y: -1, lean: 25, head: 10, ff: [6, -2], bf: [-6, -2], fa: [25, 10], ba: [-10, 10], sw: 5, cape: -70 }),
    pose({ y: 0, lean: 10, head: 2, ff: [5, -1], bf: [-5, -2], fa: [60, 50], ba: [0, 20], sw: 40, cape: -40 }),
  ];
  return {
    dash: { poses: dash, fps: 12, repeat: -1 },
    wall: { poses: wall, fps: 8, repeat: -1 },
    glide: { poses: glide, fps: 8, repeat: -1 },
    parry: { poses: parry, fps: 20, repeat: 0 },
    deflect: { poses: deflect, fps: 24, repeat: 0 },
    plunge: { poses: plunge, fps: 16, repeat: 0 },
    idle: { poses: idle, fps: 7, repeat: -1 },
    run: { poses: run, fps: 15, repeat: -1 },
    jump: { poses: jump, fps: 8, repeat: 0 },
    fall: { poses: fall, fps: 8, repeat: -1 },
    apex: { poses: apex, fps: 1, repeat: 0 },
    land: { poses: land, fps: 16, repeat: 0 },
    attack1: { poses: attack1, fps: 20, repeat: 0 },
    attack2: { poses: attack2, fps: 20, repeat: 0 },
    attack3: { poses: attack3, fps: 16, repeat: 0 },
    roll: { poses: roll, fps: 20, repeat: 0 },
    hurt: { poses: hurt, fps: 12, repeat: 0 },
    death: { poses: death, fps: 9, repeat: 0 },
    kneel: { poses: kneel, fps: 1, repeat: 0 },
    heal: { poses: heal, fps: 9, repeat: 0 },
  };
}

// ------------------------------------------------------------------ hollow
function hollowAnims() {
  const hunch = (p) => ({ ...p, lean: (p.lean || 0) + 14 * Math.PI / 180, head: (p.head || 0) - 10 * Math.PI / 180 });
  const idle = range(4, (i) => {
    const b = (1 - Math.cos(TAU * i / 4)) / 2;
    return hunch({ ...pose({ y: 1 + b, lean: 8, fa: [10, 30], ba: [-5, 10], sw: 30, cape: -12 - b * 5, ff: [3, 0], bf: [-3, 0] }), wave: TAU * i / 4 });
  });
  const walk = range(8, (i) => {
    const p = i / 8;
    const foot = (q) => {
      q = ((q % 1) + 1) % 1;
      return [4 * Math.cos(TAU * q), q < 0.5 ? 0 : -3 * Math.sin(TAU * (q - 0.5))];
    };
    const c = Math.cos(TAU * p);
    return hunch({ ...pose({ y: 1.5 + 0.5 * Math.cos(2 * TAU * p), lean: 10, ff: foot(p), bf: foot(p + 0.5), ba: [-5 + 20 * c, 15 + 20 * c], fa: [10 - 12 * c, 30 - 10 * c], sw: 25, cape: -30 }), wave: TAU * p });
  });
  const windup = [
    hunch(pose({ y: 1, lean: -6, ff: [5, 0], bf: [-5, 0], fa: [210, 200], ba: [20, 60], sw: 200, cape: -25 })),
    hunch(pose({ y: 2, lean: -10, ff: [5, 0], bf: [-5, 0], fa: [218, 214], ba: [25, 65], sw: 220, cape: -28 })),
  ];
  const attack = [
    hunch(pose({ y: 1, lean: 10, ff: [8, 0], bf: [-5, 0], fa: [150, 120], ba: [-20, 10], sw: 130, cape: -50 })),
    hunch(pose({ y: 2, lean: 22, ff: [9, 0], bf: [-5, 0], fa: [80, 70], ba: [-40, -10], sw: 55, cape: -60 })),
    hunch(pose({ y: 2, lean: 20, ff: [9, 0], bf: [-5, 0], fa: [55, 40], ba: [-40, -10], sw: 25, cape: -45 })),
    hunch(pose({ y: 1, lean: 12, ff: [6, 0], bf: [-4, 0], fa: [30, 40], ba: [-25, 15], sw: 35, cape: -30 })),
  ];
  const hurt = [
    hunch(pose({ y: 1, lean: -22, head: -15, ff: [4, 0], bf: [-4, 0], fa: [40, 20], ba: [-60, -30], sw: 60, cape: -50 })),
    hunch(pose({ y: 1, lean: -14, head: -10, ff: [4, 0], bf: [-4, 0], fa: [35, 25], ba: [-50, -20], sw: 50, cape: -40 })),
  ];
  const kn = { y: 6, lean: 20, head: 20, ff: [5, 0], bf: [-8, 0], fa: [20, 10], ba: [10, 30], sw: 10, cape: -10 };
  const death = [
    hurt[0],
    pose({ ...kn, y: 4, lean: 5 }),
    pose(kn),
    pose({ ...kn, y: 7, lean: 40, rot: 40, piv: [0, -1] }),
    pose({ ...kn, y: 7, lean: 40, rot: 75, piv: [0, -1] }),
    pose({ ...kn, y: 7, lean: 40, rot: 88, piv: [0, -1] }),
  ];
  return {
    idle: { poses: idle, fps: 5, repeat: -1 },
    walk: { poses: walk, fps: 9, repeat: -1 },
    windup: { poses: windup, fps: 6, repeat: 0 },
    attack: { poses: attack, fps: 16, repeat: 0 },
    hurt: { poses: hurt, fps: 10, repeat: 0 },
    death: { poses: death, fps: 10, repeat: 0 },
  };
}

// ------------------------------------------------------------------ warden (boss)
function wardenAnims() {
  const two = (o) => ({ ...o, ba: o.ba || [o.fa[0] + 6, o.fa[1] + 6] });
  const idle = range(6, (i) => {
    const t = i / 6, b = (1 - Math.cos(TAU * t)) / 2;
    return { ...pose(two({ y: 1 + b, lean: 8 + b * 2, ff: [5, 0], bf: [-5, 0], fa: [30 + b * 2, 70 + b * 3], sw: 60 - b * 3, cape: -15 - b * 6 })), wave: TAU * t };
  });
  const walk = range(8, (i) => {
    const p = i / 8;
    const foot = (q) => {
      q = ((q % 1) + 1) % 1;
      return [5 * Math.cos(TAU * q), q < 0.5 ? 0 : -3 * Math.sin(TAU * (q - 0.5))];
    };
    const c = Math.cos(TAU * p);
    return { ...pose(two({ y: 1.5 + 0.8 * Math.cos(2 * TAU * p), lean: 12, ff: foot(p), bf: foot(p + 0.5), fa: [25 + 5 * c, 60 + 5 * c], sw: 45 + 4 * c, cape: -35 + 5 * c })), wave: TAU * p };
  });
  const raise = [
    pose(two({ y: 1, lean: -6, ff: [6, 0], bf: [-6, 0], fa: [200, 190], sw: 200, cape: -20 })),
    pose(two({ y: 2, lean: -10, ff: [6, 0], bf: [-6, 0], fa: [212, 205], sw: 214, cape: -24 })),
  ];
  const slam = [
    pose(two({ y: 1, lean: 12, ff: [8, 0], bf: [-6, 0], fa: [150, 120], sw: 130, cape: -50 })),
    pose(two({ y: 3, lean: 28, ff: [9, 0], bf: [-7, 0], fa: [72, 50], sw: 25, cape: -70 })),
    pose(two({ y: 3, lean: 28, ff: [9, 0], bf: [-7, 0], fa: [70, 48], sw: 24, cape: -45 })),
    pose(two({ y: 2, lean: 20, ff: [7, 0], bf: [-6, 0], fa: [50, 50], sw: 35, cape: -25 })),
  ];
  const swipe = [
    pose(two({ y: 2, lean: 14, ff: [7, 0], bf: [-6, 0], fa: [-40, -70], sw: -50, cape: -40 })),
    pose(two({ y: 1, lean: 6, ff: [9, 0], bf: [-6, 0], fa: [60, 90], sw: 120, cape: -55 })),
    pose(two({ y: 0, lean: -4, ff: [9, 0], bf: [-5, 0], fa: [140, 160], sw: 175, cape: -50 })),
    pose(two({ y: 1, lean: 2, ff: [7, 0], bf: [-5, 0], fa: [110, 130], sw: 150, cape: -30 })),
  ];
  const crouch = [
    pose(two({ y: 4, lean: 30, ff: [7, 0], bf: [-7, 0], fa: [-30, -60], sw: -75, cape: -40 })),
    pose(two({ y: 5, lean: 34, ff: [7, 0], bf: [-8, 0], fa: [-35, -65], sw: -80, cape: -45 })),
  ];
  const dash = [0, 1].map((i) => ({
    ...pose(two({ y: 3, lean: 35, ff: [9, 0], bf: [-9, 0], fa: [90, 90], sw: 90, cape: -105 - i * 6 })), wave: i * 2,
  }));
  const leap = [
    pose(two({ y: -1, lean: -6, ff: [5, -5], bf: [-4, -3], fa: [190, 180], sw: 190, cape: -10 })),
    pose(two({ y: -1, lean: -8, ff: [5, -6], bf: [-4, -4], fa: [200, 195], sw: 205, cape: -150 })),
  ];
  const roar = [
    pose({ y: 1, lean: -12, head: -20, ff: [6, 0], bf: [-6, 0], fa: [110, 130], ba: [-110, -130], sw: 150, cape: -60 }),
    pose({ y: 1, lean: -16, head: -28, ff: [6, 0], bf: [-6, 0], fa: [120, 140], ba: [-120, -140], sw: 160, cape: -70 }),
    pose({ y: 1, lean: -14, head: -24, ff: [6, 0], bf: [-6, 0], fa: [118, 138], ba: [-118, -138], sw: 158, cape: -50 }),
  ];
  const stab = [
    pose(two({ y: 2, lean: 10, ff: [6, 0], bf: [-6, 0], fa: [170, 175], sw: 180, cape: -20 })),
    pose(two({ y: 5, lean: 22, head: 10, ff: [7, 0], bf: [-7, 0], fa: [60, 20], sw: 0, cape: -50 })),
  ];
  const kn = { y: 7, lean: 25, head: 22, ff: [6, 0], bf: [-8, 0], fa: [40, 20], ba: [46, 26], sw: 5, cape: -10 };
  const kneel = [pose(kn)];
  const death = [
    pose({ ...kn, y: 3, lean: 5, head: -20, fa: [60, 40], ba: [-60, -40], sw: 70 }),
    pose(kn),
    pose({ ...kn, lean: 35, head: 35 }),
    pose({ ...kn, lean: 45, head: 40, fa: [50, 40], ba: [50, 40], sw: 50 }),
    pose({ ...kn, lean: 50, head: 40, fa: [60, 55], ba: [60, 55], sw: 80, rot: 30, piv: [0, -1] }),
    pose({ ...kn, lean: 50, head: 40, fa: [70, 60], ba: [70, 60], sw: 85, rot: 55, piv: [0, -1] }),
  ];
  return {
    idle: { poses: idle, fps: 6, repeat: -1 },
    walk: { poses: walk, fps: 8, repeat: -1 },
    raise: { poses: raise, fps: 6, repeat: 0 },
    slam: { poses: slam, fps: 16, repeat: 0 },
    swipe: { poses: swipe, fps: 16, repeat: 0 },
    crouch: { poses: crouch, fps: 6, repeat: 0 },
    dash: { poses: dash, fps: 12, repeat: -1 },
    leap: { poses: leap, fps: 6, repeat: 0 },
    roar: { poses: roar, fps: 6, repeat: -1 },
    stab: { poses: stab, fps: 10, repeat: 0 },
    kneel: { poses: kneel, fps: 1, repeat: 0 },
    death: { poses: death, fps: 5, repeat: 0 },
  };
}

// ------------------------------------------------------------------ crypt sentinel (shield + spear)
function sentinelAnims() {
  const sp = (o) => ({ ...pose(o), swHand: 'back' });
  const idle = range(4, (i) => {
    const b = (1 - Math.cos(TAU * i / 4)) / 2;
    return { ...sp({ y: 1 + b * 0.6, lean: 8 + b, ff: [4, 0], bf: [-4, 0], fa: [60, 110], ba: [40 + b * 2, 95], sw: 93, cape: -15 - b * 5 }), wave: TAU * i / 4 };
  });
  const walk = range(8, (i) => {
    const p = i / 8;
    const foot = (q) => {
      q = ((q % 1) + 1) % 1;
      return [4 * Math.cos(TAU * q), q < 0.5 ? 0 : -3 * Math.sin(TAU * (q - 0.5))];
    };
    return { ...sp({ y: 1.4 + 0.5 * Math.cos(2 * TAU * p), lean: 10, ff: foot(p), bf: foot(p + 0.5), fa: [60, 110], ba: [40, 95], sw: 93, cape: -30 }), wave: TAU * p };
  });
  const windup = [
    sp({ y: 1, lean: -6, ff: [5, 0], bf: [-5, 0], fa: [65, 110], ba: [-45, -15], sw: 92, cape: -20 }),
    sp({ y: 2, lean: -10, ff: [5, 0], bf: [-6, 0], fa: [68, 112], ba: [-60, -25], sw: 91, cape: -24 }),
  ];
  const thrust = [
    sp({ y: 1, lean: 20, ff: [9, 0], bf: [-6, 0], fa: [50, 90], ba: [70, 88], sw: 90, cape: -60 }),
    sp({ y: 2, lean: 26, ff: [10, 0], bf: [-6, 0], fa: [45, 85], ba: [86, 90], sw: 90, cape: -70 }),
    sp({ y: 2, lean: 26, ff: [10, 0], bf: [-6, 0], fa: [45, 85], ba: [86, 90], sw: 90, cape: -50 }),
    sp({ y: 1, lean: 12, ff: [6, 0], bf: [-5, 0], fa: [58, 105], ba: [45, 95], sw: 93, cape: -30 }),
  ];
  const block = [
    sp({ y: 1, lean: -12, head: -8, ff: [4, 0], bf: [-6, 0], fa: [80, 130], ba: [30, 90], sw: 100, cape: -40 }),
    sp({ y: 1, lean: -6, head: -4, ff: [4, 0], bf: [-5, 0], fa: [70, 120], ba: [35, 92], sw: 96, cape: -30 }),
  ];
  const hurt = [
    sp({ y: 1, lean: -20, head: -15, ff: [4, 0], bf: [-4, 0], fa: [20, 40], ba: [-30, -10], sw: 60, cape: -50 }),
    sp({ y: 1, lean: -14, head: -10, ff: [4, 0], bf: [-4, 0], fa: [25, 45], ba: [-20, 0], sw: 70, cape: -40 }),
  ];
  const kn = { y: 6, lean: 20, head: 20, ff: [5, 0], bf: [-8, 0], fa: [20, 40], ba: [10, 20], sw: 20, cape: -10 };
  const death = [
    hurt[0],
    sp({ ...kn, y: 4, lean: 5 }),
    sp(kn),
    sp({ ...kn, y: 7, lean: 40, rot: 40, piv: [0, -1] }),
    sp({ ...kn, y: 7, lean: 40, rot: 75, piv: [0, -1] }),
    sp({ ...kn, y: 7, lean: 40, rot: 88, piv: [0, -1] }),
  ];
  return {
    idle: { poses: idle, fps: 5, repeat: -1 },
    walk: { poses: walk, fps: 8, repeat: -1 },
    windup: { poses: windup, fps: 5, repeat: 0 },
    thrust: { poses: thrust, fps: 14, repeat: 0 },
    block: { poses: block, fps: 10, repeat: 0 },
    hurt: { poses: hurt, fps: 10, repeat: 0 },
    death: { poses: death, fps: 10, repeat: 0 },
  };
}

// ------------------------------------------------------------------ drowned saint (boss 2)
function saintAnims() {
  const float = range(6, (i) => {
    const t = i / 6, b = (1 - Math.cos(TAU * t)) / 2;
    return { ...pose({ y: -b, lean: 4 + b * 2, fa: [30, 100], ba: [-30 - b * 6, -10 - b * 6], sw: 175, cape: -20 - b * 8 }), wave: TAU * t };
  });
  const cast = [
    pose({ lean: 0, fa: [100, 140], ba: [-60, -40], sw: 160, cape: -30 }),
    pose({ lean: -6, head: -10, fa: [150, 170], ba: [-80, -60], sw: 176, cape: -40 }),
    { ...pose({ lean: 6, fa: [115, 125], ba: [-50, -30], sw: 125, cape: -50 }), robeFlow: 1 },
  ];
  const channel = [0, 1].map((i) => ({
    ...pose({ lean: -6, head: -15, fa: [168 + i * 3, 176], ba: [-168 - i * 3, -176], sw: 180, cape: -60 - i * 10 }), wave: i * 2, robeFlow: 1,
  }));
  const slam = [
    pose({ lean: -8, fa: [195, 205], ba: [-150, -170], sw: 195, cape: -15 }),
    { ...pose({ y: 2, lean: 24, head: 10, fa: [60, 25], ba: [40, 20], sw: 2, cape: -70 }), robeFlow: 2 },
    { ...pose({ y: 2, lean: 22, head: 10, fa: [58, 24], ba: [38, 20], sw: 2, cape: -40 }), robeFlow: 1 },
  ];
  const hurt = [
    pose({ lean: -16, head: -12, fa: [20, 60], ba: [-60, -30], sw: 120, cape: -50 }),
    pose({ lean: -10, head: -8, fa: [25, 80], ba: [-45, -20], sw: 140, cape: -35 }),
  ];
  const death = [
    hurt[0],
    pose({ y: 2, lean: 25, head: 25, fa: [15, 5], ba: [10, 0], sw: 15, cape: -10 }),
    pose({ y: 3, lean: 35, head: 35, fa: [10, 0], ba: [5, 0], sw: 8, cape: -5 }),
    pose({ y: 3, lean: 40, head: 40, fa: [5, 0], ba: [0, 0], sw: 4, cape: 0, rot: 20, piv: [0, -1] }),
  ];
  return {
    float: { poses: float, fps: 6, repeat: -1 },
    cast: { poses: cast, fps: 7, repeat: 0 },
    channel: { poses: channel, fps: 6, repeat: -1 },
    slam: { poses: slam, fps: 10, repeat: 0 },
    hurt: { poses: hurt, fps: 10, repeat: 0 },
    death: { poses: death, fps: 4, repeat: 0 },
  };
}

// ------------------------------------------------------------------ bellringer (heavy hammer knight)
function bellringerAnims() {
  const heavy = (p) => ({ ...p, lean: (p.lean || 0) + 6 * Math.PI / 180 });
  const idle = range(4, (i) => {
    const b = (1 - Math.cos(TAU * i / 4)) / 2;
    return heavy({ ...pose({ y: 1 + b * 0.8, lean: 8, fa: [10, 30], ba: [-5, 10], sw: 20, cape: -12 - b * 5, ff: [3, 0], bf: [-3, 0] }), wave: TAU * i / 4 });
  });
  const walk = range(8, (i) => {
    const p = i / 8;
    const foot = (q) => {
      q = ((q % 1) + 1) % 1;
      return [3.5 * Math.cos(TAU * q), q < 0.5 ? 0 : -2.5 * Math.sin(TAU * (q - 0.5))];
    };
    const c = Math.cos(TAU * p);
    return heavy({ ...pose({ y: 1.5 + 0.4 * Math.cos(2 * TAU * p), lean: 10, ff: foot(p), bf: foot(p + 0.5), ba: [-5 + 14 * c, 15 + 14 * c], fa: [10 - 8 * c, 30 - 6 * c], sw: 18, cape: -28 }), wave: TAU * p });
  });
  const windup = [
    heavy(pose({ y: 1, lean: -6, ff: [5, 0], bf: [-5, 0], fa: [215, 205], ba: [25, 65], sw: 205, cape: -25 })),
    heavy(pose({ y: 2, lean: -10, ff: [5, 0], bf: [-6, 0], fa: [220, 212], ba: [30, 70], sw: 222, cape: -28 })),
  ];
  const slam = [
    heavy(pose({ y: 1, lean: 12, ff: [8, 0], bf: [-6, 0], fa: [150, 120], ba: [-20, 10], sw: 120, cape: -50 })),
    heavy(pose({ y: 3, lean: 28, ff: [9, 0], bf: [-7, 0], fa: [72, 50], ba: [-40, -10], sw: 10, cape: -70 })),
    heavy(pose({ y: 3, lean: 26, ff: [9, 0], bf: [-7, 0], fa: [70, 48], ba: [-38, -8], sw: 8, cape: -45 })),
    heavy(pose({ y: 2, lean: 20, ff: [7, 0], bf: [-6, 0], fa: [50, 50], ba: [-25, 15], sw: 25, cape: -25 })),
  ];
  const hurt = [
    heavy(pose({ y: 1, lean: -22, head: -15, ff: [4, 0], bf: [-4, 0], fa: [40, 20], ba: [-60, -30], sw: 50, cape: -50 })),
    heavy(pose({ y: 1, lean: -14, head: -10, ff: [4, 0], bf: [-4, 0], fa: [35, 25], ba: [-50, -20], sw: 40, cape: -40 })),
  ];
  const kn = { y: 6, lean: 20, head: 20, ff: [5, 0], bf: [-8, 0], fa: [20, 10], ba: [10, 30], sw: 5, cape: -10 };
  const death = [
    hurt[0],
    heavy(pose({ ...kn, y: 4, lean: 5 })),
    heavy(pose(kn)),
    heavy(pose({ ...kn, y: 7, lean: 40, rot: 40, piv: [0, -1] })),
    heavy(pose({ ...kn, y: 7, lean: 40, rot: 75, piv: [0, -1] })),
    heavy(pose({ ...kn, y: 7, lean: 40, rot: 88, piv: [0, -1] })),
  ];
  return {
    idle: { poses: idle, fps: 5, repeat: -1 },
    walk: { poses: walk, fps: 8, repeat: -1 },
    windup: { poses: windup, fps: 6, repeat: 0 },
    slam: { poses: slam, fps: 14, repeat: 0 },
    hurt: { poses: hurt, fps: 10, repeat: 0 },
    death: { poses: death, fps: 10, repeat: 0 },
  };
}

// The hero is rendered at the camera zoom (2.25x) and displayed at 1 / HERO_RES, so one
// texel lands on exactly one screen pixel: high detail that stays sharp.
export const HERO_RES = 2.25;
export const CHAR_SIZES = { hero: 64 * HERO_RES, hollow: 64, warden: 128, sentinel: 64, saint: 112, pyreknight: 128, pyrewitch: 112, acolyte: 80, bellringer: 80, rimeknight: 128,
  archer: 64, brute: 80, sapper: 64, ghoul: 64, shade: 96, duelist: 64, necromancer: 80, champion: 80,
  forgegolem: 128, stagspirit: 128, queen: 128, ashenking: 128 };

export function buildCharacters(scene) {
  const sets = {
    hero: heroAnims(), hollow: hollowAnims(), warden: wardenAnims(), sentinel: sentinelAnims(), saint: saintAnims(),
    pyreknight: wardenAnims(), pyrewitch: saintAnims(), acolyte: saintAnims(),
    bellringer: bellringerAnims(), rimeknight: wardenAnims(),
    archer: hollowAnims(), brute: bellringerAnims(), sapper: hollowAnims(), ghoul: hollowAnims(), shade: saintAnims(),
    duelist: sentinelAnims(), necromancer: saintAnims(), champion: hollowAnims(),
    forgegolem: wardenAnims(), stagspirit: wardenAnims(), queen: wardenAnims(), ashenking: wardenAnims(),
  };
  for (const [name, anims] of Object.entries(sets)) {
    const size = CHAR_SIZES[name];
    for (const [anim, def] of Object.entries(anims)) {
      const key = `${name}_${anim}`;
      const canvas = renderStrip(PixelCanvas, def.poses, STYLES[name], size, size);
      registerSheet(scene, key, canvas, size, size, def.poses.length);
      scene.anims.create({
        key,
        frames: def.poses.map((_, i) => ({ key, frame: i })),
        frameRate: def.fps,
        repeat: def.repeat,
      });
    }
  }
}
