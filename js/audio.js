/**
 * Tiny procedural sound engine (WebAudio) — no assets needed.
 * All methods are safe to call before init() (they no-op).
 */
let ctx = null;
let master = null;
let noiseBuf = null;

export const AudioSys = {
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  _t() { return ctx.currentTime + 0.001; },

  noise(opt = {}) {
    if (!ctx) return;
    const dur = opt.dur ?? 0.2;
    const type = opt.type ?? 'lowpass';
    const f0 = opt.f0 ?? 1500, f1 = opt.f1 ?? 200;
    const q = opt.q ?? 0.8, peak = opt.peak ?? 0.5;
    const t = opt.t0 ?? this._t();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type; filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(f0, 20), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  },

  tone(opt = {}) {
    if (!ctx) return;
    const dur = opt.dur ?? 0.15;
    const f0 = opt.f0 ?? 440, f1 = opt.f1 ?? null;
    const type = opt.type ?? 'sine', peak = opt.peak ?? 0.3;
    const t = opt.t0 ?? this._t();
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  shot(id) {
    if (!ctx) return;
    const t = this._t();
    switch (id) {
      case 'pistol':
        this.noise({ dur: 0.13, f0: 3200, f1: 500, peak: 0.5, t0: t });
        this.tone({ f0: 190, f1: 60, dur: 0.09, type: 'triangle', peak: 0.35, t0: t });
        break;
      case 'smg':
        this.noise({ dur: 0.07, f0: 4200, f1: 700, peak: 0.32, t0: t });
        this.tone({ f0: 230, f1: 90, dur: 0.05, type: 'triangle', peak: 0.18, t0: t });
        break;
      case 'shotgun':
        this.noise({ dur: 0.32, f0: 2000, f1: 110, peak: 0.85, t0: t });
        this.tone({ f0: 110, f1: 38, dur: 0.26, type: 'triangle', peak: 0.55, t0: t });
        this.noise({ dur: 0.12, f0: 5000, f1: 1500, peak: 0.3, t0: t });
        break;
      case 'sniper':
        this.noise({ dur: 0.3, f0: 5200, f1: 300, peak: 0.75, t0: t });
        this.tone({ f0: 170, f1: 32, dur: 0.3, type: 'triangle', peak: 0.5, t0: t });
        this.noise({ dur: 0.5, f0: 800, f1: 150, peak: 0.2, t0: t + 0.12 }); // echo
        break;
      case 'rocket':
        this.noise({ dur: 0.55, f0: 300, f1: 2200, type: 'bandpass', q: 1.2, peak: 0.45, t0: t });
        this.tone({ f0: 95, f1: 45, dur: 0.4, type: 'triangle', peak: 0.35, t0: t });
        break;
    }
  },

  explosion() {
    if (!ctx) return;
    const t = this._t();
    this.noise({ dur: 0.9, f0: 1000, f1: 40, peak: 1.0, t0: t });
    this.tone({ f0: 85, f1: 26, dur: 0.7, type: 'triangle', peak: 0.75, t0: t });
    this.noise({ dur: 1.3, f0: 350, f1: 60, peak: 0.3, t0: t + 0.06 });
  },

  hit() { this.tone({ f0: 950, f1: 650, dur: 0.06, type: 'square', peak: 0.10 }); },

  kill() {
    if (!ctx) return;
    const t = this._t();
    this.tone({ f0: 600, f1: 600, dur: 0.07, type: 'square', peak: 0.12, t0: t });
    this.tone({ f0: 950, f1: 950, dur: 0.09, type: 'square', peak: 0.12, t0: t + 0.07 });
  },

  hurt() {
    if (!ctx) return;
    const t = this._t();
    this.noise({ dur: 0.22, f0: 600, f1: 80, peak: 0.5, t0: t });
    this.tone({ f0: 130, f1: 45, dur: 0.2, type: 'triangle', peak: 0.4, t0: t });
  },

  reload() {
    if (!ctx) return;
    const t = this._t();
    this.noise({ dur: 0.035, f0: 2800, f1: 1600, peak: 0.22, t0: t });
    this.noise({ dur: 0.05, f0: 2200, f1: 900, peak: 0.28, t0: t + 0.18 });
  },

  reloadDone() { this.noise({ dur: 0.04, f0: 3000, f1: 1800, peak: 0.25 }); },

  pickup() {
    if (!ctx) return;
    const t = this._t();
    this.tone({ f0: 520, f1: 1040, dur: 0.12, type: 'sine', peak: 0.25, t0: t });
  },

  empty() { this.noise({ dur: 0.04, f0: 3200, f1: 2200, peak: 0.18 }); },

  wave() {
    if (!ctx) return;
    const t = this._t();
    this.tone({ f0: 330, dur: 0.16, type: 'triangle', peak: 0.28, t0: t });
    this.tone({ f0: 415, dur: 0.16, type: 'triangle', peak: 0.28, t0: t + 0.16 });
    this.tone({ f0: 494, dur: 0.3, type: 'triangle', peak: 0.3, t0: t + 0.32 });
  },

  gameover() {
    if (!ctx) return;
    const t = this._t();
    this.tone({ f0: 392, dur: 0.3, type: 'sawtooth', peak: 0.2, t0: t });
    this.tone({ f0: 311, dur: 0.3, type: 'sawtooth', peak: 0.2, t0: t + 0.28 });
    this.tone({ f0: 233, dur: 0.6, type: 'sawtooth', peak: 0.22, t0: t + 0.56 });
  },
};
