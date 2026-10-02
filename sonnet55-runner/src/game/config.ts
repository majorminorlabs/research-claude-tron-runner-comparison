/** Central tuning values. Distances are world units, times are seconds. */
export const LANES = 3;
export const LANE_WIDTH = 3.0;
export const laneX = (lane: number): number => (lane - 1) * LANE_WIDTH;

export const CFG = {
  // speed
  startSpeed: 19,
  maxSpeed: 47,
  speedRampSeconds: 70, // time constant of the exponential approach to maxSpeed
  phaseSpeedMul: 1.3,

  // player
  laneChangeTime: 0.11,
  laneBufferTime: 0.2,
  jumpVelocity: 15.5,
  gravity: 50,
  fastFallVelocity: 34,
  jumpBufferTime: 0.14,
  slideBufferTime: 0.45,
  slideTime: 0.75,
  standHeight: 1.8,
  slideHeight: 0.8,
  playerHalfDepth: 0.35,

  // obstacles
  lowHeight: 1.0,
  lowGrace: 0.1,
  highBottom: 1.15,
  highTop: 3.2,
  blockTop: 3.4,
  lowDepth: 1.0,
  highDepth: 1.0,
  blockDepth: 2.0,

  // pickups
  bitScore: 25,
  powerScore: 100,
  dodgeScore: 40,
  derezScore: 20,
  magnetRange: 20,
  magnetTime: 9,
  overclockTime: 10,
  phaseTime: 4.5,
  shieldInvuln: 1.3,
  phaseTail: 0.6,
  chainWindow: 1.2,

  // world
  spawnHorizon: 150,
  cullBehind: 25,
  sectorLength: 1500,
  difficultyDistance: 9000,
} as const;

export type ObstacleKind = 'low' | 'high' | 'block';
export type PickupKind = 'bit' | 'shield' | 'magnet' | 'overclock' | 'phase';
export type Cell = ObstacleKind | null;
export type Action = 'none' | 'jump' | 'slide';
export type Command = 'left' | 'right' | 'jump' | 'slide';

export const obstacleDepth = (k: ObstacleKind): number =>
  k === 'low' ? CFG.lowDepth : k === 'high' ? CFG.highDepth : CFG.blockDepth;
