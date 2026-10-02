import { CFG, LANES, obstacleDepth, type Command, type PickupKind } from './config';
import { Generator, type SpawnSink } from './generator';
import { Rng } from './rng';
import { hitsVertically, type Obstacle, type Row } from './rules';

export type GameState = 'ready' | 'playing' | 'paused' | 'over';

export interface Pickup {
  id: number;
  kind: PickupKind;
  lane: number;
  z: number;
  y: number;
  collected: boolean;
  /** Pulled in by the magnet. */
  pulled: boolean;
}

export interface PlayerState {
  /** Target lane. */
  lane: number;
  /** Lane the player is leaving while `laneT < 1`. */
  fromLane: number;
  /** 0..1 progress of the current lane change (1 = settled). */
  laneT: number;
  /** Queued lane changes (-1 / +1), applied once the current move finishes. Max 2. */
  pendingLanes: number[];
  y: number;
  vy: number;
  grounded: boolean;
  sliding: boolean;
  slideT: number;
  jumpBuffer: number;
  slideBuffer: number;
}

export interface Effects {
  shield: boolean;
  magnet: number;
  overclock: number;
  phase: number;
  /** Brief invulnerability after a shield break / phase ends. */
  invuln: number;
}

export type GameEvent =
  | { type: 'jump' }
  | { type: 'slide' }
  | { type: 'land' }
  | { type: 'lane'; dir: number }
  | { type: 'bump' }
  | { type: 'bit'; chain: number; value: number; lane: number; y: number }
  | { type: 'power'; kind: PickupKind; lane: number; y: number }
  | { type: 'power-end'; kind: 'magnet' | 'overclock' | 'phase' | 'shield' }
  | { type: 'dodge'; value: number; kind: 'low' | 'high' }
  | { type: 'derez'; obstacle: Obstacle; value: number }
  | { type: 'shield-break'; obstacle: Obstacle }
  | { type: 'sector'; sector: number }
  | { type: 'crash'; obstacle: Obstacle };

export interface GameOptions {
  seed: number;
}

const STEP = 1 / 60;

export class Game implements SpawnSink {
  readonly seed: number;
  state: GameState = 'ready';
  time = 0;
  distance = 0;
  speed: number = CFG.startSpeed;
  score = 0;
  bits = 0;
  dodges = 0;
  sector = 1;
  chain = 0;
  player: PlayerState = Game.freshPlayer();
  effects: Effects = { shield: false, magnet: 0, overclock: 0, phase: 0, invuln: 0 };
  obstacles: Obstacle[] = [];
  pickups: Pickup[] = [];
  rows: Row[] = [];
  /** Events produced since the last `drainEvents()`. */
  events: GameEvent[] = [];

  private rng: Rng;
  private gen: Generator;
  private nextId = 1;
  private inputQueue: Command[] = [];
  private chainTimer = 0;
  private scoreFloat = 0;
  private acc = 0;
  private cullTick = 0;

  constructor(opts: GameOptions) {
    this.seed = opts.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.gen = new Generator(this.rng);
    this.gen.fill(0, CFG.startSpeed, this);
  }

  private static freshPlayer(): PlayerState {
    return {
      lane: 1,
      fromLane: 1,
      laneT: 1,
      pendingLanes: [],
      y: 0,
      vy: 0,
      grounded: true,
      sliding: false,
      slideT: 0,
      jumpBuffer: 0,
      slideBuffer: 0,
    };
  }

  // ---------------------------------------------------------------- lifecycle
  start(): void {
    if (this.state === 'ready') this.state = 'playing';
  }
  pause(): void {
    if (this.state === 'playing') this.state = 'paused';
  }
  resume(): void {
    if (this.state === 'paused') this.state = 'playing';
  }
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // -------------------------------------------------------------------- input
  input(cmd: Command): void {
    if (this.state !== 'playing') return;
    if (this.inputQueue.length < 4) this.inputQueue.push(cmd);
  }

  // ------------------------------------------------------------------- derived
  get playerHeight(): number {
    return this.player.sliding ? CFG.slideHeight : CFG.standHeight;
  }
  get multiplier(): number {
    return this.effects.overclock > 0 ? 2 : 1;
  }
  /** Current visual lane position in lane units (0..2, fractional while moving). */
  get laneFloat(): number {
    const p = this.player;
    if (p.laneT >= 1) return p.lane;
    const t = p.laneT;
    const e = t * t * (3 - 2 * t);
    return p.fromLane + (p.lane - p.fromLane) * e;
  }
  /** Lanes the player currently occupies for collision purposes. */
  occupiedLanes(): number[] {
    const p = this.player;
    return p.laneT >= 1 || p.fromLane === p.lane ? [p.lane] : [p.fromLane, p.lane];
  }
  private baseSpeed(t: number): number {
    return CFG.startSpeed + (CFG.maxSpeed - CFG.startSpeed) * (1 - Math.exp(-t / CFG.speedRampSeconds));
  }

  // ------------------------------------------------------------------- update
  /** Advance the simulation by `dt` seconds (internally sub-stepped). */
  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP - 1e-9 && this.state === 'playing') {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }

  private step(h: number): void {
    this.processInput();

    this.time += h;
    const mul = this.effects.phase > 0 ? CFG.phaseSpeedMul : 1;
    this.speed = this.baseSpeed(this.time) * mul;
    const prevDistance = this.distance;
    this.distance += this.speed * h;

    this.stepPlayer(h);
    this.stepEffects(h);
    this.collideObstacles();
    if (this.state !== 'playing') return;
    this.collectPickups(h);

    this.chainTimer -= h;
    if (this.chainTimer <= 0) this.chain = 0;

    this.scoreFloat += (this.distance - prevDistance) * this.multiplier;
    this.score = Math.floor(this.scoreFloat);

    this.gen.fill(this.distance, this.speed, this);
    if (++this.cullTick % 20 === 0) this.cull();

    const sector = 1 + Math.floor(this.distance / CFG.sectorLength);
    if (sector > this.sector) {
      this.sector = sector;
      this.emit({ type: 'sector', sector });
    }
  }

  // ------------------------------------------------------------------- player
  private processInput(): void {
    const q = this.inputQueue;
    this.inputQueue = [];
    for (const c of q) this.applyCommand(c);
  }

  private applyCommand(c: Command): void {
    const p = this.player;
    switch (c) {
      case 'left':
      case 'right': {
        const dir = c === 'left' ? -1 : 1;
        if (p.laneT < 1) {
          if (p.pendingLanes.length < 2) p.pendingLanes.push(dir);
          return;
        }
        this.changeLane(dir);
        return;
      }
      case 'jump':
        if (p.grounded) this.doJump();
        else p.jumpBuffer = CFG.jumpBufferTime;
        return;
      case 'slide':
        if (p.grounded) this.doSlide();
        else {
          p.vy = Math.min(p.vy, -CFG.fastFallVelocity);
          p.slideBuffer = CFG.slideBufferTime;
          p.jumpBuffer = 0;
        }
        return;
    }
  }

  private changeLane(dir: number): void {
    const p = this.player;
    const target = p.lane + dir;
    if (target < 0 || target >= LANES) {
      this.emit({ type: 'bump' });
      return;
    }
    p.fromLane = p.lane;
    p.lane = target;
    p.laneT = 0;
    this.emit({ type: 'lane', dir });
  }

  private doJump(): void {
    const p = this.player;
    p.vy = CFG.jumpVelocity;
    p.grounded = false;
    p.sliding = false;
    p.slideT = 0;
    p.jumpBuffer = 0;
    this.emit({ type: 'jump' });
  }

  private doSlide(): void {
    const p = this.player;
    p.sliding = true;
    p.slideT = CFG.slideTime;
    p.slideBuffer = 0;
    this.emit({ type: 'slide' });
  }

  private stepPlayer(h: number): void {
    const p = this.player;

    if (p.laneT < 1) p.laneT = Math.min(1, p.laneT + h / CFG.laneChangeTime);
    // apply buffered lane changes once settled (a change into a wall is dropped, so keep going)
    while (p.laneT >= 1 && p.pendingLanes.length > 0) this.changeLane(p.pendingLanes.shift()!);

    p.jumpBuffer = Math.max(0, p.jumpBuffer - h);
    p.slideBuffer = Math.max(0, p.slideBuffer - h);

    if (!p.grounded) {
      p.vy -= CFG.gravity * h;
      p.y += p.vy * h;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
        this.emit({ type: 'land' });
        if (p.jumpBuffer > 0) this.doJump();
        else if (p.slideBuffer > 0) this.doSlide();
      }
    }

    if (p.sliding) {
      p.slideT -= h;
      if (p.slideT <= 0) {
        p.sliding = false;
        p.slideT = 0;
      }
    }
  }

  private stepEffects(h: number): void {
    const e = this.effects;
    const tick = (key: 'magnet' | 'overclock' | 'phase'): void => {
      if (e[key] > 0) {
        e[key] = Math.max(0, e[key] - h);
        if (e[key] === 0) {
          this.emit({ type: 'power-end', kind: key });
          if (key === 'phase') e.invuln = Math.max(e.invuln, CFG.phaseTail);
        }
      }
    };
    tick('magnet');
    tick('overclock');
    tick('phase');
    e.invuln = Math.max(0, e.invuln - h);
  }

  // ---------------------------------------------------------------- collisions
  private collideObstacles(): void {
    const p = this.player;
    const lanes = this.occupiedLanes();
    const reach = CFG.playerHalfDepth;
    const h = this.playerHeight;
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const half = o.depth / 2;
      const dz = o.z - this.distance;
      const overlapping = Math.abs(dz) < half + reach;

      if (overlapping && lanes.includes(o.lane)) {
        if (!hitsVertically(o.kind, p.y, h)) {
          o.crossed = true;
          continue;
        }
        if (this.effects.phase > 0) {
          o.dead = true;
          this.addScore(CFG.derezScore);
          this.emit({ type: 'derez', obstacle: o, value: CFG.derezScore * this.multiplier });
          continue;
        }
        if (this.effects.invuln > 0) continue;
        if (this.effects.shield) {
          this.effects.shield = false;
          this.effects.invuln = CFG.shieldInvuln;
          o.dead = true;
          this.emit({ type: 'power-end', kind: 'shield' });
          this.emit({ type: 'shield-break', obstacle: o });
          continue;
        }
        this.state = 'over';
        this.emit({ type: 'crash', obstacle: o });
        return;
      }

      // passed cleanly: reward obstacles actually jumped over / slid under
      if (!o.awarded && o.crossed && dz < -(half + reach)) {
        o.awarded = true;
        if (o.kind !== 'block') {
          this.dodges++;
          const value = CFG.dodgeScore * this.multiplier;
          this.addScore(CFG.dodgeScore);
          this.emit({ type: 'dodge', value, kind: o.kind });
        }
      }
    }
  }

  private collectPickups(_h: number): void {
    const p = this.player;
    const lanes = this.occupiedLanes();
    const h = this.playerHeight;
    const magnet = this.effects.magnet > 0;
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      const dz = pk.z - this.distance;
      if (magnet && pk.kind === 'bit' && dz > -1 && dz < CFG.magnetRange) pk.pulled = true;

      let got = false;
      if (pk.pulled) got = dz < 1.1;
      else if (Math.abs(dz) < 0.9 && lanes.includes(pk.lane)) {
        got = pk.y >= p.y - 0.3 && pk.y <= p.y + h + 0.3;
      }
      if (!got) continue;

      pk.collected = true;
      if (pk.kind === 'bit') this.collectBit(pk);
      else this.collectPower(pk);
    }
  }

  private collectBit(pk: Pickup): void {
    this.bits++;
    this.chain++;
    this.chainTimer = CFG.chainWindow;
    const value = CFG.bitScore * this.multiplier;
    this.addScore(CFG.bitScore);
    this.emit({ type: 'bit', chain: this.chain, value, lane: pk.lane, y: pk.y });
  }

  private collectPower(pk: Pickup): void {
    const e = this.effects;
    switch (pk.kind) {
      case 'shield':
        e.shield = true;
        break;
      case 'magnet':
        e.magnet = CFG.magnetTime;
        break;
      case 'overclock':
        e.overclock = CFG.overclockTime;
        break;
      case 'phase':
        e.phase = CFG.phaseTime;
        break;
      case 'bit':
        break;
    }
    this.addScore(CFG.powerScore);
    this.emit({ type: 'power', kind: pk.kind, lane: pk.lane, y: pk.y });
  }

  private addScore(base: number): void {
    this.scoreFloat += base * this.multiplier;
    this.score = Math.floor(this.scoreFloat);
  }

  // ------------------------------------------------------------------ world
  addObstacle(kind: 'low' | 'high' | 'block', lane: number, z: number): void {
    this.obstacles.push({
      id: this.nextId++,
      kind,
      lane,
      z,
      depth: obstacleDepth(kind),
      crossed: false,
      awarded: false,
      dead: false,
    });
  }
  addPickup(kind: PickupKind, lane: number, z: number, y: number): void {
    this.pickups.push({ id: this.nextId++, kind, lane, z, y, collected: false, pulled: false });
  }
  addRow(row: Row): void {
    this.rows.push(row);
  }

  private cull(): void {
    const limit = this.distance - CFG.cullBehind;
    this.obstacles = this.obstacles.filter((o) => o.z >= limit);
    this.pickups = this.pickups.filter((p) => p.z >= limit);
    this.rows = this.rows.filter((r) => r.z >= limit);
  }
}
