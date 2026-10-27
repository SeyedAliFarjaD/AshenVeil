import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { GameScene } from './scenes/Game.js';
import { UIScene } from './scenes/UI.js';
import { EndingScene } from './scenes/Ending.js';
import { applyScreenScale } from './menu.js';

// Title vignette shared by the title screen
function makeVignette(game) {
  const c = document.createElement('canvas'); c.width = 960; c.height = 540;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(480, 300, 150, 480, 300, 640);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,2,8,0.95)');
  x.fillStyle = gr; x.fillRect(0, 0, 960, 540);
  game.textures.addCanvas('vignette_title', c);
}

const params = new URLSearchParams(location.search);

const game = new Phaser.Game({
  // ?test drives the loop with timers (works in hidden tabs); ?debug shows hitboxes
  fps: params.has('test') ? { forceSetTimeOut: true, target: 60 } : {},
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#07060a',
  pixelArt: true,
  roundPixels: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: params.has('debug'), tileBias: 20 } },
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, GameScene, UIScene, EndingScene],
  callbacks: { postBoot: (g) => makeVignette(g) },
});
window.__game = game;
game.events.once('ready', () => applyScreenScale(game));
window.addEventListener('resize', () => applyScreenScale(game));
