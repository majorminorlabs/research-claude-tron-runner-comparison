import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import './style.css';

import { AudioEngine } from './audio/audio';
import { Autopilot } from './game/bot';
import { CFG } from './game/config';
import { Game, type GameEvent } from './game/game';
import { randomSeed } from './game/rng';
import { bindInput, type MenuAction } from './input';
import { GameView, type Quality } from './render/view';
import { load, loadRecords, recordRun, save, type Records } from './storage';
import { $, fmt } from './ui/dom';
import { Hud } from './ui/hud';

type Phase = 'title' | 'countdown' | 'playing' | 'paused' | 'over';

const COUNT_STEP = 0.65;
const GAME_OVER_DELAY = 0.95;
const PATH_SOUND_ON =
  'M4 9v6h4l5 4V5L8 9H4zm12.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2zM14.5 4.3v2.1a6 6 0 0 1 0 11.2v2.1a8 8 0 0 0 0-15.4z';
const PATH_SOUND_OFF =
  'M4 9v6h4l5 4V5L8 9H4zm12.6 0-1.4 1.4 1.6 1.6-1.6 1.6 1.4 1.4 1.6-1.6 1.6 1.6 1.4-1.4-1.6-1.6 1.6-1.6-1.4-1.4-1.6 1.6-1.6-1.6z';

const params = new URLSearchParams(location.search);
const urlSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const debug = params.has('debug');

function boot(): void {
  const canvas = $('scene') as HTMLCanvasElement;
  let view: GameView;
  try {
    view = new GameView(canvas);
  } catch (err) {
    console.error('WebGL init failed', err);
    $('nogl').hidden = false;
    $('title').hidden = true;
    return;
  }

  const audio = new AudioEngine();
  audio.setMuted(load('muted', false));
  const hud = new Hud();
  let records: Records = loadRecords();
  let quality: Quality = load<string>('quality', 'high') === 'low' ? 'low' : 'high';
  view.setQuality(quality);

  let phase: Phase = 'title';
  let game: Game | null = null;
  let demo: Game | null = null;
  let demoBot = new Autopilot();
  let runCount = 0;
  let overTimer = 0;
  let overShownAt = 0;
  let countT = 0;
  let countResume = false;
  let lastCountNum = 0;
  let newBest = false;
  let overPending = false;
  let autopilot: Autopilot | null = null;

  const el = {
    title: $('title'),
    pause: $('pause'),
    over: $('over'),
    countdown: $('countdown'),
    records: $('records'),
    newbest: $('newbest'),
  };

  // ---------------------------------------------------------------- helpers
  const info = __BUILD_INFO__;
  if (info.minutes > 0) {
    const h = Math.floor(info.minutes / 60);
    const m = info.minutes % 60;
    const time = h > 0 ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M`;
    $('credit').textContent = `BUILT IN ${time} · ${Math.round(info.tokens / 1000)}K TOKENS · ${info.model.toUpperCase()}`;
  }
  const nextSeed = (): number => (urlSeed !== null ? (urlSeed + runCount++) >>> 0 : randomSeed());

  function startDemo(): void {
    demo = new Game({ seed: randomSeed() });
    demo.start();
    demoBot = new Autopilot();
    game = null;
    view.setGame(demo);
    view.setMode('title');
  }

  function renderToggles(): void {
    const s = audio.isMuted ? 'SOUND: OFF' : 'SOUND: ON';
    const q = quality === 'high' ? 'GRAPHICS: HIGH' : 'GRAPHICS: LOW';
    $('tgl-sound').textContent = s;
    $('pause-sound').textContent = s;
    $('tgl-quality').textContent = q;
    $('pause-quality').textContent = q;
    $('tgl-sound').setAttribute('aria-pressed', String(!audio.isMuted));
    document.getElementById('ico-sound')?.setAttribute('d', audio.isMuted ? PATH_SOUND_OFF : PATH_SOUND_ON);
  }

  function renderRecords(): void {
    el.records.innerHTML =
      records.runs > 0
        ? `BEST <b>${fmt(records.bestScore)}</b> &nbsp;·&nbsp; FARTHEST <b>${fmt(records.bestDistance)} M</b> &nbsp;·&nbsp; RUNS <b>${records.runs}</b>`
        : 'FIRST RUN — GOOD LUCK, PROGRAM';
  }

  function show(which: 'title' | 'pause' | 'over' | null): void {
    el.title.hidden = which !== 'title';
    el.pause.hidden = which !== 'pause';
    el.over.hidden = which !== 'over';
    const focusId = which === 'title' ? 'btn-play' : which === 'pause' ? 'btn-resume' : which === 'over' ? 'btn-retry' : null;
    if (focusId) $(focusId).focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur();
  }

  function setPhase(p: Phase): void {
    phase = p;
    document.body.dataset.phase = p;
  }

  function beginCountdown(resume: boolean): void {
    countResume = resume;
    countT = 0;
    lastCountNum = 0;
    setPhase('countdown');
    show(null);
    el.countdown.hidden = false;
  }

  // -------------------------------------------------------------- lifecycle
  function startGame(withCountdown: boolean): void {
    audio.init();
    audio.startMusic();
    game = new Game({ seed: nextSeed() });
    demo = null;
    view.setGame(game);
    hud.reset(records.bestScore);
    hud.show(true);
    newBest = false;
    if (withCountdown) {
      view.setMode('ready');
      beginCountdown(false);
    } else {
      view.setMode('play');
      game.start();
      setPhase('playing');
      show(null);
      el.countdown.hidden = true;
    }
    audio.ui('confirm');
  }

  function toTitle(): void {
    hud.show(false);
    el.countdown.hidden = true;
    setPhase('title');
    startDemo();
    renderRecords();
    show('title');
    audio.setMusicLevel(1);
    audio.setIntensity(0);
  }

  function pauseGame(): void {
    if (phase !== 'playing' || !game) return;
    game.pause();
    setPhase('paused');
    audio.setMusicLevel(0.3);
    show('pause');
    audio.ui('back');
  }

  function resumeGame(): void {
    if (phase !== 'paused') return;
    audio.setMusicLevel(1);
    beginCountdown(true);
  }

  function crash(): void {
    if (!game) return;
    setPhase('over');
    overTimer = 0;
    overPending = true;
    const r = recordRun(records, game.score, game.distance);
    records = r.records;
    newBest = r.newBest && game.score > 0;
    hud.setBest(records.bestScore);
    audio.setMusicLevel(0.35);
  }

  function showGameOver(): void {
    if (!game) return;
    $('f-score').textContent = fmt(game.score);
    $('f-dist').textContent = `${fmt(game.distance)} M`;
    $('f-bits').textContent = fmt(game.bits);
    $('f-dodges').textContent = fmt(game.dodges);
    $('f-best').textContent = fmt(records.bestScore);
    el.newbest.hidden = !newBest;
    hud.show(false);
    show('over');
    overShownAt = performance.now();
    hud.announce(`Game over. Score ${game.score}.`);
  }

  // ------------------------------------------------------------------ input
  function onAction(a: MenuAction): void {
    switch (a) {
      case 'confirm':
        if (phase === 'title') startGame(true);
        else if (phase === 'over' && el.over.hidden === false && performance.now() - overShownAt > 250) {
          audio.setMusicLevel(1);
          startGame(false);
        } else if (phase === 'paused') resumeGame();
        break;
      case 'pause':
        if (phase === 'playing') pauseGame();
        else if (phase === 'paused') resumeGame();
        break;
      case 'mute':
        audio.init();
        audio.setMuted(!audio.isMuted);
        save('muted', audio.isMuted);
        renderToggles();
        break;
      case 'quality':
        quality = quality === 'high' ? 'low' : 'high';
        view.setQuality(quality);
        save('quality', quality);
        renderToggles();
        break;
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        break;
    }
  }

  bindInput(canvas, {
    command: (c) => {
      if (phase === 'playing' && game) game.input(c);
    },
    action: onAction,
  });

  $('btn-play').addEventListener('click', () => startGame(true));
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-restart').addEventListener('click', () => {
    audio.setMusicLevel(1);
    startGame(false);
  });
  $('btn-quit').addEventListener('click', () => {
    audio.setMusicLevel(1);
    toTitle();
  });
  $('btn-retry').addEventListener('click', () => {
    audio.setMusicLevel(1);
    startGame(false);
  });
  $('btn-menu').addEventListener('click', toTitle);
  $('btn-pause').addEventListener('click', pauseGame);
  $('btn-mute').addEventListener('click', () => onAction('mute'));
  $('tgl-sound').addEventListener('click', () => onAction('mute'));
  $('pause-sound').addEventListener('click', () => onAction('mute'));
  $('btn-mute').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('tgl-quality').addEventListener('click', () => onAction('quality'));
  $('pause-quality').addEventListener('click', () => onAction('quality'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', () => pauseGame());
  window.addEventListener('resize', () => view.resize());
  window.addEventListener('orientationchange', () => view.resize());
  // first interaction anywhere unlocks audio
  window.addEventListener('pointerdown', () => audio.init(), { once: true });

  // ---------------------------------------------------------------- the loop
  function dispatch(events: GameEvent[], toUi: boolean): void {
    if (events.length === 0) return;
    view.handleEvents(events);
    if (toUi) {
      audio.handle(events);
      hud.handle(events);
    }
  }

  function tick(dt: number): void {
    switch (phase) {
      case 'title': {
        if (!demo) break;
        for (const c of demoBot.decide(demo)) demo.input(c);
        demo.update(dt);
        dispatch(demo.drainEvents(), false);
        if (demo.state === 'over') startDemo();
        view.update(dt);
        break;
      }
      case 'countdown': {
        countT += dt;
        const n = 3 - Math.floor(countT / COUNT_STEP);
        if (n >= 1 && n !== lastCountNum) {
          lastCountNum = n;
          el.countdown.innerHTML = `<span>${n}</span>`;
          audio.ui('count');
        }
        if (n < 1 && lastCountNum !== 0) {
          lastCountNum = 0;
          el.countdown.innerHTML = '<span>GO</span>';
          audio.ui('go');
          if (countResume) game?.resume();
          else game?.start();
          view.setMode('play');
          setPhase('playing');
          window.setTimeout(() => {
            if (phase === 'playing') el.countdown.hidden = true;
          }, 450);
        }
        view.update(countResume ? 0 : dt);
        break;
      }
      case 'playing': {
        if (!game) break;
        if (autopilot) for (const c of autopilot.decide(game)) game.input(c);
        game.update(dt);
        const events = game.drainEvents();
        dispatch(events, true);
        hud.update(game);
        audio.setIntensity((game.speed - CFG.startSpeed) / (CFG.maxSpeed - CFG.startSpeed));
        if (events.some((e) => e.type === 'crash')) crash();
        view.update(dt);
        break;
      }
      case 'paused':
        view.update(0);
        break;
      case 'over': {
        overTimer += dt;
        if (overPending && overTimer >= GAME_OVER_DELAY) {
          overPending = false;
          showGameOver();
        }
        view.update(dt);
        break;
      }
    }
  }

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    view.render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------- boot
  renderToggles();
  toTitle();
  requestAnimationFrame(frame);

  // Test / debugging surface, only present with ?debug in the URL.
  if (debug) Object.defineProperty(window, '__gridrun', {
    value: {
      get phase() {
        return phase;
      },
      get game() {
        return game;
      },
      get demo() {
        return demo;
      },
      get quality() {
        return quality;
      },
      get muted() {
        return audio.isMuted;
      },
      get audioState() {
        return audio.state;
      },
      get stats() {
        return view.stats;
      },
      get records() {
        return records;
      },
      /** Step the real game forward by simulated seconds (tests only). */
      advance(seconds: number) {
        if (!game || phase !== 'playing') return;
        const steps = Math.round(seconds * 60);
        for (let i = 0; i < steps && game.state === 'playing'; i++) {
          if (autopilot) for (const c of autopilot.decide(game)) game.input(c);
          game.update(1 / 60);
        }
      },
      setAutopilot(on: boolean) {
        autopilot = on ? new Autopilot() : null;
      },
    },
    configurable: true,
  });
}

boot();
