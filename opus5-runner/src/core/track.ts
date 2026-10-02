import * as C from './constants';
import type { Lane, Obstacle, ObstacleKind, Pickup, PickupKind } from './types';
import type { Rng } from './rng';

const ALL_LANES: readonly Lane[] = [0, 1, 2];

/**
 * How a row constrains the player. The generator only ever emits rows that are
 * one of these three, which is what guarantees every row is survivable:
 * - `free`     — at least one lane is empty, so dodging always works.
 * - `jumpAll`  — barriers in every lane; jumping clears all of them.
 * - `slideAll` — beams in every lane; sliding clears all of them.
 */
type RowType = 'free' | 'jumpAll' | 'slideAll';

/** A hazard row before it is turned into obstacles. `null` means an empty lane. */
interface RowPlan {
  readonly type: RowType;
  readonly lanes: readonly (ObstacleKind | null)[];
}

function row(type: RowType, lanes: readonly (ObstacleKind | null)[]): RowPlan {
  return { type, lanes };
}

function freeLanesOf(lanes: readonly (ObstacleKind | null)[]): Lane[] {
  return ALL_LANES.filter((l) => lanes[l] == null);
}

/** Difficulty tier from distance travelled. Higher tiers unlock harder rows. */
export function tierFor(distance: number): number {
  if (distance < 450) return 0;
  if (distance < 1300) return 1;
  if (distance < 2600) return 2;
  if (distance < 4500) return 3;
  return 4;
}

/**
 * Generates obstacles and pickups ahead of the player. Deterministic for a
 * given Rng, and self-limiting: it only ever builds out to the spawn horizon.
 */
export class TrackGenerator {
  private cursor = C.GRACE_DISTANCE;
  private nextId = 1;
  private prevType: RowType = 'free';
  private prevFreeLanes: Lane[] = [0, 1, 2];
  /** Rows emitted so far, used to pace in set-piece sequences. */
  private rowCount = 0;
  /** Remaining rows of a multi-row set piece, and the lane that stays open. */
  private sequence: RowPlan[] = [];

  constructor(private readonly rng: Rng) {}

  /** Builds track until the horizon, appending into the given arrays. */
  fill(distance: number, obstacles: Obstacle[], pickups: Pickup[], speed: number): void {
    const horizon = distance + C.SPAWN_DISTANCE;
    let guard = 0;
    while (this.cursor < horizon) {
      if (guard++ > 512) break; // never spin, even if tuning goes wrong
      const plan = this.nextRow(this.cursor);
      const rowZ = this.cursor;
      for (const lane of ALL_LANES) {
        const kind = plan.lanes[lane];
        if (kind == null) continue;
        obstacles.push(this.makeObstacle(kind, lane, rowZ));
      }

      const gap = this.gapFor(speed);
      this.decoratePickups(plan, rowZ, gap, pickups);

      this.prevType = plan.type;
      this.prevFreeLanes = freeLanesOf(plan.lanes);
      if (this.prevFreeLanes.length === 0) this.prevFreeLanes = [...ALL_LANES];
      this.rowCount++;
      this.cursor = rowZ + gap;
    }
  }

  private gapFor(speed: number): number {
    const base = Math.max(C.MIN_ROW_GAP, speed * C.ROW_GAP_SECONDS);
    return base + this.rng.range(0, C.ROW_GAP_JITTER);
  }

  private makeObstacle(kind: ObstacleKind, lane: Lane, z: number): Obstacle {
    const [bottom, top] =
      kind === 'barrier'
        ? [0, C.BARRIER_HEIGHT]
        : kind === 'beam'
          ? [C.BEAM_BOTTOM, C.BEAM_TOP]
          : [0, C.BLOCK_HEIGHT];
    return { id: this.nextId++, kind, lane, z, bottom, top, resolved: false };
  }

  /** Picks the next row, respecting difficulty and the no-chained-forcing rule. */
  private nextRow(z: number): RowPlan {
    const queued = this.sequence.shift();
    if (queued) return queued;

    const tier = tierFor(z);
    // A row that forces a jump or slide is never followed by another forcing
    // row: the player needs ground time between state changes.
    const allowForcing = this.prevType === 'free' && tier >= 1;

    const candidates: Array<() => RowPlan> = [
      () => this.singleBlock(),
      () => this.barrierPartial(1),
    ];
    if (tier >= 1) {
      candidates.push(() => this.beamPartial(1));
      candidates.push(() => this.barrierPartial(2));
    }
    if (tier >= 2) {
      candidates.push(() => this.doubleBlock());
      candidates.push(() => this.beamPartial(2));
      candidates.push(() => this.mixedRow());
    }
    if (tier >= 3) {
      candidates.push(() => this.blockBarrierRow());
    }
    if (allowForcing) {
      candidates.push(() => row('jumpAll', ['barrier', 'barrier', 'barrier']));
      if (tier >= 2) candidates.push(() => row('slideAll', ['beam', 'beam', 'beam']));
    }
    // Set pieces: a weaving corridor of double blocks, or a jump/slide
    // gauntlet. Gated on `allowForcing` as well, since a gauntlet opens with a
    // forcing row and must not follow one.
    if (allowForcing && tier >= 3 && this.rowCount > 0 && this.rowCount % 7 === 0) {
      return this.startSequence(tier);
    }

    return this.rng.pick(candidates)();
  }

  /** Queues a multi-row set piece and returns its first row. */
  private startSequence(tier: number): RowPlan {
    const weave = this.rng.chance(0.5) || tier < 4;
    const rows: RowPlan[] = [];
    if (weave) {
      // Three double-block rows whose open lane shifts each time.
      let open = this.rng.pick(ALL_LANES);
      for (let i = 0; i < 3; i++) {
        const lanes: (ObstacleKind | null)[] = ['block', 'block', 'block'];
        lanes[open] = null;
        rows.push(row('free', lanes));
        const others = ALL_LANES.filter((l) => l !== open);
        open = this.rng.pick(others);
      }
    } else {
      // Jump, breathe, slide, breathe.
      rows.push(row('jumpAll', ['barrier', 'barrier', 'barrier']));
      rows.push(this.singleBlock());
      rows.push(row('slideAll', ['beam', 'beam', 'beam']));
      rows.push(this.barrierPartial(1));
    }
    const first = rows.shift() as RowPlan;
    this.sequence = rows;
    return first;
  }

  private singleBlock(): RowPlan {
    const lanes: (ObstacleKind | null)[] = [null, null, null];
    lanes[this.rng.pick(ALL_LANES)] = 'block';
    return row('free', lanes);
  }

  private doubleBlock(): RowPlan {
    const open = this.rng.pick(ALL_LANES);
    const lanes: (ObstacleKind | null)[] = ['block', 'block', 'block'];
    lanes[open] = null;
    return row('free', lanes);
  }

  private barrierPartial(count: 1 | 2): RowPlan {
    return this.partial('barrier', count);
  }

  private beamPartial(count: 1 | 2): RowPlan {
    return this.partial('beam', count);
  }

  private partial(kind: ObstacleKind, count: 1 | 2): RowPlan {
    const lanes: (ObstacleKind | null)[] = [null, null, null];
    for (const lane of this.rng.shuffle(ALL_LANES).slice(0, count)) lanes[lane] = kind;
    return row('free', lanes);
  }

  /** A block and a barrier, leaving one lane open — two ways through. */
  private mixedRow(): RowPlan {
    const order = this.rng.shuffle(ALL_LANES);
    const lanes: (ObstacleKind | null)[] = [null, null, null];
    lanes[order[0] as Lane] = 'block';
    lanes[order[1] as Lane] = this.rng.chance(0.5) ? 'barrier' : 'beam';
    return row('free', lanes);
  }

  /** Two blocks and a barrier is unsolvable, so this is block + barrier + free. */
  private blockBarrierRow(): RowPlan {
    const order = this.rng.shuffle(ALL_LANES);
    const lanes: (ObstacleKind | null)[] = [null, null, null];
    lanes[order[0] as Lane] = 'block';
    lanes[order[1] as Lane] = 'barrier';
    return row('free', lanes);
  }

  /**
   * Places rewards. Orbs sit above barriers (so jumping pays), and trail down
   * the safe lane in the gap after each row.
   */
  private decoratePickups(plan: RowPlan, rowZ: number, gap: number, out: Pickup[]): void {
    // An orb floating over each barrier, as a hint and a reward.
    for (const lane of ALL_LANES) {
      if (plan.lanes[lane] === 'barrier' && this.rng.chance(0.7)) {
        out.push(this.makePickup('orb', lane, rowZ, C.ORB_AIR_Y));
      }
    }

    const free = freeLanesOf(plan.lanes);
    const lane = free.length > 0 ? this.rng.pick(free) : this.rng.pick(ALL_LANES);
    const midZ = rowZ + gap * 0.5;

    if (this.rng.chance(C.SHIELD_CHANCE)) {
      out.push(this.makePickup('shield', lane, midZ, C.ORB_GROUND_Y));
      return;
    }
    if (this.rng.chance(C.BOOST_CHANCE)) {
      out.push(this.makePickup('boost', lane, midZ, C.ORB_GROUND_Y));
      return;
    }
    if (!this.rng.chance(C.ORB_ROW_CHANCE)) return;

    // A short trail, kept clear of the rows on either side.
    const count = this.rng.int(3, 5);
    const spacing = 3.4;
    const span = (count - 1) * spacing;
    const startZ = midZ - span / 2;
    const safeStart = rowZ + C.OBSTACLE_HALF_DEPTH + C.PICKUP_HALF_DEPTH + 1;
    const safeEnd = rowZ + gap - C.OBSTACLE_HALF_DEPTH - C.PICKUP_HALF_DEPTH - 1;
    for (let i = 0; i < count; i++) {
      const z = startZ + i * spacing;
      if (z < safeStart || z > safeEnd) continue;
      out.push(this.makePickup('orb', lane, z, C.ORB_GROUND_Y));
    }
  }

  private makePickup(kind: PickupKind, lane: Lane, z: number, y: number): Pickup {
    return { id: this.nextId++, kind, lane, z, y, taken: false, resolved: false };
  }
}
