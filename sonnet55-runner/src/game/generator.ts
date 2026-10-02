import { CFG, LANES, type Cell, type PickupKind } from './config';
import { Rng } from './rng';
import { actionFor, minGapSeconds, type Row } from './rules';
import type { Action } from './config';

export interface SpawnSink {
  addObstacle(kind: 'low' | 'high' | 'block', lane: number, z: number): void;
  addPickup(kind: PickupKind, lane: number, z: number, y: number): void;
  addRow(row: Row): void;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Builds the track row by row. Every row contains a guaranteed passable
 * "path" lane (free, jump-over or slide-under) and the gap to the previous
 * row is always long enough for the transition (see `minGapSeconds`), so
 * generated tracks are always solvable.
 */
export class Generator {
  /** Distance of the last generated row. */
  frontier = 85;
  private pathLane = 1;
  private prevAct: Action = 'none';
  private nextPowerZ = 380;
  private rows = 0;

  constructor(private rng: Rng) {}

  difficulty(distance: number): number {
    return clamp01(distance / CFG.difficultyDistance);
  }

  /** Generate rows until the frontier is beyond `distance + horizon`. */
  fill(distance: number, speed: number, sink: SpawnSink): void {
    const target = distance + CFG.spawnHorizon;
    // a little extra speed margin: the track keeps accelerating after generation
    const speedEst = Math.min(CFG.maxSpeed * CFG.phaseSpeedMul, speed * 1.08 + 1);
    if (this.rows === 0) this.seedStart(sink);
    while (this.frontier < target) this.nextRow(sink, speedEst);
  }

  private seedStart(sink: SpawnSink): void {
    // opening stretch of bits in the centre lane so the player learns the rhythm
    for (let z = 22; z < this.frontier - 8; z += 3.4) sink.addPickup('bit', 1, z, 0.7);
  }

  private nextRow(sink: SpawnSink, speedEst: number): void {
    const rng = this.rng;
    const diff = this.difficulty(this.frontier);
    const intro = this.frontier < 320;

    // ---- path cell (what the player must do in the safe lane)
    const pFree = lerp(0.55, 0.22, diff);
    const highAllowed = this.frontier > 380;
    let pathCell: Cell = null;
    if (!rng.chance(pFree)) {
      pathCell = highAllowed && rng.chance(lerp(0.35, 0.5, diff)) ? 'high' : 'low';
    }
    const act = actionFor(pathCell);

    // ---- lane move
    let next = this.pathLane;
    const roll = rng.next();
    if (roll < 0.35) {
      next = this.pathLane;
    } else {
      const options: number[] = [];
      if (this.pathLane > 0) options.push(this.pathLane - 1);
      if (this.pathLane < LANES - 1) options.push(this.pathLane + 1);
      next = rng.pick(options);
      if (this.pathLane !== 1 && rng.chance(diff * 0.35)) next = 2 - this.pathLane; // full cross-over
    }
    const dLane = Math.abs(next - this.pathLane);

    // ---- gap
    const minT = minGapSeconds(this.prevAct, act, dLane);
    const gMin = lerp(intro ? 2.2 : 1.6, 0.85, diff);
    const gMax = lerp(intro ? 3.0 : 2.5, 1.45, diff);
    const gapT = Math.max(rng.range(gMin, gMax), minT * 1.25);
    const gap = gapT * speedEst;
    const prevZ = this.frontier;
    const z = prevZ + gap;

    // ---- other lanes
    const density = lerp(intro ? 0.12 : 0.22, 0.65, diff);
    const cells: [Cell, Cell, Cell] = [null, null, null];
    cells[next] = pathCell;
    for (let lane = 0; lane < LANES; lane++) {
      if (lane === next) continue;
      if (!rng.chance(density)) continue;
      cells[lane] = rng.weighted<Cell>([
        ['block', 0.5],
        ['low', 0.3],
        ['high', highAllowed ? 0.2 : 0],
      ]);
    }

    for (let lane = 0; lane < LANES; lane++) {
      const c = cells[lane];
      if (c) sink.addObstacle(c, lane, z);
    }
    sink.addRow({ z, cells, path: next });

    const powerZ = this.placePower(sink, prevZ, z, next);
    this.placeBits(sink, prevZ, z, this.pathLane, next, pathCell, speedEst, powerZ);

    this.pathLane = next;
    this.prevAct = act;
    this.frontier = z;
    this.rows++;
  }

  private placeBits(
    sink: SpawnSink,
    prevZ: number,
    z: number,
    fromLane: number,
    toLane: number,
    pathCell: Cell,
    speedEst: number,
    powerZ: number | null,
  ): void {
    if (!this.rng.chance(0.85)) return;
    const start = prevZ + 6;
    const end = z - 6;
    if (end <= start) return;
    const span = end - start;
    const spacing = 3.4;
    const switchAt = start + span * 0.5;
    const switchHalf = speedEst * 0.16 * Math.abs(toLane - fromLane);
    for (let zz = start; zz <= end; zz += spacing) {
      if (fromLane !== toLane && Math.abs(zz - switchAt) < switchHalf) continue;
      const lane = zz < switchAt ? fromLane : toLane;
      if (powerZ !== null && lane === toLane && Math.abs(zz - powerZ) < 4) continue;
      sink.addPickup('bit', lane, zz, 0.7);
    }
    if (pathCell === 'low') {
      const s = speedEst * 0.085;
      const ys = [1.1, 1.9, 2.3, 1.9, 1.1];
      for (let i = 0; i < ys.length; i++) sink.addPickup('bit', toLane, z + (i - 2) * s, ys[i]!);
    }
  }

  private placePower(sink: SpawnSink, prevZ: number, z: number, lane: number): number | null {
    if (this.frontier < this.nextPowerZ) return null;
    const kind = this.rng.weighted<PickupKind>([
      ['shield', 0.3],
      ['magnet', 0.25],
      ['overclock', 0.25],
      ['phase', this.frontier > 900 ? 0.2 : 0],
    ]);
    const pz = prevZ + (z - prevZ) * 0.72;
    sink.addPickup(kind, lane, pz, 1.0);
    this.nextPowerZ = this.frontier + this.rng.range(520, 900);
    return pz;
  }
}
