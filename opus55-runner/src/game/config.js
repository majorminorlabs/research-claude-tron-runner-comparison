// Tunable game constants. All distances are in world units, times in seconds.

export const LANE_WIDTH = 2.6;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

export const START_SPEED = 18;
export const MAX_SPEED = 44;
export const ACCELERATION = 0.28; // units/s gained per second

export const LANE_SWITCH_SPEED = 19; // lateral units/s
export const JUMP_VELOCITY = 12.5;
export const GRAVITY = 38;
export const FAST_FALL_VELOCITY = -26;
export const SLIDE_DURATION = 0.7;
export const JUMP_BUFFER = 0.15;

export const PLAYER = {
  halfWidth: 0.42,
  halfDepth: 0.9,
  height: 1.7,
  slideHeight: 0.7,
};

export const OBSTACLES = {
  barrier: { yMin: 0, yMax: 1.0, depth: 0.5, halfWidth: 1.05 },
  beam: { yMin: 1.05, yMax: 3.2, depth: 0.5, halfWidth: 1.05 },
  wall: { yMin: 0, yMax: 3.2, depth: 2.5, halfWidth: 1.05 },
};

export const BIT_SPACING = 2.6;
export const BIT_SCORE = 10;
export const DISTANCE_SCORE = 2; // points per unit travelled

export const POWERUPS = ['shield', 'magnet', 'multiplier'];
export const POWERUP_DURATION = { shield: 0, magnet: 10, multiplier: 10 };
export const POWERUP_CHANCE = 0.085;
export const MAGNET_RANGE = 16;

export const SPAWN_AHEAD = 140;
export const DESPAWN_BEHIND = 12;
export const FIRST_ROW_DISTANCE = 60;
export const HIT_INVULNERABILITY = 1.0;
export const NEAR_MISS_BONUS = 50;
