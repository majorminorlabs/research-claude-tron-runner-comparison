import { describe, expect, test } from 'vitest';
import { Autopilot } from '../../src/game/bot';
import { CFG } from '../../src/game/config';
import { Game } from '../../src/game/game';
import { newGame, run } from './_helpers';

describe('autopilot soak (fairness + physics agree)', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99, 1234, 31337, 987654];
  for (const seed of seeds) {
    test(`seed ${seed}: survives 4 minutes at 60 Hz`, () => {
      const g = newGame(seed);
      run(g, 240, new Autopilot());
      expect(g.state, `crashed at ${g.distance.toFixed(0)}`).toBe('playing');
      expect(g.speed).toBeGreaterThan(CFG.maxSpeed - 2);
      expect(g.dodges).toBeGreaterThan(20);
    });
  }

  test('survives with a variable frame rate (30/144 Hz mix)', () => {
    const g = new Game({ seed: 77 });
    g.start();
    const bot = new Autopilot();
    let i = 0;
    while (g.time < 120 && g.state === 'playing') {
      for (const c of bot.decide(g)) g.input(c);
      g.update(i++ % 3 === 0 ? 1 / 30 : 1 / 144);
    }
    expect(g.state).toBe('playing');
  });

  test('autopilot also survives a long run with phase and shield pickups in play', () => {
    const g = newGame(2024);
    const bot = new Autopilot();
    run(g, 200, bot);
    expect(g.state).toBe('playing');
    expect(g.bits).toBeGreaterThan(0);
  });

  test('a player who never moves eventually crashes on every seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = newGame(seed);
      run(g, 120);
      expect(g.state, `seed ${seed}`).toBe('over');
    }
  });

  test('a player who only jumps and never changes lane still dies (blocks are real)', () => {
    let deaths = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = newGame(seed);
      for (let i = 0; i < 60 * 120 && g.state === 'playing'; i++) {
        if (i % 40 === 0) g.input('jump');
        g.update(1 / 60);
      }
      if (g.state === 'over') deaths++;
    }
    expect(deaths).toBe(6);
  });

  test('game is deterministic: same seed + same inputs = same result', () => {
    const a = newGame(555);
    const b = newGame(555);
    run(a, 60, new Autopilot());
    run(b, 60, new Autopilot());
    expect(a.distance).toBe(b.distance);
    expect(a.score).toBe(b.score);
    expect(a.bits).toBe(b.bits);
  });

  test('scoring is sane: a clean 3 minute run earns a plausible score', () => {
    const g = newGame(8);
    run(g, 180, new Autopilot());
    expect(g.score).toBeGreaterThan(5000);
    expect(g.score).toBeLessThan(500000);
  });

  test('object arrays stay bounded (no leaks)', () => {
    const g = newGame(13);
    run(g, 180, new Autopilot());
    expect(g.obstacles.length).toBeLessThan(120);
    expect(g.pickups.length).toBeLessThan(400);
    expect(g.rows.length).toBeLessThan(80);
  });
});
