export type Lane = 0 | 1 | 2;

/**
 * - `barrier` — low wall on the floor, cleared by jumping.
 * - `beam`    — overhead bar, cleared by sliding.
 * - `block`   — floor to ceiling, cleared only by not being in that lane.
 */
export type ObstacleKind = 'barrier' | 'beam' | 'block';

export interface Obstacle {
  readonly id: number;
  readonly kind: ObstacleKind;
  readonly lane: Lane;
  /** Absolute track position. Distance ahead of the player is `z - distance`. */
  readonly z: number;
  /** Vertical span of the solid part. */
  readonly bottom: number;
  readonly top: number;
  /** Set once the player has been resolved against it, to avoid double hits. */
  resolved: boolean;
}

export type PickupKind = 'orb' | 'shield' | 'boost';

export interface Pickup {
  readonly id: number;
  readonly kind: PickupKind;
  readonly lane: Lane;
  readonly z: number;
  readonly y: number;
  taken: boolean;
  /** Set once the pickup is behind the player, collected or not. */
  resolved: boolean;
}

export type PlayerMotion = 'running' | 'airborne' | 'sliding';

export type GamePhase = 'ready' | 'playing' | 'dead';

export type Action = 'left' | 'right' | 'jump' | 'slide';

/** Something that happened during a step, for the renderer and audio to react to. */
export type GameEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'slide' }
  | { type: 'strafe'; from: Lane; to: Lane }
  | { type: 'orb'; combo: number; lane: Lane; y: number }
  | { type: 'shield' }
  | { type: 'boost' }
  | { type: 'hit'; lane: Lane; integrity: number }
  | { type: 'shieldBreak' }
  | { type: 'death'; score: number; distance: number };
