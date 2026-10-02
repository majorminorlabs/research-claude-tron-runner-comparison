// Pure game logic — no DOM/canvas access, so it can be unit tested with plain Node.
// Everything here is deterministic given its inputs (RNG is injected, never global Math.random
// called directly inside logic that needs to be tested).

export const LANES = 3;
export const LANE_INDEXES = [0, 1, 2];

export const OBSTACLE_TYPES = {
  NONE: 'none',
  LOW: 'low',   // ground barrier — must JUMP
  HIGH: 'high', // overhead barrier — must SLIDE
  BLOCK: 'block', // full wall — must DODGE to another lane
};

export const REWARD_TYPES = {
  ORB: 'orb',
  BONUS: 'bonus',
};

export const PLAYER_ACTIONS = {
  RUN: 'run',
  JUMP: 'jump',
  SLIDE: 'slide',
};

export const JUMP_DURATION = 0.55; // seconds the player is airborne
export const SLIDE_DURATION = 0.5; // seconds the player is sliding
// Window (in world-z units) during which an obstacle is actually "at" the player
// and must be resolved by the correct action.
export const HIT_WINDOW = 0.06;

export const BASE_SPEED = 0.42; // world-z units/sec consumed at game start
export const MAX_SPEED = 1.35;
export const SPEED_RAMP_PER_SEC = 0.012; // how fast speed increases with survival time

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function currentSpeed(elapsedSeconds) {
  return clamp(BASE_SPEED + elapsedSeconds * SPEED_RAMP_PER_SEC, BASE_SPEED, MAX_SPEED);
}

export function clampLane(lane) {
  return clamp(lane, 0, LANES - 1);
}

/**
 * Builds one spawn "row": an obstacle type per lane plus optional rewards per lane.
 * Guarantees at least one lane is always OBSTACLE_TYPES.NONE so a dodge path always
 * exists — the player is never forced into an unavoidable collision.
 * @param {() => number} rand - injectable RNG returning [0,1), defaults to Math.random
 */
export function generateRow(rand = Math.random) {
  const obstacles = [OBSTACLE_TYPES.NONE, OBSTACLE_TYPES.NONE, OBSTACLE_TYPES.NONE];
  const openLane = Math.floor(rand() * LANES);

  const pool = [OBSTACLE_TYPES.LOW, OBSTACLE_TYPES.HIGH, OBSTACLE_TYPES.BLOCK];
  for (let lane = 0; lane < LANES; lane++) {
    if (lane === openLane) continue;
    // ~65% chance a non-open lane actually gets an obstacle; otherwise stays clear too.
    if (rand() < 0.65) {
      obstacles[lane] = pool[Math.floor(rand() * pool.length)];
    }
  }

  const rewards = [null, null, null];
  for (let lane = 0; lane < LANES; lane++) {
    if (obstacles[lane] === OBSTACLE_TYPES.BLOCK) continue; // can't collect inside a wall
    if (rand() < 0.35) {
      rewards[lane] = rand() < 0.12 ? REWARD_TYPES.BONUS : REWARD_TYPES.ORB;
    }
  }

  return { obstacles, rewards };
}

/**
 * Determines whether the player survives an obstacle at the moment it reaches them.
 * @returns {boolean} true if this obstacle hits (and ends) the player
 */
export function resolveObstacleHit(playerLane, playerAction, obstacleLane, obstacleType) {
  if (obstacleType === OBSTACLE_TYPES.NONE) return false;
  if (playerLane !== obstacleLane) return false;

  switch (obstacleType) {
    case OBSTACLE_TYPES.LOW:
      return playerAction !== PLAYER_ACTIONS.JUMP;
    case OBSTACLE_TYPES.HIGH:
      return playerAction !== PLAYER_ACTIONS.SLIDE;
    case OBSTACLE_TYPES.BLOCK:
      return true; // no action saves you from a full wall — must have dodged earlier
    default:
      return false;
  }
}

export function canCollectReward(playerLane, rewardLane, rewardType) {
  if (!rewardType) return false;
  return playerLane === rewardLane;
}

export function rewardValue(rewardType) {
  if (rewardType === REWARD_TYPES.BONUS) return 50;
  if (rewardType === REWARD_TYPES.ORB) return 10;
  return 0;
}

export function distanceScore(distanceMeters) {
  return Math.floor(distanceMeters);
}

/**
 * Advances a z-position (distance remaining to the player plane) by dt at the given speed.
 */
export function advanceZ(z, speed, dt) {
  return z - speed * dt;
}

export function isInHitWindow(z) {
  return z <= HIT_WINDOW && z > -HIT_WINDOW;
}

export function hasPassedPlayer(z) {
  return z <= -HIT_WINDOW;
}

// Must stay well beyond HIT_WINDOW: a row has to remain in state.rows for the
// entire hit-window interval so collision/pickup resolution always gets a chance
// to run before it is ever discarded.
export const ROW_REMOVE_MARGIN = 0.3;

export function shouldRemoveRow(z) {
  return z <= -ROW_REMOVE_MARGIN;
}
