import { settings, DEFAULT_BINDS } from './settings.js';

// Unified keyboard + gamepad input with per-frame "pressed" edges.
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, START: 9 };

export class Controls {
  constructor(scene) {
    this.scene = scene;
    this.rebind();
    this.mouseAttack = false;
    scene.input.on('pointerdown', (p) => { if (p.leftButtonDown()) this.mouseAttack = true; });
    this.prev = {};
    this.state = {};
    this.pressed = {};
    this.latched = {};
  }

  // (re)read the key bindings from settings; called again after the player rebinds
  rebind() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = this.scene.input.keyboard;
    this.keys = {};
    for (const action of Object.keys(DEFAULT_BINDS)) {
      this.keys[action] = settings.keysFor(action).filter((c) => K[c] !== undefined).map((c) => kb.addKey(K[c], true, false));
    }
  }

  update() {
    const pad = this.scene.input.gamepad && this.scene.input.gamepad.total ? this.scene.input.gamepad.getPad(0) : null;
    const btn = (i) => !!(pad && pad.buttons[i] && pad.buttons[i].pressed);
    const ax = pad ? pad.axes.length ? pad.axes[0].getValue() : 0 : 0;
    const ay = pad ? pad.axes.length > 1 ? pad.axes[1].getValue() : 0 : 0;
    const down = (name) => this.keys[name].some((k) => k.isDown);
    const s = {
      left: down('left') || btn(PAD.LEFT) || ax < -0.4,
      right: down('right') || btn(PAD.RIGHT) || ax > 0.4,
      up: down('up') || btn(PAD.UP) || ay < -0.6,
      down: down('down') || btn(PAD.DOWN) || ay > 0.6,
      jump: down('jump') || btn(PAD.A),
      attack: down('attack') || btn(PAD.X) || btn(PAD.RB) || this.mouseAttack,
      roll: down('roll') || btn(PAD.B),
      heal: down('heal') || btn(PAD.Y),
      interact: down('interact') || btn(PAD.LB),
      parry: down('parry') || btn(PAD.LT),
      grapple: down('grapple') || btn(PAD.RT),
      cast: down('cast'),
      super: down('super'),
      pause: down('pause') || btn(PAD.START),
    };
    this.mouseAttack = false;
    for (const k in s) {
      this.pressed[k] = (s[k] && !this.prev[k] && !this.swallowing) || !!this.latched[k];
      this.latched[k] = false;
    }
    this.swallowing = false;
    this.prev = s;
    this.state = s;
  }

  // Hit-stop freezes the game for a few frames: still read the pads/keys, and keep any
  // fresh press for the next real update so a quick tap (combo, roll, parry) isn't lost.
  latch() {
    const swallowing = this.swallowing;
    this.update();
    for (const k in this.pressed) if (this.pressed[k]) this.latched[k] = true;
    this.swallowing = swallowing;
  }

  // Ignore presses on the next update: a key that closed a menu (Esc, Q) must not also act in-game.
  swallow() { this.swallowing = true; }

  get x() { return (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0); }
}
