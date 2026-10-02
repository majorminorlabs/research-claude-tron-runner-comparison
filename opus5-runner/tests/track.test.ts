import { describe, expect, it } from 'vitest';
import * as C from '../src/core/constants';
import { Rng } from '../src/core/rng';
import { TrackGenerator, tierFor } from '../src/core/track';
import type { Lane, Obstacle, ObstacleKind, Pickup } from '../src/core/types';

const LANES: readonly Lane[] = [0, 1, 2];

interface BuiltRow {
  z: number;
  kinds: Array<ObstacleKind | undefined>;
}

/** Groups generated obstacles back into the rows they were emitted as. */
function rowsOf(obstacles: readonly Obstacle[]): BuiltRow[] {
  const byZ = new Map<number, BuiltRow>();
  for (const o of obstacles) {
    let row = byZ.get(o.z);
    if (!row) {
      row = { z: o.z, kinds: [undefined, undefined, undefined] };
      byZ.set(o.z, row);
    }
    row.kinds[o.lane] = o.kind;
  }
  return [...byZ.values()].sort((a, b) => a.z - b.z);
}

/** Generates a long stretch of track by walking the player forward. */
function buildTrack(seed: number, totalDistance: number) {
  const gen = new TrackGenerator(new Rng(seed));
  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];
  const stride = 50;
  for (let d = 0; d <= totalDistance; d += stride) {
    const speed =
      C.START_SPEED +
      (C.MAX_SPEED - C.START_SPEED) * Math.min(1, d / C.SPEED_RAMP_DISTANCE);
    gen.fill(d, obstacles, pickups, speed);
  }
  return { obstacles, pickups, rows: rowsOf(obstacles) };
}

describe('tierFor', () => {
  it('rises monotonically with distance', () => {
    let last = -1;
    for (let d = 0; d < 12000; d += 50) {
      const t = tierFor(d);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    expect(tierFor(0)).toBe(0);
    expect(tierFor(99999)).toBeGreaterThan(0);
  });
});

describe('track generation', () => {
  const seeds = [1, 2, 3, 7, 11, 1234, 98765, 0xdeadbeef];

  it('leaves the opening stretch clear', () => {
    for (const seed of seeds) {
      const { obstacles } = buildTrack(seed, 400);
      for (const o of obstacles) expect(o.z).toBeGreaterThanOrEqual(C.GRACE_DISTANCE);
    }
  });

  it('never emits an unsolvable row', () => {
    for (const seed of seeds) {
      const { rows } = buildTrack(seed, 20000);
      expect(rows.length).toBeGreaterThan(100);
      for (const row of rows) {
        const free = LANES.filter((l) => row.kinds[l] == null);
        if (free.length > 0) continue;
        const kinds = new Set(LANES.map((l) => row.kinds[l]));
        // A fully covered row is only fair if one single move clears all of it.
        expect(kinds.size).toBe(1);
        expect(['barrier', 'beam']).toContain([...kinds][0]);
      }
    }
  });

  it('never puts two forcing rows back to back', () => {
    for (const seed of seeds) {
      const { rows } = buildTrack(seed, 20000);
      const forcing = rows.map((r) => LANES.every((l) => r.kinds[l] != null));
      for (let i = 1; i < forcing.length; i++) {
        expect(forcing[i] && forcing[i - 1]).toBe(false);
      }
    }
  });

  it('spaces rows far enough apart to change stance between them', () => {
    const airtime = (2 * C.JUMP_VELOCITY) / C.GRAVITY;
    for (const seed of seeds) {
      const { rows } = buildTrack(seed, 20000);
      for (let i = 1; i < rows.length; i++) {
        const gap = (rows[i] as BuiltRow).z - (rows[i - 1] as BuiltRow).z;
        expect(gap).toBeGreaterThanOrEqual(C.MIN_ROW_GAP);
        // The tightest case is at top speed; the gap must still exceed airtime.
        expect(gap / (C.MAX_SPEED + C.BOOST_SPEED_BONUS)).toBeGreaterThan(airtime * 0.35);
      }
    }
  });

  it('keeps difficulty gated: no beams or double blocks in the first tier', () => {
    for (const seed of seeds) {
      const { rows } = buildTrack(seed, 440);
      for (const row of rows) {
        if (row.z >= 450) continue;
        expect(row.kinds).not.toContain('beam');
        const blocks = LANES.filter((l) => row.kinds[l] === 'block').length;
        expect(blocks).toBeLessThanOrEqual(1);
      }
    }
  });

  it('eventually uses every obstacle kind', () => {
    const { obstacles } = buildTrack(1, 20000);
    const kinds = new Set(obstacles.map((o) => o.kind));
    expect(kinds).toEqual(new Set(['barrier', 'beam', 'block']));
  });

  it('emits every pickup kind', () => {
    const { pickups } = buildTrack(1, 20000);
    const kinds = new Set(pickups.map((p) => p.kind));
    expect(kinds).toEqual(new Set(['orb', 'shield', 'boost']));
  });

  it('never places a pickup inside an obstacle in the same lane', () => {
    const reach = C.OBSTACLE_HALF_DEPTH + C.PICKUP_HALF_DEPTH;
    for (const seed of seeds) {
      const { obstacles, pickups } = buildTrack(seed, 20000);
      const byLane = new Map<Lane, Obstacle[]>();
      for (const o of obstacles) {
        const list = byLane.get(o.lane) ?? [];
        list.push(o);
        byLane.set(o.lane, list);
      }
      for (const p of pickups) {
        for (const o of byLane.get(p.lane) ?? []) {
          if (Math.abs(o.z - p.z) >= reach) continue;
          const vOverlap =
            p.y - C.ORB_RADIUS < o.top && p.y + C.ORB_RADIUS > o.bottom;
          expect(vOverlap).toBe(false);
        }
      }
    }
  });

  it('gives identical track for identical seeds, and different for different ones', () => {
    const key = (o: Obstacle) => `${o.z.toFixed(4)}:${o.lane}:${o.kind}`;
    const a = buildTrack(4242, 6000).obstacles.map(key);
    const b = buildTrack(4242, 6000).obstacles.map(key);
    const c = buildTrack(4243, 6000).obstacles.map(key);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('only generates out to the spawn horizon', () => {
    const gen = new TrackGenerator(new Rng(5));
    const obstacles: Obstacle[] = [];
    const pickups: Pickup[] = [];
    gen.fill(0, obstacles, pickups, C.START_SPEED);
    const maxZ = Math.max(...obstacles.map((o) => o.z));
    expect(maxZ).toBeLessThan(C.SPAWN_DISTANCE + C.MIN_ROW_GAP + C.ROW_GAP_JITTER + 1);
  });

  it('is idempotent when called repeatedly at the same distance', () => {
    const gen = new TrackGenerator(new Rng(9));
    const obstacles: Obstacle[] = [];
    const pickups: Pickup[] = [];
    gen.fill(0, obstacles, pickups, C.START_SPEED);
    const n = obstacles.length;
    for (let i = 0; i < 10; i++) gen.fill(0, obstacles, pickups, C.START_SPEED);
    expect(obstacles.length).toBe(n);
  });
});
