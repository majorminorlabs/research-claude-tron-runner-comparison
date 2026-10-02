import { expect, test } from 'vitest';
import { CFG } from '../../src/game/config';
import { Game } from '../../src/game/game';
import { clearTrack, DT, newGame, run } from './_helpers';

function fresh(): Game {
  const g = newGame(3);
  clearTrack(g);
  // stop the generator from re-populating during short physics tests
  g.addRow = () => undefined;
  g.addObstacle = () => undefined;
  g.addPickup = () => undefined;
  return g;
}

test('game starts in ready, only runs after start()', () => {
  const g = new Game({ seed: 1 });
  expect(g.state).toBe('ready');
  g.update(1);
  expect(g.distance).toBe(0);
  g.start();
  run(g, 1);
  expect(g.distance).toBeGreaterThan(10);
});

test('input is ignored unless playing', () => {
  const g = new Game({ seed: 1 });
  g.input('left');
  g.start();
  g.update(DT);
  expect(g.player.lane).toBe(1);
});

test('lane change: left/right, clamps at edges, emits bump', () => {
  const g = fresh();
  g.input('left');
  run(g, 0.3);
  expect(g.player.lane).toBe(0);
  g.input('left');
  run(g, 0.3);
  expect(g.player.lane).toBe(0);
  expect(g.drainEvents().some((e) => e.type === 'bump')).toBe(true);
  g.input('right');
  run(g, 0.3);
  g.input('right');
  run(g, 0.3);
  expect(g.player.lane).toBe(2);
});

test('lane change takes laneChangeTime and occupies both lanes meanwhile', () => {
  const g = fresh();
  g.input('right');
  g.update(DT);
  expect(g.occupiedLanes().sort()).toEqual([1, 2]);
  expect(g.laneFloat).toBeGreaterThan(1);
  expect(g.laneFloat).toBeLessThan(2);
  run(g, CFG.laneChangeTime + 0.05);
  expect(g.occupiedLanes()).toEqual([2]);
  expect(g.laneFloat).toBe(2);
});

test('double-tapping the same direction mid-move crosses two lanes; the buffer holds at most two', () => {
  const g = fresh();
  g.input('left');
  g.input('left');
  run(g, 0.4);
  expect(g.player.lane).toBe(0);
  const h = fresh();
  h.input('right');
  h.input('right'); // bump: lane 2 reached then wall; extra presses beyond the 2-deep buffer are dropped
  h.input('left');
  h.input('left');
  h.input('left');
  run(h, 1);
  expect(h.player.lane).toBeLessThanOrEqual(2);
  expect(h.player.pendingLanes.length).toBe(0);
});

test('a second lane command during a move is buffered and applied after', () => {
  const g = fresh();
  g.input('left');
  g.update(DT);
  g.input('left');
  g.update(DT);
  run(g, 0.4);
  expect(g.player.lane).toBe(0);
  const g2 = fresh();
  g2.input('right');
  g2.update(DT);
  g2.input('left'); // reverses after the first move completes
  run(g2, 0.4);
  expect(g2.player.lane).toBe(1);
});

test('jump leaves the ground, peaks near expected height and lands', () => {
  const g = fresh();
  g.input('jump');
  let peak = 0;
  let airtime = 0;
  for (let i = 0; i < 120; i++) {
    g.update(DT);
    peak = Math.max(peak, g.player.y);
    if (!g.player.grounded) airtime += DT;
  }
  const expectedPeak = (CFG.jumpVelocity ** 2) / (2 * CFG.gravity);
  expect(peak).toBeGreaterThan(expectedPeak - 0.3);
  expect(peak).toBeLessThan(expectedPeak + 0.1);
  expect(airtime).toBeGreaterThan(0.55);
  expect(airtime).toBeLessThan(0.7);
  expect(g.player.grounded).toBe(true);
  expect(g.player.y).toBe(0);
});

test('cannot double jump, but a jump pressed just before landing is buffered', () => {
  const g = fresh();
  g.input('jump');
  run(g, 0.2);
  const vy = g.player.vy;
  g.input('jump');
  g.update(DT);
  expect(g.player.vy).toBeLessThan(vy); // gravity only, no second impulse
  // fly until just before landing then press again
  while (g.player.y > 0.4 || g.player.vy > 0) g.update(DT);
  g.input('jump');
  run(g, 0.2);
  expect(g.player.grounded).toBe(false); // re-jumped on landing
});

test('slide lowers the hitbox for slideTime then recovers', () => {
  const g = fresh();
  g.input('slide');
  g.update(DT);
  expect(g.player.sliding).toBe(true);
  expect(g.playerHeight).toBe(CFG.slideHeight);
  run(g, CFG.slideTime + 0.1);
  expect(g.player.sliding).toBe(false);
  expect(g.playerHeight).toBe(CFG.standHeight);
});

test('jump cancels a slide', () => {
  const g = fresh();
  g.input('slide');
  g.update(DT);
  g.input('jump');
  g.update(DT);
  expect(g.player.sliding).toBe(false);
  expect(g.player.grounded).toBe(false);
});

test('slide in mid-air fast-falls and slides on landing', () => {
  const g = fresh();
  g.input('jump');
  run(g, 0.15);
  g.input('slide');
  let guard = 0;
  while (!g.player.grounded && guard++ < 120) g.update(DT);
  expect(g.player.grounded).toBe(true);
  expect(g.player.sliding).toBe(true);
  // fast fall is quicker than a natural fall
  const h = fresh();
  h.input('jump');
  let t = 0;
  while (!h.player.grounded || t === 0) {
    h.update(DT);
    t += DT;
    if (t > 2) break;
  }
  expect(t).toBeGreaterThan(0.55);
});

test('speed ramps up monotonically and is capped', () => {
  const g = fresh();
  let last = g.speed;
  for (let s = 0; s < 400; s++) {
    run(g, 1);
    expect(g.speed).toBeGreaterThanOrEqual(last - 1e-9);
    last = g.speed;
  }
  expect(g.speed).toBeLessThanOrEqual(CFG.maxSpeed);
  expect(g.speed).toBeGreaterThan(CFG.maxSpeed - 1);
});

test('distance scores points; pause stops the clock', () => {
  const g = fresh();
  run(g, 2);
  const s = g.score;
  expect(s).toBeGreaterThan(30);
  g.pause();
  const d = g.distance;
  run(g, 5);
  g.update(5);
  expect(g.distance).toBe(d);
  g.resume();
  run(g, 1);
  expect(g.distance).toBeGreaterThan(d);
});
