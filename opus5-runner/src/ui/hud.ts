import * as C from '../core/constants';
import type { Game } from '../core/game';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

export interface RunSummary {
  score: number;
  distance: number;
  orbs: number;
  bestCombo: number;
  topSpeed: number;
  best: number;
  isBest: boolean;
}

/** Formats a score the way an arcade cabinet would. */
export function formatScore(score: number): string {
  return Math.floor(score).toLocaleString('en-US');
}

export function formatMultiplier(mult: number): string {
  return `x${mult.toFixed(1)}`;
}

/** Owns every DOM node outside the canvas. */
export class Hud {
  private root = el('hud');
  private score = el('score');
  private distance = el('distance');
  private integrity = el('integrity');
  private combo = el('combo');
  private comboText = el('comboText');
  private shieldChip = el('shieldChip');
  private boostChip = el('boostChip');
  private boostBar = el('boostBar');
  private speedBar = el('speedBar');
  private speedText = el('speedText');
  private muteBtn = el<HTMLButtonElement>('muteBtn');
  private muteIcon = el('muteIcon');

  private titleScreen = el('titleScreen');
  private pauseScreen = el('pauseScreen');
  private overScreen = el('overScreen');

  private finalScore = el('finalScore');
  private bestScore = el('bestScore');
  private finalDistance = el('finalDistance');
  private finalOrbs = el('finalOrbs');
  private finalCombo = el('finalCombo');
  private finalSpeed = el('finalSpeed');
  private newBest = el('newBest');

  private segments: HTMLElement[] = [];
  private lastIntegrity = -1;
  private lastScoreText = '';
  private lastDistanceText = '';
  private lastSpeedText = '';
  private lastComboText = '';

  constructor() {
    for (let i = 0; i < C.MAX_INTEGRITY; i++) {
      const seg = document.createElement('i');
      this.integrity.appendChild(seg);
      this.segments.push(seg);
    }
  }

  onStart(handler: () => void): void {
    el<HTMLButtonElement>('startBtn').addEventListener('click', handler);
    el<HTMLButtonElement>('retryBtn').addEventListener('click', handler);
  }

  onResume(handler: () => void): void {
    el<HTMLButtonElement>('resumeBtn').addEventListener('click', handler);
  }

  onMuteToggle(handler: () => void): void {
    this.muteBtn.addEventListener('click', handler);
  }

  setMuted(muted: boolean): void {
    this.muteIcon.textContent = muted ? '◌' : '◉';
    this.muteBtn.classList.toggle('is-muted', muted);
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    this.muteBtn.setAttribute('aria-pressed', String(muted));
  }

  showTitle(): void {
    this.titleScreen.hidden = false;
    this.pauseScreen.hidden = true;
    this.overScreen.hidden = true;
    this.root.classList.remove('is-live');
  }

  showPlaying(): void {
    this.titleScreen.hidden = true;
    this.pauseScreen.hidden = true;
    this.overScreen.hidden = true;
    this.root.classList.add('is-live');
  }

  showPaused(paused: boolean): void {
    this.pauseScreen.hidden = !paused;
  }

  showGameOver(summary: RunSummary): void {
    this.finalScore.textContent = formatScore(summary.score);
    this.bestScore.textContent = formatScore(summary.best);
    this.finalDistance.textContent = `${Math.floor(summary.distance)} m`;
    this.finalOrbs.textContent = String(summary.orbs);
    this.finalCombo.textContent = formatMultiplier(
      Math.min(1 + summary.bestCombo * C.COMBO_STEP, C.COMBO_MAX),
    );
    this.finalSpeed.textContent = `${Math.round(summary.topSpeed * 3.6)} kph`;
    this.newBest.hidden = !summary.isBest;
    this.overScreen.hidden = false;
    this.root.classList.remove('is-live');
  }

  /** Called every frame. Writes only what changed, to avoid layout churn. */
  update(game: Game): void {
    const scoreText = formatScore(game.score);
    if (scoreText !== this.lastScoreText) {
      this.score.textContent = scoreText;
      this.lastScoreText = scoreText;
    }

    const distText = `${Math.floor(game.distance)} m`;
    if (distText !== this.lastDistanceText) {
      this.distance.textContent = distText;
      this.lastDistanceText = distText;
    }

    if (game.integrity !== this.lastIntegrity) {
      this.lastIntegrity = game.integrity;
      this.segments.forEach((seg, i) => {
        const full = i < game.integrity;
        seg.classList.toggle('is-full', full);
        seg.classList.toggle('is-lost', !full);
      });
    }

    const mult = game.multiplier;
    const showCombo = game.combo > 0 || game.boosting;
    this.combo.hidden = !showCombo;
    if (showCombo) {
      const text = formatMultiplier(mult);
      if (text !== this.lastComboText) {
        this.comboText.textContent = text;
        this.lastComboText = text;
      }
    }

    this.shieldChip.hidden = !game.hasShield;
    this.boostChip.hidden = !game.boosting;
    if (game.boosting) {
      const t = game.boostTimer / C.BOOST_DURATION;
      this.boostBar.style.transform = `scaleX(${t.toFixed(3)})`;
    }

    const span = C.MAX_SPEED + C.BOOST_SPEED_BONUS - C.START_SPEED;
    const ratio = Math.max(0, Math.min(1, (game.speed - C.START_SPEED) / span));
    this.speedBar.style.width = `${(8 + ratio * 92).toFixed(1)}%`;
    const speedText = `${Math.round(game.speed * 3.6)} kph`;
    if (speedText !== this.lastSpeedText) {
      this.speedText.textContent = speedText;
      this.lastSpeedText = speedText;
    }
  }
}
