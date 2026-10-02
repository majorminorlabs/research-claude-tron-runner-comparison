import type { GameEvent } from '../game/game';

const A_MINOR_PENT = [0, 3, 5, 7, 10];

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// Am - F - C - G (root, third, fifth as MIDI notes)
const PROGRESSION: number[][] = [
  [45, 48, 52],
  [41, 45, 48],
  [48, 52, 55],
  [43, 47, 50],
];

/** Fully procedural synthwave audio: no asset files. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private intensity = 0;
  private muted = false;

  /** Must be called from a user gesture. */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.42;
    this.musicBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.75;
    this.sfxBus.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** AudioContext state, or 'none' before the first user gesture. */
  get state(): string {
    return this.ctx ? this.ctx.state : 'none';
  }
  get isMuted(): boolean {
    return this.muted;
  }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  // ------------------------------------------------------------------ music
  startMusic(): void {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }
  stopMusic(): void {
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
  /** 0 (title / calm) .. 1 (full speed). */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }
  /** Ducks the music while paused. */
  setMusicLevel(v: number): void {
    if (this.ctx) this.musicBus.gain.setTargetAtTime(0.42 * v, this.ctx.currentTime, 0.1);
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c || !this.playing) return;
    const bpm = 112 + this.intensity * 26;
    const stepLen = 60 / bpm / 4;
    while (this.nextTime < c.currentTime + 0.18) {
      this.playStep(this.step, this.nextTime, stepLen);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, len: number): void {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = PROGRESSION[bar]!;
    const I = this.intensity;

    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.clap(t);
    if (s % 2 === 1 || I > 0.5) if (s % 2 === 1 || s % 4 === 2) this.hat(t, s % 4 === 2 ? 0.05 : 0.09);

    // driving 8th-note bass
    if (s % 2 === 0) this.bass(midiToHz(chord[0]! - 12 + (s % 8 === 6 ? 12 : 0)), t, len * 1.8);

    // arp enters as the pace picks up
    if (I > 0.12 || bar % 2 === 1) {
      const idx = [0, 1, 2, 1, 2, 1, 0, 2][s % 8]!;
      const note = chord[idx]! + 24 + (s >= 8 ? 12 * (I > 0.5 ? 1 : 0) : 0);
      this.pluck(midiToHz(note), t, len * 1.4, 0.05 + I * 0.05);
    }
    if (s === 0 && bar % 2 === 0) this.pad(chord.map((n) => midiToHz(n + 12)), t, len * 16);
  }

  private env(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private kick(t: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 0.9, 0.22);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.3);
  }
  private clap(t: number): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, 0.002, 0.45, 0.16);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.25);
  }
  private hat(t: number, vol: number): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = c.createGain();
    this.env(g, t, 0.001, vol, 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.08);
  }
  private bass(freq: number, t: number, dur: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(220 + this.intensity * 700, t);
    f.frequency.exponentialRampToValueAtTime(110, t + dur);
    f.Q.value = 6;
    const g = c.createGain();
    this.env(g, t, 0.005, 0.5, dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private pluck(freq: number, t: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.003, vol, dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private pad(freqs: number[], t: number, dur: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    f.connect(g).connect(this.musicBus);
    for (const fr of freqs) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  // -------------------------------------------------------------------- sfx
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private whoosh(dur: number, f0: number, f1: number, vol: number): void {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.01, vol, dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  handle(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      switch (e.type) {
        case 'jump':
          this.tone('sine', 260, 760, 0.16, 0.35);
          break;
        case 'slide':
          this.whoosh(0.3, 3200, 500, 0.5);
          break;
        case 'land':
          this.tone('sine', 120, 50, 0.12, 0.3);
          break;
        case 'lane':
          this.whoosh(0.07, 5000, 2500, 0.18);
          break;
        case 'bump':
          this.tone('square', 110, 80, 0.06, 0.12);
          break;
        case 'bit': {
          const k = Math.min(e.chain - 1, 14);
          const note = 72 + A_MINOR_PENT[k % 5]! + 12 * Math.floor(k / 5);
          this.tone('triangle', midiToHz(note), midiToHz(note) * 1.01, 0.12, 0.28);
          break;
        }
        case 'power':
          [0, 4, 7, 12].forEach((n, i) => this.tone('square', midiToHz(69 + n), midiToHz(69 + n), 0.14, 0.2, i * 0.055));
          break;
        case 'power-end':
          if (e.kind !== 'shield') this.tone('sine', 600, 200, 0.3, 0.18);
          break;
        case 'dodge':
          this.tone('sine', 900, 1500, 0.1, 0.2);
          break;
        case 'derez':
          this.tone('sawtooth', 700, 90, 0.2, 0.22);
          break;
        case 'shield-break':
          this.whoosh(0.5, 2500, 200, 0.8);
          this.tone('sawtooth', 500, 60, 0.5, 0.4);
          break;
        case 'sector':
          [0, 7, 12, 19].forEach((n, i) => this.tone('sawtooth', midiToHz(57 + n), midiToHz(57 + n), 0.5, 0.18, i * 0.08));
          break;
        case 'crash':
          this.whoosh(1.1, 4000, 60, 1.0);
          this.tone('sawtooth', 220, 30, 0.9, 0.6);
          this.tone('sine', 90, 25, 1.0, 0.7);
          break;
      }
    }
  }

  /** UI blips. */
  ui(kind: 'select' | 'confirm' | 'back' | 'count' | 'go'): void {
    if (!this.ctx || this.muted) return;
    switch (kind) {
      case 'select':
        this.tone('square', 880, 880, 0.05, 0.12);
        break;
      case 'confirm':
        this.tone('square', 660, 990, 0.12, 0.2);
        break;
      case 'back':
        this.tone('square', 600, 380, 0.1, 0.15);
        break;
      case 'count':
        this.tone('square', 520, 520, 0.12, 0.2);
        break;
      case 'go':
        this.tone('square', 1040, 1040, 0.3, 0.25);
        break;
    }
  }
}
