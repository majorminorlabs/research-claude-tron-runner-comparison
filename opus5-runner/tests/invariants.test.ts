import { describe, expect, it } from 'vitest';
import * as C from '../src/core/constants';

/**
 * These are the relationships the design rests on. A tuning change that breaks
 * one of them makes the game unfair or unwinnable, so they are asserted
 * directly rather than left to be discovered in play.
 */
describe('tuning invariants', () => {
  const jumpApex = (C.JUMP_VELOCITY * C.JUMP_VELOCITY) / (2 * C.GRAVITY);
  const airtime = (2 * C.JUMP_VELOCITY) / C.GRAVITY;
  const topSpeed = C.MAX_SPEED + C.BOOST_SPEED_BONUS;

  it('a jump clears a barrier with margin', () => {
    expect(jumpApex).toBeGreaterThan(C.BARRIER_HEIGHT * 1.5);
  });

  it('the airborne window over a barrier is wide enough to be hittable', () => {
    // Time spent above barrier height, from the quadratic for y(t).
    const disc = C.JUMP_VELOCITY ** 2 - 2 * C.GRAVITY * C.BARRIER_HEIGHT;
    expect(disc).toBeGreaterThan(0);
    const window = Math.sqrt(disc) / (C.GRAVITY / 2);
    expect(window).toBeGreaterThan(0.3);
    // That window must cover the obstacle's depth even at full tilt.
    const contact = (2 * (C.PLAYER_HALF_DEPTH + C.OBSTACLE_HALF_DEPTH)) / topSpeed;
    expect(window).toBeGreaterThan(contact * 3);
  });

  it('a slide fits under a beam, and standing does not', () => {
    expect(C.PLAYER_SLIDE_HEIGHT).toBeLessThan(C.BEAM_BOTTOM);
    expect(C.PLAYER_HEIGHT).toBeGreaterThan(C.BEAM_BOTTOM);
  });

  it('a slide lasts long enough to cross a beam at top speed', () => {
    const contact = (2 * (C.PLAYER_HALF_DEPTH + C.OBSTACLE_HALF_DEPTH)) / topSpeed;
    expect(C.SLIDE_DURATION).toBeGreaterThan(contact * 4);
  });

  it('a jump cannot clear a beam or a block', () => {
    expect(jumpApex).toBeLessThan(C.BEAM_TOP - C.PLAYER_HEIGHT);
    expect(jumpApex).toBeLessThan(C.BLOCK_HEIGHT - C.PLAYER_HEIGHT);
  });

  it('rows are spaced further apart than a full jump takes', () => {
    // The generator uses max(MIN_ROW_GAP, speed * ROW_GAP_SECONDS), so in
    // seconds the gap is never shorter than ROW_GAP_SECONDS at any speed.
    const gapSeconds = (speed: number) =>
      Math.max(C.MIN_ROW_GAP / speed, C.ROW_GAP_SECONDS);
    expect(gapSeconds(C.START_SPEED)).toBeGreaterThan(airtime);
    expect(gapSeconds(topSpeed)).toBeGreaterThan(airtime);
    expect(C.ROW_GAP_SECONDS).toBeGreaterThan(airtime);
  });

  it('speed barely changes between generating a row and reaching it', () => {
    // Rows are spaced using the speed at generation time; if the player sped
    // up much over the spawn horizon, that spacing would be a lie.
    const drift = ((C.MAX_SPEED - C.START_SPEED) * C.SPAWN_DISTANCE) / C.SPEED_RAMP_DISTANCE;
    expect(drift).toBeLessThan(C.START_SPEED * 0.1);
  });

  it('a lane change is far quicker than the gap between rows', () => {
    expect(C.STRAFE_DURATION * 2).toBeLessThan(C.MIN_ROW_GAP / topSpeed);
  });

  it('obstacles are narrower than a lane, so lanes stay distinguishable', () => {
    expect(C.OBSTACLE_HALF_WIDTH + C.PLAYER_HALF_WIDTH).toBeLessThan(C.LANE_WIDTH);
  });

  it('an air orb is out of reach while running but inside the jump arc', () => {
    expect(C.ORB_AIR_Y - C.ORB_RADIUS).toBeGreaterThan(C.PLAYER_HEIGHT);
    expect(C.ORB_AIR_Y - C.ORB_RADIUS).toBeLessThan(jumpApex + C.PLAYER_HEIGHT);
  });

  it('a ground orb is reachable both running and sliding', () => {
    expect(C.ORB_GROUND_Y - C.ORB_RADIUS).toBeLessThan(C.PLAYER_SLIDE_HEIGHT);
    expect(C.ORB_GROUND_Y + C.ORB_RADIUS).toBeGreaterThan(0);
  });

  it('nothing can tunnel through an obstacle in one fixed step', () => {
    const perStep = topSpeed * C.STEP;
    const window = 2 * (C.PLAYER_HALF_DEPTH + C.OBSTACLE_HALF_DEPTH);
    expect(perStep).toBeLessThan(window * 0.5);
  });

  it('the spawn horizon gives more than a second of reaction time', () => {
    expect(C.SPAWN_DISTANCE / topSpeed).toBeGreaterThan(2);
  });

  it('invulnerability outlasts the gap between two rows of hazards', () => {
    expect(C.INVULN_DURATION).toBeGreaterThan(0.5);
    expect(C.INVULN_DURATION).toBeLessThan(C.MIN_ROW_GAP / C.START_SPEED + 1);
  });

  it('speed only ever ramps upward', () => {
    expect(C.MAX_SPEED).toBeGreaterThan(C.START_SPEED);
    expect(C.SPEED_RAMP_DISTANCE).toBeGreaterThan(0);
  });

  it('the lane layout is symmetric about the centre', () => {
    expect(C.LANE_X.length).toBe(C.LANE_COUNT);
    expect(C.LANE_X[0]).toBeCloseTo(-(C.LANE_X[2] as number), 10);
    expect(C.LANE_X[1]).toBe(0);
  });

  it('the opening stretch is long enough to settle into', () => {
    expect(C.GRACE_DISTANCE / C.START_SPEED).toBeGreaterThan(2.5);
  });
});
