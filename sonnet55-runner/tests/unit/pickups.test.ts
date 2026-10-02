import { expect, test } from 'vitest';
import { CFG } from '../../src/game/config';
import { isolate, newGame, run } from './_helpers';

test('collecting a bit in your lane scores and counts', () => {
  const g = newGame();
  const w = isolate(g);
  const pk = w.pickup('bit', 1, 8);
  run(g, 1);
  expect(pk.collected).toBe(true);
  expect(g.bits).toBe(1);
  expect(g.drainEvents().some((e) => e.type === 'bit')).toBe(true);
});

test('bits in other lanes are not collected', () => {
  const g = newGame();
  const w = isolate(g);
  const pk = w.pickup('bit', 0, 8);
  run(g, 1);
  expect(pk.collected).toBe(false);
  expect(g.bits).toBe(0);
});

test('aerial bits need a jump; ground bits are collected while sliding', () => {
  const g = newGame();
  const w = isolate(g);
  const air = w.pickup('bit', 1, 12, 2.2);
  run(g, 1.2);
  expect(air.collected).toBe(false);

  const h = newGame();
  const w2 = isolate(h);
  const air2 = w2.pickup('bit', 1, 12, 2.2);
  run(h, 0.3);
  h.input('jump');
  run(h, 1);
  expect(air2.collected).toBe(true);

  const s = newGame();
  const w3 = isolate(s);
  const ground = w3.pickup('bit', 1, 8, 0.7);
  s.input('slide');
  run(s, 1);
  expect(ground.collected).toBe(true);
});

test('chain counts consecutive bits and resets after the window', () => {
  const g = newGame();
  const w = isolate(g);
  for (let i = 0; i < 5; i++) w.pickup('bit', 1, 6 + i * 3);
  run(g, 1.5);
  expect(g.chain).toBe(5);
  run(g, CFG.chainWindow + 0.3);
  expect(g.chain).toBe(0);
});

test('shield pickup grants a shield', () => {
  const g = newGame();
  isolate(g).pickup('shield', 1, 7, 1);
  run(g, 1);
  expect(g.effects.shield).toBe(true);
});

test('overclock doubles scoring while active and expires', () => {
  const g = newGame();
  const w = isolate(g);
  w.pickup('overclock', 1, 6, 1);
  run(g, 0.8);
  expect(g.effects.overclock).toBeGreaterThan(0);
  expect(g.multiplier).toBe(2);
  const before = g.score;
  w.pickup('bit', 1, 8);
  run(g, 0.8);
  expect(g.score - before).toBeGreaterThanOrEqual(CFG.bitScore * 2);
  run(g, CFG.overclockTime);
  expect(g.multiplier).toBe(1);
  expect(g.drainEvents().some((e) => e.type === 'power-end' && e.kind === 'overclock')).toBe(true);
});

test('magnet pulls bits from other lanes and expires', () => {
  const g = newGame();
  const w = isolate(g);
  g.effects.magnet = CFG.magnetTime;
  const near = w.pickup('bit', 0, 14);
  const far = w.pickup('bit', 2, 60);
  run(g, 1.5);
  expect(near.collected).toBe(true);
  expect(far.collected).toBe(false);
  // magnet does not grab power-ups
  const pw = w.pickup('shield', 0, 10, 1);
  run(g, 1);
  expect(pw.collected).toBe(false);
  run(g, CFG.magnetTime);
  expect(g.effects.magnet).toBe(0);
});

test('phase pickup starts the phase effect', () => {
  const g = newGame();
  isolate(g).pickup('phase', 1, 7, 1);
  run(g, 1);
  expect(g.effects.phase).toBeGreaterThan(0);
});

test('collecting a power-up awards bonus points', () => {
  const g = newGame();
  isolate(g).pickup('magnet', 1, 4, 1);
  const before = g.score;
  run(g, 0.5);
  expect(g.score - before).toBeGreaterThanOrEqual(CFG.powerScore);
});

test('sector advances every sectorLength and emits an event', () => {
  const g = newGame();
  isolate(g);
  g.distance = CFG.sectorLength - 5;
  run(g, 1);
  expect(g.sector).toBe(2);
  expect(g.drainEvents().some((e) => e.type === 'sector' && e.sector === 2)).toBe(true);
});
