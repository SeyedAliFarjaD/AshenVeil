// Lists enemy spawns too close to each bonfire (respawn safety).
import { LEVELS } from '../src/levels/index.js';
const keys = ['hollows','sentinels','acolytes','bellringers','wisps','archers','brutes','sappers','ghouls','champions','spiders','shades','duelists','necromancers'];
for (const [n, f] of Object.entries(LEVELS)) {
  const L = f();
  for (const b of L.bonfires) {
    for (const k of Object.keys(L)) {
      if (!Array.isArray(L[k]) || !L[k].length || L[k][0].x === undefined || ['bonfires','messages','anchors','secrets'].includes(k)) continue;
      for (const e of L[k]) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < 260) console.log(`L${n} bonfire@${b.x},${b.y}  ${k}@${e.x},${e.y}  d=${Math.round(d)}`); }
    }
  }
}
