import { describe, expect, it } from 'vitest';
import * as C from '../src/core/constants';
import { Game } from '../src/core/game';
import { Autopilot } from '../src/core/autopilot';

/** Plays a full run on autopilot and reports what happened. */
function autopilot(seed: number, seconds: number) {
  const game = new Game(seed);
  game.start();
  const bot = new Autopilot(game);
  const steps = Math.round(seconds / C.STEP);
  for (let i = 0; i < steps; i++) {
    if (game.phase !== 'playing') break;
    bot.think();
    game.step(C.STEP);
    game.events.length = 0;
  }
  return game;
}

describe('autopilot survival', () => {
  // The real assertion about fairness: a player with perfect information and
  // human-scale reaction windows can clear the generated track indefinitely.
  const seeds = [1, 2, 3, 5, 8, 13, 21, 1337, 90210, 0xc0ffee];

  for (const seed of seeds) {
    it(`survives 150s untouched on seed ${seed}`, () => {
      const game = autopilot(seed, 150);
      expect(game.phase).toBe('playing');
      expect(game.stats.hits).toBe(0);
      expect(game.integrity).toBe(C.START_INTEGRITY);
      expect(game.distance).toBeGreaterThan(4000);
    });
  }

  it('reaches late-game difficulty and top speed', () => {
    const game = autopilot(1, 300);
    expect(game.phase).toBe('playing');
    expect(game.stats.hits).toBe(0);
    expect(game.distance).toBeGreaterThan(C.SPEED_RAMP_DISTANCE);
    expect(game.speed).toBeGreaterThanOrEqual(C.MAX_SPEED - 0.5);
  });

  it('collects rewards along the way', () => {
    const game = autopilot(7, 150);
    expect(game.stats.orbs).toBeGreaterThan(20);
    expect(game.score).toBeGreaterThan(1000);
  });
});

describe('simulation integrity', () => {
  it('is fully deterministic for a seed', () => {
    const a = autopilot(555, 60);
    const b = autopilot(555, 60);
    expect(b.distance).toBe(a.distance);
    expect(b.score).toBe(a.score);
    expect(b.stats).toEqual(a.stats);
    expect(b.obstacles.map((o) => o.id)).toEqual(a.obstacles.map((o) => o.id));
  });

  it('diverges for different seeds', () => {
    const a = autopilot(1, 60);
    const b = autopilot(2, 60);
    expect(a.obstacles.map((o) => `${o.z}:${o.kind}`)).not.toEqual(
      b.obstacles.map((o) => `${o.z}:${o.kind}`),
    );
  });

  it('is frame-rate independent: 60fps and 144fps agree', () => {
    const slow = new Game(21);
    const fast = new Game(21);
    slow.start();
    fast.start();
    const seconds = 20;
    for (let t = 0; t < seconds * 60; t++) slow.update(1 / 60);
    for (let t = 0; t < seconds * 144; t++) fast.update(1 / 144);
    // Both consume the same number of whole fixed steps, bar the remainder.
    expect(Math.abs(slow.distance - fast.distance)).toBeLessThan(C.MAX_SPEED * C.STEP * 2);
    expect(slow.integrity).toBe(fast.integrity);
  });

  it('clamps a huge frame instead of fast-forwarding the world', () => {
    const game = new Game(3);
    game.start();
    game.update(10);
    expect(game.distance).toBeLessThanOrEqual(C.MAX_SPEED * C.MAX_FRAME_TIME);
  });

  it('keeps the entity count bounded over a long run', () => {
    const game = autopilot(99, 240);
    expect(game.obstacles.length).toBeLessThan(80);
    expect(game.pickups.length).toBeLessThan(200);
  });

  it('culls only entities behind the player', () => {
    const game = autopilot(4, 90);
    for (const o of game.obstacles) {
      expect(o.z).toBeGreaterThanOrEqual(game.distance + C.DESPAWN_DISTANCE);
    }
    for (const p of game.pickups) {
      expect(p.z).toBeGreaterThanOrEqual(game.distance + C.DESPAWN_DISTANCE);
    }
  });

  it('always has track ahead of the player', () => {
    const game = new Game(6);
    game.start();
    for (let i = 0; i < 120 * 60; i++) {
      game.step(C.STEP);
      if (i % 600 === 0 && game.distance > C.GRACE_DISTANCE) {
        const ahead = game.obstacles.filter((o) => o.z > game.distance);
        expect(ahead.length).toBeGreaterThan(0);
      }
      game.events.length = 0;
    }
  });

  it('score and distance only ever increase while alive', () => {
    const game = new Game(12);
    game.start();
    const bot = new Autopilot(game);
    let score = -1;
    let distance = -1;
    for (let i = 0; i < 120 * 60; i++) {
      bot.think();
      game.step(C.STEP);
      game.events.length = 0;
      expect(game.score).toBeGreaterThanOrEqual(score);
      expect(game.distance).toBeGreaterThan(distance);
      score = game.score;
      distance = game.distance;
    }
  });

  it('speed stays within its envelope', () => {
    const game = new Game(15);
    game.start();
    const bot = new Autopilot(game);
    for (let i = 0; i < 120 * 200; i++) {
      bot.think();
      game.step(C.STEP);
      game.events.length = 0;
      expect(game.speed).toBeGreaterThan(0);
      expect(game.speed).toBeLessThanOrEqual(C.MAX_SPEED + C.BOOST_SPEED_BONUS + 0.001);
    }
  });
});

describe('lifecycle', () => {
  it('does not advance before start()', () => {
    const game = new Game(1);
    game.update(1);
    expect(game.distance).toBe(0);
    expect(game.phase).toBe('ready');
  });

  it('reset() returns everything to its opening state', () => {
    const played = autopilot(31, 40);
    const fresh = new Game(31);
    played.reset(31);
    expect(played.distance).toBe(fresh.distance);
    expect(played.score).toBe(fresh.score);
    expect(played.integrity).toBe(fresh.integrity);
    expect(played.phase).toBe('ready');
    expect(played.stats).toEqual(fresh.stats);
    expect(played.obstacles.map((o) => o.z)).toEqual(fresh.obstacles.map((o) => o.z));
  });

  it('start() after death restarts the run', () => {
    const game = new Game(1);
    game.start();
    game.integrity = 1;
    game.obstacles = [
      {
        id: 1,
        kind: 'block',
        lane: 1,
        z: game.distance + 40,
        bottom: 0,
        top: C.BLOCK_HEIGHT,
        resolved: false,
      },
    ];
    for (let i = 0; i < 1000; i++) game.step(C.STEP);
    expect(game.phase).toBe('dead');
    game.start();
    expect(game.phase).toBe('playing');
    expect(game.integrity).toBe(C.START_INTEGRITY);
    expect(game.distance).toBeLessThan(1);
  });

  it('drops queued input while not playing', () => {
    const game = new Game(1);
    game.queue('jump');
    game.update(0.5);
    game.start();
    game.update(C.STEP * 2);
    expect(game.player.motion).toBe('running');
  });
});
