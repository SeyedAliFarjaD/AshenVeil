import { buildLevel1 } from './level1.js';
import { buildLevel2 } from './level2.js';
import { buildLevel3 } from './level3.js';
import { buildLevel4 } from './level4.js';
import { buildLevel5 } from './level5.js';
import { buildLevel6 } from './level6.js';
import { buildLevel7 } from './level7.js';
import { buildLevel8 } from './level8.js';

export const LEVELS = { 1: buildLevel1, 2: buildLevel2, 3: buildLevel3, 4: buildLevel4, 5: buildLevel5, 6: buildLevel6, 7: buildLevel7, 8: buildLevel8 };
export const LAST_LEVEL = 8;

// Progress persists in localStorage between sessions.
// Three save slots; slot 1 keeps the original key so older saves carry over.
const KEY = 'ashen-vigil-save';
const slotKey = (n) => (n === 1 ? KEY : `${KEY}-${n}`);
export const SLOTS = 3;
export const save = {
  slot: 1,
  use(n) { this.slot = n; },
  peek(n) { try { return JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { return null; } },
  load() { return this.peek(this.slot); },
  write(d) {
    try { localStorage.setItem(slotKey(this.slot), JSON.stringify({ ...d, savedAt: Date.now() })); } catch (e) { /* storage unavailable */ }
  },
  clear(n = this.slot) { try { localStorage.removeItem(slotKey(n)); } catch (e) { /* storage unavailable */ } },
};
