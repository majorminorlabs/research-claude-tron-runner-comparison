import { CFG } from '../game/config';
import type { Game, GameEvent } from '../game/game';
import { $, fmt } from './dom';

type PowerKey = 'shield' | 'magnet' | 'overclock' | 'phase';

const POWER_LABEL: Record<PowerKey, string> = {
  shield: 'SHIELD',
  magnet: 'MAGNET',
  overclock: 'OVERCLOCK ×2',
  phase: 'PHASE',
};
const POWER_MAX: Record<Exclude<PowerKey, 'shield'>, number> = {
  magnet: CFG.magnetTime,
  overclock: CFG.overclockTime,
  phase: CFG.phaseTime,
};

/** The in-game overlay: score, speed, active power-ups and floating call-outs. */
export class Hud {
  private root = $('hud');
  private score = $('score');
  private bits = $('bits');
  private dist = $('dist');
  private best = $('best');
  private sector = $('sector');
  private speed = $('speedfill');
  private powers = $('powers');
  private popups = $('popups');
  private live = $('live');
  private chips = new Map<PowerKey, { el: HTMLElement; bar: HTMLElement | null }>();
  private last = { score: -1, bits: -1, dist: -1, sector: -1, speed: -1 };

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  reset(best: number): void {
    this.last = { score: -1, bits: -1, dist: -1, sector: -1, speed: -1 };
    this.best.textContent = fmt(best);
    this.popups.replaceChildren();
    this.powers.replaceChildren();
    this.chips.clear();
    this.score.textContent = '0';
    this.bits.textContent = '0';
    this.dist.textContent = '0';
    this.sector.textContent = 'SECTOR 01';
    this.speed.style.width = '0%';
  }

  setBest(best: number): void {
    this.best.textContent = fmt(best);
  }

  update(game: Game): void {
    const l = this.last;
    if (game.score !== l.score) {
      l.score = game.score;
      this.score.textContent = fmt(game.score);
    }
    if (game.bits !== l.bits) {
      l.bits = game.bits;
      this.bits.textContent = String(game.bits);
    }
    const d = Math.floor(game.distance);
    if (d !== l.dist) {
      l.dist = d;
      this.dist.textContent = fmt(d);
    }
    if (game.sector !== l.sector) {
      l.sector = game.sector;
      this.sector.textContent = `SECTOR ${String(game.sector).padStart(2, '0')}`;
    }
    const sp = Math.round(((game.speed - CFG.startSpeed) / (CFG.maxSpeed * CFG.phaseSpeedMul - CFG.startSpeed)) * 100);
    if (sp !== l.speed) {
      l.speed = sp;
      this.speed.style.width = `${Math.max(2, Math.min(100, sp))}%`;
    }
    this.updatePowers(game);
  }

  private updatePowers(game: Game): void {
    const e = game.effects;
    this.setChip('shield', e.shield, e.shield ? 1 : 0, false);
    this.setChip('magnet', e.magnet > 0, e.magnet / POWER_MAX.magnet, e.magnet > 0 && e.magnet < 2);
    this.setChip('overclock', e.overclock > 0, e.overclock / POWER_MAX.overclock, e.overclock > 0 && e.overclock < 2);
    this.setChip('phase', e.phase > 0, e.phase / POWER_MAX.phase, e.phase > 0 && e.phase < 1.2);
  }

  private setChip(key: PowerKey, on: boolean, fraction: number, warn: boolean): void {
    let chip = this.chips.get(key);
    if (!on) {
      if (chip) {
        chip.el.remove();
        this.chips.delete(key);
      }
      return;
    }
    if (!chip) {
      const el = document.createElement('div');
      el.className = `power ${key}`;
      el.dataset.power = key;
      const label = document.createElement('span');
      label.textContent = POWER_LABEL[key];
      el.append(label);
      let bar: HTMLElement | null = null;
      if (key !== 'shield') {
        const b = document.createElement('div');
        b.className = 'bar';
        bar = document.createElement('i');
        b.append(bar);
        el.append(b);
      }
      this.powers.append(el);
      chip = { el, bar };
      this.chips.set(key, chip);
    }
    if (chip.bar) chip.bar.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    chip.el.classList.toggle('warn', warn);
  }

  handle(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'dodge':
          this.popup(`+${e.value} CLEAN`, 'good');
          break;
        case 'power':
          this.popup(POWER_LABEL[e.kind as PowerKey] ?? '', 'power');
          this.announce(`${POWER_LABEL[e.kind as PowerKey] ?? ''} collected`);
          break;
        case 'shield-break':
          this.popup('SHIELD BROKEN', 'warn');
          break;
        case 'derez':
          this.popup(`+${e.value} DEREZ`, 'good');
          break;
        case 'sector':
          this.popup(`SECTOR ${String(e.sector).padStart(2, '0')}`, 'sector');
          this.announce(`Sector ${e.sector}`);
          break;
        case 'bit':
          if (e.chain > 0 && e.chain % 10 === 0) this.popup(`CHAIN ×${e.chain}`, 'good');
          break;
        default:
          break;
      }
    }
  }

  private popup(text: string, kind: string): void {
    // keep at most a few on screen
    while (this.popups.children.length >= 4) this.popups.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `popup ${kind}`;
    el.textContent = text;
    el.style.top = `${(this.popups.children.length % 3) * 34}px`;
    this.popups.append(el);
    window.setTimeout(() => el.remove(), kind === 'sector' ? 2100 : 1300);
  }

  announce(text: string): void {
    this.live.textContent = text;
  }
}
