import { describe, expect, test } from 'vitest';
import { CFG, type PickupKind } from '../../src/game/config';
import { Generator, type SpawnSink } from '../../src/game/generator';
import { Rng } from '../../src/game/rng';
import { actionFor, minGapSeconds, type Row } from '../../src/game/rules';
import { solveRows } from '../../src/game/solver';

interface Spawned {
  obstacles: { kind: string; lane: number; z: number }[];
  pickups: { kind: PickupKind; lane: number; z: number; y: number }[];
  rows: Row[];
}

/** Drive a Generator the way the game does, up to `until` distance. */
function generate(seed: number, until: number): Spawned {
  const out: Spawned = { obstacles: [], pickups: [], rows: [] };
  const sink: SpawnSink = {
    addObstacle: (kind, lane, z) => out.obstacles.push({ kind, lane, z }),
    addPickup: (kind, lane, z, y) => out.pickups.push({ kind, lane, z, y }),
    addRow: (row) => out.rows.push(row),
  };
  const gen = new Generator(new Rng(seed));
  let d = 0;
  let t = 0;
  while (d < until) {
    const speed = CFG.startSpeed + (CFG.maxSpeed - CFG.startSpeed) * (1 - Math.exp(-t / CFG.speedRampSeconds));
    gen.fill(d, speed, sink);
    d += speed / 20;
    t += 1 / 20;
  }
  return out;
}

/** Speed at the moment a given distance is reached (integrating the ramp). */
function speedAtDistance(target: number): number {
  let d = 0;
  let t = 0;
  while (d < target) {
    const s = CFG.startSpeed + (CFG.maxSpeed - CFG.startSpeed) * (1 - Math.exp(-t / CFG.speedRampSeconds));
    d += s / 100;
    t += 1 / 100;
  }
  return CFG.startSpeed + (CFG.maxSpeed - CFG.startSpeed) * (1 - Math.exp(-t / CFG.speedRampSeconds));
}

describe('generator', () => {
  test('is deterministic per seed and differs between seeds', () => {
    const a = generate(5, 3000);
    const b = generate(5, 3000);
    const c = generate(6, 3000);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.pickups).toEqual(b.pickups);
    expect(c.obstacles).not.toEqual(a.obstacles);
  });

  test('rows are strictly increasing in distance', () => {
    const { rows } = generate(11, 8000);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.z).toBeGreaterThan(rows[i - 1]!.z);
  });

  test('the opening stretch is clear so the player can get going', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { obstacles } = generate(seed, 300);
      expect(Math.min(...obstacles.map((o) => o.z))).toBeGreaterThan(70);
    }
  });

  test('each row has a passable path lane that matches its declared path', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { rows } = generate(seed, 12000);
      for (const r of rows) {
        expect(r.cells[r.path]).not.toBe('block');
        expect(r.path).toBeGreaterThanOrEqual(0);
        expect(r.path).toBeLessThanOrEqual(2);
      }
    }
  });

  test('obstacles match rows one-to-one', () => {
    const { rows, obstacles } = generate(3, 6000);
    const fromRows = rows.reduce((n, r) => n + r.cells.filter(Boolean).length, 0);
    expect(obstacles.length).toBe(fromRows);
  });

  test('consecutive path cells always respect the minimum gap time at the speed of arrival', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { rows } = generate(seed, 14000);
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1]!;
        const b = rows[i]!;
        const speed = speedAtDistance(b.z);
        const need = minGapSeconds(actionFor(a.cells[a.path] ?? null), actionFor(b.cells[b.path] ?? null), Math.abs(a.path - b.path));
        expect((b.z - a.z) / speed).toBeGreaterThanOrEqual(need - 1e-6);
      }
    }
  });

  test('independent solver finds a survivable route through every window of rows', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { rows } = generate(seed, 14000);
      for (let i = 0; i + 5 <= rows.length; i += 3) {
        const win = rows.slice(i, i + 5);
        const speed = speedAtDistance(win[win.length - 1]!.z);
        const plan = solveRows(win, speed, win[0]!.path, 5);
        expect(plan, `seed ${seed} window ${i}`).not.toBeNull();
      }
    }
  });

  test('difficulty rises: denser obstacles and tighter gaps late than early', () => {
    let early = 0;
    let late = 0;
    let earlyGap = 0;
    let lateGap = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { rows, obstacles } = generate(seed, 14000);
      early += obstacles.filter((o) => o.z > 300 && o.z < 1800).length;
      late += obstacles.filter((o) => o.z > 9000 && o.z < 10500).length;
      const e = rows.filter((r) => r.z > 300 && r.z < 1800);
      const l = rows.filter((r) => r.z > 9000 && r.z < 10500);
      earlyGap += 1500 / Math.max(1, e.length);
      lateGap += 1500 / Math.max(1, l.length);
    }
    expect(late / early).toBeGreaterThan(1.3);
    expect(lateGap / 20).toBeLessThan(earlyGap / 20 * 1.6); // late rows aren't absurdly sparse (speed grows too)
  });

  test('gate obstacles only appear after the intro distance', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { obstacles } = generate(seed, 3000);
      for (const o of obstacles) if (o.kind === 'high') expect(o.z).toBeGreaterThan(380);
    }
  });

  test('every power-up kind shows up and spacing is reasonable', () => {
    const kinds = new Set<string>();
    let prev = -1e9;
    for (let seed = 1; seed <= 10; seed++) {
      const { pickups } = generate(seed, 15000);
      const powers = pickups.filter((p) => p.kind !== 'bit').sort((a, b) => a.z - b.z);
      for (const p of powers) {
        kinds.add(p.kind);
        if (p.z - prev > 0) expect(p.z - prev).toBeGreaterThan(100);
        prev = p.z;
      }
      prev = -1e9;
      expect(powers.length).toBeGreaterThan(8);
      expect(powers.length).toBeLessThan(40);
    }
    expect([...kinds].sort()).toEqual(['magnet', 'overclock', 'phase', 'shield']);
  });

  test('phase power-up is held back until the player is experienced', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { pickups } = generate(seed, 3000);
      for (const p of pickups) if (p.kind === 'phase') expect(p.z).toBeGreaterThan(850);
    }
  });

  test('bits never overlap a blocking obstacle in their own lane', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const { obstacles, pickups } = generate(seed, 10000);
      for (const p of pickups) {
        if (p.kind !== 'bit') continue;
        for (const o of obstacles) {
          if (o.lane !== p.lane || o.kind !== 'block') continue;
          expect(Math.abs(o.z - p.z), `seed ${seed}`).toBeGreaterThan(2);
        }
      }
    }
  });

  test('aerial bits only appear in arcs over low barriers', () => {
    const { obstacles, pickups } = generate(4, 8000);
    for (const p of pickups) {
      if (p.kind !== 'bit' || p.y <= 0.8) continue;
      const near = obstacles.some((o) => o.kind === 'low' && o.lane === p.lane && Math.abs(o.z - p.z) < 12);
      expect(near).toBe(true);
    }
  });
});
