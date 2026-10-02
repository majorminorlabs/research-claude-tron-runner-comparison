// Procedural WebAudio sound: every effect and the music loop are synthesized,
// so the game ships with zero audio assets.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = false;
  let musicOn = false;
  let nextStep = 0;
  let step = 0;
  let timer = null;
  let collectCombo = 0;
  let lastCollect = 0;

  function ensure() {
    if (ctx) return ctx.state === 'running' || ctx.state === 'suspended';
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.55;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.32;
    musicBus.connect(master);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone({ type = 'square', freq, to, time = 0, dur = 0.12, vol = 0.3, bus = sfxBus, attack = 0.005 }) {
    if (!ctx) return;
    const t = ctx.currentTime + time;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ time = 0, dur = 0.2, vol = 0.3, filter = 'lowpass', from = 4000, to = 300, q = 1, bus = sfxBus }) {
    if (!ctx) return;
    const t = ctx.currentTime + time;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const sfx = {
    jump: () => tone({ type: 'square', freq: 220, to: 660, dur: 0.16, vol: 0.18 }),
    slide: () => noise({ dur: 0.3, vol: 0.35, filter: 'bandpass', from: 3000, to: 400, q: 2 }),
    lane: () => tone({ type: 'triangle', freq: 520, to: 380, dur: 0.06, vol: 0.12 }),
    edge: () => tone({ type: 'square', freq: 110, to: 90, dur: 0.06, vol: 0.12 }),
    land: () => noise({ dur: 0.08, vol: 0.15, from: 900, to: 200 }),
    collect: () => {
      const now = ctx ? ctx.currentTime : 0;
      collectCombo = now - lastCollect < 0.45 ? Math.min(collectCombo + 1, 12) : 0;
      lastCollect = now;
      tone({ type: 'sine', freq: NOTE(84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][collectCombo]), dur: 0.12, vol: 0.2 });
    },
    clear: () => {
      tone({ type: 'triangle', freq: NOTE(76), dur: 0.08, vol: 0.18 });
      tone({ type: 'triangle', freq: NOTE(83), dur: 0.12, vol: 0.18, time: 0.06 });
    },
    powerup: () => [72, 76, 79, 84, 88].forEach((n, i) => tone({ type: 'square', freq: NOTE(n), dur: 0.1, vol: 0.14, time: i * 0.05 })),
    powerEnd: () => tone({ type: 'triangle', freq: NOTE(79), to: NOTE(67), dur: 0.25, vol: 0.15 }),
    bump: () => {
      tone({ type: 'sine', freq: 140, to: 50, dur: 0.18, vol: 0.4 });
      noise({ dur: 0.12, vol: 0.2, from: 1500, to: 200 });
    },
    shieldBreak: () => {
      noise({ dur: 0.5, vol: 0.45, filter: 'highpass', from: 6000, to: 800 });
      tone({ type: 'sawtooth', freq: 880, to: 110, dur: 0.45, vol: 0.18 });
    },
    crash: () => {
      noise({ dur: 1.2, vol: 0.6, from: 5000, to: 60 });
      tone({ type: 'sawtooth', freq: 300, to: 30, dur: 1.0, vol: 0.3 });
      tone({ type: 'square', freq: 1200, to: 60, dur: 0.6, vol: 0.1, time: 0.05 });
    },
    start: () => [60, 67, 72].forEach((n, i) => tone({ type: 'sawtooth', freq: NOTE(n), dur: 0.25, vol: 0.12, time: i * 0.08 })),
  };

  // --- Music: a minor-key synthwave loop (bass arp, kick, hats, pads) ---
  const BPM = 116;
  const STEP = 60 / BPM / 4; // 16th notes
  const roots = [45, 41, 48, 43]; // A, F, C, G
  const arp = [0, 12, 7, 12, 0, 12, 7, 10];

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % roots.length;
    const s = i % 16;
    const root = roots[bar];
    const at = t - ctx.currentTime;
    // bass
    tone({ type: 'sawtooth', freq: NOTE(root + arp[s % 8] - 12), dur: STEP * 0.9, vol: 0.22, time: at, bus: musicBus });
    // kick
    if (s % 4 === 0) tone({ type: 'sine', freq: 150, to: 40, dur: 0.22, vol: 0.7, time: at, bus: musicBus });
    // snare
    if (s === 4 || s === 12) noise({ time: at, dur: 0.16, vol: 0.25, filter: 'bandpass', from: 2200, to: 1500, q: 0.8, bus: musicBus });
    // hats
    if (s % 2 === 1) noise({ time: at, dur: 0.04, vol: 0.08, filter: 'highpass', from: 8000, to: 7000, bus: musicBus });
    // lead stab every half bar
    if (s === 0 || s === 10) {
      tone({ type: 'square', freq: NOTE(root + 24 + (s === 10 ? 7 : 3)), dur: STEP * 3, vol: 0.05, time: at, bus: musicBus, attack: 0.02 });
    }
  }

  function scheduler() {
    if (!ctx || !musicOn) return;
    while (nextStep < ctx.currentTime + 0.12) {
      scheduleStep(step++, nextStep);
      nextStep += STEP;
    }
  }

  return {
    unlock,
    play(name) {
      if (!ctx || muted || ctx.state !== 'running') return;
      sfx[name]?.();
    },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      step = 0;
      nextStep = ctx.currentTime + 0.05;
      timer = setInterval(scheduler, 25);
    },
    stopMusic() {
      musicOn = false;
      clearInterval(timer);
      timer = null;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
    },
    get muted() {
      return muted;
    },
  };
}
