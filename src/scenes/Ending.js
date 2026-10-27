import { audio } from '../audio.js';

const SERIF = 'Georgia, "Times New Roman", serif';

const EPILOGUE = [
  'The last pyre gutters out beneath the foundry.',
  'For the first time in an age, the ash stops falling.',
  '',
  'The knight sets down the blade by a cold bonfire',
  'and keeps the vigil a little longer,',
  'until the dark is only dark again.',
];

const CREDITS = [
  ['ASHEN VIGIL', 'title'],
  ['', ''],
  ['Design, code and art', 'head'],
  ['Made with Claude Code', ''],
  ['', ''],
  ['Engine', 'head'],
  ['Phaser 3', ''],
  ['', ''],
  ['Music', 'head'],
  ['"Dark Place (loop)"  by SkyleTheFrench', ''],
  ['"Cathedral in the forest"  by congusbongus', ''],
  ['Boss themes synthesized in code', ''],
  ['', ''],
  ['Sound', 'head'],
  ['"RPG sounds"  by Kenney (kenney.nl)', ''],
  ['"Loopable Dungeon Ambience"  by JaggedStone', ''],
  ['All sampled audio CC0, via OpenGameArt.org', ''],
  ['', ''],
  ['', ''],
  ['Thank you for keeping the vigil.', 'thanks'],
];

// The ending: an epilogue and run summary after the final boss, then a
// credits roll. Opened from the title menu it shows only the credits.
export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  create(data) {
    this.data_ = data || {};
    this.cameras.main.setBackgroundColor('#05030a');
    this.cameras.main.fadeIn(1200);
    this.add.image(480, 520, 'glow').setTint(0xff8a30).setScale(4).setAlpha(0.18).setBlendMode('ADD');
    this.add.particles(0, 560, 'px', {
      x: { min: 0, max: 960 }, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 }, lifespan: 9000, frequency: 120,
      scale: { start: 1.2, end: 0 }, tint: [0xffb347, 0xff7a2a, 0xffe2a0], blendMode: 'ADD', alpha: { start: 0.8, end: 0 },
    });
    this.skipHint = this.add.text(950, 530, 'Enter / A  skip', { fontFamily: SERIF, fontSize: '12px', color: '#5a5248' }).setOrigin(1, 1);
    this.phase = this.data_.credits ? 'credits' : 'epilogue';
    if (this.phase === 'epilogue') this.showEpilogue(); else this.rollCredits();
    const next = () => this.advance();
    this.input.keyboard.on('keydown-ENTER', next);
    this.input.keyboard.on('keydown-ESC', next);
    this.input.keyboard.on('keydown-SPACE', next);
    this.input.on('pointerdown', next);
    if (this.input.gamepad) this.input.gamepad.on('down', next);
  }

  showEpilogue() {
    audio.playMusic('cathedral');
    const s = this.data_;
    this.epi = this.add.container(0, 0).setAlpha(0);
    this.epi.add(this.add.text(480, 120, 'THE VIGIL ENDS', { fontFamily: SERIF, fontSize: '48px', color: '#e8c36a' }).setOrigin(0.5).setShadow(0, 0, '#000', 12));
    this.epi.add(this.add.text(480, 250, EPILOGUE.join('\n'), { fontFamily: SERIF, fontSize: '19px', color: '#d8cfb8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    const t = s.time || 0, mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    this.epi.add(this.add.text(480, 395, `Time  ${mm}:${ss}      Deaths  ${s.deaths || 0}      Embers  ${s.embers || 0}`,
      { fontFamily: SERIF, fontSize: '18px', color: '#f0e2c0' }).setOrigin(0.5));
    this.epi.add(this.add.text(480, 440, `Your save now waits at New Game+ ${(s.ng || 0) + 1}: the dead endure more, and are worth more.`,
      { fontFamily: SERIF, fontSize: '15px', color: '#9a907e' }).setOrigin(0.5));
    this.tweens.add({ targets: this.epi, alpha: 1, duration: 2500 });
    this.epiTimer = this.time.delayedCall(14000, () => this.advance());
  }

  rollCredits() {
    this.phase = 'credits';
    if (this.epi) this.tweens.add({ targets: this.epi, alpha: 0, duration: 900 });
    const roll = this.add.container(0, 560);
    let y = 0;
    for (const [line, kind] of CREDITS) {
      const style = kind === 'title' ? { fontSize: '54px', color: '#e8c36a' }
        : kind === 'head' ? { fontSize: '15px', color: '#9a907e' }
          : kind === 'thanks' ? { fontSize: '22px', color: '#e8c36a' } : { fontSize: '20px', color: '#e8dcc0' };
      roll.add(this.add.text(480, y, line, { fontFamily: SERIF, ...style }).setOrigin(0.5, 0));
      y += kind === 'title' ? 80 : kind === 'head' ? 24 : 32;
    }
    this.tweens.add({
      targets: roll, y: 270 - y, duration: y * 28, delay: 600,
      onComplete: () => { this.creditsDone = true; this.time.delayedCall(2500, () => this.advance()); },
    });
  }

  advance() {
    if (this.leaving) return;
    if (this.phase === 'epilogue') {
      if (this.epiTimer) this.epiTimer.remove();
      this.rollCredits();
      return;
    }
    this.leaving = true;
    audio.stopMusic(1.5);
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }
}
