import './styles.css';
import * as C from './core/constants';
import { Autopilot } from './core/autopilot';
import { Game } from './core/game';
import type { GameEvent } from './core/types';
import { Renderer } from './render/renderer';
import { Audio } from './audio';
import { Hud } from './ui/hud';
import { Input } from './ui/input';
import { readBest, writeBest } from './ui/storage';

type Screen = 'title' | 'playing' | 'paused' | 'over';

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

class App {
  private renderer: Renderer;
  private hud = new Hud();
  private audio = new Audio();
  private game = new Game(randomSeed());
  /** A second simulation, played by the autopilot behind the title screen. */
  private demo = new Game(randomSeed());
  private demoBot: Autopilot;
  private demoStep = 0;

  private screen: Screen = 'title';
  private best = readBest();
  private topSpeed = 0;
  private lastFrame = 0;

  constructor() {
    const canvas = document.getElementById('stage');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #stage canvas');
    this.renderer = new Renderer(canvas);
    this.demoBot = new Autopilot(this.demo);
    this.demo.start();

    new Input(canvas, {
      action: (a) => {
        if (this.screen === 'playing') this.game.queue(a);
      },
      jumpHeld: (held) => this.game.setJumpHeld(held),
      confirm: () => this.confirm(),
      togglePause: () => this.togglePause(),
      toggleMute: () => this.toggleMute(),
      interacted: () => this.audio.unlock(),
    });

    this.hud.onStart(() => {
      this.audio.unlock();
      this.audio.uiSelect();
      this.startRun();
    });
    this.hud.onResume(() => this.setPaused(false));
    this.hud.onMuteToggle(() => this.toggleMute());
    this.hud.setMuted(this.audio.muted);
    this.hud.showTitle();

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => {
      // Safari reports stale sizes if measured too early.
      setTimeout(() => this.renderer.resize(), 120);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'playing') this.setPaused(true);
    });
    // Restoring from the back/forward cache leaves a stale timestamp behind,
    // which would otherwise be read as one enormous frame.
    window.addEventListener('pageshow', () => {
      this.lastFrame = performance.now();
    });

    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // --- flow --------------------------------------------------------------

  private confirm(): void {
    if (this.screen === 'title' || this.screen === 'over') {
      this.audio.uiSelect();
      this.startRun();
    } else if (this.screen === 'paused') {
      this.setPaused(false);
    }
  }

  private startRun(): void {
    this.game.reset(randomSeed());
    this.game.start();
    this.renderer.reset();
    this.topSpeed = this.game.speed;
    this.screen = 'playing';
    this.hud.showPlaying();
    this.hud.update(this.game);
  }

  private togglePause(): void {
    if (this.screen === 'playing') this.setPaused(true);
    else if (this.screen === 'paused') this.setPaused(false);
  }

  private setPaused(paused: boolean): void {
    if (paused && this.screen !== 'playing') return;
    if (!paused && this.screen !== 'paused') return;
    this.screen = paused ? 'paused' : 'playing';
    this.hud.showPaused(paused);
    if (!paused) this.lastFrame = performance.now();
  }

  private toggleMute(): void {
    this.audio.unlock();
    this.audio.setMuted(!this.audio.muted);
    this.hud.setMuted(this.audio.muted);
  }

  private endRun(): void {
    this.screen = 'over';
    const score = Math.floor(this.game.score);
    const isBest = score > this.best;
    if (isBest) {
      this.best = score;
      writeBest(score);
    }
    this.hud.showGameOver({
      score,
      distance: this.game.distance,
      orbs: this.game.stats.orbs,
      bestCombo: this.game.stats.bestCombo,
      topSpeed: this.topSpeed,
      best: this.best,
      isBest,
    });
  }

  // --- loop --------------------------------------------------------------

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    if (this.screen === 'playing') {
      this.game.update(dt);
      this.topSpeed = Math.max(this.topSpeed, this.game.speed);
      this.drainEvents(this.game);
      this.hud.update(this.game);
      this.audio.setEngine(true, (this.game.speed - C.START_SPEED) / (C.MAX_SPEED - C.START_SPEED));
      this.renderer.render(this.game, dt);
      if (this.game.phase === 'dead') {
        this.audio.setEngine(false, 0);
        this.endRun();
      }
      return;
    }

    if (this.screen === 'title') {
      this.runDemo(dt);
      this.audio.setEngine(false, 0);
      this.renderer.render(this.demo, dt);
      return;
    }

    if (this.screen === 'over') {
      // Hold on the wreck rather than cutting away: the death sparks and the
      // dust settling are the last beat of the run.
      this.drainEvents(this.game);
      this.audio.setEngine(false, 0);
      this.renderer.render(this.game, dt);
      return;
    }

    // Paused: hold the frame, but keep the scene alive so it still breathes.
    this.audio.setEngine(false, 0);
    this.renderer.render(this.game, 0);
  }

  /** Advances the attract-mode run, and silently restarts it if it ever ends. */
  private runDemo(dt: number): void {
    const steps = Math.min(Math.round(dt / C.STEP), 12);
    for (let i = 0; i < steps; i++) {
      if (this.demo.phase !== 'playing') break;
      this.demoBot.think();
      this.demo.step(C.STEP);
      this.demoStep++;
    }
    // The demo is muted, so events only drive the visuals.
    for (const e of this.demo.events) this.renderer.handleEvent(e, this.demo);
    this.demo.events.length = 0;

    const tooLong = this.demoStep > 120 * 180;
    if (this.demo.phase !== 'playing' || tooLong) {
      this.demo.reset(randomSeed());
      this.demo.start();
      this.renderer.reset();
      this.demoStep = 0;
    }
  }

  private drainEvents(game: Game): void {
    for (const e of game.events) {
      this.renderer.handleEvent(e, game);
      this.playSound(e);
    }
    game.events.length = 0;
  }

  private playSound(e: GameEvent): void {
    switch (e.type) {
      case 'jump':
        this.audio.jump();
        break;
      case 'land':
        this.audio.land();
        break;
      case 'slide':
        this.audio.slide();
        break;
      case 'strafe':
        this.audio.strafe();
        break;
      case 'orb':
        this.audio.orb(e.combo);
        break;
      case 'shield':
        this.audio.shield();
        break;
      case 'boost':
        this.audio.boost();
        break;
      case 'hit':
        this.audio.hit();
        break;
      case 'shieldBreak':
        this.audio.shieldBreak();
        break;
      case 'death':
        this.audio.death();
        break;
    }
  }

}

new App();
