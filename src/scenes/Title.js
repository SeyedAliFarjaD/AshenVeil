import { audio } from '../audio.js';
import { save, SLOTS } from '../levels/index.js';
import { Menu, settingsPage } from '../menu.js';
import { settings } from '../settings.js';


function slotSummary(d) {
  const t = d.time || 0, h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  const time = h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  const ng = d.ng ? `  NG+${d.ng}` : '';
  return `${d.cleared ? 'Cleared  ' : ''}Level ${d.level}${ng}  ·  ${time}`;
}

const SERIF = 'Georgia, "Times New Roman", serif';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    // pixel-art backdrop at 2x
    const mk = (key, y = 0) => this.add.tileSprite(0, y, 480, 270, key).setOrigin(0).setScale(2);
    mk('bg_sky');
    this.far = mk('bg_far', -40);
    this.mid = mk('bg_mid', -20);
    this.fogBand = this.add.tileSprite(0, 330, 480, 90, 'bg_fog').setOrigin(0).setScale(2).setAlpha(0.9);
    this.add.rectangle(480, 520, 960, 60, 0x0b0910);

    // the knight resting at a bonfire
    const gx = 480, gy = 500;
    this.add.image(gx, gy + 6, 'glow').setTint(0xff8a30).setScale(3.2).setAlpha(0.35).setBlendMode('ADD');
    this.add.sprite(gx + 40, gy, 'bonfire').setOrigin(0.5, 1).setScale(2).play('bonfire_lit');
    this.add.sprite(gx - 30, gy, 'hero_kneel').setOrigin(0.5, 140 / 144).setScale(128 / 144);
    this.add.particles(gx + 40, gy - 30, 'px', {
      speedY: { min: -60, max: -20 }, speedX: { min: -15, max: 15 }, lifespan: 1800, frequency: 60,
      scale: { start: 1.5, end: 0 }, tint: [0xffb347, 0xff7a2a, 0xffe2a0], blendMode: 'ADD',
    });

    this.add.image(0, 0, 'vignette_title').setOrigin(0);

    this.titleText = this.add.text(480, 130, 'ASHEN VIGIL', { fontFamily: SERIF, fontSize: '84px', color: '#e8c36a' }).setOrigin(0.5).setShadow(0, 0, '#000', 14);
    if (this.titleText.setLetterSpacing) this.titleText.setLetterSpacing(10);
    this.add.text(950, 532, 'v1.0', { fontFamily: SERIF, fontSize: '12px', color: '#5a5248' }).setOrigin(1, 1);
    this.cameras.main.fadeIn(800);

    // first screen: "press any key" (also unlocks audio), then the main menu
    const press = this.add.text(480, 300, 'Press any key', { fontFamily: SERIF, fontSize: '22px', color: '#f5e6c8' }).setOrigin(0.5).setShadow(2, 2, '#000', 4);
    this.tweens.add({ targets: press, alpha: 0.25, yoyo: true, repeat: -1, duration: 1000, ease: 'Sine.InOut' });
    this.menu = new Menu(this, 20);
    this.menu.bg.setFillStyle(0x05030a, 0.0);
    this.menu.footer.setY(452);
    // the big logo shows on the main page; sub-pages use the menu's own heading on a dark veil
    this.menu.onRender = (depth) => {
      const main = depth === 1;
      this.titleText.setVisible(main);
      this.menu.titleText.setVisible(!main);
      this.menu.bg.setFillStyle(0x05030a, main ? 0 : 0.8);
    };
    const wake = () => {
      if (this.awake) return;
      this.awake = true;
      audio.init();
      audio.play('select', 0.5);
      press.destroy();
      this.time.delayedCall(60, () => this.menu.show(this.mainPage()));
    };
    this.input.keyboard.once('keydown', wake);
    this.input.once('pointerdown', wake);
    if (this.input.gamepad) this.input.gamepad.once('down', wake);
    if (new URLSearchParams(location.search).has('menu')) wake();
  }

  // the most recently played slot with a save in it
  latestSlot() {
    let best = null;
    for (let n = 1; n <= SLOTS; n++) {
      const d = save.peek(n);
      if (d && (!best || (d.savedAt || 0) > (best.d.savedAt || 0))) best = { n, d };
    }
    return best;
  }

  mainPage() {
    const latest = this.latestSlot();
    const rows = [];
    if (latest) rows.push({ label: `Continue   ·   ${slotSummary(latest.d)}`, act: () => this.startSlot(latest.n, latest.d) });
    rows.push({ label: 'New game', act: (m) => m.push(this.slotsPage('new')) });
    if (latest) rows.push({ label: 'Load game', act: (m) => m.push(this.slotsPage('load')) });
    rows.push({ label: 'Settings', act: (m) => m.push(settingsPage({ scene: this, menu: m })) });
    rows.push({ label: 'Credits', act: () => this.leave(() => this.scene.start('Ending', { credits: true })) });
    return { title: '', rows, footer: 'W / S  choose     Enter  select     Esc  back', onBack: () => {} };
  }

  slotsPage(mode) {
    const rows = [];
    for (let n = 1; n <= SLOTS; n++) {
      const d = save.peek(n);
      rows.push({
        label: `Slot ${n}`,
        value: () => (d ? slotSummary(d) : 'Empty'),
        disabled: () => mode === 'load' && !d,
        act: (m) => {
          if (mode === 'load') return this.startSlot(n, d);
          if (!d) return this.startSlot(n, null);
          m.push({
            title: `OVERWRITE SLOT ${n}?`,
            text: `${slotSummary(d)}
This save will be lost.`,
            rows: [{ label: 'Keep it', act: (mm) => mm.pop() }, { label: 'Overwrite', act: () => { save.clear(n); this.startSlot(n, null); } }],
          });
        },
      });
    }
    rows.push({ label: 'Back', act: (m) => m.pop() });
    return { title: mode === 'load' ? 'LOAD GAME' : 'NEW GAME', rows };
  }

  startSlot(n, d) {
    save.use(n);
    settings.lastSlot = n; settings.save();
    const data = d ? { level: d.level, carry: d } : {};
    this.leave(() => this.scene.start('Game', data));
  }

  leave(fn) {
    if (this.leaving) return;
    this.leaving = true;
    audio.play('bonfire', 0.6);
    this.menu.hide();
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', fn);
  }

  update(time) {
    this.menu.pollPad();
    this.far.tilePositionX = time * 0.004;
    this.mid.tilePositionX = time * 0.01;
    this.fogBand.tilePositionX = time * 0.02;
  }
}
