import { settings } from './settings.js';

// Sound is synthesized with WebAudio. Optional CC0 samples (assets/audio, see
// README) replace or layer over some effects and the exploration music; any
// file that fails to load just falls back to the synth.
const SFX = {
  step: ['footstep00', 'footstep02', 'footstep04', 'footstep06', 'footstep08'],
  roll: ['cloth1', 'cloth3'], land: ['dropLeather'],
  pickup: ['handleCoins'], souls: ['handleCoins2'],
  slice: ['knifeSlice', 'knifeSlice2'], clang: ['metalPot1', 'metalPot2'], shield: ['metalPot2'],
  hitHeavy: ['chop'], interact: ['metalLatch'], door: ['doorOpen_1'], creak: ['creak1'], draw: ['drawKnife1'],
};
const LAYER = { slice: 0.5, clang: 0.6, shield: 0.5, hitHeavy: 0.6 }; // keep the synth too, sample on top
const MUSIC = { ambient: 'music_dark_place', crypt: 'music_dark_place', cathedral: 'music_cathedral_forest' };
const AMB = { ambient: 'amb_dungeon', crypt: 'amb_dungeon', cathedral: null };
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.music = null;
    this.musicName = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    // shared reverb for atmosphere
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4, 2.5);
    const rv = this.ctx.createGain(); rv.gain.value = 0.35;
    this.reverb.connect(rv); rv.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings();
    this.loadSamples();
  }

  // volumes from the settings menu (0..1 each, on top of the mix levels)
  applySettings() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = 0.9 * settings.sfx;
    this.musicBus.gain.value = 0.32 * settings.music;
  }

  loadSamples() {
    this.bufs = {};
    const load = (key, url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((a) => this.ctx.decodeAudioData(a)).then((b) => { this.bufs[key] = b; this.onSample(key); }).catch(() => {});
    new Set(Object.values(SFX).flat()).forEach((k) => load(k, `assets/audio/sfx/${k}.ogg`));
    new Set([...Object.values(MUSIC), ...Object.values(AMB)].filter(Boolean)).forEach((k) => load(k, `assets/audio/${k}.ogg`));
  }

  // a music file that finishes loading after its level started swaps in at once
  onSample(key) {
    const n = this.musicName;
    if (n && this.music && !this.music.file && (MUSIC[n] === key)) { this.musicName = null; this.playMusic(n); }
  }

  sample(key, vol, rate = 1) {
    const b = this.bufs && this.bufs[key];
    if (!b) return false;
    const src = this.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.sfxBus); src.start();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
  }

  impulse(sec, decay) {
    const rate = this.ctx.sampleRate, len = rate * sec;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // --- building blocks
  noise(t, dur, { freq = 1000, q = 1, type = 'bandpass', gain = 0.5, sweep = null, attack = 0.005, verb = 0 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    if (verb) { const v = c.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.reverb); }
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  tone(t, dur, { freq = 440, type = 'sine', gain = 0.3, slide = null, attack = 0.005, verb = 0, bus = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    if (verb) { const v = c.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.reverb); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const r = (a, b) => a + Math.random() * (b - a);
    const list = SFX[name];
    if (list) {
      const ok = this.sample(list[Math.floor(Math.random() * list.length)], (LAYER[name] || 0.8) * vol, r(0.92, 1.08));
      if (ok && !LAYER[name]) return;
    }
    switch (name) {
      case 'swing': this.noise(t, 0.16, { freq: r(1800, 2400), sweep: 500, q: 2, gain: 0.35 * vol }); break;
      case 'swing2': // the backhand: higher, with a faint ring off the blade
        this.noise(t, 0.15, { freq: r(2400, 2900), sweep: 700, q: 2.5, gain: 0.33 * vol });
        this.tone(t, 0.18, { freq: r(2900, 3200), slide: 2300, type: 'triangle', gain: 0.02 * vol });
        break;
      case 'swingHeavy':
        this.noise(t, 0.3, { freq: 1400, sweep: 220, q: 1.5, gain: 0.45 * vol });
        this.tone(t, 0.26, { freq: 150, slide: 60, type: 'sine', gain: 0.22 * vol });
        break;
      case 'slice': // the edge biting in: a short metallic "shing"
        this.noise(t, 0.07, { freq: 6000, q: 4, gain: 0.18 * vol, sweep: 3000 });
        this.tone(t, 0.12, { freq: r(2800, 3300), slide: 2000, type: 'triangle', gain: 0.035 * vol });
        break;
      case 'hitHeavy':
        this.noise(t, 0.22, { freq: 600, q: 0.7, gain: 0.75 * vol, type: 'lowpass', sweep: 120 });
        this.tone(t, 0.3, { freq: 110, slide: 38, type: 'sine', gain: 0.8 * vol });
        this.noise(t, 0.09, { freq: 3500, q: 2, gain: 0.3 * vol });
        this.tone(t, 0.18, { freq: 2400, slide: 1800, type: 'triangle', gain: 0.05 * vol, verb: 0.3 });
        break;
      case 'riposte':
        this.play('hitHeavy', vol);
        this.tone(t + 0.02, 0.7, { freq: 1318, type: 'triangle', gain: 0.07 * vol, verb: 0.7 });
        this.tone(t + 0.02, 0.5, { freq: 1976, type: 'sine', gain: 0.04 * vol, verb: 0.7 });
        break;
      case 'killBlow':
        this.tone(t, 0.6, { freq: 90, slide: 30, type: 'sine', gain: 0.55 * vol, verb: 0.5 });
        this.noise(t, 0.5, { freq: 2400, sweep: 300, q: 1, gain: 0.22 * vol, verb: 0.6 });
        break;
      case 'parry': // bright steel-on-steel ring, a low thump, and a falling shimmer
        this.tone(t, 0.9, { freq: 1760, type: 'sine', gain: 0.16 * vol, verb: 0.8 });
        this.tone(t, 0.7, { freq: 2637, type: 'triangle', gain: 0.07 * vol, verb: 0.8 });
        this.tone(t, 0.5, { freq: 3520, slide: 4200, type: 'sine', gain: 0.04 * vol, verb: 0.8 });
        this.noise(t, 0.1, { freq: 5000, q: 1.5, gain: 0.4 * vol, type: 'highpass' });
        this.tone(t, 0.2, { freq: 160, slide: 60, type: 'sine', gain: 0.5 * vol });
        for (let i = 0; i < 5; i++) this.tone(t + 0.05 + i * 0.04, 0.3, { freq: 4000 - i * 350, gain: 0.02 * vol, verb: 0.9 });
        break;
      case 'parryWhiff': this.noise(t, 0.12, { freq: 3200, sweep: 1200, q: 3, gain: 0.18 * vol }); break;
      case 'shield': // a blow glancing off a shield
        this.tone(t, 0.25, { freq: r(520, 600), type: 'square', gain: 0.05 * vol, verb: 0.3 });
        this.tone(t, 0.35, { freq: r(1200, 1350), gain: 0.08 * vol, verb: 0.4 });
        this.noise(t, 0.1, { freq: 900, q: 1, gain: 0.45 * vol, type: 'lowpass' });
        break;
      case 'guardBreak':
        this.noise(t, 0.3, { freq: 1800, q: 0.8, gain: 0.6 * vol, type: 'lowpass', sweep: 200, verb: 0.4 });
        this.tone(t, 0.35, { freq: 240, slide: 70, type: 'square', gain: 0.08 * vol });
        this.noise(t, 0.25, { freq: 7000, q: 1, gain: 0.25 * vol, type: 'highpass', sweep: 3000 });
        this.tone(t, 0.4, { freq: 70, slide: 35, gain: 0.6 * vol });
        break;
      case 'hit':
        this.noise(t, 0.12, { freq: 900, q: 0.8, gain: 0.6 * vol, type: 'lowpass' });
        this.tone(t, 0.12, { freq: 180, slide: 60, type: 'triangle', gain: 0.5 * vol });
        this.noise(t, 0.06, { freq: 4000, q: 3, gain: 0.25 * vol });
        break;
      case 'clang':
        this.tone(t, 0.4, { freq: r(900, 1100), type: 'square', gain: 0.08 * vol, verb: 0.4 });
        this.tone(t, 0.5, { freq: r(1500, 1700), type: 'sine', gain: 0.12 * vol, verb: 0.4 });
        this.noise(t, 0.08, { freq: 3000, q: 2, gain: 0.3 * vol });
        break;
      case 'hurt':
        this.noise(t, 0.2, { freq: 600, q: 1, gain: 0.6 * vol, type: 'lowpass' });
        this.tone(t, 0.25, { freq: 220, slide: 90, type: 'sawtooth', gain: 0.15 * vol });
        break;
      case 'jump': this.noise(t, 0.1, { freq: 700, sweep: 1400, q: 1, gain: 0.15 * vol }); break;
      case 'djump':
        this.noise(t, 0.25, { freq: 900, sweep: 2600, q: 2, gain: 0.25 * vol, verb: 0.3 });
        this.tone(t, 0.3, { freq: 660, slide: 990, type: 'sine', gain: 0.08 * vol, verb: 0.5 });
        break;
      case 'land': this.noise(t, 0.09, { freq: 300, q: 0.7, gain: 0.3 * vol, type: 'lowpass' }); break;
      case 'step': this.noise(t, 0.05, { freq: r(250, 400), q: 0.8, gain: 0.12 * vol, type: 'lowpass' }); break;
      case 'roll': this.noise(t, 0.28, { freq: 400, sweep: 200, q: 0.6, gain: 0.3 * vol, type: 'lowpass' }); break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.08, 0.6, { freq: f, gain: 0.1 * vol, verb: 0.6 }));
        break;
      case 'drink': this.noise(t, 0.35, { freq: 500, q: 4, gain: 0.15 * vol, sweep: 300 }); break;
      case 'enemyDie':
        this.noise(t, 0.6, { freq: 1200, sweep: 120, q: 1, gain: 0.4 * vol, verb: 0.4 });
        this.tone(t, 0.5, { freq: 300, slide: 50, type: 'sawtooth', gain: 0.1 * vol });
        break;
      case 'souls':
        for (let i = 0; i < 4; i++) this.tone(t + i * 0.05, 0.3, { freq: 1200 + i * 240, gain: 0.04 * vol, verb: 0.6 });
        break;
      case 'bonfire':
        this.noise(t, 1.2, { freq: 300, sweep: 2000, q: 0.7, gain: 0.4 * vol, attack: 0.3, verb: 0.5 });
        [262, 330, 392, 523].forEach((f, i) => this.tone(t + 0.2 + i * 0.1, 1.6, { freq: f, gain: 0.08 * vol, verb: 0.8 }));
        break;
      case 'pickup':
        [440, 554, 659, 880, 1108].forEach((f, i) => this.tone(t + i * 0.09, 1.2, { freq: f, gain: 0.08 * vol, verb: 0.8, type: 'triangle' }));
        break;
      case 'died':
        this.tone(t, 3, { freq: 110, slide: 55, type: 'sawtooth', gain: 0.15 * vol, attack: 0.2, verb: 0.8 });
        this.tone(t, 3, { freq: 165, slide: 82, type: 'sawtooth', gain: 0.1 * vol, attack: 0.2, verb: 0.8 });
        this.noise(t, 2.5, { freq: 200, q: 0.5, gain: 0.3 * vol, type: 'lowpass', attack: 0.1, verb: 0.6 });
        break;
      case 'roar':
        this.tone(t, 1.6, { freq: 80, slide: 55, type: 'sawtooth', gain: 0.3 * vol, attack: 0.1, verb: 0.6 });
        this.tone(t, 1.6, { freq: 121, slide: 70, type: 'sawtooth', gain: 0.18 * vol, attack: 0.1, verb: 0.6 });
        this.noise(t, 1.6, { freq: 400, q: 0.8, gain: 0.5 * vol, attack: 0.15, verb: 0.6, sweep: 150 });
        break;
      case 'slam':
        this.tone(t, 0.6, { freq: 90, slide: 30, type: 'sine', gain: 0.9 * vol });
        this.noise(t, 0.5, { freq: 500, q: 0.6, gain: 0.7 * vol, type: 'lowpass', verb: 0.5, sweep: 80 });
        break;
      case 'whoosh': this.noise(t, 0.4, { freq: 300, sweep: 1600, q: 1.2, gain: 0.35 * vol }); break;
      case 'fire':
        this.noise(t, 0.8, { freq: 800, q: 0.5, gain: 0.45 * vol, attack: 0.05, verb: 0.3, sweep: 200 });
        this.tone(t, 0.5, { freq: 70, slide: 40, gain: 0.4 * vol });
        break;
      case 'glint': this.tone(t, 0.35, { freq: 2600, slide: 3200, gain: 0.06 * vol, verb: 0.6, type: 'triangle' }); break;
      case 'fog': this.noise(t, 1.5, { freq: 600, q: 0.6, gain: 0.25 * vol, attack: 0.4, verb: 0.7 }); break;
      case 'victory':
        [196, 247, 294, 392, 494, 587].forEach((f, i) => this.tone(t + i * 0.12, 3, { freq: f, gain: 0.07 * vol, verb: 0.9, type: 'triangle' }));
        break;
      case 'select': this.tone(t, 0.15, { freq: 880, gain: 0.08 * vol, type: 'triangle', verb: 0.3 }); break;
      case 'wisp': this.tone(t, 0.5, { freq: 700, slide: 300, gain: 0.07 * vol, type: 'triangle', verb: 0.5 }); break;
      case 'wail':
        [622, 740, 932].forEach((f, i) => this.tone(t + i * 0.05, 1.8, { freq: f, slide: f * 0.7, type: 'sine', gain: 0.09 * vol, attack: 0.25, verb: 1 }));
        this.noise(t, 1.6, { freq: 2400, q: 6, gain: 0.12 * vol, attack: 0.3, verb: 0.8, sweep: 900 });
        break;
      case 'orb':
        this.tone(t, 0.4, { freq: 1200, slide: 500, type: 'triangle', gain: 0.1 * vol, verb: 0.6 });
        this.noise(t, 0.3, { freq: 3000, q: 4, gain: 0.08 * vol, sweep: 1200 });
        break;
      case 'beam':
        this.tone(t, 0.5, { freq: 180, slide: 90, type: 'sawtooth', gain: 0.18 * vol, verb: 0.5 });
        this.noise(t, 0.5, { freq: 2000, q: 1, gain: 0.3 * vol, sweep: 400, verb: 0.4 });
        break;
      case 'splash': this.noise(t, 0.35, { freq: 1400, q: 0.8, gain: 0.3 * vol, sweep: 400, verb: 0.3 }); break;
      case 'vanish': this.noise(t, 0.45, { freq: 600, q: 2, gain: 0.2 * vol, sweep: 3000, verb: 0.7 }); break;
      case 'dash':
        this.noise(t, 0.25, { freq: 500, sweep: 3000, q: 1.5, gain: 0.35 * vol, verb: 0.3 });
        this.tone(t, 0.2, { freq: 300, slide: 900, type: 'triangle', gain: 0.08 * vol });
        break;
      case 'lava':
        this.noise(t, 0.6, { freq: 3000, q: 0.6, gain: 0.35 * vol, sweep: 800, type: 'highpass' });
        this.noise(t, 0.4, { freq: 300, q: 0.8, gain: 0.4 * vol, type: 'lowpass' });
        break;
      case 'fireball':
        this.noise(t, 0.35, { freq: 700, q: 1, gain: 0.25 * vol, sweep: 1800 });
        this.tone(t, 0.25, { freq: 220, slide: 440, type: 'triangle', gain: 0.06 * vol });
        break;
      case 'jet': this.noise(t, 0.7, { freq: 900, q: 0.6, gain: 0.3 * vol, attack: 0.04, sweep: 300, verb: 0.2 }); break;
      case 'block':
        this.tone(t, 0.3, { freq: 700, type: 'square', gain: 0.07 * vol, verb: 0.3 });
        this.noise(t, 0.08, { freq: 2500, q: 2, gain: 0.3 * vol });
        break;
      default: break;
    }
  }

  // --- music
  stopMusic(fade = 1) {
    if (!this.music) return;
    const m = this.music;
    this.music = null;
    this.musicName = null;
    clearInterval(m.timer);
    const t = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(m.gain.gain.value, t);
    m.gain.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => m.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }), fade * 1000 + 100);
  }

  playMusic(name) {
    if (!this.ctx || this.musicName === name) return;
    this.stopMusic(1.2);
    this.musicName = name;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    gain.connect(this.musicBus);
    const rv = c.createGain(); rv.gain.value = 0.5; gain.connect(rv); rv.connect(this.reverb);
    const m = { gain, nodes: [], timer: null };
    this.music = m;

    const file = this.bufs && this.bufs[MUSIC[name]];
    if (file) {
      m.file = true;
      const loop = (b, v) => {
        const s = c.createBufferSource(); s.buffer = b; s.loop = true;
        const g = c.createGain(); g.gain.value = v; s.connect(g); g.connect(gain); s.start(); m.nodes.push(s);
      };
      loop(file, name === 'crypt' ? 1.6 : 1.9);
      const amb = AMB[name] && this.bufs[AMB[name]];
      if (amb) loop(amb, 0.9);
      return;
    }

    if (name === 'ambient' || name === 'crypt' || name === 'cathedral') {
      // slow drone pad + sparse bell notes (crypt: lower, darker, more echo; cathedral: organ-like)
      const crypt = name === 'crypt';
      const organ = name === 'cathedral';
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = organ ? 900 : crypt ? 380 : 500; lp.connect(gain);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
      const lfoG = c.createGain(); lfoG.gain.value = 250; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
      m.nodes.push(lfo);
      (organ ? [82.4, 123.5, 164.8, 196, 246.9] : crypt ? [61.7, 92.5, 123.5, 146.8] : [73.4, 110, 146.8, 174.6]).forEach((f, i) => {
        const o = c.createOscillator(); o.type = organ ? 'square' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 7;
        const g = c.createGain(); g.gain.value = organ ? 0.045 : 0.09; o.connect(g); g.connect(lp); o.start(); m.nodes.push(o);
      });
      const scale = organ ? [329.6, 392, 493.9, 523.3, 659.3, 784] : crypt ? [246.9, 293.7, 329.6, 370, 493.9, 587.3] : [293.7, 349.2, 440, 523.3, 587.3, 698.5];
      m.timer = setInterval(() => {
        if (Math.random() < (crypt ? 0.35 : 0.45)) {
          const f = scale[Math.floor(Math.random() * scale.length)];
          this.tone(c.currentTime, crypt ? 4.5 : 3, { freq: f, gain: 0.05, verb: 1, bus: gain, attack: 0.02, type: crypt ? 'triangle' : 'sine' });
        }
      }, crypt ? 1700 : 1400);
    } else if (name === 'boss' || name === 'boss2' || name === 'boss3') {
      // driving 8th-note ostinato, drums, and a pad
      // boss2: B minor, choir-like arpeggio. boss3: E harmonic minor, fastest, double arpeggio.
      const two = name === 'boss2' || name === 'boss3';
      const three = name === 'boss3';
      const bpm = three ? 156 : two ? 144 : 132, step = 60 / bpm / 2;
      const bass = three ? [82.4, 82.4, 98, 82.4, 77.8, 82.4, 65.4, 61.7]
        : two ? [61.7, 61.7, 73.4, 61.7, 69.3, 61.7, 55, 58.3] : [73.4, 73.4, 87.3, 73.4, 65.4, 65.4, 69.3, 73.4];
      const chords = three
        ? [[329.6, 392, 493.9], [261.6, 329.6, 392], [246.9, 311.1, 370], [220, 261.6, 329.6]]
        : two
          ? [[246.9, 293.7, 370], [220, 277.2, 329.6], [196, 246.9, 293.7], [233.1, 277.2, 370]]
          : [[293.7, 349.2, 440], [261.6, 329.6, 392], [233.1, 293.7, 349.2], [220, 277.2, 329.6]];
      let i = 0;
      let next = c.currentTime + 0.1;
      const sched = () => {
        while (next < c.currentTime + 0.2) {
          const t = next;
          const b = bass[i % 8];
          this.tone(t, step * 0.9, { freq: b, type: 'sawtooth', gain: 0.22, bus: gain });
          this.tone(t, step * 0.9, { freq: b * 2, type: 'square', gain: 0.04, bus: gain });
          if (i % 4 === 0) { // kick
            this.tone(t, 0.3, { freq: 120, slide: 40, gain: 0.6, bus: gain });
          }
          if (i % 8 === 4) { // snare
            const src = c.createBufferSource(); src.buffer = this.noiseBuf;
            const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
            const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            src.connect(f); f.connect(g); g.connect(gain); src.start(t); src.stop(t + 0.2);
          }
          if (three && i % 2 === 0) { // low counter-arpeggio
            const ch = chords[Math.floor(i / 16) % 4];
            this.tone(t, step * 1.2, { freq: ch[(i >> 1) % 3], type: 'square', gain: 0.02, bus: gain });
          }
          if (two && i % 2 === 1) { // shimmering arpeggio
            const ch = chords[Math.floor(i / 16) % 4];
            this.tone(t, step * 1.5, { freq: ch[(i >> 1) % 3] * 2, type: 'triangle', gain: 0.035, bus: gain, verb: 0.6 });
          }
          if (i % 16 === 0) {
            const ch = chords[Math.floor(i / 16) % 4];
            ch.forEach((f) => {
              this.tone(t, step * 15, { freq: f, type: 'sawtooth', gain: 0.035, attack: 0.3, bus: gain, verb: 0.5 });
              this.tone(t, step * 15, { freq: f / 2, type: 'triangle', gain: 0.05, attack: 0.3, bus: gain });
            });
          }
          i++;
          next += step;
        }
      };
      m.timer = setInterval(sched, 40);
    }
  }
}

export const audio = new AudioEngine();
