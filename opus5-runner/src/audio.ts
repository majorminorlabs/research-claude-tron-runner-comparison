/**
 * All sound is synthesised at runtime — no asset downloads, and nothing is
 * created until the first user gesture, which keeps browsers' autoplay rules
 * happy.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneSub: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  /** Safe to call repeatedly; only the first call inside a gesture matters. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WithLegacy = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithLegacy).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.5;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = this.makeNoise(ctx);
      this.startDrone();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startDrone(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 58;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 29;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    sub.start();
    this.droneOsc = osc;
    this.droneSub = sub;
    this.droneGain = gain;
  }

  /** Engine note follows speed; silent when the run is not in progress. */
  setEngine(active: boolean, speedRatio: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.droneGain || !this.droneOsc || !this.droneSub) return;
    const t = ctx.currentTime;
    const r = Math.max(0, Math.min(1, speedRatio));
    this.droneGain.gain.setTargetAtTime(active ? 0.1 : 0, t, 0.2);
    this.droneOsc.frequency.setTargetAtTime(52 + r * 92, t, 0.25);
    this.droneSub.frequency.setTargetAtTime(26 + r * 44, t, 0.25);
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, peak: number, filterFreq: number, sweepTo?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  jump(): void {
    this.tone(320, 760, 0.16, 'triangle', 0.18);
  }

  land(): void {
    this.noise(0.09, 0.14, 240, 110);
  }

  slide(): void {
    this.noise(0.3, 0.12, 1700, 300);
  }

  strafe(): void {
    this.tone(540, 300, 0.07, 'square', 0.06);
  }

  orb(combo: number): void {
    const step = Math.min(combo - 1, 11);
    const base = 660 * Math.pow(2, step / 12);
    this.tone(base, base * 1.5, 0.12, 'sine', 0.16);
    this.tone(base * 2, base * 3, 0.09, 'sine', 0.05, 0.015);
  }

  shield(): void {
    this.tone(300, 600, 0.3, 'sine', 0.14);
    this.tone(450, 900, 0.3, 'sine', 0.1, 0.04);
  }

  boost(): void {
    this.tone(180, 1400, 0.42, 'sawtooth', 0.14);
  }

  hit(): void {
    this.noise(0.32, 0.3, 900, 90);
    this.tone(180, 52, 0.34, 'square', 0.2);
  }

  shieldBreak(): void {
    this.noise(0.25, 0.2, 2600, 700);
    this.tone(700, 240, 0.22, 'triangle', 0.12);
  }

  death(): void {
    this.noise(0.7, 0.3, 1200, 60);
    this.tone(420, 40, 0.9, 'sawtooth', 0.22);
    this.tone(210, 28, 1.1, 'sine', 0.18, 0.05);
  }

  uiSelect(): void {
    this.tone(520, 880, 0.1, 'square', 0.1);
  }
}
