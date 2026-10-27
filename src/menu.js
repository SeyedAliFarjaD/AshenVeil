import { audio } from './audio.js';
import { settings, BIND_ACTIONS, keyLabel } from './settings.js';

const SERIF = 'Georgia, "Times New Roman", serif';

// A small page-based menu (keyboard, mouse and gamepad) shared by the title
// screen and the pause screen. A page is { title, rows, footer?, onBack? };
// each row is { label, value?: () => string, act?, left?, right?, disabled?: () => bool }.
export class Menu {
  constructor(scene, depth = 40) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    this.bg = scene.add.rectangle(480, 270, 960, 540, 0x05030a, 0.86);
    this.titleText = scene.add.text(480, 92, '', { fontFamily: SERIF, fontSize: '40px', color: '#e8c36a' }).setOrigin(0.5).setShadow(0, 0, '#000', 10);
    this.footer = scene.add.text(480, 500, '', { fontFamily: SERIF, fontSize: '14px', color: '#8a8070', align: 'center' }).setOrigin(0.5);
    this.body = scene.add.text(480, 290, '', { fontFamily: 'monospace', fontSize: '15px', color: '#d8cfb8', lineSpacing: 5, align: 'left' }).setOrigin(0.5);
    this.cursor = scene.add.graphics();
    this.layer.add([this.bg, this.cursor, this.titleText, this.body, this.footer]);
    this.rowEls = [];
    this.stack = [];
    this.index = 0;
    this.capture = null; // set while waiting for a key to rebind
    this.padPrev = {};
    this.onKey = this.onKey.bind(this);
    scene.input.keyboard.on('keydown', this.onKey);
    scene.events.once('shutdown', () => scene.input.keyboard.off('keydown', this.onKey));
  }

  get open() { return this.layer.visible; }

  // buttons held while the menu opens (e.g. Start) must be released before they count
  show(page) { this.padPrev = { up: 1, down: 1, left: 1, right: 1, a: 1, back: 1 }; this.stack = [page]; this.index = 0; this.layer.setVisible(true); this.render(); }
  push(page) { this.stack.push(page); this.index = 0; audio.play('select', 0.5); this.render(); }
  pop() {
    if (this.stack.length > 1) { this.stack.pop(); this.index = 0; audio.play('select', 0.4); this.render(); return; }
    const p = this.page;
    if (p && p.onBack) p.onBack();
  }
  hide() { this.layer.setVisible(false); this.stack = []; this.capture = null; }
  get page() { return this.stack[this.stack.length - 1]; }
  refresh() { if (this.open) this.render(); }

  render() {
    const p = this.page;
    if (!p) return;
    const s = this.scene;
    this.rowEls.forEach((r) => { r.label.destroy(); r.value.destroy(); });
    this.rowEls = [];
    this.titleText.setText(p.title || '');
    this.body.setText(p.text || '').setVisible(!!p.text);
    const rows = p.rows || [];
    const gap = rows.length > 10 ? 25 : 34;
    const y0 = p.text ? 440 : 270 - ((rows.length - 1) * gap) / 2 + 10;
    const wide = rows.some((r) => r.value);
    rows.forEach((r, i) => {
      const y = y0 + i * gap;
      const off = r.disabled && r.disabled();
      const label = s.add.text(wide ? 300 : 480, y, r.label, { fontFamily: SERIF, fontSize: '21px', color: off ? '#5a5248' : '#e8dcc0' })
        .setOrigin(wide ? 0 : 0.5, 0.5).setShadow(2, 2, '#000', 3).setInteractive({ useHandCursor: true });
      const value = s.add.text(660, y, '', { fontFamily: SERIF, fontSize: '20px', color: '#e8c36a' }).setOrigin(1, 0.5).setShadow(2, 2, '#000', 3);
      label.on('pointerover', () => { if (this.index !== i) { this.index = i; this.drawCursor(); } });
      label.on('pointerdown', () => { this.index = i; this.activate(); });
      this.layer.add([label, value]);
      this.rowEls.push({ label, value, y, row: r });
    });
    this.footer.setText(p.footer || 'W / S  choose     Enter / E  select     A / D  change     Esc  back');
    if (this.index >= rows.length) this.index = Math.max(0, rows.length - 1);
    this.updateValues();
    this.drawCursor();
    if (this.onRender) this.onRender(this.stack.length);
  }

  updateValues() {
    for (const r of this.rowEls) r.value.setText(r.row.value ? r.row.value() : '');
    if (this.capture) {
      const el = this.rowEls[this.index];
      if (el) el.value.setText('press a key...').setColor('#ff9a7a');
    } else this.rowEls.forEach((r) => r.value.setColor('#e8c36a'));
  }

  drawCursor() {
    const G = this.cursor;
    G.clear();
    const el = this.rowEls[this.index];
    if (!el) return;
    const wide = this.rowEls.some((r) => r.row.value);
    const x0 = wide ? 280 : 480 - el.label.width / 2 - 26, x1 = wide ? 680 : 480 + el.label.width / 2 + 26;
    G.fillStyle(0xe8c36a, 0.08); G.fillRect(x0, el.y - 15, x1 - x0, 30);
    G.lineStyle(1, 0xe8c36a, 0.5); G.lineBetween(x0, el.y + 15, x1, el.y + 15);
    G.fillStyle(0xe8c36a, 1); G.fillTriangle(x0 - 4, el.y - 6, x0 - 4, el.y + 6, x0 + 4, el.y);
  }

  move(d) {
    const rows = this.page.rows || [];
    if (!rows.length) return;
    let i = this.index;
    for (let n = 0; n < rows.length; n++) {
      i = (i + d + rows.length) % rows.length;
      if (!(rows[i].disabled && rows[i].disabled())) break;
    }
    this.index = i;
    audio.play('select', 0.3);
    this.drawCursor();
  }

  activate() {
    const r = (this.page.rows || [])[this.index];
    if (!r || (r.disabled && r.disabled())) { audio.play('block', 0.4); return; }
    if (r.act) { audio.play('select', 0.6); r.act(this); } else if (r.right) { r.right(this); audio.play('select', 0.4); }
    this.updateValues();
  }

  side(d) {
    const r = (this.page.rows || [])[this.index];
    const fn = r && (d < 0 ? r.left : r.right);
    if (!fn) return;
    fn(this);
    audio.play('select', 0.35);
    this.updateValues();
  }

  onKey(e) {
    if (!this.open) return;
    if (this.capture) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const name = Object.keys(K).find((k) => K[k] === e.keyCode);
      const cb = this.capture;
      this.capture = null;
      if (name && name !== 'ESC') cb(name);
      this.updateValues();
      return;
    }
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.move(-1); break;
      case 'KeyS': case 'ArrowDown': this.move(1); break;
      case 'KeyA': case 'ArrowLeft': this.side(-1); break;
      case 'KeyD': case 'ArrowRight': this.side(1); break;
      case 'Enter': case 'KeyE': case 'Space': case 'KeyJ': this.activate(); break;
      case 'Escape': case 'Backspace': this.pop(); break;
      default: break;
    }
  }

  // gamepad: D-pad / stick to move, A select, B back (call from the scene's update)
  pollPad() {
    if (!this.open) return;
    const gp = this.scene.input.gamepad;
    const pad = gp && gp.total ? gp.getPad(0) : null;
    if (!pad) return;
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
    const ax = pad.axes.length ? pad.axes[0].getValue() : 0;
    const now = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, a: b(0), back: b(1) || b(9) };
    const hit = (k) => now[k] && !this.padPrev[k];
    if (hit('up')) this.move(-1);
    if (hit('down')) this.move(1);
    if (hit('left')) this.side(-1);
    if (hit('right')) this.side(1);
    if (hit('a')) this.activate();
    if (hit('back')) this.pop();
    this.padPrev = now;
  }
}

// ---------------------------------------------------------------- shared pages
const pct = (v) => `${Math.round(v * 100)}%`;
const step = (k, d) => () => { settings[k] = Math.round(Math.min(1, Math.max(0, settings[k] + d)) * 10) / 10; settings.save(); audio.applySettings(); };
const flip = (k) => () => { settings[k] = !settings[k]; settings.save(); };
const cycle = (k, list, d) => () => { settings[k] = list[(list.indexOf(settings[k]) + d + list.length) % list.length]; settings.save(); };
const DIFFS = ['story', 'normal', 'hard'];
const DIFF_NAMES = { story: 'Story', normal: 'Normal', hard: 'Hard' };
const SCALES = ['fit', 'pixel'];
const QUALITY = ['auto', 'high', 'low'];
const cycleQuality = (d, onQuality) => () => {
  settings.quality = QUALITY[(QUALITY.indexOf(settings.quality) + d + 3) % 3];
  settings.save();
  const eff = settings.quality === 'low' ? 'low' : 'high';
  if (onQuality) onQuality(eff); else settings.effectiveQuality = eff;
};

export function settingsPage(opts = {}) {
  const fs = () => opts.scene && opts.scene.scale.isFullscreen;
  return {
    title: 'SETTINGS',
    rows: [
      { label: 'Difficulty', value: () => `${DIFF_NAMES[settings.difficulty]}${opts.inGame ? '  (next area)' : ''}`, left: cycle('difficulty', DIFFS, -1), right: cycle('difficulty', DIFFS, 1) },
      { label: 'Music volume', value: () => pct(settings.music), left: step('music', -0.1), right: step('music', 0.1) },
      { label: 'Sound effects', value: () => pct(settings.sfx), left: step('sfx', -0.1), right: step('sfx', 0.1) },
      { label: 'Graphics quality', value: () => (settings.quality === 'auto' ? `Auto (${settings.effectiveQuality})` : settings.quality === 'high' ? 'High' : 'Low'),
        left: cycleQuality(-1, opts.onQuality), right: cycleQuality(1, opts.onQuality) },
      { label: 'Screen shake', value: () => (settings.shake ? 'On' : 'Off'), left: flip('shake'), right: flip('shake') },
      { label: 'Bright flashes', value: () => (settings.flashes ? 'On' : 'Reduced'), left: flip('flashes'), right: flip('flashes') },
      { label: 'Damage numbers', value: () => (settings.damageNumbers ? 'On' : 'Off'), left: flip('damageNumbers'), right: flip('damageNumbers') },
      { label: 'Screen scale', value: () => (settings.scaleMode === 'pixel' ? 'Pixel-perfect' : 'Fit window'),
        left: () => { cycle('scaleMode', SCALES, -1)(); applyScreenScale(opts.scene && opts.scene.game); }, right: () => { cycle('scaleMode', SCALES, 1)(); applyScreenScale(opts.scene && opts.scene.game); } },
      { label: 'Fullscreen', value: () => (fs() ? 'On' : 'Off'), act: () => { if (opts.scene) opts.scene.scale.toggleFullscreen(); setTimeout(() => opts.menu && opts.menu.updateValues(), 250); } },
      { label: 'Controls...', act: (m) => m.push(controlsPage(opts)) },
      { label: 'Back', act: (m) => m.pop() },
    ],
  };
}

export function controlsPage(opts = {}) {
  const rows = BIND_ACTIONS.map(([action, name]) => ({
    label: name,
    value: () => keyLabel(settings.primaryKey(action)),
    act: (m) => { m.capture = (code) => { settings.setBind(action, code); if (opts.onRebind) opts.onRebind(); }; m.updateValues(); },
  }));
  rows.push({ label: 'Reset to defaults', act: (m) => { settings.resetBinds(); if (opts.onRebind) opts.onRebind(); m.updateValues(); } });
  rows.push({ label: 'Back', act: (m) => m.pop() });
  return {
    title: 'CONTROLS',
    rows,
    footer: 'Enter on an action, then press the new key   ·   arrows, Z/X and the gamepad always work too   ·   Esc back',
  };
}

export const MOVES_TEXT = [
  'Plunge .......... Down + Attack in mid-air (pogo off foes and spikes)',
  'Up slash ........ Up + Attack',
  'Drop through .... Down + Jump on a thin platform',
  'Wall jump ....... hold toward a wall in the air, then Jump',
  'Air dash ........ Roll while in the air',
  'Riposte ......... Attack right after a clean parry',
  'Glide ........... hold Jump while falling (Ashen Mantle)',
  '',
  'Gamepad: A jump  X attack  B roll  Y heal  LB interact  LT parry  RT grapple',
].join('\n');

// Screen scale: 'fit' stretches to the window; 'pixel' uses the largest whole-number
// zoom that fits, so every pixel of the art stays square and sharp.
export function applyScreenScale(game) {
  if (!game) return;
  const sc = game.scale;
  if (settings.scaleMode === 'pixel') {
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth / 960, window.innerHeight / 540)));
    sc.scaleMode = Phaser.Scale.NONE;
    sc.setZoom(k);
  } else {
    sc.scaleMode = Phaser.Scale.FIT;
    sc.setZoom(1);
  }
  sc.refresh();
}
