// Skeletal pixel-art renderer. A "pose" describes joint angles (radians,
// measured from straight-down, positive = toward facing direction) and IK
// foot targets. Characters are drawn facing right; sprites flip for left.
import { hex, shade } from './pixel.js';

const dir = (a) => [Math.sin(a), Math.cos(a)];
const up = (a) => [Math.sin(a), -Math.cos(a)];

export const STYLES = {
  hero: {
    // drawn at 2x and shown at half size (HERO_RES): finer pixels and room for detail
    scale: 2.25, hd: true, helm: 'knight', cape: true, capeLen: 12, bladeLen: 15, bladeW: 2,
    c: {
      armor: hex('#5a6273'), armorLight: hex('#9aa4b5'), armorDark: hex('#343a48'),
      cloth: hex('#262330'), boots: hex('#2a2420'), belt: hex('#6b4a2b'),
      cape: hex('#9c2f2f'), capeDark: hex('#5e1a22'), eye: hex('#ffbf5a'),
      blade: hex('#e4ecf2'), bladeDark: hex('#8a97a6'), hilt: hex('#b58a3a'), plume: hex('#c43c3c'),
      outline: hex('#0b0910'),
    },
  },
  hollow: {
    scale: 0.95, helm: 'hollow', cape: true, capeLen: 8, bladeLen: 11, bladeW: 2,
    c: {
      armor: hex('#5b5446'), armorLight: hex('#857b63'), armorDark: hex('#38332b'),
      cloth: hex('#3a3128'), boots: hex('#241e19'), belt: hex('#4a3a28'),
      cape: hex('#4a3d2e'), capeDark: hex('#2e261d'), eye: hex('#d94a3a'),
      skin: hex('#8f9a86'), skinDark: hex('#5f6858'),
      blade: hex('#9a8f7c'), bladeDark: hex('#6a5a48'), hilt: hex('#4d3a26'),
      outline: hex('#0b0910'),
    },
  },
  warden: {
    scale: 1.8, bulk: 1.45, helm: 'warden', cape: true, capeLen: 13, bladeLen: 24, bladeW: 3,
    c: {
      armor: hex('#3c3a44'), armorLight: hex('#6f6a78'), armorDark: hex('#232129'),
      cloth: hex('#1b1a20'), boots: hex('#1a1616'), belt: hex('#a07a2c'),
      cape: hex('#5a1414'), capeDark: hex('#330b0e'), eye: hex('#ff7a2a'),
      blade: hex('#d9cfc4'), bladeDark: hex('#7a6e66'), hilt: hex('#a07a2c'),
      horn: hex('#d8ccb0'), trim: hex('#c39a3e'),
      outline: hex('#08070b'),
    },
  },
};

STYLES.sentinel = {
  scale: 1.05, bulk: 1.15, helm: 'sentinel', cape: true, capeLen: 9, bladeLen: 13, bladeW: 1, weapon: 'spear', shield: true,
  c: {
    armor: hex('#4f5a5c'), armorLight: hex('#8a9a9a'), armorDark: hex('#2c3436'),
    cloth: hex('#25302f'), boots: hex('#1c2020'), belt: hex('#5a4a30'),
    cape: hex('#2f4a46'), capeDark: hex('#1c2e2c'), eye: hex('#7affd8'),
    blade: hex('#c8d4d4'), bladeDark: hex('#6a7878'), hilt: hex('#5a4630'),
    shield: hex('#3a4a4a'), trim: hex('#a08a4a'), emblem: hex('#7affd8'),
    outline: hex('#070a0b'),
  },
};
STYLES.saint = {
  scale: 1.5, helm: 'saint', cape: true, capeLen: 14, bladeLen: 20, bladeW: 1, weapon: 'staff', robe: true, halo: true,
  c: {
    armor: hex('#c9cfd6'), armorLight: hex('#eef2f5'), armorDark: hex('#7e8a96'),
    cloth: hex('#3a4a5a'), boots: hex('#20262c'), belt: hex('#6ac8d8'),
    cape: hex('#26404e'), capeDark: hex('#142630'), eye: hex('#9ff6ff'),
    skin: hex('#d6e2e6'), robe: hex('#d4dce2'), robeDark: hex('#8c9aa6'),
    blade: hex('#ffffff'), bladeDark: hex('#ffffff'), hilt: hex('#4a3a2a'),
    trim: hex('#c9a24a'), orb: hex('#7ff0ff'), halo: hex('#e9d48a'),
    outline: hex('#05080b'),
  },
};

// Level 3: the Twin Pyres and their acolytes
STYLES.pyreknight = {
  scale: 1.6, bulk: 1.4, helm: 'warden', cape: true, capeLen: 13, bladeLen: 24, bladeW: 3,
  c: {
    armor: hex('#2e2a2c'), armorLight: hex('#5c4c46'), armorDark: hex('#181416'),
    cloth: hex('#1a1414'), boots: hex('#141010'), belt: hex('#ff7a2a'),
    cape: hex('#7a2410'), capeDark: hex('#40120a'), eye: hex('#ffcf5a'),
    blade: hex('#ffd9a0'), bladeDark: hex('#a8502a'), hilt: hex('#ff7a2a'),
    horn: hex('#3a3232'), trim: hex('#ff9a3a'),
    outline: hex('#080506'),
  },
};
STYLES.pyrewitch = {
  scale: 1.5, helm: 'saint', cape: true, capeLen: 14, bladeLen: 20, bladeW: 1, weapon: 'staff', robe: true, halo: true,
  c: {
    armor: hex('#4a3a3a'), armorLight: hex('#7a5a52'), armorDark: hex('#2a1e1e'),
    cloth: hex('#2a1a1a'), boots: hex('#140e0e'), belt: hex('#ff9a3a'),
    cape: hex('#5a1a10'), capeDark: hex('#300c08'), eye: hex('#ffcf5a'),
    skin: hex('#c9b8aa'), robe: hex('#3a2a2c'), robeDark: hex('#1e1416'),
    blade: hex('#ffffff'), bladeDark: hex('#ffffff'), hilt: hex('#2a1a12'),
    trim: hex('#ff9a3a'), orb: hex('#ffb347'), halo: hex('#ff7a2a'),
    outline: hex('#080506'),
  },
};
STYLES.acolyte = {
  scale: 1.0, helm: 'saint', cape: true, capeLen: 9, bladeLen: 13, bladeW: 1, weapon: 'staff', robe: true,
  c: {
    armor: hex('#5a3a30'), armorLight: hex('#8a5a48'), armorDark: hex('#2e1c18'),
    cloth: hex('#2a1a16'), boots: hex('#140e0c'), belt: hex('#ff9a3a'),
    cape: hex('#6a2416'), capeDark: hex('#3a120a'), eye: hex('#ff9a3a'),
    skin: hex('#3a2a26'), robe: hex('#5a2a1e'), robeDark: hex('#341610'),
    blade: hex('#ffffff'), bladeDark: hex('#ffffff'), hilt: hex('#3a2a1a'),
    trim: hex('#a07a3a'), orb: hex('#ff8a3a'),
    outline: hex('#080506'),
  },
};

// Level 4: the Bellringer (heavy hammer knight) and the Rimebound (boss)
STYLES.bellringer = {
  scale: 1.25, bulk: 1.25, helm: 'warden', cape: true, capeLen: 10, bladeLen: 16, bladeW: 5,
  c: {
    armor: hex('#46505c'), armorLight: hex('#7e8ca0'), armorDark: hex('#262c36'),
    cloth: hex('#232a33'), boots: hex('#161b22'), belt: hex('#8fa8c8'),
    cape: hex('#2c3a48'), capeDark: hex('#18222c'), eye: hex('#9fd8ff'),
    blade: hex('#c8d4e0'), bladeDark: hex('#6a7888'), hilt: hex('#4a3a28'),
    horn: hex('#a8b8c8'), trim: hex('#8fa8c8'),
    outline: hex('#070a0e'),
  },
};
STYLES.rimeknight = {
  scale: 1.8, bulk: 1.45, helm: 'warden', cape: true, capeLen: 13, bladeLen: 24, bladeW: 3,
  c: {
    armor: hex('#3a4450'), armorLight: hex('#7088a0'), armorDark: hex('#1e2630'),
    cloth: hex('#1a2028'), boots: hex('#12181f'), belt: hex('#9fd8ff'),
    cape: hex('#1e3448'), capeDark: hex('#0e1c2c'), eye: hex('#bfe8ff'),
    blade: hex('#e0eef8'), bladeDark: hex('#7e96ac'), hilt: hex('#9fd8ff'),
    horn: hex('#c8d8e8'), trim: hex('#bfe8ff'),
    outline: hex('#06090d'),
  },
};

// --- Expansion: levels 5-8 --------------------------------------------------
const mk = (o) => ({ outline: hex('#07060a'), ...o });
STYLES.archer = {
  scale: 0.98, helm: 'hollow', cape: true, capeLen: 10, bladeLen: 11, bladeW: 1, weapon: 'bow',
  c: mk({ armor: hex('#4a5238'), armorLight: hex('#7d8a5a'), armorDark: hex('#2a3022'), cloth: hex('#2f3624'), boots: hex('#1c1a14'), belt: hex('#6b5232'),
    cape: hex('#3b4a2c'), capeDark: hex('#222c18'), eye: hex('#e8d84a'), skin: hex('#8f9a86'), skinDark: hex('#5f6858'),
    blade: hex('#d8caa0'), bladeDark: hex('#6a5a38'), hilt: hex('#6b4a26') }),
};
STYLES.brute = {
  scale: 1.3, bulk: 1.55, helm: 'warden', cape: true, capeLen: 8, bladeLen: 14, bladeW: 6,
  c: mk({ armor: hex('#5a3a30'), armorLight: hex('#8a5a48'), armorDark: hex('#2e1c18'), cloth: hex('#2a1814'), boots: hex('#140e0c'), belt: hex('#b04a2a'),
    cape: hex('#3a2218'), capeDark: hex('#22130c'), eye: hex('#ff5a2a'), blade: hex('#a89a8a'), bladeDark: hex('#5a4e44'), hilt: hex('#4a3a2a'),
    horn: hex('#d8ccb0'), trim: hex('#b04a2a') }),
};
STYLES.sapper = {
  scale: 0.95, helm: 'hollow', cape: true, capeLen: 7, bladeLen: 8, bladeW: 3,
  c: mk({ armor: hex('#6a4a2a'), armorLight: hex('#a8783a'), armorDark: hex('#3a2812'), cloth: hex('#3a2a18'), boots: hex('#1c140c'), belt: hex('#ff9a3a'),
    cape: hex('#7a3a18'), capeDark: hex('#40200c'), eye: hex('#ffcf5a'), skin: hex('#9a8f78'), skinDark: hex('#6a604c'),
    blade: hex('#c8b890'), bladeDark: hex('#7a6a48'), hilt: hex('#3a2a18') }),
};
STYLES.ghoul = {
  scale: 0.92, bulk: 0.85, helm: 'hollow', cape: false, bladeLen: 6, bladeW: 1,
  c: mk({ armor: hex('#7a8a82'), armorLight: hex('#a8b8b0'), armorDark: hex('#46524c'), cloth: hex('#5a665e'), boots: hex('#2a302c'), belt: hex('#46524c'),
    cape: hex('#46524c'), capeDark: hex('#2a322e'), eye: hex('#c8ff7a'), skin: hex('#a8b8a0'), skinDark: hex('#6a7a66'),
    blade: hex('#d8e0d0'), bladeDark: hex('#8a9a88'), hilt: hex('#46524c') }),
};
STYLES.shade = {
  scale: 1.35, helm: 'saint', cape: true, capeLen: 16, bladeLen: 10, bladeW: 1, weapon: 'staff', robe: true,
  c: mk({ armor: hex('#3a2a52'), armorLight: hex('#6a4a92'), armorDark: hex('#1c1230'), cloth: hex('#241838'), boots: hex('#120a1c'), belt: hex('#8a5ad8'),
    cape: hex('#2a1c44'), capeDark: hex('#140c24'), eye: hex('#e0b8ff'), skin: hex('#b8a8d8'), robe: hex('#2c1e46'), robeDark: hex('#160e26'),
    blade: hex('#ffffff'), bladeDark: hex('#ffffff'), hilt: hex('#2a1c3a'), trim: hex('#8a5ad8'), orb: hex('#c898ff') }),
};
STYLES.duelist = {
  scale: 1.05, helm: 'sentinel', cape: true, capeLen: 11, bladeLen: 18, bladeW: 1, weapon: 'spear', shield: true,
  c: mk({ armor: hex('#8a8c98'), armorLight: hex('#c8cad6'), armorDark: hex('#4a4c58'), cloth: hex('#3a1a22'), boots: hex('#1c1216'), belt: hex('#c43c4a'),
    cape: hex('#8a1c2c'), capeDark: hex('#480c16'), eye: hex('#ff6a7a'), blade: hex('#f0f4fa'), bladeDark: hex('#8a92a0'), hilt: hex('#c8a24a'),
    shield: hex('#5a1c28'), trim: hex('#e0c060'), emblem: hex('#f0e0a0') }),
};
STYLES.necromancer = {
  scale: 1.05, helm: 'saint', cape: true, capeLen: 12, bladeLen: 15, bladeW: 1, weapon: 'staff', robe: true,
  c: mk({ armor: hex('#2e4a3a'), armorLight: hex('#5a8a6a'), armorDark: hex('#16261e'), cloth: hex('#1c2e24'), boots: hex('#0c1410'), belt: hex('#7aff9a'),
    cape: hex('#1e3a2c'), capeDark: hex('#0e2018'), eye: hex('#aaffc0'), skin: hex('#a8b8a8'), robe: hex('#223a2c'), robeDark: hex('#101e16'),
    blade: hex('#ffffff'), bladeDark: hex('#ffffff'), hilt: hex('#2a2418'), trim: hex('#9aff9a'), orb: hex('#7aff9a') }),
};
STYLES.champion = {
  scale: 1.25, bulk: 1.35, helm: 'warden', cape: true, capeLen: 11, bladeLen: 20, bladeW: 3,
  c: mk({ armor: hex('#22202a'), armorLight: hex('#5a5468'), armorDark: hex('#0e0d14'), cloth: hex('#14121a'), boots: hex('#0c0a10'), belt: hex('#d8a83a'),
    cape: hex('#4a1830'), capeDark: hex('#280c1a'), eye: hex('#ffd25a'), blade: hex('#e8e0d0'), bladeDark: hex('#7a7468'), hilt: hex('#d8a83a'),
    horn: hex('#c8b890'), trim: hex('#d8a83a') }),
};
// bosses
STYLES.forgegolem = {
  scale: 2.0, bulk: 2.0, helm: 'warden', cape: false, bladeLen: 24, bladeW: 7,
  c: mk({ armor: hex('#4a403c'), armorLight: hex('#8a6a50'), armorDark: hex('#241e1c'), cloth: hex('#2a2220'), boots: hex('#161210'), belt: hex('#ff7a2a'),
    cape: hex('#3a2c26'), capeDark: hex('#1e1612'), eye: hex('#ffb040'), blade: hex('#b8a898'), bladeDark: hex('#5a4a3c'), hilt: hex('#ff7a2a'),
    horn: hex('#2a2220'), trim: hex('#ff8a30') }),
};
STYLES.stagspirit = {
  scale: 1.8, bulk: 1.25, helm: 'warden', cape: true, capeLen: 15, bladeLen: 22, bladeW: 2,
  c: mk({ armor: hex('#2e5a52'), armorLight: hex('#7ae0c8'), armorDark: hex('#143028'), cloth: hex('#183a34'), boots: hex('#0c1c18'), belt: hex('#d8ffe8'),
    cape: hex('#1e5a4a'), capeDark: hex('#0e302a'), eye: hex('#e8fff0'), blade: hex('#d8fff0'), bladeDark: hex('#6ac0a8'), hilt: hex('#9affd8'),
    horn: hex('#e8f4e8'), trim: hex('#9affd8') }),
};
STYLES.queen = {
  scale: 1.75, bulk: 1.1, helm: 'knight', cape: true, capeLen: 16, bladeLen: 30, bladeW: 1,
  c: mk({ armor: hex('#b8bcc8'), armorLight: hex('#f0f2fa'), armorDark: hex('#6a6e7e'), cloth: hex('#4a1626'), boots: hex('#241018'), belt: hex('#e0c060'),
    cape: hex('#a01c38'), capeDark: hex('#560c1e'), eye: hex('#ff8a9a'), blade: hex('#ffffff'), bladeDark: hex('#a0a8b8'), hilt: hex('#e0c060'),
    plume: hex('#e03a5a') }),
};
STYLES.ashenking = {
  scale: 2.05, bulk: 1.7, helm: 'warden', cape: true, capeLen: 18, bladeLen: 30, bladeW: 4,
  c: mk({ armor: hex('#1c1a20'), armorLight: hex('#5a5262'), armorDark: hex('#0a090e'), cloth: hex('#100e14'), boots: hex('#0a080c'), belt: hex('#ffc84a'),
    cape: hex('#3a0c10'), capeDark: hex('#1c0608'), eye: hex('#ffe26a'), blade: hex('#fff0d0'), bladeDark: hex('#a07a3a'), hilt: hex('#ffc84a'),
    horn: hex('#e8d8a8'), trim: hex('#ffc84a') }),
};

export const BASE_POSE = {
  x: 0, y: 0, lean: 0.1, head: 0,
  bf: [-3, 0], ff: [3, 0],
  ba: [-0.25, 0.35], fa: [0.45, 1.4],
  sw: 2.1, swHand: 'front', cape: -0.35, wave: 0, rot: 0, piv: [0, -8],
  flask: false, glow: 0,
};

export function drawHumanoid(pc, pose, style, fw, fh) {
  const s = style.scale;
  const C = style.c;
  const P = { ...BASE_POSE, ...pose };
  const ox = fw / 2, oy = fh - 4;
  const cr = Math.cos(P.rot), sr = Math.sin(P.rot);
  const pvx = P.piv[0], pvy = P.piv[1];
  // local (unscaled, feet-origin) -> pixel coords, with optional body rotation
  const TT = (p) => {
    const x = p[0] + P.x - pvx, y = p[1] - pvy;
    const rx = x * cr - y * sr, ry = x * sr + y * cr;
    return [ox + (rx + pvx) * s, oy + (ry + pvy) * s];
  };
  const bk = style.bulk || 1;
  const W = (w) => Math.max(1, Math.round(w * s));
  const L = (a, b, c, w) => { const A = TT(a), B = TT(b); pc.line(A[0], A[1], B[0], B[1], c, W(w)); };
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

  // Skeleton
  const H = [0, -13 + P.y];
  const lean = P.lean;
  const S = add(H, up(lean), 9);
  const n = [Math.cos(lean), Math.sin(lean)]; // body-forward normal
  const head = add(S, up(lean + P.head), 4.4);
  const LEG = 6.7;

  const leg = (foot) => {
    const tgt = [foot[0], foot[1] - 1];
    let dx = tgt[0] - H[0], dy = tgt[1] - H[1];
    let d = Math.hypot(dx, dy);
    const maxD = LEG * 2 - 0.05;
    if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    const at = Math.atan2(dx, dy);
    const al = Math.acos(Math.min(1, d / (2 * LEG)));
    const K = add(H, dir(at + al), LEG);
    const A = add(K, dir(at - al), LEG);
    return { K, A, shin: at - al };
  };
  const arm = (sh, angs) => {
    const E = add(sh, dir(angs[0]), 4.8);
    const Hn = add(E, dir(angs[1]), 4.6);
    return { E, Hn };
  };

  const shB = add(S, n, -1.2), shF = add(S, n, 1.0);
  const armB = arm(shB, P.ba), armF = arm(shF, P.fa);
  const legB = leg(P.bf), legF = leg(P.ff);

  const drawLeg = (lg, dark) => {
    const f = dark ? 0.68 : 1;
    L(H, lg.K, shade(C.cloth, f * 1.2), 3 * bk);
    L(lg.K, lg.A, shade(C.armor, f), 3 * bk);
    const toe = add(lg.A, dir(lg.shin + Math.PI / 2), 2.4);
    L(lg.A, toe, shade(C.boots, f), 2);
    const k = TT(lg.K); pc.set(k[0], k[1], shade(C.armorLight, f));
  };
  const drawArm = (sh, a, dark) => {
    const f = dark ? 0.65 : 1;
    L(sh, a.E, shade(C.armor, f), 2.2 * bk);
    L(a.E, a.Hn, shade(C.armorDark, f * 1.25), 2 * bk);
  };
  const drawSword = (hand) => {
    const d = dir(P.sw), pd = [d[1], -d[0]];
    if (style.weapon === 'spear') {
      const tip = add(hand, d, style.bladeLen);
      L(add(hand, d, -7), tip, C.hilt, 1.1);
      const head = [add(tip, d, 4), add(tip, pd, 1.4), add(tip, d, -0.5), add(tip, pd, -1.4)].map(TT);
      pc.poly(head, C.blade);
      const e = TT(add(tip, d, 1)); pc.set(e[0], e[1], C.bladeDark);
      return;
    }
    if (style.weapon === 'bow') {
      // a recurved bow held out front: limbs curve away from the archer, string drawn taut
      const mid = add(hand, d, 3);
      const t1 = add(add(mid, pd, 8), d, -3.2), t2 = add(add(mid, pd, -8), d, -3.2);
      const k1 = add(add(mid, pd, 4.5), d, 0.6), k2 = add(add(mid, pd, -4.5), d, 0.6);
      L(t1, k1, C.hilt, 1.3); L(k1, mid, C.hilt, 1.5); L(mid, k2, C.hilt, 1.5); L(k2, t2, C.hilt, 1.3);
      L(t1, t2, C.blade, 0.5);
      return;
    }
    if (style.weapon === 'staff') {
      const tip = add(hand, d, style.bladeLen);
      L(add(hand, d, -9), tip, C.hilt, 1.2);
      const t = TT(add(tip, d, 1.6));
      for (let a = 0; a < Math.PI * 2; a += 0.3) pc.set(t[0] + Math.cos(a) * 2.6 * s, t[1] + Math.sin(a) * 2.6 * s, C.trim);
      pc.disc(t[0], t[1], 1.7 * s, C.orb);
      pc.disc(t[0] - 0.4 * s, t[1] - 0.4 * s, 0.8 * s, hex('#ffffff'));
      return;
    }
    const base = add(hand, d, 1.2);
    const tip = add(hand, d, 1.2 + style.bladeLen);
    L(base, tip, C.bladeDark, style.bladeW);
    // bright edge
    const A = TT(add(base, pd, 0.3)), B = TT(add(tip, pd, 0.3));
    pc.line(A[0], A[1], B[0], B[1], C.blade, 1);
    L(add(base, pd, -2), add(base, pd, 2), C.hilt, 1.2);
    L(hand, add(hand, d, -1.8), C.hilt, 1.4);
  };

  // --- cape (behind everything)
  if (style.cape) {
    const anchorB = add(S, n, -1.6), anchorF = add(S, n, 1.2);
    const right = [], left = [];
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = P.cape + Math.sin(P.wave + t * 2.6) * 0.18 * t;
      const c = add(S, dir(a), style.capeLen * t);
      const pd = [Math.cos(a), -Math.sin(a)];
      const hw = (1.6 + t * 2.2) * bk;
      right.push(add(c, pd, hw));
      left.push(add(c, pd, -hw));
    }
    // tattered hem
    const hem = [];
    const r = right[steps - 1], l = left[steps - 1];
    const tipDir = dir(P.cape);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const p = [r[0] + (l[0] - r[0]) * t, r[1] + (l[1] - r[1]) * t];
      hem.push(add(p, tipDir, (i % 2) * 1.6 + Math.sin(P.wave * 2 + i) * 0.5));
    }
    const pts = [anchorF, ...right, ...hem.slice(1, -1), ...left.reverse(), anchorB].map(TT);
    pc.poly(pts, C.cape);
    const mid = add(S, dir(P.cape + Math.sin(P.wave + 1.5) * 0.1), style.capeLen * 0.85);
    L(add(S, dir(P.cape), 2), mid, C.capeDark, 1);
  }

  // --- back limbs
  drawArm(shB, armB, true);
  if (P.swHand === 'back') drawSword(armB.Hn);
  if (!style.robe) drawLeg(legB, true);
  else {
    const sway = Math.sin(P.wave) * 1.2;
    const flow = P.robeFlow || 0;
    const hemF = [5 + sway * 0.5 + flow, -0.5], hemB = [-6 + sway - flow * 2, -0.5 + flow];
    const hem = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      hem.push([hemF[0] + (hemB[0] - hemF[0]) * t, hemF[1] + (hemB[1] - hemF[1]) * t + (i % 2) * 1.6 + Math.sin(P.wave * 2 + i) * 0.4]);
    }
    pc.poly([add(H, n, 2.8), ...hem, add(H, n, -2.8)].map(TT), C.robe);
    for (const k of [-1.5, 1.2]) L(add(H, n, k), [H[0] + k * 2 + sway * 0.5, -1], C.robeDark, 1);
  }

  // --- torso
  const torso = [add(H, n, -2.4 * bk), add(H, n, 2.4 * bk), add(S, n, 3.1 * bk), add(S, n, -3.1 * bk)].map(TT);
  pc.poly(torso, C.armor);
  L(add(add(S, n, 2.2), up(lean), -1), add(add(H, n, 1.8), up(lean), 1.5), C.armorLight, 1);
  L(add(add(S, n, -2.5), up(lean), -0.5), add(add(H, n, -2), up(lean), 2), C.armorDark, 1);
  L(add(add(H, n, -2.5), up(lean), 1), add(add(H, n, 2.5), up(lean), 1), C.belt, 1.4);
  if (style.helm === 'warden') {
    L(add(S, n, -3), add(S, n, 3), C.trim, 1);
  }

  // --- head
  const hn = [Math.cos(lean + P.head), Math.sin(lean + P.head)];
  const hu = up(lean + P.head);
  const hc = TT(head);
  if (style.halo) {
    const hh = TT(add(add(head, hu, 1.2), hn, -1.2));
    for (let a = 0; a < Math.PI * 2; a += 0.12) pc.set(hh[0] + Math.cos(a) * 5.6 * s, hh[1] + Math.sin(a) * 5.6 * s, C.halo);
  }
  if (style.helm === 'knight') {
    pc.disc(hc[0], hc[1], 3.5 * s, C.armor);
    const top = TT(add(head, hu, 2.5));
    pc.disc(top[0], top[1], 1.6 * s, C.armorLight);
    // plume flowing back
    L(add(head, hu, 3.2), add(add(head, hu, 3.6), hn, -4), C.plume, 1.4);
    L(add(add(head, hu, 3.4), hn, -3.5), add(add(head, hu, 1.8), hn, -6), C.plume, 1);
    // visor slit + glowing eye
    L(add(head, hn, 0.6), add(head, hn, 3.4), C.armorDark, 1);
    const e = TT(add(head, hn, 2.4));
    pc.set(e[0], e[1], C.eye);
    const e2 = TT(add(head, hn, 3.2)); pc.set(e2[0], e2[1], shade(C.eye, 0.8));
    if (style.hd) {
      // fine detail only the high-res hero has room for: a third plume strand,
      // a lit rim on the helm, a cheek guard line, and a brighter eye core
      L(add(add(head, hu, 3.0), hn, -3.0), add(add(head, hu, 0.8), hn, -5.4), shade(C.plume, 0.75), 0.5);
      L(add(add(head, hu, 2.6), hn, -2.2), add(add(head, hu, 2.9), hn, 1.6), C.armorLight, 0.5);
      L(add(add(head, hu, -0.8), hn, 1.0), add(add(head, hu, -2.6), hn, 2.4), C.armorDark, 0.5);
      const ec = TT(add(head, hn, 2.7)); pc.set(ec[0], ec[1], hex('#fff2c4'));
    }
  } else if (style.helm === 'hollow') {
    pc.disc(hc[0], hc[1], 3.4 * s, C.cape);
    const face = TT(add(add(head, hn, 1.3), hu, -0.6));
    pc.disc(face[0], face[1], 2.1 * s, C.skin);
    const sh = TT(add(add(head, hn, 0.4), hu, -1.6));
    pc.set(sh[0], sh[1], C.skinDark);
    const e = TT(add(add(head, hn, 2.2), hu, -0.2));
    pc.set(e[0], e[1], C.eye);
    // hood peak
    L(add(head, hu, 3), add(add(head, hu, 1.5), hn, 2.6), C.cape, 1.2);
  } else if (style.helm === 'warden') {
    pc.disc(hc[0], hc[1], 3.7 * s, C.armor);
    pc.disc(TT(add(head, hu, 1.6))[0], TT(add(head, hu, 1.6))[1], 2.2 * s, C.armorLight);
    // horns sweeping back
    L(add(add(head, hu, 2), hn, -1), add(add(head, hu, 4.5), hn, -3.5), C.horn, 1.3);
    L(add(add(head, hu, 4.5), hn, -3.5), add(add(head, hu, 6.5), hn, -3), C.horn, 1);
    L(add(add(head, hu, 2), hn, 1), add(add(head, hu, 4.2), hn, 2.6), shade(C.horn, 0.8), 1.2);
    L(add(add(head, hu, 4.2), hn, 2.6), add(add(head, hu, 6), hn, 2.2), shade(C.horn, 0.8), 1);
    // visor glow
    L(add(head, hn, 0.5), add(head, hn, 3.6), C.armorDark, 1.1);
    L(add(head, hn, 1.6), add(head, hn, 3.4), P.glow ? hex('#ffd36a') : C.eye, 0.7);
    L(add(add(head, hu, -1.2), hn, 1), add(add(head, hu, -3), hn, 2.5), C.trim, 0.8);
  } else if (style.helm === 'sentinel') {
    // great helm with a cross-shaped slit
    const q = [add(add(head, hu, 3.2), hn, -3), add(add(head, hu, 3.2), hn, 3.2), add(add(head, hu, -3.4), hn, 3.4), add(add(head, hu, -3.4), hn, -3)].map(TT);
    pc.poly(q, C.armor);
    L(add(add(head, hu, 3.2), hn, -2.6), add(add(head, hu, 3.2), hn, 2.8), C.armorLight, 1);
    L(add(head, hn, 0.8), add(head, hn, 3.4), C.armorDark, 1);
    L(add(add(head, hu, 1.6), hn, 2.4), add(add(head, hu, -2), hn, 2.4), C.armorDark, 1);
    const e = TT(add(head, hn, 2.5)); pc.set(e[0], e[1], C.eye);
  } else if (style.helm === 'saint') {
    pc.disc(hc[0], hc[1], 3.8 * s, C.cape);
    const face = TT(add(add(head, hn, 1.4), hu, -0.5));
    pc.disc(face[0], face[1], 2.2 * s, C.skin);
    for (const k of [0.7, 2.6]) {
      const e = TT(add(add(head, hn, 1.6 + k * 0.5), hu, -0.2));
      pc.set(e[0], e[1], C.eye);
    }
    // veil strands over the face
    L(add(add(head, hu, 2.6), hn, 1.2), add(add(head, hu, -3.6), hn, 2.4), C.capeDark, 0.8);
    L(add(add(head, hu, 3.4), hn, -1), add(add(head, hu, 1.5), hn, 3), C.cape, 1.2);
  }

  // --- front limbs
  if (!style.robe) drawLeg(legF, false);
  if (P.swHand === 'front') drawSword(armF.Hn);
  drawArm(shF, armF, false);
  const pa = TT(shF);
  pc.disc(pa[0], pa[1], 1.7 * s * bk, C.armorLight);
  if (bk > 1) { const pb = TT(add(shF, up(lean), 0.6)); pc.disc(pb[0], pb[1], 1.0 * s * bk, C.trim || C.armorLight); pc.disc(pa[0], pa[1], 1.1 * s * bk, C.armorLight); }
  const hand = TT(armF.Hn);
  pc.disc(hand[0], hand[1], 0.9 * s, shade(C.armorDark, 1.4));

  if (style.shield) {
    const c = add([(armF.E[0] + armF.Hn[0]) / 2, (armF.E[1] + armF.Hn[1]) / 2], n, 1.6);
    const u = up(lean);
    const kite = [add(add(c, u, 5), n, -3), add(add(c, u, 5), n, 3), add(add(c, u, -1), n, 2.8), add(c, u, -6), add(add(c, u, -1), n, -2.8)];
    pc.poly(kite.map(TT), C.shield);
    for (let i = 0; i < kite.length; i++) L(kite[i], kite[(i + 1) % kite.length], C.trim, 0.8);
    L(add(c, u, 3.5), add(c, u, -4), C.emblem, 1);
    L(add(add(c, u, 1.5), n, -1.8), add(add(c, u, 1.5), n, 1.8), C.emblem, 1);
  }

  if (P.flask) {
    const f = TT(armB.Hn);
    pc.disc(f[0], f[1] - 1, 1.8, hex('#ffb347'));
    pc.set(f[0], f[1] - 1, hex('#fff2c4'));
    pc.rect(f[0], f[1] - 4, 1, 2, hex('#c9b38a'));
  }
}

// --- pose helpers ---------------------------------------------------------
export const D = Math.PI / 180;

// Build a pose from degrees for readability.
export function pose(o) {
  const r = { ...o };
  for (const k of ['lean', 'head', 'sw', 'cape', 'rot']) if (k in r) r[k] = r[k] * D;
  for (const k of ['ba', 'fa']) if (k in r) r[k] = [r[k][0] * D, r[k][1] * D];
  return r;
}

export function lerpPose(a, b, t) {
  const A = { ...BASE_POSE, ...a }, B = { ...BASE_POSE, ...b };
  const out = {};
  for (const k in A) {
    const va = A[k], vb = B[k];
    if (typeof va === 'number') out[k] = va + (vb - va) * t;
    else if (Array.isArray(va)) out[k] = va.map((v, i) => v + (vb[i] - v) * t);
    else out[k] = t < 0.5 ? va : vb;
  }
  return out;
}

// Renders a list of poses into one horizontal strip and outlines each cell.
export function renderStrip(PixelCanvas, poses, style, fw, fh) {
  const pc = new PixelCanvas(fw * poses.length, fh);
  poses.forEach((p, i) => {
    pc.cell(i * fw, 0, fw, fh);
    drawHumanoid(pc, p, style, fw, fh);
  });
  pc.cell(0, 0, pc.w, pc.h);
  pc.ox = 0; pc.oy = 0;
  for (let i = 0; i < poses.length; i++) pc.outline(i * fw, 0, fw, fh, style.c.outline);
  return pc.flush();
}
