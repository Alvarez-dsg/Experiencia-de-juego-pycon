// Efectos de sonido sintetizados con WebAudio (no requiere archivos de audio).
let ctx = null;
let master = null;
let noiseBuf = null;
const last = {};

function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return true;
  last[key] = now;
  return false;
}

export const sfx = {
  muted: false,
  unlock() {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      /* sin audio */
    }
  },
  get ready() {
    return !!ctx && ctx.state === 'running' && !this.muted;
  },
  tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, attack = 0.006 } = {}) {
    if (!this.ready) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  },
  noise(dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'lowpass', to = 0, delay = 0 } = {}) {
    if (!this.ready) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  },
  click() {
    this.tone(660, 0.07, { type: 'triangle', vol: 0.15 });
  },
  pick() {
    this.tone(420, 0.1, { type: 'triangle', vol: 0.13, slide: 300 });
  },
  deny() {
    this.tone(180, 0.18, { type: 'square', vol: 0.06, slide: -60 });
  },
  plant() {
    this.noise(0.14, { vol: 0.3, freq: 420 });
    this.tone(300, 0.14, { type: 'triangle', vol: 0.15, slide: 250 });
    this.tone(720, 0.12, { vol: 0.08, delay: 0.07, slide: 240 });
  },
  collect() {
    this.tone(880, 0.1, { vol: 0.13 });
    this.tone(1320, 0.16, { vol: 0.11, delay: 0.07 });
    this.tone(1760, 0.14, { vol: 0.05, delay: 0.13 });
  },
  shoot(kind) {
    if (throttle('shoot', 60)) return;
    if (kind === 'rana') {
      this.noise(0.07, { vol: 0.12, freq: 900, type: 'bandpass', q: 3 });
      this.tone(380, 0.08, { type: 'sine', vol: 0.05, slide: 260 });
    } else if (kind === 'mono') this.noise(0.1, { vol: 0.1, freq: 600, to: 2400, type: 'bandpass', q: 1.2 });
    else this.tone(520, 0.06, { type: 'square', vol: 0.035, slide: -260 });
  },
  jump() {
    if (throttle('jump', 80)) return;
    this.tone(330, 0.16, { type: 'triangle', vol: 0.1, slide: 420 });
  },
  impact(big) {
    if (throttle('impact', 60)) return;
    this.noise(big ? 0.35 : 0.14, { vol: big ? 0.4 : 0.22, freq: big ? 500 : 900, to: 120 });
    this.tone(big ? 90 : 140, big ? 0.3 : 0.12, { type: 'sine', vol: 0.2, slide: -50 });
  },
  roll() {
    this.noise(0.5, { vol: 0.16, freq: 300, to: 700, type: 'bandpass', q: 1.5 });
  },
  bite() {
    if (throttle('bite', 120)) return;
    this.noise(0.06, { vol: 0.25, freq: 1800, type: 'bandpass', q: 2.5 });
    this.tone(220, 0.07, { type: 'square', vol: 0.05, slide: -80 });
  },
  heal() {
    if (throttle('heal', 500)) return;
    this.tone(1046, 0.18, { vol: 0.05 });
    this.tone(1568, 0.22, { vol: 0.04, delay: 0.08 });
  },
  throw() {
    this.noise(0.25, { vol: 0.18, freq: 600, to: 2200, type: 'bandpass', q: 1.2 });
  },
  whoosh(hit) {
    if (throttle('whoosh', 250)) return;
    this.noise(0.35, { vol: hit ? 0.3 : 0.14, freq: 400, to: 2600, type: 'bandpass', q: 0.9 });
    if (hit) this.tone(180, 0.2, { type: 'triangle', vol: 0.08, slide: 200, delay: 0.05 });
  },
  snake() {
    this.noise(0.3, { vol: 0.14, freq: 5000, type: 'highpass' });
    this.tone(150, 0.22, { type: 'sine', vol: 0.22, slide: -80, delay: 0.22 });
  },
  hit() {
    if (throttle('hit', 50)) return;
    this.noise(0.05, { vol: 0.12, freq: 2200, type: 'bandpass', q: 2 });
  },
  chop(type) {
    if (throttle('chop' + type, 90)) return;
    if (type === 'motosierra') this.tone(110 + Math.random() * 30, 0.22, { type: 'sawtooth', vol: 0.05, slide: 40 });
    else if (type === 'topadora') this.noise(0.25, { vol: 0.2, freq: 260 });
    else this.noise(0.09, { vol: 0.28, freq: 1500, type: 'bandpass', q: 1.4 });
  },
  saw() {
    this.tone(90, 0.7, { type: 'sawtooth', vol: 0.05, slide: 70 });
    this.tone(180, 0.6, { type: 'sawtooth', vol: 0.025, slide: 120, delay: 0.05 });
  },
  engine() {
    this.noise(1.0, { vol: 0.25, freq: 160, to: 90 });
    this.tone(55, 1.0, { type: 'sawtooth', vol: 0.06, slide: 15 });
  },
  fall() {
    this.tone(260, 0.3, { type: 'triangle', vol: 0.09, slide: -180 });
  },
  eaten() {
    this.noise(0.25, { vol: 0.22, freq: 700, to: 200 });
  },
  explode() {
    this.noise(0.9, { vol: 0.55, freq: 1800, to: 80 });
    this.tone(70, 0.6, { type: 'sine', vol: 0.3, slide: -40 });
  },
  roar() {
    this.noise(0.6, { vol: 0.25, freq: 400, type: 'bandpass', q: 1.5, to: 180 });
    this.tone(110, 0.5, { type: 'sawtooth', vol: 0.06, slide: -50 });
  },
  banner(big) {
    if (big) {
      [0, 0.18, 0.36].forEach((d) => this.tone(220, 0.25, { type: 'square', vol: 0.06, delay: d }));
    } else {
      this.tone(523, 0.12, { type: 'triangle', vol: 0.1 });
      this.tone(784, 0.2, { type: 'triangle', vol: 0.1, delay: 0.1 });
    }
  },
  rise() {
    this.noise(1.4, { vol: 0.18, freq: 300, to: 1200 });
    this.tone(196, 1.2, { type: 'triangle', vol: 0.06, slide: 196 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.13 }));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.38, { type: 'triangle', vol: 0.11, delay: i * 0.2 }));
  },
  bird() {
    const base = 1800 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone(base, 0.09, { vol: 0.018, slide: (Math.random() - 0.3) * 1400, delay: i * 0.12 });
  },
};
