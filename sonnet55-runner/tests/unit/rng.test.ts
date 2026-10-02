import { expect, test } from 'vitest';
import { Rng } from '../../src/game/rng';

test('same seed gives the same sequence', () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
});

test('different seeds diverge', () => {
  const a = new Rng(1);
  const b = new Rng(2);
  const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
  expect(same).toBeLessThan(3);
});

test('values stay in range', () => {
  const r = new Rng(7);
  for (let i = 0; i < 5000; i++) {
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    const n = r.int(2, 4);
    expect([2, 3, 4]).toContain(n);
  }
});

test('weighted pick respects zero weights and roughly the ratios', () => {
  const r = new Rng(9);
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 6000; i++) counts[r.weighted([['a', 1], ['b', 3], ['c', 0]] as const)]++;
  expect(counts.c).toBe(0);
  expect(counts.b / counts.a).toBeGreaterThan(2.5);
  expect(counts.b / counts.a).toBeLessThan(3.6);
});
