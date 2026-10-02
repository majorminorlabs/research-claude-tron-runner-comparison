import { Autopilot } from '../../src/game/bot';
import { Game } from '../../src/game/game';

export const DT = 1 / 60;

/** Advance a game by `seconds` of simulated time at a fixed 60 Hz. */
export function run(game: Game, seconds: number, bot?: Autopilot): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps && game.state === 'playing'; i++) {
    if (bot) for (const c of bot.decide(game)) game.input(c);
    game.update(DT);
  }
}

export function newGame(seed = 1): Game {
  const g = new Game({ seed });
  g.start();
  return g;
}

/** Remove everything from the track so physics can be tested in isolation. */
export function clearTrack(g: Game): void {
  g.obstacles = [];
  g.pickups = [];
  g.rows = [];
}

/**
 * Stop the generator from spawning anything and return helpers that place
 * exactly the obstacles / pickups a test wants (z is relative to the player).
 */
export function isolate(g: Game) {
  const add = {
    o: g.addObstacle.bind(g),
    p: g.addPickup.bind(g),
  };
  clearTrack(g);
  g.addRow = () => undefined;
  g.addObstacle = () => undefined;
  g.addPickup = () => undefined;
  return {
    obstacle(kind: 'low' | 'high' | 'block', lane: number, dz: number) {
      add.o(kind, lane, g.distance + dz);
      return g.obstacles[g.obstacles.length - 1]!;
    },
    pickup(kind: 'bit' | 'shield' | 'magnet' | 'overclock' | 'phase', lane: number, dz: number, y = 0.7) {
      add.p(kind, lane, g.distance + dz, y);
      return g.pickups[g.pickups.length - 1]!;
    },
  };
}
