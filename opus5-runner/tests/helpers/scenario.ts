import { Game } from '../../src/core/game';
import * as C from '../../src/core/constants';
import type { Lane, Obstacle, ObstacleKind, Pickup, PickupKind } from '../../src/core/types';

/** A game with an empty track, for testing one hand-placed entity at a time. */
export function emptyGame(): Game {
  const game = new Game(1);
  game.start();
  game.obstacles = [];
  game.pickups = [];
  // Freeze the track: generation only appends ahead of its own cursor, and the
  // cursor is already far past the horizon used in these short scenarios.
  (game as unknown as { track: { fill: () => void } }).track = { fill: () => {} };
  return game;
}

export function obstacleAt(kind: ObstacleKind, lane: Lane, z: number): Obstacle {
  const [bottom, top] =
    kind === 'barrier'
      ? [0, C.BARRIER_HEIGHT]
      : kind === 'beam'
        ? [C.BEAM_BOTTOM, C.BEAM_TOP]
        : [0, C.BLOCK_HEIGHT];
  return { id: 1, kind, lane, z, bottom, top, resolved: false };
}

export function pickupAt(kind: PickupKind, lane: Lane, z: number, y: number): Pickup {
  return { id: 2, kind, lane, z, y, taken: false, resolved: false };
}

/** Runs fixed steps, optionally calling `onStep` before each one. */
export function run(game: Game, seconds: number, onStep?: (g: Game, t: number) => void): void {
  const steps = Math.round(seconds / C.STEP);
  for (let i = 0; i < steps; i++) {
    onStep?.(game, i * C.STEP);
    game.step(C.STEP);
  }
}

/** Steps until the obstacle has been passed, or the budget runs out. */
export function runUntilPassed(game: Game, obstacle: Obstacle, maxSeconds = 20): void {
  const steps = Math.round(maxSeconds / C.STEP);
  for (let i = 0; i < steps; i++) {
    if (obstacle.resolved) return;
    game.step(C.STEP);
  }
}
