import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANES,
  OBSTACLE_TYPES,
  REWARD_TYPES,
  PLAYER_ACTIONS,
  generateRow,
  resolveObstacleHit,
  canCollectReward,
  rewardValue,
  currentSpeed,
  BASE_SPEED,
  MAX_SPEED,
  clampLane,
  advanceZ,
  isInHitWindow,
  hasPassedPlayer,
  shouldRemoveRow,
  HIT_WINDOW,
  ROW_REMOVE_MARGIN,
  distanceScore,
} from '../src/logic.js';

test('generateRow always leaves at least one lane fully open', () => {
  // Seeded deterministic sequence so the test itself is stable.
  for (let seed = 0; seed < 500; seed++) {
    let i = seed;
    const rand = () => {
      i = (i * 9301 + 49297) % 233280;
      return i / 233280;
    };
    const { obstacles } = generateRow(rand);
    assert.equal(obstacles.length, LANES);
    const hasOpenLane = obstacles.some((o) => o === OBSTACLE_TYPES.NONE);
    assert.ok(hasOpenLane, `row from seed ${seed} has no open lane: ${obstacles}`);
  }
});

test('generateRow never places a reward inside a BLOCK obstacle lane', () => {
  for (let seed = 0; seed < 300; seed++) {
    let i = seed + 1;
    const rand = () => {
      i = (i * 9301 + 49297) % 233280;
      return i / 233280;
    };
    const { obstacles, rewards } = generateRow(rand);
    obstacles.forEach((type, lane) => {
      if (type === OBSTACLE_TYPES.BLOCK) {
        assert.equal(rewards[lane], null);
      }
    });
  }
});

test('LOW obstacle only hits when the player is not jumping', () => {
  assert.equal(resolveObstacleHit(1, PLAYER_ACTIONS.JUMP, 1, OBSTACLE_TYPES.LOW), false);
  assert.equal(resolveObstacleHit(1, PLAYER_ACTIONS.RUN, 1, OBSTACLE_TYPES.LOW), true);
  assert.equal(resolveObstacleHit(1, PLAYER_ACTIONS.SLIDE, 1, OBSTACLE_TYPES.LOW), true);
});

test('HIGH obstacle only hits when the player is not sliding', () => {
  assert.equal(resolveObstacleHit(0, PLAYER_ACTIONS.SLIDE, 0, OBSTACLE_TYPES.HIGH), false);
  assert.equal(resolveObstacleHit(0, PLAYER_ACTIONS.RUN, 0, OBSTACLE_TYPES.HIGH), true);
  assert.equal(resolveObstacleHit(0, PLAYER_ACTIONS.JUMP, 0, OBSTACLE_TYPES.HIGH), true);
});

test('BLOCK obstacle always hits regardless of action, only in its own lane', () => {
  assert.equal(resolveObstacleHit(2, PLAYER_ACTIONS.JUMP, 2, OBSTACLE_TYPES.BLOCK), true);
  assert.equal(resolveObstacleHit(2, PLAYER_ACTIONS.SLIDE, 2, OBSTACLE_TYPES.BLOCK), true);
  assert.equal(resolveObstacleHit(2, PLAYER_ACTIONS.RUN, 2, OBSTACLE_TYPES.BLOCK), true);
  assert.equal(resolveObstacleHit(1, PLAYER_ACTIONS.RUN, 2, OBSTACLE_TYPES.BLOCK), false);
});

test('NONE obstacle never hits', () => {
  for (const action of Object.values(PLAYER_ACTIONS)) {
    assert.equal(resolveObstacleHit(0, action, 0, OBSTACLE_TYPES.NONE), false);
  }
});

test('obstacle in a different lane never hits', () => {
  assert.equal(resolveObstacleHit(0, PLAYER_ACTIONS.RUN, 1, OBSTACLE_TYPES.BLOCK), false);
  assert.equal(resolveObstacleHit(2, PLAYER_ACTIONS.JUMP, 0, OBSTACLE_TYPES.LOW), false);
});

test('rewards are only collectible from the matching lane', () => {
  assert.equal(canCollectReward(1, 1, REWARD_TYPES.ORB), true);
  assert.equal(canCollectReward(0, 1, REWARD_TYPES.ORB), false);
  assert.equal(canCollectReward(1, 1, null), false);
});

test('reward values: bonus worth more than a standard orb', () => {
  assert.equal(rewardValue(REWARD_TYPES.ORB), 10);
  assert.equal(rewardValue(REWARD_TYPES.BONUS), 50);
  assert.equal(rewardValue(null), 0);
  assert.ok(rewardValue(REWARD_TYPES.BONUS) > rewardValue(REWARD_TYPES.ORB));
});

test('speed ramps up over time but never exceeds MAX_SPEED', () => {
  assert.equal(currentSpeed(0), BASE_SPEED);
  assert.ok(currentSpeed(10) > BASE_SPEED);
  assert.equal(currentSpeed(1_000_000), MAX_SPEED);
});

test('lane is always clamped into [0, LANES-1]', () => {
  assert.equal(clampLane(-5), 0);
  assert.equal(clampLane(5), LANES - 1);
  assert.equal(clampLane(1), 1);
});

test('advanceZ moves an obstacle toward the player over time', () => {
  const z0 = 1;
  const z1 = advanceZ(z0, 0.5, 1);
  assert.equal(z1, 0.5);
  assert.ok(z1 < z0);
});

test('hit window / passed-player boundaries are consistent and non-overlapping in intent', () => {
  assert.equal(isInHitWindow(0), true);
  assert.equal(hasPassedPlayer(0), false);
  assert.equal(hasPassedPlayer(-1), true);
  assert.equal(isInHitWindow(-1), false);
});

test('regression: rows are never removed before they clear the hit window', () => {
  // ROW_REMOVE_MARGIN must exceed HIT_WINDOW, or a row gets filtered out of
  // state.rows while its z is still above the hit-window threshold, so
  // collision/pickup resolution never runs on it (a real bug caught in manual
  // playtesting — obstacles and rewards were silently skipped at high speed).
  assert.ok(ROW_REMOVE_MARGIN > HIT_WINDOW);
  assert.equal(shouldRemoveRow(HIT_WINDOW), false);
  assert.equal(shouldRemoveRow(-HIT_WINDOW), false);
  assert.equal(shouldRemoveRow(-ROW_REMOVE_MARGIN - 0.01), true);
});

test('distanceScore floors to a whole number', () => {
  assert.equal(distanceScore(12.9), 12);
  assert.equal(distanceScore(0), 0);
});
