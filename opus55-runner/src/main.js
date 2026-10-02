import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import './style.css';

import { createGame, update, input as sendInput, multiplier } from './game/game.js';
import { botStep } from './game/autopilot.js';
import { NEAR_MISS_BONUS, POWERUP_DURATION } from './game/config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createStorage } from './storage.js';

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('game'),
  hud: $('hud'),
  score: $('score'),
  bits: $('bits'),
  mult: $('mult'),
  speed: $('speed'),
  toasts: $('toasts'),
  powers: {
    shield: document.querySelector('[data-power="shield"]'),
    magnet: document.querySelector('[data-power="magnet"]'),
    multiplier: document.querySelector('[data-power="multiplier"]'),
  },
  screens: {
    title: $('screen-title'),
    pause: $('screen-pause'),
    over: $('screen-over'),
    error: $('screen-error'),
  },
  bestTitle: $('best-title'),
  btnMute: $('btn-mute'),
  btnPause: $('btn-pause'),
};

const params = new URLSearchParams(location.search);
const fixedSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : undefined;
const storage = createStorage('grid-runner');
const audio = createAudio();

const FIXED_DT = 1 / 120;
const DEATH_DELAY = 1.1; // seconds of derez animation before the results screen

let view = null;
let game = null;
let phase = 'title'; // title | playing | paused | dying | over
let dyingFor = 0;
let best = storage.get('best', 0);
let lastFrame = 0;
let accumulator = 0;
let lastMilestone = 0;

// ---------------------------------------------------------------------------
// UI helpers

function show(name) {
  for (const [key, el] of Object.entries(ui.screens)) el.hidden = key !== name;
  ui.hud.hidden = !(phase === 'playing' || phase === 'paused' || phase === 'dying');
  ui.btnPause.hidden = phase !== 'playing';
  const focusable = name && ui.screens[name]?.querySelector('.btn.primary');
  if (focusable) focusable.focus({ preventScroll: true });
}

function toast(text, color = 'var(--cyan)', small = false) {
  const el = document.createElement('div');
  el.className = small ? 'toast small' : 'toast';
  el.style.setProperty('--c', color);
  el.textContent = text;
  ui.toasts.append(el);
  while (ui.toasts.children.length > 4) ui.toasts.firstChild.remove();
  setTimeout(() => el.remove(), small ? 700 : 1100);
}

function format(n) {
  return Math.floor(n).toLocaleString('en-US');
}

const hudCache = {};
function setText(el, key, value) {
  if (hudCache[key] !== value) {
    hudCache[key] = value;
    el.textContent = value;
  }
}

function updateHud() {
  setText(ui.score, 'score', format(game.score));
  setText(ui.bits, 'bits', format(game.bitsCollected));
  setText(ui.speed, 'speed', String(Math.round(game.speed * 9)));
  ui.mult.hidden = multiplier(game) === 1;
  ui.powers.shield.hidden = !game.powers.shield;
  for (const key of ['magnet', 'multiplier']) {
    const t = game.powers[key];
    ui.powers[key].hidden = t <= 0;
    if (t > 0) ui.powers[key].querySelector('b').style.transform = `scaleX(${(t / POWERUP_DURATION[key]).toFixed(3)})`;
  }
}

function syncMuteButton() {
  ui.btnMute.classList.toggle('muted', audio.muted);
  ui.btnMute.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  ui.btnMute.setAttribute('aria-pressed', String(audio.muted));
}

// ---------------------------------------------------------------------------
// Game flow

function startDemo() {
  game = createGame({ seed: 7 });
  view?.reset();
}

function startRun() {
  audio.unlock();
  game = createGame({ seed: fixedSeed });
  view?.reset();
  phase = 'playing';
  lastMilestone = 0;
  accumulator = 0;
  show(null);
  audio.play('start');
  audio.startMusic();
  toast('Go!', 'var(--cyan)');
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopMusic();
  show('pause');
}

function resume() {
  if (phase !== 'paused') return;
  phase = 'playing';
  lastFrame = performance.now();
  show(null);
  audio.unlock();
  audio.startMusic();
}

function toMenu() {
  phase = 'title';
  audio.stopMusic();
  ui.bestTitle.textContent = format(best);
  startDemo();
  show('title');
}

function gameOver() {
  phase = 'over';
  const score = Math.floor(game.score);
  const prevBest = best;
  const isBest = score > best;
  if (isBest) {
    best = score;
    storage.set('best', best);
  }
  $('final-score').textContent = format(score);
  $('final-best').textContent = format(best);
  $('final-distance').textContent = `${format(game.distance)} m`;
  $('final-bits').textContent = format(game.bitsCollected);
  $('final-clears').textContent = format(game.clears);
  $('final-time').textContent = `${Math.floor(game.time)}s`;
  $('new-best').hidden = !isBest || prevBest === 0;
  show('over');
}

const POWER_LABEL = {
  shield: ['Shield online', 'var(--blue)'],
  magnet: ['Magnet', 'var(--yellow)'],
  multiplier: ['Score ×2', 'var(--magenta)'],
};

function handleEvents(events, live) {
  for (const e of events) {
    if (live) audio.play(e.type);
    if (!live) continue;
    switch (e.type) {
      case 'powerup':
        toast(...POWER_LABEL[e.power]);
        break;
      case 'shieldBreak':
        toast('Shield down', 'var(--blue)');
        break;
      case 'clear':
        toast(`+${NEAR_MISS_BONUS * multiplier(game)} clean`, 'var(--cyan)', true);
        break;
      case 'crash':
        audio.stopMusic();
        phase = 'dying';
        dyingFor = 0;
        break;
      default:
        break;
    }
  }
}

function onAction(action) {
  if (action === 'mute') {
    audio.setMuted(!audio.muted);
    storage.set('muted', audio.muted);
    syncMuteButton();
    return;
  }
  switch (phase) {
    case 'title':
      if (action === 'confirm' || action === 'jump') startRun();
      break;
    case 'over':
      if (action === 'confirm' || action === 'jump') startRun();
      else if (action === 'pause') toMenu();
      break;
    case 'paused':
      if (action === 'pause' || action === 'confirm') resume();
      break;
    case 'playing':
      if (action === 'pause') pause();
      else if (action !== 'tap' && action !== 'confirm') sendInput(game, action);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Main loop

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (phase === 'paused' || phase === 'over') {
    if (phase === 'over') view.sync(game, dt, []);
    view.render();
    return;
  }

  const live = phase === 'playing' || phase === 'dying';
  const events = [];
  if (phase === 'title' || phase === 'playing') {
    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      if (phase === 'title') botStep(game);
      events.push(...update(game, FIXED_DT));
      accumulator -= FIXED_DT;
    }
    if (phase === 'title' && !game.alive) startDemo();
  }
  handleEvents(events, live);
  if (phase === 'dying') {
    dyingFor += dt;
    if (dyingFor >= DEATH_DELAY) gameOver();
  }
  if (phase === 'playing') {
    const km = Math.floor(game.distance / 1000);
    if (km > lastMilestone) {
      lastMilestone = km;
      toast(`${km * 1000} m`, 'var(--orange)');
    }
  }
  if (live) updateHud();
  view.sync(game, dt, events);
  view.render();
  quality.sample(dt, phase);
}

// Drops render resolution if the device can't hold a smooth frame rate.
const quality = {
  frames: 0,
  time: 0,
  sample(dt, ph) {
    if (ph !== 'playing' && ph !== 'title') return;
    this.frames++;
    this.time += dt;
    if (this.time < 2.5) return;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    if (fps < 45 && view.pixelRatio > 0.75) view.setQuality(Math.max(0.75, view.pixelRatio - 0.25));
  },
};

// ---------------------------------------------------------------------------
// Boot

async function boot() {
  audio.setMuted(storage.get('muted', false));
  syncMuteButton();
  ui.bestTitle.textContent = format(best);

  try {
    const { createView } = await import('./render/view.js');
    view = createView(ui.canvas);
  } catch (err) {
    console.warn('WebGL unavailable', err);
    phase = 'error';
    show('error');
    return;
  }

  createInput(ui.canvas, onAction);
  $('btn-start').addEventListener('click', startRun);
  $('btn-retry').addEventListener('click', startRun);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', toMenu);
  ui.btnPause.addEventListener('click', pause);
  ui.btnMute.addEventListener('click', () => {
    audio.unlock();
    onAction('mute');
  });
  // Any touch on a menu is a user gesture we can use to unlock audio.
  for (const el of Object.values(ui.screens)) el.addEventListener('pointerdown', () => audio.unlock());

  window.addEventListener('resize', () => view.resize());
  document.addEventListener('visibilitychange', () => document.hidden && pause());
  window.addEventListener('blur', pause);

  startDemo();
  show('title');
  lastFrame = performance.now();
  requestAnimationFrame(frame);

  // Read-only hook for automated tests and debugging.
  window.__gridRunner = {
    get phase() {
      return phase;
    },
    snapshot() {
      return {
        phase,
        alive: game.alive,
        lane: game.player.lane,
        y: game.player.y,
        sliding: game.player.sliding,
        score: Math.floor(game.score),
        distance: game.distance,
        speed: game.speed,
        seed: game.seed,
      };
    },
  };
  // Full mutable access only in the dev server, for manual tuning.
  if (import.meta.env.DEV) {
    Object.defineProperty(window.__gridRunner, 'game', { get: () => game });
  }
}

boot();
