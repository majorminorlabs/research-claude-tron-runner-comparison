import type { Command } from './config';
import type { Game } from './game';
import { actionFor } from './rules';
import { solveRows } from './solver';

/** Rows overlap the player while |z - distance| is below this. */
const OVERLAP = 1.4;

/**
 * A simple autopilot that plays by reading the generated rows. Used for the
 * attract-mode demo behind the title screen and as a fairness oracle in tests.
 */
export class Autopilot {
  private actedRow = -1;

  constructor(private lookahead = 5) {}

  /** Returns the commands to send this frame. */
  decide(game: Game): Command[] {
    const cmds: Command[] = [];
    const p = game.player;
    const speed = game.speed;

    const ahead = game.rows.filter((r) => r.z - game.distance > OVERLAP).slice(0, this.lookahead);
    if (ahead.length === 0) return cmds;
    const inside = game.rows.some((r) => Math.abs(r.z - game.distance) <= OVERLAP);

    const first = ahead[0]!;
    const timeToFirst = (first.z - game.distance - OVERLAP) / speed;
    const plan = solveRows(ahead, speed, p.lane, timeToFirst);
    if (!plan) return cmds;

    const target = plan.lanes[0]!;
    if (!inside && p.laneT >= 1 && p.pendingLanes.length === 0 && target !== p.lane) {
      cmds.push(target < p.lane ? 'left' : 'right');
    }

    const act = actionFor(first.cells[target] ?? null);
    const tt = (first.z - game.distance) / speed;
    if (first.z !== this.actedRow) {
      if (act === 'jump' && tt <= 0.3) {
        cmds.push('jump');
        this.actedRow = first.z;
      } else if (act === 'slide' && tt <= 0.2) {
        cmds.push('slide');
        this.actedRow = first.z;
      }
    }
    return cmds;
  }
}
