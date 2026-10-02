import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = Array.from({ length: 50 }, () => new Rng(42).next());
    expect(new Set(a).size).toBe(1);
    const s1 = Array.from({ length: 20 }, (_, i) => new Rng(7).next() + i);
    const s2 = Array.from({ length: 20 }, (_, i) => new Rng(7).next() + i);
    expect(s1).toEqual(s2);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays inside [0, 1)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 20000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('survives a zero seed', () => {
    const rng = new Rng(0);
    const vals = Array.from({ length: 5 }, () => rng.next());
    expect(new Set(vals).size).toBe(5);
  });

  it('int() covers the inclusive range', () => {
    const rng = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('shuffle() is a permutation and does not mutate the input', () => {
    const rng = new Rng(11);
    const input = [0, 1, 2, 3, 4];
    const out = rng.shuffle(input);
    expect(input).toEqual([0, 1, 2, 3, 4]);
    expect([...out].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('pick() rejects an empty list', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it('chance() is roughly calibrated', () => {
    const rng = new Rng(3);
    let hits = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) if (rng.chance(0.25)) hits++;
    expect(hits / n).toBeGreaterThan(0.23);
    expect(hits / n).toBeLessThan(0.27);
  });
});
