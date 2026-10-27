import { settings } from './settings.js';
import { audio } from './audio.js';

// On-screen controls for phones and tablets. Every button presses a real key
// binding (as a synthetic keyboard event), so gameplay, the title screen, the
// pause menu and the bonfire menu all work without knowing about touch.
//
// Left half: a floating stick (arrows). Right side: Attack, Jump, Roll, Parry,
// with Heal / Bolt / Force / Grapple / Interact above. Top: pause and fullscreen.

export const isTouchDevice = () => new URLSearchParams(location.search).has('touch')
  || (window.matchMedia && matchMedia('(pointer: coarse)').matches)
  || navigator.maxTouchPoints > 0;

// e.code names for the Phaser key names used by the bindings
const CODE = { LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown', SPACE: 'Space', SHIFT: 'ShiftLeft', ESC: 'Escape', ENTER: 'Enter' };
const codeFor = (name) => CODE[name] || (name.length === 1 ? (/\d/.test(name) ? 'Digit' : 'Key') + name : name);

// The key an action's button presses: a fixed alternate when the action has one (those
// can't be rebound), otherwise the player's current key for it.
const keyFor = (action) => {
  const keys = settings.keysFor(action);
  return keys[keys.length - 1];
};

const held = {}; // key name -> number of buttons holding it
function sendKey(name, down) {
  const n = (held[name] || 0) + (down ? 1 : -1);
  held[name] = Math.max(0, n);
  if (down ? n !== 1 : n !== 0) return; // already down / still held by another button
  const kc = Phaser.Input.Keyboard.KeyCodes[name];
  const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { code: codeFor(name), key: codeFor(name), bubbles: true, cancelable: true });
  // KeyboardEvent can't take keyCode in its init dict; Phaser reads it
  Object.defineProperty(e, 'keyCode', { get: () => kc });
  Object.defineProperty(e, 'which', { get: () => kc });
  window.dispatchEvent(e);
}

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; }
#touch .zone { position: absolute; left: 0; top: 18%; width: 45%; height: 82%; pointer-events: auto; }
#touch .stick { position: absolute; pointer-events: none; width: 22vmin; height: 22vmin; margin: -11vmin 0 0 -11vmin; border-radius: 50%;
  border: 2px solid rgba(232,195,106,0.35); background: rgba(10,8,14,0.25); opacity: 0.55; transition: opacity .15s; }
#touch .stick.on { opacity: 1; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 9vmin; height: 9vmin; margin: -4.5vmin 0 0 -4.5vmin; border-radius: 50%;
  background: rgba(232,195,106,0.45); border: 2px solid rgba(255,226,160,0.7); }
#touch .btn { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font: 600 2.6vmin Georgia, serif; color: #f0e2c0; text-shadow: 0 1px 2px #000; letter-spacing: .02em;
  background: rgba(10,8,14,0.42); border: 2px solid rgba(232,195,106,0.5); box-sizing: border-box; }
#touch .btn.big { font-size: 3.2vmin; }
#touch .btn.small { border-color: rgba(200,190,170,0.35); font-size: 2.2vmin; border-radius: 1.6vmin; }
#touch .btn.down { background: rgba(232,195,106,0.45); border-color: #ffe2a0; color: #fff; }
#touch.menu .btn.play { display: none; }
#touch .btn.menuonly { display: none; }
#touch.menu .btn.menuonly { display: flex; }
#touch.menu .zone { top: 55%; width: 26%; height: 45%; }
#rotate { position: fixed; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; text-align: center;
  background: #07060a; color: #cfc4ae; font: 18px Georgia, serif; padding: 24px; }
@media (orientation: portrait) { #rotate.touch { display: flex; } }
`;

// [label, action key or special, right %, bottom %, size vmin, class]
// (kept clear of the ember purse in the bottom-right corner of the HUD)
const BUTTONS = [
  ['ATK', 'attack', 13, 27, 17, 'big'],
  ['JUMP', 'jump', 2, 14, 17, 'big'],
  ['ROLL', 'roll', 24, 10, 13, ''],
  ['PARRY', 'parry', 2, 45, 13, ''],
  ['HEAL', 'heal', 25, 33, 11, ''],
  ['BOLT', 'cast', 26, 56, 10, 'small'],
  ['FORCE', 'super', 15, 58, 10, 'small'],
  ['HOOK', 'grapple', 3, 66, 10, 'small'],
  ['USE', 'interact', 35, 14, 10, 'small'],
];

export function setupTouch() {
  if (!isTouchDevice()) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const meta = document.querySelector('meta[name=viewport]');
  if (meta) meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  const root = document.createElement('div');
  root.id = 'touch';
  document.body.appendChild(root);
  const rotate = document.createElement('div');
  rotate.id = 'rotate'; rotate.className = 'touch';
  rotate.textContent = 'Turn your device sideways to play';
  document.body.appendChild(rotate);
  // no long-press menus, no page scroll or pinch zoom while playing
  for (const ev of ['contextmenu', 'gesturestart', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  const wake = () => audio.init(); // a real touch unlocks Web Audio (synthetic keys can't)

  // ---------------------------------------------------------------- stick
  const zone = document.createElement('div'); zone.className = 'zone';
  const stick = document.createElement('div'); stick.className = 'stick';
  const knob = document.createElement('div'); knob.className = 'knob';
  // the stick lives in screen coordinates (the zone shrinks in menus)
  stick.appendChild(knob); root.appendChild(zone); root.appendChild(stick);
  const restStick = () => { stick.style.left = '16vmin'; stick.style.top = 'calc(100% - 17vmin)'; stick.classList.remove('on'); knob.style.transform = ''; };
  restStick();
  let stickId = null, ox = 0, oy = 0;
  const dirs = { LEFT: false, RIGHT: false, UP: false, DOWN: false };
  const setDir = (k, v) => { if (dirs[k] !== v) { dirs[k] = v; sendKey(k, v); } };
  const moveStick = (x, y) => {
    const R = Math.min(innerWidth, innerHeight) * 0.11;
    let dx = x - ox, dy = y - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // generous sideways deadzone; up/down need a firmer push so running doesn't
    // trigger an up-slash or a plunge by accident
    setDir('LEFT', dx < -R * 0.3); setDir('RIGHT', dx > R * 0.3);
    setDir('UP', dy < -R * 0.6); setDir('DOWN', dy > R * 0.6);
  };
  const endStick = () => { stickId = null; for (const k in dirs) setDir(k, false); restStick(); };
  zone.addEventListener('pointerdown', (e) => {
    wake();
    if (stickId !== null) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    ox = e.clientX; oy = e.clientY;
    stick.style.left = `${e.clientX}px`; stick.style.top = `${e.clientY}px`;
    stick.classList.add('on');
    moveStick(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e.clientX, e.clientY); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, (e) => { if (e.pointerId === stickId) endStick(); });

  // ---------------------------------------------------------------- buttons
  // key() names the key to hold while pressed; onTap (instead) runs once per press
  const button = (label, key, css, cls = '', onTap = null) => {
    const b = document.createElement('div');
    b.className = `btn ${cls}`;
    b.textContent = label;
    Object.assign(b.style, css);
    let pid = null, sent = null;
    let pressFrame = 0;
    const frame = () => (window.__game ? window.__game.loop.frame : 0);
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; b.classList.remove('down');
      if (!sent) return;
      const k = sent; sent = null;
      // the game polls keys once per frame: a quick tap must stay down until a frame has seen it
      const release = () => (frame() >= pressFrame + 2 ? sendKey(k, false) : setTimeout(release, 8));
      release();
    };
    b.addEventListener('pointerdown', (e) => {
      wake();
      if (pid !== null) return;
      pid = e.pointerId;
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      if (onTap) { onTap(); return; }
      sent = key();
      pressFrame = frame();
      sendKey(sent, true);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    root.appendChild(b);
    return b;
  };
  for (const [label, action, right, bottom, size, cls] of BUTTONS) {
    button(label, () => keyFor(action), { right: `${right}%`, bottom: `${bottom}%`, width: `${size}vmin`, height: `${size}vmin` }, `play ${cls}`);
  }
  // menus (title, pause, bonfire, level complete): hide the action buttons and shrink the
  // stick's zone so menu rows can be tapped; the stick, OK and II still drive the menu
  const inMenu = () => {
    const g = window.__game;
    if (!g) return true;
    return g.scene.getScenes(true).some((s) => {
      const k = s.sys.settings.key;
      return k === 'Title' || k === 'Ending' || s.menuOpen || s.completeShown || (s.pauseMenu && s.pauseMenu.open);
    });
  };
  setInterval(() => {
    const m = inMenu();
    if (m !== root.classList.contains('menu')) { root.classList.toggle('menu', m); if (m) endStick(); }
  }, 150);

  // pause doubles as "back" in menus; OK confirms in menus and on the level-complete screen
  // (a slim row at the very top, above the tutorial hints; OK only shows in menus)
  const top = (dx) => ({ left: '50%', top: '1%', width: '10vmin', height: '5.5vmin', marginLeft: `${dx}vmin` });
  button('II', () => 'ESC', top(-16.5), 'small');
  button('OK', () => 'ENTER', top(-5), 'small menuonly');
  button('[ ]', null, top(6.5), 'small', () => {
    const d = document.documentElement;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
        if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
      }
    } catch (err) { /* fullscreen unsupported (iPhone Safari) */ }
  });
}
