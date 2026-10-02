import type { Game } from './game';
import * as C from './constants';
import type { Lane, Obstacle } from './types';

const LANES: readonly Lane[] = [0, 1, 2];

interface Row {
  z: number;
  lanes: Array<Obstacle | undefined>;
}

/**
 * A perfect-information autopilot. It drives the attract-mode demo behind the
 * title screen, and in the test suite it doubles as the fairness proof: if it
 * can run for minutes without a scratch, no generated row is impossible.
 *
 * It deliberately reacts on the same timescales a player can — roughly a third
 * of a second before contact — rather than acting on the exact frame.
 */
export class Autopilot {
  private jumpedFor = -1;
  private slidFor = -1;

  constructor(private readonly game: Game) {}

  /** Call once per fixed step, before `game.step`. */
  think(): void {
    const g = this.game;
    const row = this.nextRow();
    if (!row) return;
    const rel = row.z - g.distance;
    const player = g.player;

    const mine = row.lanes[player.targetLane];
    const safeLane = this.chooseLane(row, player.targetLane);

    // Move early: lane changes are cheap and rows are far apart.
    if (safeLane !== player.targetLane && player.strafe >= 1) {
      g.queue(safeLane < player.targetLane ? 'left' : 'right');
      return;
    }

    // Already heading somewhere safe? Then only the vertical move is left.
    const target = row.lanes[player.targetLane];
    const kind = target?.kind ?? mine?.kind;
    if (!kind || kind === 'block') return;

    if (kind === 'barrier' && this.jumpedFor !== row.z) {
      // Clear the apex window over the barrier: fire ~0.33s before contact.
      if (rel <= g.speed * 0.33) {
        g.queue('jump');
        this.jumpedFor = row.z;
      }
      return;
    }
    if (kind === 'beam' && this.slidFor !== row.z) {
      if (rel <= g.speed * 0.2) {
        g.queue('slide');
        this.slidFor = row.z;
      }
    }
  }

  /** The nearest row of obstacles still ahead of the player. */
  private nextRow(): Row | undefined {
    const g = this.game;
    let bestZ = Infinity;
    for (const o of g.obstacles) {
      const rel = o.z - g.distance;
      if (rel < -C.PLAYER_HALF_DEPTH) continue;
      if (o.z < bestZ) bestZ = o.z;
    }
    if (!Number.isFinite(bestZ)) return undefined;
    const lanes: Array<Obstacle | undefined> = [undefined, undefined, undefined];
    for (const o of g.obstacles) {
      // Obstacles in one row share a Z exactly; tolerate float noise anyway.
      if (Math.abs(o.z - bestZ) < 0.001) lanes[o.lane] = o;
    }
    return { z: bestZ, lanes };
  }

  /** Prefers an empty lane, then the nearest lane needing the least work. */
  private chooseLane(row: Row, current: Lane): Lane {
    const score = (lane: Lane): number => {
      const o = row.lanes[lane];
      const base = o == null ? 0 : o.kind === 'block' ? 100 : 10;
      return base + Math.abs(lane - current) * 0.5;
    };
    let best = current;
    let bestScore = score(current);
    for (const lane of LANES) {
      const s = score(lane);
      if (s < bestScore) {
        bestScore = s;
        best = lane;
      }
    }
    return best;
  }
}
