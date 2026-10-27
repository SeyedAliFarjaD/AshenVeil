import { audio } from '../audio.js';
import { CHARMS, CHARM } from '../charms.js';
import { Menu, settingsPage, controlsPage, MOVES_TEXT } from '../menu.js';
import { settings } from '../settings.js';

const SERIF = 'Georgia, "Times New Roman", serif';

// Bonfire level-up: Dark Souls style stat investment with escalating costs.
const STATS = [
  { key: 'vigor', name: 'VIGOR', base: 500, desc: '+20 maximum health' },
  { key: 'endur', name: 'ENDURANCE', base: 400, desc: '+15 maximum stamina' },
  { key: 'str', name: 'STRENGTH', base: 450, desc: '+8% damage with every blow' },
  { key: 'attun', name: 'ATTUNEMENT', base: 600, desc: '+1 Ember Flask (up to 7)' },
];
const statCost = (s, lvl) => Math.floor(s.base * Math.pow(1.55, lvl));
const ROMAN = ['-', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (n) => ROMAN[n] || String(n);
const fmt = (n) => n.toLocaleString('en-US');

// Bonfire shop: items bought with embers, each with a rank cap.
const SHOP_ITEMS = [
  { key: 'lifeseed', name: 'LIFESEED', base: 350, max: 5, desc: '+20 maximum health' },
  { key: 'hexed', name: 'HEXED EMBER', base: 400, max: 5, desc: '+15% Soul Bolt and Force damage' },
  { key: 'attuned', name: 'ATTUNED MIND', base: 450, max: 4, desc: '+25% focus from hits and parries' },
  { key: 'flask', name: 'EMBER FLASK', base: 500, max: 2, desc: '+1 Ember Flask (heal more often)' },
  { key: 'luck', name: 'LUCKY COIN', base: 375, max: 4, desc: '+25% embers from the fallen' },
  { key: 'sigil', name: 'GUARDIAN SIGIL', base: 600, max: 3, desc: '-10% damage taken' },
];
const shopCost = (s, lvl) => Math.floor(s.base * Math.pow(1.5, lvl));

// ---------------------------------------------------------------- HUD chrome
// Cut-corner plates and beveled tracks, so the vitals read as forged iron
// rather than three floating rectangles.
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const chamferPath = (G, x, y, w, h, c) => {
  G.beginPath();
  G.moveTo(x + c, y); G.lineTo(x + w - c, y); G.lineTo(x + w, y + c);
  G.lineTo(x + w, y + h - c); G.lineTo(x + w - c, y + h); G.lineTo(x + c, y + h);
  G.lineTo(x, y + h - c); G.lineTo(x, y + c); G.closePath();
};
const hudPlate = (G, x, y, w, h, a = 0.62) => {
  G.fillStyle(0x05030a, a); chamferPath(G, x, y, w, h, 7); G.fillPath();
  G.lineStyle(1, 0x6b5638, 0.9); chamferPath(G, x, y, w, h, 7); G.strokePath();
  G.lineStyle(1, 0x000000, 0.55); chamferPath(G, x + 2, y + 2, w - 4, h - 4, 6); G.strokePath();
};
const hudTrack = (G, x, y, w, h) => {
  G.fillStyle(0x000000, 0.7); G.fillRect(x - 2, y - 2, w + 4, h + 4);
  G.fillStyle(0x100c12, 1); G.fillRect(x, y, w, h);
  G.lineStyle(1, 0x3d3225, 1); G.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
};

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.leavingLevel = false;
    this.hintBox = null;
    const g = this.game_ = this.scene.get('Game');
    this.W = 960; this.H = 540;

    // vignette
    if (!this.textures.exists('vignette')) {
      const c = document.createElement('canvas'); c.width = 960; c.height = 540;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(480, 270, 200, 480, 270, 620);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(5,3,10,0.45)'); gr.addColorStop(1, 'rgba(5,3,10,0.9)');
      x.fillStyle = gr; x.fillRect(0, 0, 960, 540);
      this.textures.addCanvas('vignette', c);
    }
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(-5);

    // ------------------------------------------------------------ player HUD
    // A soul vessel (focus) on the left, and health / stamina bars that grow with the
    // hero's maximums, flask pips underneath. Bar chrome depends on max HP / stamina,
    // so it is redrawn with the fills each frame; only the ember purse is static.
    this.hudFrame = this.add.graphics().setDepth(1);
    this.gfx = this.add.graphics().setDepth(2);
    this.BAR = { cx: 56, cy: 52, r: 30, x: 100, hp: 28, hpH: 16, st: 50, stH: 8, pips: 72 };
    this.hpLag = 100; this.lagDelay = 0; this.stLag = 100;
    this.shownEmbers = 0; this.prevHp = 100; this.hpFlash = 0; this.emberPop = 0;
    this.hpLowShown = false; this.emberHot = false; this.focusFullShown = false;

    hudPlate(this.hudFrame, 842, 486, 100, 40);                                  // ember purse

    // blood wash that pulses when the hero is close to death
    this.lowHp = this.add.rectangle(480, 270, 960, 540, 0x6a0a10, 1).setDepth(0).setAlpha(0);

    this.hpText = this.add.text(0, 36, '', { fontFamily: SERIF, fontSize: '12px', color: '#f3e6cc' })
      .setOrigin(1, 0.5).setDepth(3).setShadow(1, 1, '#000', 2);
    this.hpShown = '';
    this.lvText = this.add.text(this.BAR.cx, this.BAR.cy + this.BAR.r + 11, 'LV 1', { fontFamily: SERIF, fontSize: '11px', color: '#c9b38a' })
      .setOrigin(0.5).setDepth(3).setShadow(1, 1, '#000', 2);
    this.lvShown = -1;
    // focus readout inside the vessel, and the key hint once a spell is affordable
    this.focusText = this.add.text(this.BAR.cx, this.BAR.cy, '0', { fontFamily: SERIF, fontSize: '14px', color: '#f0e2c0' })
      .setOrigin(0.5).setDepth(3).setShadow(1, 1, '#000', 3);
    this.focusShown = -1;
    this.spellHint = this.add.text(this.BAR.x + 116, this.BAR.pips, '', { fontFamily: SERIF, fontSize: '11px', color: '#e8c36a' })
      .setOrigin(1, 0.5).setDepth(3).setShadow(1, 1, '#000', 2);
    this.spellHintShown = '';

    // flasks: one pip per flask, under the stamina bar
    this.flaskPips = [];
    for (let i = 0; i < 7; i++) {
      this.flaskPips.push(this.add.image(this.BAR.x + 7 + i * 18, this.BAR.pips, 'icon_flask').setScale(1.7).setDepth(3).setVisible(false));
    }
    this.flaskShown = '';

    // embers
    this.emberIcon = this.add.image(862, 506, 'icon_ember').setScale(2).setDepth(3);
    this.emberText = this.add.text(932, 506, '0', { fontFamily: SERIF, fontSize: '19px', color: '#f0e2c0' })
      .setOrigin(1, 0.5).setDepth(3).setShadow(2, 2, '#000', 2);

    // ability slots (bottom-left): every power has a sealed socket from the start;
    // earning it lights a crisp vector rune, and a spent air move dims until you land
    makeAbilityIcons(this);
    this.abilitySlots = [
      { tex: 'ab_double', flag: 'hasDouble', used: 'usedDouble', key: 'SPC', col: 0x9fe8ff },
      { tex: 'ab_wall', flag: 'hasWallJump', key: 'WALL', col: 0xd8c8a8 },
      { tex: 'ab_dash', flag: 'hasDash', used: 'usedDash', key: 'K', col: 0xff8a40 },
      { tex: 'ab_hook', flag: 'hasGrapple', used: 'usedGrapple', cd: 'grappleCd', key: 'R', col: 0xc0d0e0 },
      { tex: 'ab_glide', flag: 'hasGlide', key: 'HOLD', col: 0xc8a0ff },
    ].map((s, i) => {
      const x = 16 + i * 44;
      const glow = this.add.image(x + 19, 494, 'ab_glow').setDepth(3).setTint(s.col).setBlendMode('ADD').setAlpha(0);
      const img = this.add.image(x + 19, 494, s.tex).setDepth(3).setVisible(false);
      const key = this.add.text(x + 19, 516, s.key, { fontFamily: 'monospace', fontSize: '9px', color: '#b8a888' })
        .setOrigin(0.5, 0).setDepth(3).setShadow(1, 1, '#000', 1).setVisible(false);
      return { ...s, img, glow, keyText: key, x, fit: 1, lit: false };
    });

    // run stats (top-right): play time and deaths
    hudPlate(this.hudFrame, 842, 10, 100, 50);
    const glass = this.add.graphics().setDepth(3);
    glass.fillStyle(0xc9b38a, 1); // hourglass
    glass.fillTriangle(856, 18, 866, 18, 861, 25); glass.fillTriangle(856, 32, 866, 32, 861, 25);
    glass.fillRect(855, 17, 12, 1); glass.fillRect(855, 32, 12, 1);
    glass.fillStyle(0xe8d8c0, 1); // skull
    glass.fillCircle(861, 44, 5); glass.fillRect(858, 47, 7, 4);
    glass.fillStyle(0x1a1418, 1);
    glass.fillRect(858, 42, 3, 3); glass.fillRect(862, 42, 3, 3); glass.fillRect(860, 49, 2, 2);
    this.timeText = this.add.text(932, 25, '0:00', { fontFamily: SERIF, fontSize: '15px', color: '#f0e2c0' })
      .setOrigin(1, 0.5).setDepth(3).setShadow(1, 1, '#000', 2);
    this.deathText = this.add.text(932, 46, '0', { fontFamily: SERIF, fontSize: '15px', color: '#f0e2c0' })
      .setOrigin(1, 0.5).setDepth(3).setShadow(1, 1, '#000', 2);
    this.timeShown = -1; this.deathsShown = -1;

    // cheat indicator: top-right under the run stats, visible only while one-shot mode is on (Shift+O)
    this.cheatBox = this.add.container(936, 66).setDepth(2).setVisible(false);
    const cheatLabel = this.add.text(0, 0, 'ONE-SHOT', { fontFamily: SERIF, fontSize: '14px', color: '#ff7a6a' }).setOrigin(1, 0).setShadow(2, 2, '#000', 3);
    const skull = this.add.graphics();
    skull.fillStyle(0xe8d8c0, 1); // bone
    skull.fillCircle(-6, 7, 5);
    skull.fillRect(-9, 10, 7, 4);
    skull.fillStyle(0x1a1418, 1); // eyes + teeth
    skull.fillRect(-9, 5, 3, 3);
    skull.fillRect(-5, 5, 3, 3);
    skull.fillRect(-7, 12, 2, 2);
    skull.x = -cheatLabel.width - 10;
    this.cheatBox.add([skull, cheatLabel]);

    // boss bars (one per boss; twin fights stack two)
    this.bossBars = [];

    // prompt + message
    this.prompt = this.add.text(480, 420, '', { fontFamily: SERIF, fontSize: '16px', color: '#f5e6c8', backgroundColor: 'rgba(10,8,14,0.7)', padding: { x: 10, y: 5 } })
      .setOrigin(0.5).setDepth(3).setVisible(false);
    this.msgBox = this.add.text(480, 110, '', {
      fontFamily: SERIF, fontSize: '17px', color: '#ffcf8a', align: 'center', lineSpacing: 6,
      backgroundColor: 'rgba(10,8,14,0.78)', padding: { x: 18, y: 12 },
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.toastText = this.add.text(480, 60, '', { fontFamily: SERIF, fontSize: '15px', color: '#d8cfb8' }).setOrigin(0.5).setDepth(3).setAlpha(0).setShadow(2, 2, '#000', 3);

    // banner band
    this.band = this.add.rectangle(480, 270, 960, 90, 0x000000, 0.65).setDepth(10).setAlpha(0);
    this.bannerText = this.add.text(480, 262, '', { fontFamily: SERIF, fontSize: '52px', color: '#e8c36a' }).setOrigin(0.5).setDepth(11).setAlpha(0).setShadow(0, 0, '#000', 8);
    this.bannerSub = this.add.text(480, 304, '', { fontFamily: SERIF, fontSize: '16px', color: '#cfc4ae' }).setOrigin(0.5).setDepth(11).setAlpha(0);

    // full-screen flash
    this.flashRect = this.add.rectangle(480, 270, 960, 540, 0xffffff, 1).setDepth(20).setAlpha(0);

    // pause menu: resume, settings, key rebinding, move list, quit to title
    this.pauseMenu = new Menu(this, 30);
    this.pauseLayer = this.pauseMenu.layer;
    const g0 = this.game_;
    const opts = {
      scene: this, menu: this.pauseMenu, inGame: true,
      onQuality: (q) => g0.setQuality(q),
      onRebind: () => g0.ctl.rebind(),
    };
    this.pausePage = {
      title: 'PAUSED',
      onBack: () => this.resumeFromPause(),
      rows: [
        { label: 'Resume', act: () => this.resumeFromPause() },
        { label: 'Settings', act: (m) => m.push(settingsPage(opts)) },
        { label: 'Controls', act: (m) => m.push(controlsPage(opts)) },
        { label: 'Move list', act: (m) => m.push({ title: 'MOVES', text: MOVES_TEXT, rows: [{ label: 'Back', act: (mm) => mm.pop() }] }) },
        { label: 'Quit to title', act: (m) => m.push({
          title: 'QUIT TO TITLE?',
          text: 'Progress is kept from the last bonfire you rested at.',
          rows: [{ label: 'Stay', act: (mm) => mm.pop() }, { label: 'Quit to title', act: () => this.quitToTitle() }],
        }) },
      ],
    };

    // --- level-up menu (opened by resting at a bonfire)
    this.menuOpen = false;
    this.menuIndex = 0;
    this.menuPanel = 'stats';          // 'stats' = ascend, 'shop' = spend embers, 'charms' = buy + equip
    this.menuLayer = this.add.container(0, 0).setDepth(35).setVisible(false);
    this.menuLayer.add(this.add.rectangle(480, 270, 960, 540, 0x05030a, 0.88));
    this.menuLayer.add(this.add.text(480, 66, 'BONFIRE', { fontFamily: SERIF, fontSize: '40px', color: '#e8c36a' }).setOrigin(0.5).setShadow(0, 0, '#000', 8));
    this.menuEmbers = this.add.text(480, 110, '', { fontFamily: SERIF, fontSize: '20px', color: '#f0e2c0' }).setOrigin(0.5);
    this.menuLayer.add(this.menuEmbers);
    // panel tabs
    this.menuTabStats = this.add.text(370, 140, 'ASCEND', { fontFamily: SERIF, fontSize: '17px' }).setOrigin(0.5);
    this.menuTabShop = this.add.text(480, 140, 'SHOP', { fontFamily: SERIF, fontSize: '17px' }).setOrigin(0.5);
    this.menuTabCharms = this.add.text(590, 140, 'CHARMS', { fontFamily: SERIF, fontSize: '17px' }).setOrigin(0.5);
    this.menuLayer.add([this.menuTabStats, this.menuTabShop, this.menuTabCharms]);
    this.menuRowEls = STATS.map((s, i) => {
      const y = 168 + i * 52;
      const name = this.add.text(280, y, '', { fontFamily: SERIF, fontSize: '22px', color: '#f0e2c0' }).setOrigin(0, 0.5);
      const lvl = this.add.text(545, y, '', { fontFamily: SERIF, fontSize: '22px', color: '#c9b38a' }).setOrigin(0, 0.5);
      const cost = this.add.text(660, y, '', { fontFamily: SERIF, fontSize: '20px', color: '#8f7a3a' }).setOrigin(0, 0.5);
      const desc = this.add.text(280, y + 21, s.desc, { fontFamily: SERIF, fontSize: '13px', color: '#8a8070' }).setOrigin(0, 0.5);
      this.menuLayer.add([name, lvl, cost, desc]);
      return { s, name, lvl, cost, desc };
    });
    this.menuShopEls = SHOP_ITEMS.map((s, i) => {
      const y = 162 + i * 40;
      const name = this.add.text(280, y, '', { fontFamily: SERIF, fontSize: '20px', color: '#f0e2c0' }).setOrigin(0, 0.5);
      const lvl = this.add.text(545, y, '', { fontFamily: SERIF, fontSize: '20px', color: '#c9b38a' }).setOrigin(0, 0.5);
      const cost = this.add.text(660, y, '', { fontFamily: SERIF, fontSize: '19px', color: '#8f7a3a' }).setOrigin(0, 0.5);
      const desc = this.add.text(280, y + 17, s.desc, { fontFamily: SERIF, fontSize: '13px', color: '#8a8070' }).setOrigin(0, 0.5);
      this.menuLayer.add([name, lvl, cost, desc]);
      return { s, name, lvl, cost, desc };
    });
    this.menuShopEls.forEach((r) => [r.name, r.lvl, r.cost, r.desc].forEach((t) => t.setVisible(false)));
    // charms: a gem icon, name, notch cost, and status (equipped / owned / price / boss reward)
    this.menuCharmEls = CHARMS.map((s, i) => {
      const y = 156 + i * 15.5;
      const gem = this.add.graphics();
      gem.fillStyle(0x000000, 0.6); gem.fillCircle(262, y, 6.5);
      gem.fillStyle(s.color, 1); gem.fillCircle(262, y, 5);
      gem.fillStyle(0xffffff, 0.7); gem.fillCircle(260.5, y - 1.5, 1.6);
      const name = this.add.text(280, y, '', { fontFamily: SERIF, fontSize: '16px', color: '#f0e2c0' }).setOrigin(0, 0.5);
      const lvl = this.add.text(520, y, '', { fontFamily: SERIF, fontSize: '14px', color: '#c9b38a' }).setOrigin(0, 0.5);
      const cost = this.add.text(600, y, '', { fontFamily: SERIF, fontSize: '14px', color: '#8f7a3a' }).setOrigin(0, 0.5);
      this.menuLayer.add([gem, name, lvl, cost]);
      return { s, gem, name, lvl, cost };
    });
    this.menuCharmEls.forEach((r) => [r.gem, r.name, r.lvl, r.cost].forEach((t) => t.setVisible(false)));
    this.menuDerived = this.add.text(480, 436, '', { fontFamily: SERIF, fontSize: '16px', color: '#cfc4ae', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    this.menuLayer.add(this.menuDerived);
    this.menuLayer.add(this.add.text(480, 486, 'W / S  -  choose      A / D  -  switch tab      E / Enter  -  buy / equip      Esc  -  leave', { fontFamily: SERIF, fontSize: '15px', color: '#9a907e' }).setOrigin(0.5));

    this.input.keyboard.on('keydown-M', () => audio.toggleMute());
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'KeyO' && e.shiftKey) this.toggleCheat();
    });

    // events from the game
    const ev = g.events;
    const on = (name, fn) => { ev.on(name, fn, this); this.events.once('shutdown', () => ev.off(name, fn, this)); };
    on('hud', (d) => this.onHud(d));
    on('banner', (t, c, sub, dur, big) => this.banner(t, c, sub, dur, big));
    on('toast', (t) => this.toast(t));
    on('hint', (t) => this.hint(t));
    on('item', (name, desc) => this.itemGet(name, desc));
    on('you-died', () => this.youDied());
    on('respawn', () => this.clearDeath());
    on('boss-show', (list) => this.showBosses([].concat(list)));
    on('boss-hide', () => this.hideBosses());
    on('boss-phase2', (msg) => this.toast(msg || 'The Warden\'s flame rekindles...'));
    on('pause', (v) => { if (v && !this.menuOpen) this.pauseMenu.show(this.pausePage); else this.pauseMenu.hide(); });
    on('complete', (s) => this.complete(s));
    on('open-levelup', () => { this.game_.setPaused(true); this.pauseMenu.hide(); this.openLevelUp(); });
    on('focus-full', () => {
      if (!this.focusToastShown) {
        this.focusToastShown = true;
        this.toast('Focus is full  -  U for Force');
        this.time.delayedCall(5000, () => { this.focusToastShown = false; });
      }
    });
  }

  resumeFromPause() {
    this.pauseMenu.hide();
    this.game_.ctl.swallow();
    this.game_.setPaused(false);
  }

  quitToTitle() {
    this.pauseMenu.hide();
    audio.stopMusic(0.6);
    this.scene.stop('Game');
    this.scene.start('Title');
  }

  // ------------------------------------------------------------ cheat
  toggleCheat() {
    const g = this.game_;
    g.oneShot = !g.oneShot;
    this.tweens.killTweensOf(this.cheatBox);
    this.cheatBox.setAlpha(1);
    this.cheatBox.setVisible(g.oneShot);
    if (g.oneShot) {
      this.tweens.add({ targets: this.cheatBox, alpha: 0.5, yoyo: true, repeat: -1, duration: 650 });
      audio.play('select', 0.6);
      this.toast('CHEAT  -  one-shot ON   (Shift + O toggles)');
    } else {
      audio.play('block', 0.5);
      this.toast('Cheat off  -  one-shot disabled');
    }
  }

  // ------------------------------------------------------------ level-up menu
  openLevelUp() {
    this.menuIndex = 0;
    this.menuPanel = 'stats';
    this.menuLayer.setVisible(true);
    this.refreshMenu();
    this.input.keyboard.on('keydown', this.menuKeys, this);
    this.menuOpen = true;
  }

  closeLevelUp() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.menuLayer.setVisible(false);
    this.input.keyboard.off('keydown', this.menuKeys, this);
    this.game_.ctl.swallow();
    this.game_.setPaused(false);
  }

  menuKeys(e) {
    if (!this.menuOpen) return;
    const rows = { stats: STATS, shop: SHOP_ITEMS, charms: CHARMS }[this.menuPanel];
    const panels = ['stats', 'shop', 'charms'];
    const pi = panels.indexOf(this.menuPanel);
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.menuIndex = (this.menuIndex + rows.length - 1) % rows.length; audio.play('select', 0.6); this.refreshMenu(); break;
      case 'ArrowDown': case 'KeyS': this.menuIndex = (this.menuIndex + 1) % rows.length; audio.play('select', 0.6); this.refreshMenu(); break;
      case 'KeyA': case 'ArrowLeft': this.switchPanel(panels[Math.max(0, pi - 1)]); break;
      case 'KeyD': case 'ArrowRight': this.switchPanel(panels[Math.min(panels.length - 1, pi + 1)]); break;
      case 'KeyE': case 'Enter': case 'Space':
        if (this.menuPanel === 'shop') this.buyShop();
        else if (this.menuPanel === 'charms') this.useCharm();
        else this.buyStat();
        break;
      case 'Escape': case 'KeyQ': this.closeLevelUp(); break;
      default: break;
    }
  }

  switchPanel(panel) {
    if (this.menuPanel === panel) return;
    this.menuPanel = panel;
    this.menuIndex = 0;
    audio.play('select', 0.6);
    this.refreshMenu();
  }

  buyStat() {
    const g = this.game_;
    const p = g.player;
    const s = STATS[this.menuIndex];
    const lvl = p.stats[s.key];
    const c = statCost(s, lvl);
    if (p.embers < c) { audio.play('block', 0.6); this.toast('Not enough embers'); return; }
    p.embers -= c;
    p.stats[s.key]++;
    p.applyStats();
    p.hp = p.maxHp; p.st = p.maxSt; p.flasks = p.maxFlasks;
    audio.play('heal');
    audio.play('select');
    g.fx.burst('embers', p.x, p.y - 24, 30);
    g.writeSave();
    this.refreshMenu();
  }

  // buy a shop item: embers -> permanent rank, capped per item
  buyShop() {
    const g = this.game_;
    const p = g.player;
    const s = SHOP_ITEMS[this.menuIndex];
    const lvl = p.shop[s.key] || 0;
    if (lvl >= s.max) { audio.play('block', 0.6); this.toast(`${s.name}  -  full rank already`); return; }
    const c = shopCost(s, lvl);
    if (p.embers < c) { audio.play('block', 0.6); this.toast('Not enough embers'); return; }
    p.embers -= c;
    p.shop[s.key] = lvl + 1;
    p.applyStats();
    p.hp = p.maxHp; p.st = p.maxSt; p.flasks = p.maxFlasks;
    audio.play('heal');
    audio.play('select');
    g.fx.burst('embers', p.x, p.y - 24, 30);
    g.writeSave();
    this.toast(`${s.name}  -  rank ${lvl + 1} of ${s.max}`);
    this.refreshMenu();
  }

  // charms tab: buy an unowned charm, or equip / unequip an owned one (notches permitting)
  useCharm() {
    const g = this.game_;
    const p = g.player;
    const s = CHARMS[this.menuIndex];
    if (!p.charms.includes(s.key)) {
      if (s.secret) { audio.play('block', 0.6); this.toast('This charm lies hidden somewhere in the world'); return; }
      if (!s.price) { audio.play('block', 0.6); this.toast('This charm is won from a fallen lord'); return; }
      if (p.embers < s.price) { audio.play('block', 0.6); this.toast('Not enough embers'); return; }
      p.embers -= s.price;
      p.charms.push(s.key);
      audio.play('pickup', 0.7);
      this.toast(`${s.name}  -  bought. Press E again to equip.`);
    } else if (p.equipped.includes(s.key)) {
      p.equipped = p.equipped.filter((k) => k !== s.key);
      audio.play('select');
    } else {
      const used = p.equipped.reduce((n, k) => n + CHARM[k].notch, 0);
      if (used + s.notch > p.notches) { audio.play('block', 0.6); this.toast('Not enough charm notches'); return; }
      p.equipped.push(s.key);
      audio.play('heal', 0.6);
      g.fx.burst('spirit', p.x, p.y - 24, 20);
    }
    const hp = p.hp;
    p.applyStats();
    p.hp = Math.min(p.maxHp, Math.max(hp, p.hp));
    g.writeSave();
    this.refreshMenu();
  }

  refreshMenu() {
    const p = this.game_.player;
    this.menuEmbers.setText(`Embers   ${fmt(p.embers)}`);
    const shop = this.menuPanel === 'shop', charms = this.menuPanel === 'charms', stats = !shop && !charms;
    this.menuTabStats.setColor(stats ? '#ffe2a0' : '#6a5c46');
    this.menuTabShop.setColor(shop ? '#ffe2a0' : '#6a5c46');
    this.menuTabCharms.setColor(charms ? '#ffe2a0' : '#6a5c46');
    const used = p.equipped.reduce((n, k) => n + CHARM[k].notch, 0);
    this.menuCharmEls.forEach((r, i) => {
      [r.gem, r.name, r.lvl, r.cost].forEach((t) => t.setVisible(charms));
      if (!charms) return;
      const owned = p.charms.includes(r.s.key), on = p.equipped.includes(r.s.key);
      const sel = i === this.menuIndex;
      r.gem.setAlpha(owned ? 1 : 0.25);
      r.name.setText(`${sel ? '> ' : ''}${r.s.secret && !owned ? '? ? ?' : r.s.name}`).setColor(on ? '#ffe2a0' : owned ? (sel ? '#ffe2a0' : '#f0e2c0') : (sel ? '#c9b38a' : '#7a6e5a'));
      r.lvl.setText('\u25c6'.repeat(r.s.notch)).setColor(on ? '#ffe2a0' : '#8f7a3a');
      if (on) r.cost.setText('EQUIPPED').setColor('#ffe2a0');
      else if (owned) r.cost.setText('owned').setColor('#c9b38a');
      else if (r.s.price) r.cost.setText(fmt(r.s.price)).setColor(p.embers >= r.s.price ? '#c9b38a' : '#6a2a2a');
      else r.cost.setText(r.s.secret ? 'hidden' : 'boss reward').setColor('#6a5c46');
    });
    if (charms) {
      const s = CHARMS[this.menuIndex];
      const shown = s.secret && !p.charms.includes(s.key) ? { name: '? ? ?', desc: 'Somewhere a false wall hides it' } : s;
      this.menuDerived.setText(`Notches   ${'\u25c6'.repeat(used)}${'\u25c7'.repeat(Math.max(0, p.notches - used))}   (${used} / ${p.notches})\n${shown.name}  -  ${shown.desc}`);
    }
    this.menuRowEls.forEach((r, i) => {
      [r.name, r.lvl, r.cost, r.desc].forEach((t) => t.setVisible(stats));
      if (!stats) return;
      const lvl = p.stats[r.s.key];
      const c = statCost(r.s, lvl);
      const sel = i === this.menuIndex;
      r.name.setText(`${sel ? '> ' : ''}${r.s.name}`).setColor(sel ? '#ffe2a0' : '#f0e2c0');
      r.lvl.setText(roman(lvl)).setColor(sel ? '#ffe2a0' : '#c9b38a');
      r.cost.setText(fmt(c)).setColor(p.embers >= c ? (sel ? '#ffe2a0' : '#c9b38a') : '#6a2a2a');
    });
    this.menuShopEls.forEach((r, i) => {
      [r.name, r.lvl, r.cost, r.desc].forEach((t) => t.setVisible(shop));
      if (!shop) return;
      const lvl = p.shop[r.s.key] || 0;
      const c = shopCost(r.s, lvl);
      const sel = i === this.menuIndex;
      const maxed = lvl >= r.s.max;
      r.name.setText(`${sel ? '> ' : ''}${r.s.name}`).setColor(sel ? '#ffe2a0' : '#f0e2c0');
      r.lvl.setText(`${lvl} / ${r.s.max}`).setColor(sel ? '#ffe2a0' : '#c9b38a');
      r.cost.setText(maxed ? 'MAX' : fmt(c)).setColor(maxed ? '#6a5c46' : (p.embers >= c ? (sel ? '#ffe2a0' : '#c9b38a') : '#6a2a2a'));
      r.desc.setText(lvl > 0 ? `${r.s.desc}   -  owned ${lvl}` : r.s.desc);
    });
    if (charms) {
      // notches + the selected charm, set above
    } else if (shop) {
      this.menuDerived.setText(
        `Health ${p.maxHp}    Flasks ${p.maxFlasks}\n` +
        `Spell damage ${Math.round(p.dmgMul * p.spellMul * 100)}%    Focus gain ${Math.round(p.focusMul * 100)}%\n` +
        `Embers from the fallen ${Math.round(p.emberMul * 100)}%    Ward ${Math.round((1 - p.dmgTakenMul) * 100)}%`
      );
    } else {
      const lv = 1 + p.stats.vigor + p.stats.endur + p.stats.str + p.stats.attun;
      this.menuDerived.setText(
        `Soul Level ${lv}\nHP ${p.maxHp}    Stamina ${p.maxSt}    Flasks ${p.maxFlasks}    Damage ${Math.round(p.dmgMul * 100)}%`
      );
    }
  }

  showBosses(list) {
    this.hideBosses();
    this.bossBars = list.map((boss, i) => {
      const y = 478 - (list.length - 1 - i) * 40;
      const name = this.add.text(200, y - 26, boss.name, { fontFamily: SERIF, fontSize: '18px', color: '#e6dccb' })
        .setDepth(2).setShadow(2, 2, '#000', 3).setAlpha(0);
      this.tweens.add({ targets: name, alpha: 1, duration: 800 });
      return { boss, name, y, lag: 1, delay: 0.6 };
    });
  }

  hideBosses() {
    this.bossBars.forEach((b) => b.name.destroy());
    this.bossBars = [];
  }

  flash(color, dur, alpha) {
    this.flashRect.setFillStyle(color, 1).setAlpha(alpha);
    this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: dur });
  }

  onHud(d) {
    if (d.prompt) this.prompt.setText(d.prompt).setVisible(true); else this.prompt.setVisible(false);
    if (d.message !== this.curMsg) {
      this.curMsg = d.message;
      this.tweens.killTweensOf(this.msgBox);
      if (d.message) { this.msgBox.setText(d.message); this.tweens.add({ targets: this.msgBox, alpha: 1, duration: 250 }); }
      else this.tweens.add({ targets: this.msgBox, alpha: 0, duration: 300 });
    }
  }

  // tutorial prompt: a framed line above the HUD until the move is used (or it times out)
  hint(t) {
    if (!this.hintBox) {
      this.hintBox = this.add.container(480, 440).setDepth(12).setAlpha(0);
      this.hintBg = this.add.graphics();
      this.hintText = this.add.text(0, 0, '', { fontFamily: SERIF, fontSize: '16px', color: '#f0e2c0' }).setOrigin(0.5).setShadow(2, 2, '#000', 3);
      this.hintBox.add([this.hintBg, this.hintText]);
    }
    this.tweens.killTweensOf(this.hintBox);
    if (!t) { this.tweens.add({ targets: this.hintBox, alpha: 0, duration: 400 }); return; }
    this.hintText.setText(t);
    const w = this.hintText.width + 40, h = 34;
    this.hintBg.clear();
    this.hintBg.fillStyle(0x05030a, 0.78); this.hintBg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    this.hintBg.lineStyle(1, 0xe8c36a, 0.6); this.hintBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    this.hintBox.setAlpha(0).setY(452);
    this.tweens.add({ targets: this.hintBox, alpha: 1, y: 440, duration: 350, ease: 'Cubic.out' });
  }

  toast(t) {
    this.toastText.setText(t).setAlpha(0);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 1, duration: 300, yoyo: true, hold: 2200 });
  }

  banner(text, color = '#e8c36a', sub = null, dur = 2600, big = false) {
    const items = [this.band, this.bannerText, this.bannerSub];
    this.tweens.killTweensOf(items);
    this.bannerText.setText(text).setColor(color).setFontSize(big ? 64 : 46).setScale(1);
    this.bannerText.setLetterSpacing ? this.bannerText.setLetterSpacing(6) : null;
    this.bannerSub.setText(sub || '');
    items.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: this.band, alpha: 1, duration: 500, yoyo: true, hold: dur });
    this.tweens.add({ targets: [this.bannerText, this.bannerSub], alpha: 1, duration: 700, yoyo: true, hold: dur - 200 });
    this.tweens.add({ targets: this.bannerText, scale: 1.06, duration: dur + 1000 });
  }

  itemGet(name, desc) {
    this.banner(name, '#fff2d0', desc, 3600);
  }

  youDied() {
    this.died = this.add.container(0, 0).setDepth(25);
    const band = this.add.rectangle(480, 270, 960, 120, 0x000000, 0.75);
    const txt = this.add.text(480, 270, 'YOU DIED', { fontFamily: SERIF, fontSize: '72px', color: '#a0161a' }).setOrigin(0.5).setShadow(0, 0, '#000', 10);
    txt.setLetterSpacing ? txt.setLetterSpacing(8) : null;
    this.died.add([band, txt]);
    this.died.setAlpha(0);
    this.tweens.add({ targets: this.died, alpha: 1, duration: 1400 });
    this.tweens.add({ targets: txt, scale: 1.08, duration: 4200 });
  }

  clearDeath() {
    if (this.died) { this.died.destroy(); this.died = null; }
  }

  complete(s) {
    if (!s.next) { // the final boss: epilogue + credits, then the title (the save holds New Game+)
      this.time.delayedCall(800, () => { this.scene.stop('Game'); this.scene.start('Ending', s); });
      return;
    }
    const c = this.add.container(0, 0).setDepth(40).setAlpha(0);
    const mm = Math.floor(s.time / 60), ss = String(s.time % 60).padStart(2, '0');
    c.add(this.add.rectangle(480, 270, 960, 540, 0x05030a, 0.92));
    c.add(this.add.text(480, 150, 'LEVEL COMPLETE', { fontFamily: SERIF, fontSize: '50px', color: '#e8c36a' }).setOrigin(0.5));
    const title = s.name.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
    c.add(this.add.text(480, 205, title, { fontFamily: SERIF, fontSize: '20px', color: '#cfc4ae' }).setOrigin(0.5));
    c.add(this.add.text(480, 300, `Time   ${mm}:${ss}\nDeaths   ${s.deaths}\nEmbers   ${s.embers}`, { fontFamily: SERIF, fontSize: '22px', color: '#f0e2c0', align: 'center', lineSpacing: 10 }).setOrigin(0.5));
    const msg = s.next ? `Press Enter to descend to Level ${s.next}` : 'The vigil ends here... for now.';
    const hint = this.add.text(480, 415, msg, { fontFamily: SERIF, fontSize: '18px', color: '#d8cfb8' }).setOrigin(0.5);
    c.add(hint);
    if (!s.next) {
      const ngHint = this.add.text(480, 462, `Enter  -  New Game+ ${s.ng + 1}: the dead endure more, and are worth more\nN  -  return to the title`, {
        fontFamily: SERIF, fontSize: '17px', color: '#e8c36a', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);
      c.add(ngHint);
      this.tweens.add({ targets: ngHint, alpha: 0.4, yoyo: true, repeat: -1, duration: 900 });
    }
    this.tweens.add({ targets: c, alpha: 1, duration: 1500 });
    this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 900 });
    this.time.delayedCall(1500, () => {
      const go = () => {
        if (this.leavingLevel) return;
        this.leavingLevel = true;
        if (s.next) {
          this.scene.start('Game', { level: s.next, carry: s.carry });
        } else {
          this.scene.start('Game', { level: 1, carry: { ...s.carry, ng: s.ng + 1 } });
        }
      };
      this.input.keyboard.once('keydown-ENTER', go);
      if (this.input.gamepad) this.input.gamepad.once('down', go);
      if (!s.next) this.input.keyboard.once('keydown-N', () => { this.scene.stop('Game'); this.scene.start('Title'); });
    });
  }

  update(time, delta) {
    this.pauseMenu.pollPad();
    const dt = delta / 1000;
    const g = this.game_;
    const p = g.player;
    if (!p) return;
    const G = this.gfx;
    const B = this.BAR;
    G.clear();

    // low-health vignette: a red heartbeat on the screen edges below 30% HP
    if (p.hp > 0 && p.hp < p.maxHp * 0.3) {
      const beat = 0.5 + 0.5 * Math.sin(time / 1000 * 7);
      const k = (1 - p.hp / (p.maxHp * 0.3)) * 0.5 + 0.25;
      for (let i = 0; i < 6; i++) {
        const w = 6 + i * 7, a = k * (0.22 - i * 0.03) * (0.6 + 0.4 * beat);
        G.fillStyle(0xb01818, a);
        G.fillRect(0, 0, this.W, w); G.fillRect(0, this.H - w, this.W, w);
        G.fillRect(0, w, w, this.H - 2 * w); G.fillRect(this.W - w, w, w, this.H - 2 * w);
      }
    }

    // ---------------------------------------------------------------- vitals
    if (p.hp < this.prevHp - 0.05) this.hpFlash = 1;
    this.prevHp = p.hp;
    this.hpFlash = Math.max(0, this.hpFlash - dt * 3.2);

    // lagging "damage taken" trail (souls style)
    if (p.hp < this.hpLag) { this.lagDelay -= dt; if (this.lagDelay <= 0) this.hpLag = Math.max(p.hp, this.hpLag - 60 * dt); }
    else { this.hpLag = p.hp; this.lagDelay = 0.55; }
    if (p.hp >= this.hpLag) this.lagDelay = 0.55;
    this.stLag = p.st < this.stLag ? Math.max(p.st, this.stLag - 70 * dt) : p.st;

    const hpF = clamp01(p.hp / p.maxHp);
    const stF = clamp01(p.st / p.maxSt);
    const foF = clamp01(p.focus / 100);
    const lagF = clamp01(this.hpLag / p.maxHp);
    const stLagF = clamp01(this.stLag / p.maxSt);
    const beat = Math.sin(time / 170) * 0.5 + 0.5;          // 0..1 pulse for warnings
    // bars grow with the maximums, like a souls HUD
    const hpW = Math.min(330, 190 + (p.maxHp - 100) * 0.75);
    const stW = Math.min(300, 160 + (p.maxSt - 100) * 1.0);

    // backing plate, sized to the bars
    const plateW = B.x + Math.max(hpW, stW, 230) + 14 - 12;
    G.fillStyle(0x05030a, 0.55); chamferPath(G, 12, 12, plateW, 82, 8); G.fillPath();
    G.lineStyle(1, 0x6b5638, 0.75); chamferPath(G, 12, 12, plateW, 82, 8); G.strokePath();

    // health: gold trail, crimson fill with a lit crown, a tick every 25 HP
    hudTrack(G, B.x, B.hp, hpW, B.hpH);
    if (lagF > hpF) { G.fillStyle(0xd8b066, 1); G.fillRect(B.x, B.hp, hpW * lagF, B.hpH); }
    G.fillStyle(hpF < 0.3 ? 0xa81e22 : 0x8e2126, 1); G.fillRect(B.x, B.hp, hpW * hpF, B.hpH);
    G.fillStyle(0xd84a3a, 0.9); G.fillRect(B.x, B.hp, hpW * hpF, 4);
    G.fillStyle(0xff9a80, 0.35); G.fillRect(B.x, B.hp + 1, hpW * hpF, 1);
    G.fillStyle(0x3a0a0e, 0.85); G.fillRect(B.x, B.hp + B.hpH - 3, hpW * hpF, 3);
    for (let v = 25; v < p.maxHp; v += 25) { const tx = B.x + hpW * (v / p.maxHp); G.fillStyle(0x000000, v % 100 ? 0.3 : 0.6); G.fillRect(tx, B.hp, 1, B.hpH); }
    if (hpF > 0 && hpF < 1) { G.fillStyle(0xfff0d8, 0.85); G.fillRect(B.x + hpW * hpF - 1, B.hp, 1, B.hpH); }
    if (this.hpFlash > 0.01) { G.fillStyle(0xffffff, this.hpFlash * 0.55); G.fillRect(B.x, B.hp, hpW * Math.max(hpF, lagF), B.hpH); }
    if (hpF < 0.3) {
      G.fillStyle(0xff4a3a, 0.1 + 0.2 * beat); G.fillRect(B.x, B.hp, hpW * hpF, B.hpH);
      G.lineStyle(1, 0xff5a4a, 0.25 + 0.5 * beat); G.strokeRect(B.x - 2.5, B.hp - 2.5, hpW + 5, B.hpH + 5);
    }
    this.lowHp.setAlpha(hpF < 0.3 ? (0.03 + 0.1 * beat) * (1 - hpF / 0.3) : 0);

    // stamina: green with a pale "spent" trail, amber and pulsing once nearly empty
    hudTrack(G, B.x, B.st, stW, B.stH);
    const stLow = p.st < 22;
    if (stLagF > stF) { G.fillStyle(0xbfe0a0, 0.55); G.fillRect(B.x, B.st, stW * stLagF, B.stH); }
    G.fillStyle(stLow ? 0x9a7a24 : 0x2f7a3e, 1); G.fillRect(B.x, B.st, stW * stF, B.stH);
    G.fillStyle(stLow ? 0xf0d070 : 0x8ad08a, 0.6); G.fillRect(B.x, B.st, stW * stF, 2);
    if (stLow) { G.fillStyle(0xffe2a0, 0.12 + 0.2 * beat); G.fillRect(B.x, B.st, stW * Math.max(stF, 0.02), B.stH); }

    // soul vessel: a round gauge that fills with focus, a tick at the Soul Bolt price,
    // burning red-gold and pulsing when Force (U) is ready
    const foFull = p.focus >= 100;
    const { cx, cy, r } = B;
    G.fillStyle(0x000000, 0.75); G.fillCircle(cx, cy, r + 4);
    G.fillStyle(0x120c14, 1); G.fillCircle(cx, cy, r);
    if (foF > 0) {
      // the liquid: the part of the circle below the current level
      const lvl = cy + r - 2 * r * foF;
      const a0 = Math.asin(Phaser.Math.Clamp((lvl - cy) / r, -1, 1));
      G.fillStyle(foFull ? 0xff6a3a : 0xc9963a, 0.95);
      G.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = a0 + (Math.PI - 2 * a0) * (i / 24);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (i === 0) G.moveTo(px, py); else G.lineTo(px, py);
      }
      G.closePath(); G.fillPath();
      const half = Math.sqrt(Math.max(0, r * r - (lvl - cy) * (lvl - cy)));
      G.fillStyle(0xfff0c0, 0.6); G.fillRect(cx - half + 1, lvl, Math.max(0, half * 2 - 2), 1);
    }
    if (foFull) { G.fillStyle(0xffd0a0, 0.12 + 0.25 * beat); G.fillCircle(cx, cy, r); }
    G.lineStyle(2, foFull ? 0xffb070 : 0x8a7048, foFull ? 0.6 + 0.4 * beat : 1); G.strokeCircle(cx, cy, r + 1);
    G.lineStyle(1, 0x000000, 0.7); G.strokeCircle(cx, cy, r - 1);
    const tickY = cy + r - 2 * r * clamp01(p.boltCost / 100);
    const tickHalf = Math.sqrt(Math.max(0, r * r - (tickY - cy) * (tickY - cy)));
    G.fillStyle(p.focus >= p.boltCost ? 0xffe2a0 : 0x6b5638, 1);
    G.fillRect(cx - tickHalf - 4, tickY, 5, 1); G.fillRect(cx + tickHalf - 1, tickY, 5, 1);

    const fv = Math.floor(p.focus);
    if (fv !== this.focusShown) { this.focusShown = fv; this.focusText.setText(String(fv)); }
    if (foFull !== this.focusFullShown) { this.focusFullShown = foFull; this.focusText.setColor(foFull ? '#fff4d8' : '#f0e2c0'); }
    this.focusText.setScale(foFull ? 1 + 0.12 * beat : 1);
    const hint = foFull ? 'FORCE  [U]    BOLT  [I]' : p.focus >= p.boltCost ? 'BOLT  [I]' : '';
    if (hint !== this.spellHintShown) { this.spellHintShown = hint; this.spellHint.setText(hint); }
    this.spellHint.setX(B.x + Math.max(hpW, stW));
    this.spellHint.setAlpha(hint ? (foFull ? 0.6 + 0.4 * beat : 0.8) : 0);

    const hpStr = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    if (hpStr !== this.hpShown) { this.hpShown = hpStr; this.hpText.setText(hpStr); }
    this.hpText.setPosition(B.x + hpW - 4, B.hp + B.hpH / 2);
    const hpLow = hpF < 0.3;
    if (hpLow !== this.hpLowShown) { this.hpLowShown = hpLow; this.hpText.setColor(hpLow ? '#ffd0c0' : '#f3e6cc'); }
    const lv = 1 + p.stats.vigor + p.stats.endur + p.stats.str + p.stats.attun;
    if (lv !== this.lvShown) { this.lvShown = lv; this.lvText.setText('LV ' + lv); }

    // ---------------------------------------------------------------- flasks
    const fk = `${p.flasks}/${p.maxFlasks}`;
    if (fk !== this.flaskShown) {
      const before = this.flaskShown ? Number(this.flaskShown.split('/')[0]) : p.flasks;
      this.flaskShown = fk;
      this.flaskPips.forEach((img, i) => {
        img.setVisible(i < p.maxFlasks);
        const full = i < p.flasks;
        img.setTexture(full ? 'icon_flask' : 'icon_flask_empty').setAlpha(full ? 1 : 0.45);
        if (i === p.flasks && before > p.flasks) this.tweens.add({ targets: img, scale: { from: 2.6, to: 1.7 }, duration: 260, ease: 'Back.Out' });
      });
    }

    // ---------------------------------------------------------------- run stats
    const secs = g.playSeconds;
    if (secs !== this.timeShown) {
      this.timeShown = secs;
      const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, sec = String(secs % 60).padStart(2, '0');
      this.timeText.setText(h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`);
    }
    if (g.deaths !== this.deathsShown) {
      if (this.deathsShown >= 0) this.tweens.add({ targets: this.deathText, scale: { from: 1.5, to: 1 }, duration: 400, ease: 'Back.Out' });
      this.deathsShown = g.deaths;
      this.deathText.setText(String(g.deaths));
    }

    // ---------------------------------------------------------------- embers
    if (this.shownEmbers !== p.embers) {
      const diff = p.embers - this.shownEmbers;
      if (diff > 0) this.emberPop = 1;
      this.shownEmbers += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.15));
      if (Math.sign(p.embers - this.shownEmbers) !== Math.sign(diff)) this.shownEmbers = p.embers;
      this.emberText.setText(String(this.shownEmbers));
    }
    this.emberPop = Math.max(0, this.emberPop - dt * 2.2);
    this.emberIcon.setScale(2 + this.emberPop * 0.45);
    const hot = this.emberPop > 0.02;
    if (hot !== this.emberHot) { this.emberHot = hot; this.emberText.setColor(hot ? '#ffe2a0' : '#f0e2c0'); }

    // ---------------------------------------------------------------- ability slots
    const tNow = this.time.now / 1000;
    for (const s of this.abilitySlots) {
      const on = !!p[s.flag];
      if (on !== s.lit) {
        s.lit = on;
        s.img.setVisible(on); s.keyText.setVisible(on);
        if (on) {
          s.img.setScale(0.1);
          this.tweens.add({ targets: s.img, scale: 1, duration: 380, ease: 'Back.easeOut' });
          s.glow.setAlpha(1).setScale(2.2);
          this.tweens.add({ targets: s.glow, scale: 1, alpha: 0.35, duration: 700, ease: 'Cubic.out' });
        }
      }
      const x = s.x, y = 475, w = 38, h = 38;
      // socket: dark bevelled diamond-cut frame
      chamferPath(G, x, y, w, h, 8);
      G.fillStyle(0x05030a, on ? 0.72 : 0.45); G.fillPath();
      G.lineStyle(on ? 1.5 : 1, on ? 0x8a6f44 : 0x3a3028, on ? 0.95 : 0.7); chamferPath(G, x, y, w, h, 8); G.strokePath();
      if (!on) {
        // sealed: a faint carved rune
        G.lineStyle(1, 0x3a3028, 0.8);
        G.strokeCircle(x + 19, y + 19, 6); G.lineBetween(x + 19, y + 9, x + 19, y + 29);
        continue;
      }
      G.lineStyle(1, s.col, 0.25); chamferPath(G, x + 3, y + 3, w - 6, h - 6, 6); G.strokePath();
      const spent = (s.used && p[s.used]) || (s.cd && p[s.cd] > 0);
      s.img.setAlpha(spent ? 0.3 : 1);
      if (!this.tweens.isTweening(s.glow)) s.glow.setAlpha(spent ? 0 : 0.28 + 0.1 * Math.sin(tNow * 2.4 + x));
      if (s.cd && p[s.cd] > 0) { // cooldown sweep
        const k = Math.min(1, p[s.cd] / 1.2);
        G.fillStyle(0x000000, 0.55); G.fillRect(x + 2, y + 2 + (h - 4) * (1 - k), w - 4, (h - 4) * k);
      }
    }

    // equipped charms, right-aligned above the purse
    (p.equipped || []).forEach((key, i) => {
      const c = CHARM[key];
      if (!c) return;
      const gx = 930 - i * 15;
      G.fillStyle(0x000000, 0.7); G.fillCircle(gx, 474, 5.4);
      G.fillStyle(c.color, 1); G.fillCircle(gx, 474, 3.8);
      G.fillStyle(0xffffff, 0.6); G.fillCircle(gx - 1.2, 472.8, 1.3);
      G.lineStyle(1, 0x6b5638, 0.7); G.strokeCircle(gx, 474, 5.4);
    });

    // boss bars
    for (const bb of this.bossBars) {
      const b = bb.boss;
      const frac = Math.max(0, b.hp / b.maxHp);
      if (frac < bb.lag) { bb.delay -= dt; if (bb.delay <= 0) bb.lag = Math.max(frac, bb.lag - 0.25 * dt); }
      if (frac >= bb.lag) { bb.lag = frac; bb.delay = 0.6; }
      bb.name.setAlpha(b.dead ? 0.35 : bb.name.alpha);
      // boss bar: same forged look as the hero's vitals
      const bx = 200, bw = 560, bh = 9;
      G.fillStyle(0x000000, 0.7); G.fillRect(bx - 2, bb.y - 2, bw + 4, bh + 4);
      G.fillStyle(0x100c12, 1); G.fillRect(bx, bb.y, bw, bh);
      if (bb.lag > frac) { G.fillStyle(0xc9a45a, 1); G.fillRect(bx, bb.y, bw * bb.lag, bh); }
      G.fillStyle(b.phase === 2 ? 0xc0391c : 0x8e2126, 1); G.fillRect(bx, bb.y, bw * frac, bh);
      G.fillStyle(0xffffff, 0.16); G.fillRect(bx, bb.y, bw * frac, 3);
      G.lineStyle(1, 0x3d3225, 1); G.strokeRect(bx - 1.5, bb.y - 1.5, bw + 3, bh + 3);
    }
  }
}

// crisp 32px vector runes for the ability slots, drawn once into textures
function makeAbilityIcons(scene) {
  if (scene.textures.exists('ab_double')) return;
  const mk = (key, draw) => { const g = scene.make.graphics({ add: false }); draw(g); g.generateTexture(key, 32, 32); g.destroy(); };
  const glowCanvas = scene.textures.createCanvas('ab_glow', 48, 48);
  const cx = glowCanvas.getContext(), gr = cx.createRadialGradient(24, 24, 2, 24, 24, 24);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 48, 48); glowCanvas.refresh();
  // double jump: two rising chevrons over a pale wing
  mk('ab_double', (g) => {
    g.fillStyle(0x9fe8ff, 0.35); g.fillTriangle(6, 26, 16, 18, 26, 26);
    for (const [y, a] of [[18, 0.65], [8, 1]]) {
      g.lineStyle(4, 0xe8fbff, a); g.beginPath(); g.moveTo(7, y + 8); g.lineTo(16, y); g.lineTo(25, y + 8); g.strokePath();
    }
    g.fillStyle(0xffffff, 1); g.fillCircle(16, 8, 1.6);
  });
  // wall jump: a stone wall with three claw gouges and a kick-off arrow
  mk('ab_wall', (g) => {
    g.fillStyle(0x6a5a48, 1); g.fillRect(3, 3, 9, 26);
    g.lineStyle(1, 0x2a2018, 1); for (let y = 9; y < 29; y += 7) g.lineBetween(3, y, 12, y);
    g.lineStyle(2, 0xf0e2c0, 1); for (let i = 0; i < 3; i++) g.lineBetween(5 + i * 2.5, 8 + i * 2, 10 + i * 2.5, 20 + i * 2);
    g.lineStyle(3, 0xd8c8a8, 1); g.beginPath(); g.moveTo(14, 22); g.lineTo(27, 9); g.strokePath();
    g.fillStyle(0xd8c8a8, 1); g.fillTriangle(29, 6, 21, 8, 27, 14);
  });
  // cinder dash: a flame comet streaking right
  mk('ab_dash', (g) => {
    g.fillStyle(0x8a2a10, 0.8); g.fillTriangle(2, 16, 20, 8, 20, 24);
    g.fillStyle(0xff7a30, 1); g.fillTriangle(7, 16, 22, 10, 22, 22);
    g.fillStyle(0xffd070, 1); g.fillCircle(23, 16, 6);
    g.fillStyle(0xfff6d0, 1); g.fillCircle(24, 16, 3);
    g.lineStyle(1.5, 0xffb060, 0.8); g.lineBetween(3, 9, 12, 11); g.lineBetween(3, 23, 12, 21);
  });
  // grapple: an iron hook on a chain
  mk('ab_hook', (g) => {
    g.lineStyle(2, 0x8a96a4, 1); for (let i = 0; i < 3; i++) g.strokeEllipse(9 + i * 4, 6 + i * 4, 5, 3);
    g.lineStyle(3.5, 0xdfe8f0, 1); g.beginPath(); g.moveTo(18, 14); g.lineTo(20, 18);
    g.arc(16, 21, 5, -0.9, Math.PI * 0.95, false); g.strokePath();
    g.fillStyle(0xdfe8f0, 1); g.fillTriangle(9, 21, 13, 17, 13, 24);
    g.fillStyle(0xffffff, 1); g.fillCircle(19, 15, 1.4);
  });
  // ashen mantle: an open cloak drifting down
  mk('ab_glide', (g) => {
    g.fillStyle(0x6a4a9a, 1); g.fillTriangle(16, 6, 3, 24, 16, 20); g.fillTriangle(16, 6, 29, 24, 16, 20);
    g.fillStyle(0xc8a0ff, 1); g.fillTriangle(16, 8, 7, 21, 16, 18); g.fillTriangle(16, 8, 25, 21, 16, 18);
    g.fillStyle(0xf0e2ff, 1); g.fillCircle(16, 6, 2.6);
    g.lineStyle(1.5, 0xc8a0ff, 0.7); g.lineBetween(10, 27, 10, 30); g.lineBetween(16, 25, 16, 29); g.lineBetween(22, 27, 22, 30);
  });
}
