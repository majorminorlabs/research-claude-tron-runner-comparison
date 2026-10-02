import { beforeEach, describe, expect, test } from 'vitest';
import { load, loadRecords, recordRun, save } from '../../src/storage';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('storage', () => {
  test('round-trips values and falls back when missing', () => {
    expect(load('x', 5)).toBe(5);
    save('x', 12);
    expect(load('x', 5)).toBe(12);
  });

  test('ignores corrupt or wrongly-typed data', () => {
    (globalThis as any).localStorage.setItem('gridrun.bestScore', '{not json');
    expect(loadRecords().bestScore).toBe(0);
    (globalThis as any).localStorage.setItem('gridrun.bestScore', JSON.stringify('lots'));
    expect(loadRecords().bestScore).toBe(0);
    (globalThis as any).localStorage.setItem('gridrun.bestScore', JSON.stringify(-50));
    expect(loadRecords().bestScore).toBe(0);
  });

  test('never throws when storage is unavailable', () => {
    (globalThis as any).localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(() => save('a', 1)).not.toThrow();
    expect(load('a', 7)).toBe(7);
    expect(loadRecords()).toEqual({ bestScore: 0, bestDistance: 0, runs: 0 });
    expect(() => recordRun(loadRecords(), 100, 50)).not.toThrow();
  });

  test('recordRun tracks bests independently, counts runs and flags a new best', () => {
    let r = loadRecords();
    let res = recordRun(r, 500, 300);
    expect(res.newBest).toBe(true);
    r = res.records;
    expect(r).toEqual({ bestScore: 500, bestDistance: 300, runs: 1 });
    res = recordRun(r, 400, 900);
    expect(res.newBest).toBe(false);
    expect(res.records).toEqual({ bestScore: 500, bestDistance: 900, runs: 2 });
    expect(loadRecords()).toEqual(res.records);
    res = recordRun(res.records, 500, 10);
    expect(res.newBest).toBe(false); // ties are not a new best
  });
});
