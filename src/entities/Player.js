import { audio } from '../audio.js';
import { HERO_RES } from '../art/characters.js';
import { BASE_NOTCHES } from '../charms.js';

const BASE_SCALE = 1 / HERO_RES;

const RUN = 108;
const JUMP_V = 322;
const DJUMP_V = 290;
const ROLL_SPEED = 235;
const ROLL_TIME = 0.35;
const ROLL_IFRAMES = 0.3;
const DASH_SPEED = 460; // above max velocity, so a dash still reads as a burst
const DASH_TIME = 0.17; // ~78px: the ground roll covers ~59px, this is a touch more
const JUMP_ST = 10;     // stamina for a ground or wall jump
const DJUMP_ST = 12;    // stamina for the double jump
const PARRY_WINDOW = 0.18; // active timing window from the start of the parry
const PARRY_TOTAL = 0.34;  // full commitment if nothing is parried
const PLUNGE_SPEED = 430;
const GRAPPLE_RANGE = 150;
const GRAPPLE_SPEED = 430;

// Each strike: animation, stamina cost, damage, poise damage, active frames, lunge.
const ATTACKS = [
  { anim: 'attack1', cost: 16, dmg: 24, poise: 22, hit: [2, 3], lunge: 120, lungeFrame: 2, fx: 'slash', flipY: false, chain: 2, cancel: 4, reach: 42, sfx: 'swing', cut: 0.45 },
  { anim: 'attack2', cost: 16, dmg: 24, poise: 22, hit: [2, 3], lunge: 110, lungeFrame: 2, fx: 'slash', flipY: true, chain: 2, cancel: 4, reach: 42, sfx: 'swing2', cut: -0.45 },
  { anim: 'attack3', cost: 28, dmg: 44, poise: 60, hit: [4, 5], lunge: 170, lungeFrame: 3, fx: 'slashBig', flipY: false, chain: 99, cancel: 6, reach: 50, heavy: true, sfx: 'swingHeavy', cut: 0.15 },
  // Up + Attack: an overhead arc that cuts the air above the hero (fliers, ceiling crawlers, falling foes)
  { anim: 'attack2', cost: 16, dmg: 26, poise: 26, hit: [2, 3], lunge: 0, lungeFrame: 2, fx: 'slash', flipY: false, chain: 99, cancel: 4, reach: 50, up: true, sfx: 'swing2', cut: -Math.PI / 2 },
];
const UP_ATTACK = 3;

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'hero_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // frames are HERO_RES times larger than the world size; body numbers are in frame pixels
    // (the renderer puts the feet 4 texels above the frame bottom)
    const fs = 64 * HERO_RES;
    this.setOrigin(0.5, (fs - 4) / fs).setScale(BASE_SCALE);
    this.body.setSize(10 * HERO_RES, 26 * HERO_RES).setOffset(fs / 2 - 5 * HERO_RES, fs - 4 - 26 * HERO_RES);
    this.body.setMaxVelocity(400, 520);
    this.setDepth(20);

    this.maxHp = 100; this.hp = 100;
    this.maxSt = 100; this.st = 100;
    this.maxFlasks = 3; this.flasks = 3;
    this.embers = 0;
    // soul level: stats bought at bonfires with embers
    this.stats = { vigor: 0, endur: 0, str: 0, attun: 0 };
    // bonfire shop: bought items, each with a rank cap
    this.shop = { lifeseed: 0, hexed: 0, attuned: 0, flask: 0, luck: 0, sigil: 0 };
    // charms: owned and equipped keys, and how many notches the hero has
    this.charms = []; this.equipped = []; this.notches = BASE_NOTCHES;
    this.foundSecrets = []; // ids of hidden rooms already looted
    this.dmgMul = 1;
    this.spellMul = 1; this.focusMul = 1; this.emberMul = 1; this.dmgTakenMul = 1;
    this.applyStats();
    this.hasDouble = false;
    this.hasWallJump = false;
    this.hasDash = false; this.usedDash = false; this.dashT = 0;
    this.hasGrapple = false; this.usedGrapple = false;
    this.hasGlide = false; this.floorGrip = 1; this.gliding = false;
    this.lastSafe = { x, y };
    this.wallDir = 0; this.wallCoyote = 0; this.wallLock = 0; this.sliding = false;
    this.inWater = false;

    this.facing = 1;
    this.state = 'normal';
    this.anim = '';
    this.coyote = 0; this.jumpBuf = 0; this.attackBuf = 0;
    this.combo = 0; this.queued = false;
    this.invuln = 0; this.stDelay = 0; this.dropTimer = 0;
    this.usedDouble = false; this.jumpCut = false;
    this.wasGrounded = true; this.lastVy = 0;
    this.rollT = 0; this.ghostT = 0; this.hurtT = 0;
    this.parryT = 0; this.parryHit = false;
    this.plungeT = 0;
    this.grappleT = 0; this.grappleTarget = null; this.grappleCd = 0; this.rope = null;
    this.focus = 0; this.castCd = 0; this.superT = 0;
    this.hitSet = new Set();

    this.on('animationcomplete', this.onAnimDone, this);
    this.on('animationupdate', this.onAnimFrame, this);
    this.light = scene.fx.glow(x, y - 16, 0xffa050, 0.9, 0.22, 19);
    this.setAnim('idle');
  }

  get dead() { return this.state === 'dead'; }
  get grounded() { return this.body.blocked.down || this.body.touching.down; }
  get iframes() { return this.invuln > 0 || (this.state === 'roll' && this.rollT < ROLL_IFRAMES * (this.charm('shadowveil') ? 1.5 : 1)) || this.state === 'dash' || this.dead; }

  // Vigor/Endurance/Strength/Attunement + bonfire-shop items -> derived stats. Buying tops up HP.
  applyStats() {
    const s = this.stats, sh = this.shop;
    const hp0 = this.maxHp;
    this.maxHp = 100 + s.vigor * 20 + sh.lifeseed * 20 + (this.charm('steelheart') ? 40 : 0) + (this.charm('ashencrown') ? 25 : 0);
    this.maxSt = 100 + s.endur * 15;
    this.maxFlasks = Math.min(7, 3 + s.attun + sh.flask);
    this.dmgMul = (1 + s.str * 0.08) * (this.charm('ashenfury') ? 1.25 : 1) * (this.charm('ashencrown') ? 1.2 : 1);
    this.spellMul = 1 + sh.hexed * 0.15;                 // Soul Bolt + Force
    this.focusMul = 1 + sh.attuned * 0.25;               // focus gained from hits/parries
    this.emberMul = 1 + sh.luck * 0.25 + (this.charm('antlersigil') ? 0.25 : 0);                  // embers dropped by the fallen
    this.dmgTakenMul = Math.max(0.5, (1 - sh.sigil * 0.1) * (this.charm('ironhide') ? 0.85 : 1)); // guardian sigil
    this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - hp0));
  }

  setAnim(key, restart = false) {
    if (this.anim === key && !restart) return;
    this.anim = key;
    this.play('hero_' + key);
    this.anims.timeScale = key === 'heal' && this.charm('quickflask') ? 1.6 : 1;
  }

  charm(key) { return !!(this.equipped && this.equipped.includes(key)); }
  get boltCost() { return this.charm('emberbolt') ? 35 : 50; }

  spendStamina(n) {
    this.st = Math.max(-20, this.st - n);
    this.stDelay = 0.65;
  }

  update(dt, ctl) {
    const b = this.body;
    const onGround = this.grounded;
    const scene = this.scene;

    this.light.setPosition(this.x, this.y - 16);
    if (this.invuln > 0) {
      this.invuln -= dt;
      this.setAlpha(this.state === 'roll' ? 1 : (Math.floor(this.invuln * 20) % 2 ? 0.35 : 1));
      if (this.invuln <= 0) this.setAlpha(1);
    }
    if (this.dropTimer > 0) this.dropTimer -= dt;
    if (this.grappleCd > 0) this.grappleCd -= dt;
    if (this.castCd > 0) this.castCd -= dt;

    if (this.dead) { b.setVelocityX(approach(b.velocity.x, 0, 600 * dt)); return; }

    // stamina regen (slower while healing)
    if (this.stDelay > 0) this.stDelay -= dt;
    else if (this.state !== 'attack' && this.state !== 'roll') this.st = Math.min(this.maxSt, this.st + (this.state === 'heal' ? 20 : 55) * dt);

    this.coyote = onGround ? 0.1 : this.coyote - dt;
    this.jumpBuf = ctl.pressed.jump ? 0.13 : this.jumpBuf - dt;
    this.attackBuf = ctl.pressed.attack ? 0.3 : this.attackBuf - dt;
    if (onGround) {
      this.usedDouble = false; this.usedDash = false; this.usedGrapple = false;
      if (this.state === 'normal' && this.scene.isSafeGround(this)) { this.lastSafe.x = this.x; this.lastSafe.y = this.y; }
    }

    // landing feel
    if (onGround && !this.wasGrounded && this.lastVy > 160) {
      audio.play('land', Math.min(1, this.lastVy / 400));
      scene.fx.dustPuff(this.x, this.y, this.lastVy > 330 ? 10 : 5);
      this.squash(1.18, 0.84);
      if (this.state === 'normal') this.setAnim('land', true);
    }

    // water: floaty, slow, damped falls
    b.setGravityY(this.inWater ? -470 : 0);
    if (this.inWater && b.velocity.y > 150) b.setVelocityY(150);

    // Gravebloom: standing still on the ground slowly heals
    if (this.charm('gravebloom') && this.state === 'normal' && onGround && Math.abs(b.velocity.x) < 5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 4 * dt);
      if (Math.random() < 0.06) scene.fx.burst('heal', this.x, this.y - 10, 1);
    }

    switch (this.state) {
      case 'normal': this.updateNormal(dt, ctl, onGround); break;
      case 'attack': this.updateAttack(dt, ctl, onGround); break;
      case 'roll': this.updateRoll(dt); break;
      case 'dash': this.updateDash(dt); break;
      case 'parry': this.updateParry(dt); break;
      case 'plunge': this.updatePlunge(dt); break;
      case 'grapple': this.updateGrapple(dt); break;
      case 'super': this.updateSuper(dt); break;
      case 'heal':
        b.setVelocityX(approach(b.velocity.x, ctl.x * 30, 800 * dt));
        break;
      case 'hurt':
        b.setVelocityX(approach(b.velocity.x, 0, 500 * dt));
        this.hurtT -= dt;
        if (this.hurtT <= 0) this.state = 'normal';
        break;
      case 'rest':
        b.setVelocityX(0);
        if (ctl.x || ctl.pressed.jump || ctl.pressed.attack || ctl.pressed.roll) { this.state = 'normal'; this.setAnim('idle'); }
        break;
      default: break;
    }

    this.wasGrounded = onGround;
    this.lastVy = b.velocity.y;
  }

  updateNormal(dt, ctl, onGround) {
    const b = this.body;
    const run = RUN * (this.inWater ? 0.6 : 1) * (this.charm('featherstep') ? 1.2 : 1);
    if (this.wallLock > 0) {
      // just kicked off a wall: keep the kick direction briefly
      this.wallLock -= dt;
      b.setVelocityX(approach(b.velocity.x, this.facing * run, 400 * dt));
    } else {
      // turning hard on the ground kicks up a little dust
      if (onGround && ctl.x && Math.sign(b.velocity.x) === -ctl.x && Math.abs(b.velocity.x) > 70 && !this.skidded) {
        this.skidded = true;
        this.scene.fx.dustPuff(this.x + Math.sign(b.velocity.x) * 4, this.y, 3);
      } else if (!ctl.x || Math.sign(b.velocity.x) === ctl.x) this.skidded = false;
      b.setVelocityX(approach(b.velocity.x, ctl.x * run, (onGround ? 1200 * (this.floorGrip ?? 1) : 750) * dt));
      if (ctl.x) { this.facing = ctl.x; this.setFlipX(this.facing < 0); }
    }

    // wall slide (needs Gravecrawler's Claw)
    this.sliding = false;
    if (this.hasWallJump && !onGround && this.wallLock <= 0) {
      const sc = this.scene;
      // lenient probes: being within a few pixels of a wall is enough to jump off it
      const left = sc.isWallAt(b.left - 4, b.top + 6) || sc.isWallAt(b.left - 4, b.bottom - 6);
      const right = sc.isWallAt(b.right + 4, b.top + 6) || sc.isWallAt(b.right + 4, b.bottom - 6);
      const near = left ? -1 : right ? 1 : 0;
      if (near) { this.wallDir = near; this.wallCoyote = 0.12; }
      const touching = ctl.x < 0 && left ? -1 : ctl.x > 0 && right ? 1 : 0;
      if (touching) {
        this.facing = -touching; this.setFlipX(this.facing < 0);
        if (b.velocity.y > 0) {
          this.sliding = true;
          if (b.velocity.y > 65) b.setVelocityY(65);
          if (Math.random() < 0.25) sc.fx.dustPuff(this.x + touching * 6, this.y - 18, 1);
        }
      }
    }
    if (!this.sliding) this.wallCoyote -= dt;

    // jumping: costs stamina, and is gated like every other costly action (a roll or a
    // swing at 0 stamina is simply dropped, and so is a jump press).
    if (this.jumpBuf > 0) {
      if (ctl.state.down && onGround && this.scene.onPlatform(this)) {
        this.dropTimer = 0.22; this.jumpBuf = 0;
        b.setVelocityY(40);
      } else if (this.st > 0 && this.coyote > 0) {
        b.setVelocityY(-JUMP_V * (this.inWater ? 0.8 : 1));
        this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false;
        this.spendStamina(JUMP_ST);
        audio.play('jump');
        this.scene.fx.dustPuff(this.x, this.y, 4);
        this.squash(0.82, 1.2);
      } else if (this.st > 0 && this.hasWallJump && this.wallCoyote > 0) {
        b.setVelocity(-this.wallDir * 175, -JUMP_V * 0.95);
        this.facing = -this.wallDir; this.setFlipX(this.facing < 0);
        this.wallLock = 0.17; this.wallCoyote = 0; this.jumpBuf = 0; this.jumpCut = true; // wall kicks always get full height
        this.spendStamina(JUMP_ST);
        audio.play('jump');
        this.scene.fx.dustPuff(this.x + this.wallDir * 6, this.y - 10, 5);
        this.squash(0.85, 1.15);
        this.setAnim('jump', true);
      } else if (this.st > 0 && this.hasDouble && !this.usedDouble) {
        b.setVelocityY(-DJUMP_V);
        this.usedDouble = true; this.jumpBuf = 0; this.jumpCut = false;
        this.spendStamina(DJUMP_ST);
        audio.play('djump');
        this.scene.fx.burst('spirit', this.x, this.y - 6, 18);
        this.squash(0.85, 1.15);
        this.setAnim('jump', true);
      }
    }
    if (!ctl.state.jump && b.velocity.y < -110 && !this.jumpCut) {
      b.setVelocityY(b.velocity.y * 0.45);
      this.jumpCut = true;
    }

    // a touch of hang time at the top of a held jump (adds well under a pixel of height)
    if (!onGround && !this.inWater && ctl.state.jump && Math.abs(b.velocity.y) < 40) b.setGravityY(-320);

    // glide (Ashen Mantle): hold Jump while falling to drift down slowly
    this.gliding = false;
    if (this.hasGlide && !onGround && !this.sliding && ctl.state.jump && b.velocity.y > 60) {
      b.setVelocityY(60);
      this.gliding = true;
      if (Math.random() < 0.2) this.scene.fx.burst('spirit', this.x, this.y - 22, 1);
    }

    // animation
    if (this.sliding) {
      this.setAnim('wall');
    } else if (!onGround) {
      this.setAnim(b.velocity.y < -50 ? 'jump' : b.velocity.y < 70 ? 'apex' : 'fall');
    } else if (Math.abs(b.velocity.x) > 15 && ctl.x) {
      this.setAnim('run');
      // the stride follows the real speed: no foot sliding in water or while speeding up
      this.anims.timeScale = Phaser.Math.Clamp(Math.abs(b.velocity.x) / RUN, 0.55, 1.3);
    } else if (!((this.anim === 'land' || this.anim === 'deflect' || (this.anim === 'attack1' && this.castCd > 0)) && this.anims.isPlaying)) {
      this.setAnim('idle');
    }

    // actions
    if (this.attackBuf > 0 && this.st > 0) {
      // Down + Attack in mid-air: the plunge (pogo off enemies and hazards)
      if (ctl.state.down && !onGround) this.startPlunge();
      else if (ctl.state.up && !ctl.state.down) this.startAttack(UP_ATTACK);
      else this.startAttack(0);
    }
    else if (ctl.pressed.roll && this.st > 0 && onGround) this.startRoll(ctl);
    else if (ctl.pressed.roll && !onGround && this.hasDash && !this.usedDash) this.startDash(ctl);
    else if (ctl.pressed.parry && this.st > 0) this.startParry();
    else if (ctl.pressed.grapple && !onGround && this.hasGrapple && !this.usedGrapple && this.grappleCd <= 0) this.startGrapple();
    else if (ctl.pressed.cast && this.castCd <= 0 && this.focus >= this.boltCost) this.startCast();
    else if (ctl.pressed.super && this.focus >= 100) this.startSuper(ctl);
    else if (ctl.pressed.heal && onGround) this.startHeal();
    else if (ctl.pressed.interact || (ctl.pressed.up && onGround && this.attackBuf <= 0)) this.scene.tryInteract();
  }

  updateAttack(dt, ctl, onGround) {
    const b = this.body;
    const f = this.anims.currentFrame ? this.anims.currentFrame.index - 1 : 0;
    const atk = ATTACKS[this.combo];
    if (!onGround && ctl.x) b.setVelocityX(approach(b.velocity.x, ctl.x * 110, 500 * dt));
    else b.setVelocityX(approach(b.velocity.x, 0, (onGround ? 700 : 200) * dt));
    if (this.attackBuf > 0 && this.combo < 2 && f >= atk.chain - 1) this.queued = true;
    if (f >= atk.cancel) {
      if (ctl.pressed.roll && this.st > 0 && onGround) return this.startRoll(ctl);
      if (this.queued && this.combo < 2 && this.st > 0) return this.startAttack(this.combo + 1, ctl);
    }
  }

  updateRoll(dt) {
    this.rollT += dt;
    const t = Math.min(1, this.rollT / ROLL_TIME);
    this.body.setVelocityX(this.facing * ROLL_SPEED * (1 - t * t * 0.85));
    this.ghostT -= dt;
    if (this.ghostT <= 0 && this.rollT < ROLL_IFRAMES) {
      this.ghostT = 0.035;
      this.scene.fx.afterImage(this);
    }
  }

  startDash(ctl) {
    if (ctl.x) { this.facing = ctl.x; this.setFlipX(this.facing < 0); }
    this.state = 'dash';
    this.dashT = 0; this.ghostT = 0;
    this.usedDash = true;
    this.spendStamina(this.charm('lightstep') ? 6 : 12);
    this.body.setAllowGravity(false);
    this.body.setVelocity(this.facing * DASH_SPEED, 0);
    this.setAnim('dash', true);
    audio.play('dash');
    this.scene.fx.burst('fire', this.x - this.facing * 6, this.y - 14, 14);
  }

  updateDash(dt) {
    const b = this.body;
    this.dashT += dt;
    b.setVelocity(this.facing * DASH_SPEED, 0);
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.03; this.scene.fx.afterImage(this, 0xff8a3a); }
    const blocked = (this.facing > 0 && b.blocked.right) || (this.facing < 0 && b.blocked.left);
    if (this.dashT >= DASH_TIME || blocked) this.endDash();
  }

  endDash() {
    this.body.setAllowGravity(true);
    this.body.setVelocityX(this.body.velocity.x * 0.55);
    if (this.state === 'dash') { this.state = 'normal'; this.setAnim('fall'); }
  }

  // ------------------------------------------------------------ parry (deflect)
  startParry() {
    this.state = 'parry';
    this.parryT = 0; this.parryHit = false;
    this.spendStamina(10);
    this.setAnim('parry', true);
    audio.play('parryWhiff', 0.8);
    // a faint guard arc in front: shows the parry window
    const arc = this.scene.fx.slash(this.x + this.facing * 4, this.y - 22, 'slash', this.facing < 0, true, 0.75);
    arc.setTint(0x9fe8ff).setAlpha(0.55);
    this.squash(0.9, 1.08);
  }

  updateParry(dt) {
    this.parryT += dt;
    this.body.setVelocityX(approach(this.body.velocity.x, 0, 900 * dt));
    if (!this.parryHit && this.parryT <= PARRY_WINDOW * (this.charm('wardlesson') ? 1.5 : 1)) this.scene.tryParry(this);
    // a successful parry recovers fast; a whiff leaves you committed
    if (this.parryT >= (this.parryHit ? 0.17 : PARRY_TOTAL)) this.state = 'normal';
  }

  // ------------------------------------------------------------ plunge (pogo)
  startPlunge() {
    this.state = 'plunge';
    this.plungeT = 0;
    this.hitSet = new Set();
    this.spendStamina(16);
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, PLUNGE_SPEED * 0.6); // a short hang, then the drop
    this.setAnim('plunge', true);
    audio.play('swingHeavy', 0.8);
    // the blade points straight down: a downward arc under the hero
    const sl = this.scene.fx.slash(this.x, this.y - 6, 'slash', this.facing < 0, false, 1.1);
    sl.setAngle(this.facing > 0 ? 90 : -90);
  }

  updatePlunge(dt) {
    const b = this.body, sc = this.scene;
    this.plungeT += dt;
    b.setVelocity(approach(b.velocity.x, 0, 600 * dt), Math.min(PLUNGE_SPEED * 1.15, PLUNGE_SPEED * 0.6 + this.plungeT * 1400));
    if (Math.random() < 0.6) sc.fx.afterImage(this, 0xffe2a0);
    // generous hitbox under and around the feet
    const r = new Phaser.Geom.Rectangle(this.x - 20, this.y - 14, 40, 34);
    sc.playerStrike(r, { dmg: 44, poise: 70, heavy: true, cut: Math.PI / 2 }, this.facing, this.hitSet);
    if (this.hitSet.size) return this.endPlunge('hit');
    // Hollow Knight style: spikes and lava under the blade are a pogo, not a wound
    for (const x of [b.left + 2, b.right - 2]) {
      const t = sc.ground.getTileAtWorldXY(x, b.bottom + 6);
      if (t && (t.index === 18 || t.index === 21)) return this.endPlunge('hazard');
    }
    if (b.blocked.down) return this.endPlunge('land');
    if (this.plungeT > 1.4) this.endPlunge(null);
  }

  // hitting something mid-plunge bounces you back up: the pogo; hitting the floor sends out a shockwave
  endPlunge(how) {
    const sc = this.scene, fx = sc.fx;
    this.body.setAllowGravity(true);
    if (how === 'hit' || how === 'hazard') {
      this.body.setVelocity(this.facing * 40, -300);
      this.jumpCut = true; // the bounce always gets full height (not cut by a released Jump)
      this.usedDouble = false; this.usedDash = false; // a pogo refreshes the air moves
      if (how === 'hazard') this.invuln = Math.max(this.invuln, 0.25);
      audio.play('land', 0.7);
      fx.hitStop(how === 'hit' ? 80 : 40);
      fx.ring(this.x, this.y + 2, 0xffe2a0, 1.8, 200);
      fx.burst('sparks', this.x, this.y + 2, 8);
      if (how === 'hit') this.gainFocus(10);
    } else if (how === 'land') {
      // impact wave along the floor
      audio.play('land', 1);
      fx.shake(0.006, 140);
      fx.dustPuff(this.x, this.y, 12);
      fx.ring(this.x, this.y, 0xffe2a0, 2.6, 260);
      const r = new Phaser.Geom.Rectangle(this.x - 38, this.y - 18, 76, 20);
      sc.playerStrike(r, { dmg: 20, poise: 40, cut: 0 }, this.facing, this.hitSet);
      this.squash(1.25, 0.8);
    }
    if (this.state === 'plunge') { this.state = 'normal'; this.setAnim(how === 'land' ? 'land' : 'fall', true); }
  }

  // ------------------------------------------------------------ grapple (Rimeward Grapple)
  startGrapple() {
    const anchors = this.scene.level.anchors || [];
    let best = null, bd = GRAPPLE_RANGE;
    for (const a of anchors) {
      const d = Math.hypot(a.x - this.x, a.y - (this.y - 8));
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { this.grappleCd = 0.3; audio.play('swing', 0.4); return; }
    this.grappleTarget = best;
    this.grappleT = 0;
    this.state = 'grapple';
    this.body.setAllowGravity(false);
    this.setAnim('jump', true);
    audio.play('whoosh', 0.5);
    this.rope = this.scene.add.graphics().setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.scene.fx.glow(best.x, best.y, 0x9fd8ff, 0.8, 0.6, 18);
    this.scene.tweens.add({ targets: g, alpha: 0, scale: 1.6, duration: 300, onComplete: () => g.destroy() });
  }

  updateGrapple(dt) {
    const b = this.body;
    const t = this.grappleTarget;
    this.grappleT += dt;
    if (!t) { this.endGrapple(false); return; }
    const dx = t.x - this.x, dy = t.y - (this.y - 8);
    const d = Math.hypot(dx, dy);
    if (this.rope) {
      this.rope.clear();
      this.rope.lineStyle(1, 0x9fd8ff, 0.9);
      this.rope.lineBetween(this.x, this.y - 8, t.x, t.y);
    }
    if (d < 14 || this.grappleT > 0.7) { this.endGrapple(d < 14); return; }
    b.setVelocity(dx / d * GRAPPLE_SPEED, dy / d * GRAPPLE_SPEED);
    if (Math.random() < 0.3) this.scene.fx.dustPuff(this.x, this.y - 8, 1);
  }

  endGrapple(arrived) {
    if (this.rope) { this.rope.destroy(); this.rope = null; }
    this.body.setAllowGravity(true);
    this.usedGrapple = true;
    if (arrived) {
      this.body.setVelocity(this.body.velocity.x * 0.4, -170);
      this.jumpCut = true;
      audio.play('djump', 0.5);
      this.scene.fx.burst('spirit', this.x, this.y - 8, 10);
    } else {
      this.body.setVelocity(this.body.velocity.x * 0.6, Math.max(this.body.velocity.y, 0));
    }
    this.grappleTarget = null;
    if (this.state === 'grapple') { this.state = 'normal'; this.setAnim('fall'); }
  }

  // Interrupted mid-grapple (hit, death, lava warp): drop the rope so it doesn't stay on screen.
  cancelGrapple() {
    if (this.rope) { this.rope.destroy(); this.rope = null; }
    this.grappleTarget = null;
  }

  // ------------------------------------------------------------ focus: bolt + super
  gainFocus(n) {
    this.focus = Math.min(100, this.focus + n * this.focusMul);
    if (this.focus >= 100) this.scene.events.emit('focus-full');
  }

  startCast() {
    this.castCd = 0.45;
    this.focus -= this.boltCost;
    if (this.facing === undefined) this.facing = 1;
    this.setAnim('attack1', true);
    audio.play('orb', 0.7);
    this.scene.spawnSoulBolt(this.x + this.facing * 12, this.y - 20, this.facing, 35 * this.dmgMul * this.spellMul);
  }

  startSuper(ctl) {
    if (ctl && ctl.x) { this.facing = ctl.x; this.setFlipX(this.facing < 0); }
    this.state = 'super';
    this.superT = 0;
    this.focus = 0;
    this.hitSet = new Set();
    this.spendStamina(15);
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
    this.setAnim('attack3', true);
    this.setTint(0xff8a78); // the blade burns red through the whole strike
    audio.play('roar', 0.35);
    this.scene.fx.flash(0xff4a30, 160, 0.25);
  }

  updateSuper(dt) {
    this.superT += dt;
    if (this.superT > 0.16 && !this.superDone) {
      this.superDone = true;
      const fx = this.scene.fx;
      audio.play('swingHeavy');
      // the cleave follows the hero's facing (it used to always draw to the right, so
      // facing left it looked like the blow went out behind), and reaches mostly forward
      const f = this.facing;
      fx.slash(this.x - f * 6, this.y - 30, 'bslash', f < 0, false, 1.4).setTint(0xff2a14);
      fx.slash(this.x - f * 2, this.y - 24, 'slashBig', f < 0, true, 1.2).setTint(0xff6040);
      fx.shake(0.01, 220);
      fx.hitStop(140);
      this.body.setAllowGravity(true);
      const r = new Phaser.Geom.Rectangle(f > 0 ? this.x - 22 : this.x - 96, this.y - 64, 118, 70);
      this.scene.playerStrike(r, { dmg: 100 * this.spellMul, poise: 200, heavy: true, cut: 0.2, cutLen: 190 }, f, this.hitSet);
      fx.burst('sparks', this.x + f * 30, this.y - 26, 24);
      fx.burst('blood', this.x + f * 30, this.y - 26, 10);
      fx.ring(this.x + f * 20, this.y - 26, 0xff4a30, 4.5, 380);
      fx.streaks(this.x + f * 20, this.y - 26, f, 12, 0xff5a3a, { len: 22, dist: 44, dur: 260 });
      this.scene.time.delayedCall(400, () => { this.superDone = false; });
    }
    if (this.superT >= 0.5) { this.state = 'normal'; this.clearTint(); this.setAnim('idle', true); }
  }

  startAttack(i, ctl) {
    const atk = ATTACKS[i];
    if (ctl && ctl.x) { this.facing = ctl.x; this.setFlipX(this.facing < 0); }
    this.state = 'attack';
    this.combo = i;
    this.queued = false;
    this.attackBuf = 0;
    this.hitSet = new Set();
    this.spendStamina(atk.cost);
    this.setAnim(atk.anim, true);
    // carry momentum into the swing: a small forward lunge on grounded slashes
    if (!atk.up && this.body.blocked.down) this.body.setVelocityX(this.facing * (i === 2 ? 170 : 120));
  }

  startRoll(ctl) {
    if (ctl.x) { this.facing = ctl.x; this.setFlipX(this.facing < 0); }
    this.state = 'roll';
    this.rollT = 0; this.ghostT = 0;
    this.spendStamina(this.charm('lightstep') ? 11 : 22);
    this.setAnim('roll', true);
    audio.play('roll');
    this.scene.fx.dustPuff(this.x - this.facing * 6, this.y, 6);
  }

  startHeal() {
    if (this.flasks <= 0) { this.scene.events.emit('toast', 'No Ember Flasks left'); return; }
    this.flasks--;
    this.state = 'heal';
    this.setAnim('heal', true);
    audio.play('drink');
  }

  onAnimFrame(anim, frame) {
    const f = frame.index - 1;
    // parry: a glint runs up the blade the moment the guard locks in
    if (anim.key === 'hero_parry' && f === 1) {
      const fx = this.scene.fx;
      const g = this.scene.add.image(this.x + this.facing * 10, this.y - 26, 'star').setTint(0xdff8ff)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(42).setScale(0.3);
      this.scene.tweens.add({ targets: g, x: this.x + this.facing * 20, y: this.y - 40, scale: 0.9, angle: 90, alpha: 0, duration: 180, onComplete: () => g.destroy() });
      fx.dustPuff(this.x + this.facing * 6, this.y, 3);
    }
    if (anim.key === 'hero_run' && (f === 1 || f === 5)) {
      audio.play('step');
      if (Math.random() < 0.5) this.scene.fx.dustPuff(this.x - this.facing * 4, this.y, 1);
    }
    if (this.state === 'attack') {
      const atk = ATTACKS[this.combo];
      if (anim.key !== 'hero_' + atk.anim) return;
      if (f === atk.lungeFrame) {
        audio.play(atk.sfx);
        if (this.grounded) this.body.setVelocityX(this.facing * atk.lunge);
        // motion smear on the lunge; the heavy finisher also squashes into the swing
        this.scene.fx.afterImage(this, atk.heavy ? 0xffd6a0 : 0xcfeaff);
        if (atk.heavy) this.squash(1.12, 0.9);
        if (atk.up) {
          // the arc swept straight overhead
          const sl = this.scene.fx.slash(this.x + this.facing * 3, this.y - 30, atk.fx, this.facing < 0, atk.flipY);
          sl.setAngle(this.facing > 0 ? -90 : 90);
        } else {
          const fy = atk.heavy ? this.y - 24 : this.y - 20;
          this.scene.fx.slash(this.x + this.facing * 2, fy, atk.fx, this.facing < 0, atk.flipY);
        }
      }
      if (atk.hit.includes(f)) {
        const reach = atk.reach * (this.charm('longedge') ? 1.25 : 1);
        const r = atk.up
          ? new Phaser.Geom.Rectangle(this.x - 22, this.y - 30 - reach, 44, reach + 4)
          : new Phaser.Geom.Rectangle(this.facing > 0 ? this.x - 4 : this.x - reach + 4, this.y - 40, reach, 42);
        this.scene.playerStrike(r, atk, this.facing, this.hitSet);
        if (atk.heavy && f === atk.hit[0] && this.grounded) {
          this.scene.fx.shake(0.004, 100);
          this.scene.fx.dustPuff(this.x + this.facing * 26, this.y, 8);
        }
      }
    }
    if (anim.key === 'hero_heal' && f === 4) {
      this.hp = Math.min(this.maxHp, this.hp + 45);
      audio.play('heal');
      this.scene.fx.burst('heal', this.x, this.y - 14, 26);
      const g = this.scene.fx.glow(this.x, this.y - 14, 0xffb347, 0.8, 0.7, 21);
      this.scene.tweens.add({ targets: g, alpha: 0, scale: 1.4, duration: 600, onComplete: () => g.destroy() });
    }
  }

  onAnimDone(anim) {
    const k = anim.key;
    if (this.state === 'attack' && k.startsWith('hero_attack')) {
      if (this.queued && this.combo < 2 && this.st > 0) this.startAttack(this.combo + 1);
      else { this.state = 'normal'; this.combo = 0; }
    } else if (this.state === 'roll' && k === 'hero_roll') {
      this.state = 'normal';
    } else if (this.state === 'parry' && k === 'hero_parry') {
      if (this.parryT < 0.14) this.state = 'normal';
    } else if (this.state === 'heal' && k === 'hero_heal') {
      this.state = 'normal';
    }
  }

  squash(sx, sy) {
    this.scene.tweens.killTweensOf(this, ['scaleX', 'scaleY']);
    this.setScale(sx * BASE_SCALE, sy * BASE_SCALE);
    this.scene.tweens.add({ targets: this, scaleX: BASE_SCALE, scaleY: BASE_SCALE, duration: 160, ease: 'Back.Out' });
  }

  takeDamage(dmg, fromX, knock = 1) {
    if (this.iframes || this.state === 'dead') return false;
    this.body.setAllowGravity(true);
    this.cancelGrapple();
    this.hp -= dmg * this.dmgTakenMul;
    const fx = this.scene.fx;
    audio.play('hurt');
    fx.burst('blood', this.x, this.y - 16, 14);
    fx.burst('sparks', this.x, this.y - 16, 6);
    fx.shake(0.008, 180);
    fx.flash(0xa01818, 140, 0.35);
    fx.hitStop(90);
    const dir = Math.sign(this.x - fromX) || -this.facing;
    fx.hurtFx(this.x, this.y - 16, dir);
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    if (this.charm('woundsong')) this.gainFocus(20);
    if (this.charm('thorns')) {
      // rime lashes out: a ring of ice that strikes everything close by
      fx.ring(this.x, this.y - 16, 0x8ad0ff, 3.4, 300);
      fx.streaks(this.x, this.y - 16, 0, 10, 0x8ad0ff, { len: 18, dist: 40 });
      audio.play('shield', 0.8);
      const r = new Phaser.Geom.Rectangle(this.x - 46, this.y - 50, 92, 56);
      this.scene.time.delayedCall(60, () => this.scene.playerStrike(r, { dmg: 30, poise: 40, cut: 0 }, dir, new Set()));
    }
    if (this.state === 'super') this.clearTint();
    this.state = 'hurt';
    this.hurtT = 0.38;
    this.invuln = 1.0;
    this.body.setVelocity(dir * 150 * knock, -170 * Math.min(knock, 1.4));
    this.setAnim('hurt', true);
    return true;
  }

  die() {
    this.state = 'dead';
    this.cancelGrapple();
    this.body.setAllowGravity(true);
    this.setAlpha(1);
    this.setAnim('death', true);
    this.body.setVelocityY(Math.min(0, this.body.velocity.y));
    this.scene.onPlayerDeath();
  }

  rest() {
    this.state = 'rest';
    this.body.setVelocity(0, 0);
    this.setAnim('kneel', true);
  }

  // Lava (and similar hazards) return you to the last safe ground.
  warpTo(x, y) {
    this.cancelGrapple();
    this.setPosition(x, y);
    this.body.reset(x, y);
    this.body.setAllowGravity(true);
    this.state = 'normal';
    this.invuln = 1.0;
    this.setAnim('idle', true);
  }

  respawn(x, y) {
    this.cancelGrapple();
    this.setPosition(x, y);
    this.body.reset(x, y);
    this.hp = this.maxHp; this.st = this.maxSt; this.flasks = this.maxFlasks;
    this.state = 'normal'; this.invuln = 0; this.setAlpha(1);
    this.body.setAllowGravity(true);
    this.lastSafe = { x, y };
    this.combo = 0; this.queued = false;
    this.setAnim('idle', true);
  }
}
