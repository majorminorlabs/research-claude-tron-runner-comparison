// A simple autopilot that follows the generator's guaranteed safe path.
// Used to prove generated tracks are survivable, and to drive the title-screen demo.
import { PLAYER } from './config.js';
import { input } from './game.js';

export function botStep(game) {
  const p = game.player;
  const D = game.distance;
  const row = game.rows.find((r) => r.d + 0.5 + PLAYER.halfDepth + 0.1 > D);
  if (!row) return;
  if (p.lane < row.safeLane) input(game, 'right');
  else if (p.lane > row.safeLane) input(game, 'left');

  const type = row.types[row.safeLane];
  const ahead = row.d - D;
  if (type === 'barrier' && p.grounded && ahead < game.speed * 0.22 + PLAYER.halfDepth && ahead > 0) {
    input(game, 'jump');
  }
  if (type === 'beam' && !p.sliding && !p.slideQueued && ahead < game.speed * 0.3 + PLAYER.halfDepth && ahead > -1) {
    input(game, 'slide');
  }
}
