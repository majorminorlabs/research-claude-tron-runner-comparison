import * as C from './constants';
import { Rng } from './rng';
import { TrackGenerator } from './track';
import type {
  Action,
  GameEvent,
  GamePhase,
  Lane,
  Obstacle,
  Pickup,
  PlayerMotion,
} from './types';

export interface PlayerView {
  /** Lane the collision code considers the player to be in. */
  readonly lane: Lane;
  /** Smooth X for rendering; strafing interpolates between lane centres. */
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly height: number;
  readonly motion: PlayerMotion;
  /** 0..1 strafe progress; 1 when settled. */
  readonly strafe: number;
  readonly fromLane: Lane;
  readonly targetLane: Lane;
}

export interface GameStats {
  orbs: number;
  hits: number;
  bestCombo: number;
  shields: number;
  boosts: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function laneX(lane: Lane): number {
  return C.LANE_X[lane] as number;
}

/**
 * The whole game, with no reference to the DOM, canvas, or wall-clock time.
 * Advance it with `update(dt)`; it internally runs fixed `STEP` slices so the
 * physics are frame-rate independent and reproducible.
 */
export class Game {
  phase: GamePhase = 'ready';
  distance = 0;
  speed = C.START_SPEED;
  score = 0;
  integrity = C.START_INTEGRITY;
  hasShield = false;
  invulnTimer = 0;
  combo = 0;
  comboTimer = 0;
  boostTimer = 0;
  elapsed = 0;

  obstacles: Obstacle[] = [];
  pickups: Pickup[] = [];
  /** Drained by the presentation layer each frame. */
  events: GameEvent[] = [];
  stats: GameStats = { orbs: 0, hits: 0, bestCombo: 0, shields: 0, boosts: 0 };

  private rng: Rng;
  private track: TrackGenerator;
  private seed: number;

  private lane: Lane = 1;
  private fromLane: Lane = 1;
  private targetLane: Lane = 1;
  private strafeT = 1;
  private x = 0;
  private y = 0;
  private vy = 0;
  private motion: PlayerMotion = 'running';
  private slideT = 0;
  private strafeFromX = 0;
  private jumpBuffer = 0;
  /** A strafe pressed mid-move is held until the current move finishes. */
  private strafeBuffer: -1 | 1 | 0 = 0;
  private jumpHeld = false;
  /** Pending actions, consumed at the start of the next fixed step. */
  private queued: Action[] = [];
  private accumulator = 0;

  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.track = new TrackGenerator(this.rng);
    this.track.fill(this.distance, this.obstacles, this.pickups, this.speed);
  }

  reset(seed = this.seed): void {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.track = new TrackGenerator(this.rng);
    this.phase = 'ready';
    this.distance = 0;
    this.speed = C.START_SPEED;
    this.score = 0;
    this.integrity = C.START_INTEGRITY;
    this.hasShield = false;
    this.invulnTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.boostTimer = 0;
    this.elapsed = 0;
    this.obstacles = [];
    this.pickups = [];
    this.events = [];
    this.stats = { orbs: 0, hits: 0, bestCombo: 0, shields: 0, boosts: 0 };
    this.lane = 1;
    this.fromLane = 1;
    this.targetLane = 1;
    this.strafeT = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.motion = 'running';
    this.slideT = 0;
    this.strafeFromX = 0;
    this.jumpBuffer = 0;
    this.strafeBuffer = 0;
    this.jumpHeld = false;
    this.queued = [];
    this.accumulator = 0;
    this.track.fill(this.distance, this.obstacles, this.pickups, this.speed);
  }

  start(): void {
    if (this.phase === 'playing') return;
    if (this.phase === 'dead') this.reset();
    this.phase = 'playing';
  }

  /** Queues an input. Inputs are honoured in order on the next fixed step. */
  queue(action: Action): void {
    // A short queue is enough; anything longer is a key-repeat storm.
    if (this.queued.length < 6) this.queued.push(action);
  }

  /** Tracks whether jump is being held, for variable jump height. */
  setJumpHeld(held: boolean): void {
    this.jumpHeld = held;
  }

  get player(): PlayerView {
    return {
      lane: this.lane,
      x: this.x,
      y: this.y,
      vy: this.vy,
      height: this.motion === 'sliding' ? C.PLAYER_SLIDE_HEIGHT : C.PLAYER_HEIGHT,
      motion: this.motion,
      strafe: this.strafeT,
      fromLane: this.fromLane,
      targetLane: this.targetLane,
    };
  }

  get multiplier(): number {
    const comboMult = clamp(1 + this.combo * C.COMBO_STEP, 1, C.COMBO_MAX);
    return this.boostTimer > 0 ? comboMult * C.BOOST_SCORE_MULTIPLIER : comboMult;
  }

  get boosting(): boolean {
    return this.boostTimer > 0;
  }

  get invulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  get targetSpeed(): number {
    const ramp = clamp(this.distance / C.SPEED_RAMP_DISTANCE, 0, 1);
    const base = C.START_SPEED + (C.MAX_SPEED - C.START_SPEED) * ramp;
    return base + (this.boostTimer > 0 ? C.BOOST_SPEED_BONUS : 0);
  }

  /**
   * Advances by real elapsed seconds, in fixed slices. Returns the fractional
   * leftover (0..1 of a step) so renderers can interpolate if they want to.
   */
  update(dt: number): number {
    const frame = clamp(dt, 0, C.MAX_FRAME_TIME);
    this.accumulator += frame;
    let guard = 0;
    while (this.accumulator >= C.STEP) {
      this.accumulator -= C.STEP;
      this.step(C.STEP);
      if (guard++ > Math.ceil(C.MAX_FRAME_TIME / C.STEP) + 2) {
        this.accumulator = 0;
        break;
      }
    }
    return this.accumulator / C.STEP;
  }

  /** One fixed slice. Exposed for tests that want exact control. */
  step(dt: number): void {
    if (this.phase !== 'playing') {
      this.queued.length = 0;
      return;
    }
    this.elapsed += dt;
    this.consumeInput();
    this.advanceMotion(dt);

    const prevDistance = this.distance;
    this.updateSpeed(dt);
    this.distance += this.speed * dt;

    this.score += this.speed * dt * C.SCORE_PER_UNIT * this.multiplier;

    this.updateTimers(dt);
    this.collide(prevDistance);

    this.track.fill(this.distance, this.obstacles, this.pickups, this.speed);
    this.cull();
  }

  private consumeInput(): void {
    for (const action of this.queued) {
      switch (action) {
        case 'left':
          this.strafe(-1);
          break;
        case 'right':
          this.strafe(1);
          break;
        case 'jump':
          this.jumpBuffer = C.JUMP_BUFFER;
          break;
        case 'slide':
          this.startSlide();
          break;
      }
    }
    this.queued.length = 0;
  }

  private strafe(dir: -1 | 1): void {
    // A press during a move is buffered rather than applied: re-targeting
    // mid-move would let the player skip straight over the middle lane and
    // through whatever is standing in it.
    if (this.strafeT < 1) {
      this.strafeBuffer = dir;
      return;
    }
    const next = this.lane + dir;
    if (next < 0 || next > C.LANE_COUNT - 1) return;
    this.fromLane = this.lane;
    this.targetLane = next as Lane;
    this.strafeFromX = this.x;
    this.strafeT = 0;
    this.events.push({ type: 'strafe', from: this.fromLane, to: this.targetLane });
  }

  private startSlide(): void {
    if (this.motion === 'sliding') {
      this.slideT = C.SLIDE_DURATION; // refresh a held slide
      return;
    }
    // Sliding in the air is a fast-fall, which then becomes a ground slide.
    if (this.motion === 'airborne') {
      this.vy = Math.min(this.vy, -C.JUMP_VELOCITY * 0.9);
      this.slideT = C.SLIDE_DURATION;
      return;
    }
    this.motion = 'sliding';
    this.slideT = C.SLIDE_DURATION;
    this.jumpBuffer = 0;
    this.events.push({ type: 'slide' });
  }

  private advanceMotion(dt: number): void {
    // Horizontal
    if (this.strafeT < 1) {
      this.strafeT = Math.min(1, this.strafeT + dt / C.STRAFE_DURATION);
      const b = laneX(this.targetLane);
      // Ease-out so the move reads as a snap rather than a glide.
      const t = this.strafeT;
      const eased = 1 - (1 - t) * (1 - t);
      this.x = this.strafeFromX + (b - this.strafeFromX) * eased;
      // Collision lane flips at the halfway point: predictable and forgiving.
      this.lane = this.strafeT < 0.5 ? this.fromLane : this.targetLane;
      if (this.strafeT >= 1) {
        this.lane = this.targetLane;
        this.fromLane = this.targetLane;
        this.x = b;
      }
    } else if (this.strafeBuffer !== 0) {
      const dir = this.strafeBuffer;
      this.strafeBuffer = 0;
      this.strafe(dir);
    }

    // Vertical
    if (this.motion === 'airborne') {
      const rising = this.vy > 0;
      const g = rising && this.jumpHeld ? C.GRAVITY * C.JUMP_HOLD_GRAVITY_SCALE : C.GRAVITY;
      this.vy -= g * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        // A slide queued in the air lands as a ground slide.
        this.motion = this.slideT > 0 ? 'sliding' : 'running';
        this.events.push({ type: 'land' });
        if (this.motion === 'sliding') this.events.push({ type: 'slide' });
      }
    }

    if (this.motion === 'sliding') {
      this.slideT -= dt;
      if (this.slideT <= 0) {
        this.slideT = 0;
        this.motion = 'running';
      }
    }

    // Jump. A press that arrives just before touchdown is held in the buffer
    // and fires on landing rather than being dropped.
    if (this.jumpBuffer > 0) {
      if (this.motion !== 'airborne') {
        this.motion = 'airborne';
        this.slideT = 0;
        this.vy = C.JUMP_VELOCITY;
        this.jumpBuffer = 0;
        this.events.push({ type: 'jump' });
      } else {
        this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      }
    }
  }

  private updateSpeed(dt: number): void {
    const target = this.targetSpeed;
    if (this.speed < target) {
      this.speed = Math.min(target, this.speed + C.SPEED_RECOVERY * dt);
    } else if (this.speed > target) {
      this.speed = Math.max(target, this.speed - C.SPEED_RECOVERY * dt);
    }
  }

  private updateTimers(dt: number): void {
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }
  }

  private collide(prevDistance: number): void {
    const zReach = C.PLAYER_HALF_DEPTH + C.OBSTACLE_HALF_DEPTH;
    const bottom = this.y;
    const top = this.y + (this.motion === 'sliding' ? C.PLAYER_SLIDE_HEIGHT : C.PLAYER_HEIGHT);

    for (const o of this.obstacles) {
      if (o.resolved) continue;
      const relNow = o.z - this.distance;
      const relPrev = o.z - prevDistance;
      // Swept in Z: did the obstacle's slab overlap the player's at any point?
      if (relNow > zReach) continue; // still ahead
      if (relPrev < -zReach) {
        o.resolved = true; // skipped past entirely
        continue;
      }
      if (o.lane !== this.lane) {
        if (relNow < -zReach) o.resolved = true;
        continue;
      }
      const vertical = bottom < o.top && top > o.bottom;
      if (vertical) {
        o.resolved = true;
        this.takeHit(o.lane);
        if (this.phase === 'dead') return;
      } else if (relNow < -zReach) {
        o.resolved = true;
      }
    }

    const pReach = C.PLAYER_HALF_DEPTH + C.PICKUP_HALF_DEPTH;
    for (const p of this.pickups) {
      if (p.resolved) continue;
      const relNow = p.z - this.distance;
      const relPrev = p.z - prevDistance;
      if (relNow > pReach) continue;
      if (relPrev < -pReach) {
        p.resolved = true;
        continue;
      }
      if (p.lane === this.lane) {
        const pBottom = p.y - C.ORB_RADIUS;
        const pTop = p.y + C.ORB_RADIUS;
        if (bottom < pTop && top > pBottom) {
          p.taken = true;
          p.resolved = true;
          this.collect(p);
          continue;
        }
      }
      if (relNow < -pReach) p.resolved = true;
    }
  }

  private collect(p: Pickup): void {
    switch (p.kind) {
      case 'orb': {
        this.combo += 1;
        this.comboTimer = C.COMBO_TIMEOUT;
        this.stats.orbs += 1;
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
        this.score += C.ORB_SCORE * this.multiplier;
        this.events.push({ type: 'orb', combo: this.combo, lane: p.lane, y: p.y });
        break;
      }
      case 'shield': {
        this.hasShield = true;
        this.stats.shields += 1;
        this.events.push({ type: 'shield' });
        break;
      }
      case 'boost': {
        this.boostTimer = C.BOOST_DURATION;
        this.stats.boosts += 1;
        this.events.push({ type: 'boost' });
        break;
      }
    }
  }

  private takeHit(lane: Lane): void {
    if (this.invulnTimer > 0) return;
    this.invulnTimer = C.INVULN_DURATION;
    this.combo = 0;
    this.comboTimer = 0;

    if (this.hasShield) {
      this.hasShield = false;
      this.events.push({ type: 'shieldBreak' });
      return;
    }

    this.stats.hits += 1;
    this.integrity -= 1;
    this.speed = Math.max(C.START_SPEED * 0.6, this.speed * (1 - C.HIT_SPEED_PENALTY));
    this.boostTimer = 0;
    this.events.push({ type: 'hit', lane, integrity: this.integrity });

    if (this.integrity <= 0) {
      this.integrity = 0;
      this.phase = 'dead';
      this.events.push({ type: 'death', score: this.score, distance: this.distance });
    }
  }

  private cull(): void {
    const limit = this.distance + C.DESPAWN_DISTANCE;
    // Entities are appended in increasing Z, so the stale ones are a prefix.
    let i = 0;
    while (i < this.obstacles.length && (this.obstacles[i] as Obstacle).z < limit) i++;
    if (i > 0) this.obstacles.splice(0, i);
    let j = 0;
    while (j < this.pickups.length && (this.pickups[j] as Pickup).z < limit) j++;
    if (j > 0) this.pickups.splice(0, j);
  }
}
