import { buildCharacters } from '../art/characters.js';
import { buildWorld } from '../art/world.js';

// Generates every texture and animation procedurally, then shows the title.
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const el = document.getElementById('loading');
    if (el) el.remove();
    const SERIF = 'Georgia, serif';
    this.add.text(480, 230, 'ASHEN VIGIL', { fontFamily: SERIF, fontSize: '40px', color: '#e8c36a' }).setOrigin(0.5);
    const label = this.add.text(480, 300, 'Kindling the flame...', { fontFamily: SERIF, fontSize: '16px', color: '#9a907e' }).setOrigin(0.5);
    const bar = this.add.graphics();
    const draw = (k) => {
      bar.clear();
      bar.fillStyle(0x1a1418, 1); bar.fillRect(330, 270, 300, 6);
      bar.fillStyle(0xe8a050, 1); bar.fillRect(330, 270, 300 * k, 6);
    };
    draw(0.05);
    // generate every texture, then show the title (same timing as before)
    this.time.delayedCall(30, () => {
      buildCharacters(this);
      buildWorld(this);
      draw(1);
      this.scene.start('Title');
    });
  }
}
