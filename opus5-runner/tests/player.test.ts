import { describe, expect, it } from 'vitest';
import * as C from '../src/core/constants';
import { emptyGame, obstacleAt, pickupAt, run, runUntilPassed } from './helpers/scenario';

/** Z at which an obstacle sits `seconds` of travel ahead of the player. */
function ahead(speed: number, seconds: number): number {
  return speed * seconds;
}

describe('movement', () => {
  it('starts in the middle lane, grounded', () => {
    const game = emptyGame();
    expect(game.player.lane).toBe(1);
    expect(game.player.y).toBe(0);
    expect(game.player.motion).toBe('running');
  });

  it('strafes one lane and settles at the lane centre', () => {
    const game = emptyGame();
    game.queue('left');
    run(game, C.STRAFE_DURATION + C.STEP * 2);
    expect(game.player.lane).toBe(0);
    expect(game.player.x).toBeCloseTo(C.LANE_X[0] as number, 5);
    expect(game.player.strafe).toBe(1);
  });

  it('will not strafe past the edge lanes', () => {
    const game = emptyGame();
    game.queue('left');
    run(game, 0.3);
    game.queue('left');
    run(game, 0.3);
    expect(game.player.lane).toBe(0);
    game.queue('right');
    run(game, 0.3);
    game.queue('right');
    run(game, 0.3);
    game.queue('right');
    run(game, 0.3);
    expect(game.player.lane).toBe(2);
  });

  it('flips the collision lane at the halfway point of a strafe', () => {
    const game = emptyGame();
    game.queue('right');
    run(game, C.STRAFE_DURATION * 0.4);
    expect(game.player.lane).toBe(1);
    run(game, C.STRAFE_DURATION * 0.25);
    expect(game.player.lane).toBe(2);
  });

  it('jumps above barrier height and returns to the ground', () => {
    const game = emptyGame();
    game.queue('jump');
    run(game, C.STEP);
    expect(game.player.motion).toBe('airborne');
    let peak = 0;
    run(game, 1.2, (g) => {
      peak = Math.max(peak, g.player.y);
    });
    expect(peak).toBeGreaterThan(C.BARRIER_HEIGHT);
    expect(game.player.y).toBe(0);
    expect(game.player.motion).toBe('running');
  });

  it('cannot double jump', () => {
    const game = emptyGame();
    game.queue('jump');
    run(game, 0.2);
    const yBefore = game.player.y;
    game.queue('jump');
    run(game, C.STEP);
    expect(game.player.y).toBeLessThan(yBefore + C.JUMP_VELOCITY * C.STEP * 1.01);
    expect(game.player.vy).toBeLessThan(C.JUMP_VELOCITY);
  });

  it('slides, lowering the hitbox, then stands back up', () => {
    const game = emptyGame();
    game.queue('slide');
    run(game, C.STEP);
    expect(game.player.motion).toBe('sliding');
    expect(game.player.height).toBe(C.PLAYER_SLIDE_HEIGHT);
    run(game, C.SLIDE_DURATION + C.STEP * 2);
    expect(game.player.motion).toBe('running');
    expect(game.player.height).toBe(C.PLAYER_HEIGHT);
  });

  it('turns an airborne slide into a fast fall that lands sliding', () => {
    const game = emptyGame();
    game.queue('jump');
    run(game, 0.25);
    expect(game.player.motion).toBe('airborne');
    game.queue('slide');
    run(game, C.STEP);
    expect(game.player.vy).toBeLessThan(0);
    run(game, 0.5);
    expect(game.player.motion).toBe('sliding');
  });

  it('buffers a jump pressed just before landing', () => {
    const game = emptyGame();
    game.queue('jump');
    // Land at ~0.77s; press at 0.72s, inside the buffer window.
    run(game, 0.72);
    game.queue('jump');
    run(game, 0.12);
    expect(game.player.motion).toBe('airborne');
    expect(game.player.vy).toBeGreaterThan(0);
  });

  it('jumping out of a slide cancels the slide', () => {
    const game = emptyGame();
    game.queue('slide');
    run(game, 0.1);
    game.queue('jump');
    run(game, C.STEP * 2);
    expect(game.player.motion).toBe('airborne');
    expect(game.player.height).toBe(C.PLAYER_HEIGHT);
  });
});

describe('obstacle interaction', () => {
  it('running into a barrier costs integrity', () => {
    const game = emptyGame();
    const o = obstacleAt('barrier', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('jumping clears a barrier', () => {
    const game = emptyGame();
    const o = obstacleAt('barrier', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    run(game, 0.67);
    game.queue('jump');
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY);
  });

  it('sliding does not clear a barrier', () => {
    const game = emptyGame();
    const o = obstacleAt('barrier', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    run(game, 0.8);
    game.queue('slide');
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('running into an overhead beam costs integrity', () => {
    const game = emptyGame();
    const o = obstacleAt('beam', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('sliding clears an overhead beam', () => {
    const game = emptyGame();
    const o = obstacleAt('beam', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    run(game, 0.85);
    game.queue('slide');
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY);
  });

  it('jumping does not clear an overhead beam', () => {
    const game = emptyGame();
    const o = obstacleAt('beam', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    run(game, 0.67);
    game.queue('jump');
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('a full-height block cannot be jumped or slid, only dodged', () => {
    const jumper = emptyGame();
    const a = obstacleAt('block', 1, ahead(jumper.speed, 1));
    jumper.obstacles.push(a);
    run(jumper, 0.67);
    jumper.queue('jump');
    runUntilPassed(jumper, a);
    expect(jumper.integrity).toBe(C.START_INTEGRITY - 1);

    const slider = emptyGame();
    const b = obstacleAt('block', 1, ahead(slider.speed, 1));
    slider.obstacles.push(b);
    run(slider, 0.85);
    slider.queue('slide');
    runUntilPassed(slider, b);
    expect(slider.integrity).toBe(C.START_INTEGRITY - 1);

    const dodger = emptyGame();
    const c = obstacleAt('block', 1, ahead(dodger.speed, 1));
    dodger.obstacles.push(c);
    dodger.queue('right');
    runUntilPassed(dodger, c);
    expect(dodger.integrity).toBe(C.START_INTEGRITY);
  });

  it('ignores obstacles in other lanes', () => {
    const game = emptyGame();
    const o = obstacleAt('block', 0, ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY);
  });

  it('a double tap crosses two lanes one at a time, not in one hop', () => {
    const game = emptyGame();
    game.queue('left');
    run(game, 0.3);
    expect(game.player.lane).toBe(0);
    // Two presses on the same step: the second is buffered, not merged in.
    game.queue('right');
    game.queue('right');
    run(game, C.STRAFE_DURATION * 0.9);
    expect(game.player.lane).toBeLessThanOrEqual(1);
    run(game, C.STRAFE_DURATION * 1.3);
    expect(game.player.lane).toBe(2);
  });

  it('is hit by a block it is crossing mid-strafe', () => {
    const game = emptyGame();
    game.queue('left');
    run(game, 0.3);
    const o = obstacleAt('block', 1, game.distance + ahead(game.speed, 0.1));
    game.obstacles.push(o);
    game.queue('right');
    game.queue('right');
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('does not tunnel through an obstacle at top speed', () => {
    const game = emptyGame();
    game.speed = C.MAX_SPEED + C.BOOST_SPEED_BONUS;
    game.distance = C.SPEED_RAMP_DISTANCE * 2; // keep the target speed high
    const o = obstacleAt('block', 1, game.distance + 30);
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(o.resolved).toBe(true);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
  });

  it('a single obstacle only ever costs one integrity segment', () => {
    const game = emptyGame();
    const o = obstacleAt('block', 1, ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    run(game, 0.5);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
    expect(game.stats.hits).toBe(1);
  });

  it('grants invulnerability so a second hit lands only after the window', () => {
    const game = emptyGame();
    const a = obstacleAt('block', 1, ahead(game.speed, 1));
    const b = { ...obstacleAt('block', 1, a.z + 2.5), id: 99 };
    game.obstacles.push(a, b);
    runUntilPassed(game, b, 5);
    expect(game.integrity).toBe(C.START_INTEGRITY - 1);
    expect(game.invulnerable).toBe(true);
  });
});

describe('pickups', () => {
  it('collects a ground orb and scores it', () => {
    const game = emptyGame();
    const p = pickupAt('orb', 1, ahead(game.speed, 1), C.ORB_GROUND_Y);
    game.pickups.push(p);
    run(game, 1.3);
    expect(p.taken).toBe(true);
    expect(game.stats.orbs).toBe(1);
    expect(game.score).toBeGreaterThan(C.ORB_SCORE);
  });

  it('needs a jump to reach an air orb', () => {
    const missed = emptyGame();
    const a = pickupAt('orb', 1, ahead(missed.speed, 1), C.ORB_AIR_Y);
    missed.pickups.push(a);
    run(missed, 1.3);
    expect(a.taken).toBe(false);

    const caught = emptyGame();
    const b = pickupAt('orb', 1, ahead(caught.speed, 1), C.ORB_AIR_Y);
    caught.pickups.push(b);
    run(caught, 0.67);
    caught.queue('jump');
    run(caught, 0.7);
    expect(b.taken).toBe(true);
  });

  it('does not collect orbs from another lane', () => {
    const game = emptyGame();
    const p = pickupAt('orb', 0, ahead(game.speed, 1), C.ORB_GROUND_Y);
    game.pickups.push(p);
    run(game, 1.3);
    expect(p.taken).toBe(false);
    expect(game.stats.orbs).toBe(0);
  });

  it('builds a combo multiplier that caps out', () => {
    const game = emptyGame();
    for (let i = 0; i < 60; i++) {
      game.pickups.push({
        ...pickupAt('orb', 1, game.distance + 20 + i * 4, C.ORB_GROUND_Y),
        id: 100 + i,
      });
    }
    run(game, 12);
    expect(game.stats.orbs).toBe(60);
    expect(game.multiplier).toBeCloseTo(C.COMBO_MAX, 5);
  });

  it('drops the combo after the timeout', () => {
    const game = emptyGame();
    game.pickups.push(pickupAt('orb', 1, ahead(game.speed, 0.5), C.ORB_GROUND_Y));
    run(game, 0.8);
    expect(game.combo).toBe(1);
    run(game, C.COMBO_TIMEOUT + 0.1);
    expect(game.combo).toBe(0);
    expect(game.multiplier).toBe(1);
  });

  it('a shield absorbs one hit and is then gone', () => {
    const game = emptyGame();
    game.pickups.push(pickupAt('shield', 1, ahead(game.speed, 0.5), C.ORB_GROUND_Y));
    run(game, 0.8);
    expect(game.hasShield).toBe(true);

    const o = obstacleAt('block', 1, game.distance + ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(game.integrity).toBe(C.START_INTEGRITY);
    expect(game.hasShield).toBe(false);
    expect(game.events.some((e) => e.type === 'shieldBreak')).toBe(true);
  });

  it('a boost raises speed and doubles scoring, then expires', () => {
    const game = emptyGame();
    game.pickups.push(pickupAt('boost', 1, ahead(game.speed, 0.5), C.ORB_GROUND_Y));
    run(game, 0.8);
    expect(game.boosting).toBe(true);
    expect(game.multiplier).toBe(C.BOOST_SCORE_MULTIPLIER);
    // Compare at the same distance, so the difficulty ramp cancels out.
    const boosted = game.targetSpeed;
    game.boostTimer = 0;
    expect(boosted - game.targetSpeed).toBeCloseTo(C.BOOST_SPEED_BONUS, 5);
    expect(game.multiplier).toBeLessThan(C.BOOST_SCORE_MULTIPLIER);

    game.boostTimer = C.BOOST_DURATION;
    run(game, C.BOOST_DURATION + 0.1);
    expect(game.boosting).toBe(false);
  });

  it('a hit cancels the boost and resets the combo', () => {
    const game = emptyGame();
    game.pickups.push(pickupAt('boost', 1, ahead(game.speed, 0.5), C.ORB_GROUND_Y));
    game.pickups.push({ ...pickupAt('orb', 1, ahead(game.speed, 0.7), C.ORB_GROUND_Y), id: 7 });
    run(game, 1);
    expect(game.boosting).toBe(true);
    expect(game.combo).toBe(1);
    const o = obstacleAt('block', 1, game.distance + ahead(game.speed, 1));
    game.obstacles.push(o);
    runUntilPassed(game, o);
    expect(game.boosting).toBe(false);
    expect(game.combo).toBe(0);
  });
});

describe('integrity and death', () => {
  it('ends the run when integrity reaches zero', () => {
    const game = emptyGame();
    for (let i = 0; i < C.START_INTEGRITY; i++) {
      game.obstacles.push({
        ...obstacleAt('block', 1, game.distance + 40 + i * 120),
        id: 10 + i,
      });
    }
    run(game, 20);
    expect(game.integrity).toBe(0);
    expect(game.phase).toBe('dead');
    expect(game.events.some((e) => e.type === 'death')).toBe(true);
  });

  it('stops simulating once dead', () => {
    const game = emptyGame();
    game.phase = 'dead';
    const d = game.distance;
    run(game, 2);
    expect(game.distance).toBe(d);
  });

  it('a hit slows the player down, and speed recovers', () => {
    const game = emptyGame();
    run(game, 1);
    const o = obstacleAt('block', 1, game.distance + ahead(game.speed, 1));
    game.obstacles.push(o);
    const speedBefore = game.speed;
    runUntilPassed(game, o);
    expect(game.speed).toBeLessThan(speedBefore);
    run(game, 4);
    expect(game.speed).toBeCloseTo(game.targetSpeed, 1);
  });
});
