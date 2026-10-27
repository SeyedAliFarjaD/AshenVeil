// Player settings (volume, graphics, accessibility, key bindings), kept in
// localStorage apart from the save slots so they survive a new game.
const KEY = 'ashen-vigil-settings';

// Default keyboard bindings: the first code of each action is the one the
// player can rebind; the rest stay as fixed alternates (arrows, Z/X, ...).
export const DEFAULT_BINDS = {
  left: ['A', 'LEFT'], right: ['D', 'RIGHT'], up: ['W', 'UP'], down: ['S', 'DOWN'],
  jump: ['SPACE', 'Z'], attack: ['J', 'X'], roll: ['K', 'SHIFT', 'C'], heal: ['F', 'Q'],
  interact: ['E'], parry: ['L'], grapple: ['R'], cast: ['I'], super: ['U'], pause: ['ESC', 'P'],
};

// The actions shown in the rebinding screen, in menu order.
export const BIND_ACTIONS = [
  ['left', 'Move left'], ['right', 'Move right'], ['up', 'Up / look'], ['down', 'Down / drop'],
  ['jump', 'Jump'], ['attack', 'Attack'], ['roll', 'Roll / dash'], ['parry', 'Parry'],
  ['heal', 'Heal'], ['interact', 'Interact / rest'], ['grapple', 'Grapple'], ['cast', 'Soul Bolt'], ['super', 'Force'],
];

const DEFAULTS = {
  music: 0.8, sfx: 0.9, quality: 'auto', difficulty: 'normal', scaleMode: 'fit', shake: true, flashes: true, damageNumbers: true,
  binds: {}, lastSlot: 1,
};

export const settings = {
  ...DEFAULTS,
  // the quality actually in use: 'auto' resolves to high until the frame rate says otherwise
  effectiveQuality: 'high',

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }
    Object.assign(this, DEFAULTS, d || {});
    this.binds = { ...(d && d.binds) };
    this.effectiveQuality = this.quality === 'low' ? 'low' : 'high';
    return this;
  },

  save() {
    const d = {};
    for (const k of Object.keys(DEFAULTS)) d[k] = this[k];
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ }
  },

  // the key codes for an action: the player's chosen primary key, then the fixed alternates
  keysFor(action) {
    const def = DEFAULT_BINDS[action] || [];
    const primary = this.binds[action] || def[0];
    return [primary, ...def.slice(1).filter((k) => k !== primary)];
  },

  primaryKey(action) { return this.binds[action] || (DEFAULT_BINDS[action] || [])[0]; },

  setBind(action, code) {
    // a key can only do one thing: hand the old owner its default back
    for (const [a] of BIND_ACTIONS) {
      if (a !== action && this.primaryKey(a) === code) delete this.binds[a];
    }
    if (code === DEFAULT_BINDS[action][0]) delete this.binds[action];
    else this.binds[action] = code;
    this.save();
  },

  resetBinds() { this.binds = {}; this.save(); },
};

settings.load();

// Short label for a Phaser key-code name ("SPACE" -> "Space", "LEFT" -> "Left")
export function keyLabel(code) {
  if (!code) return '?';
  if (code.length === 1) return code;
  const map = { SPACE: 'Space', SHIFT: 'Shift', ESC: 'Esc', LEFT: 'Left', RIGHT: 'Right', UP: 'Up', DOWN: 'Down', ENTER: 'Enter', TAB: 'Tab', CTRL: 'Ctrl', ALT: 'Alt', BACKSPACE: 'Bksp' };
  return map[code] || code.charAt(0) + code.slice(1).toLowerCase();
}
