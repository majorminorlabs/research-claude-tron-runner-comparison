import { expect, test } from 'vitest';
import { CFG } from '../../src/game/config';
import { isolate, newGame, run } from './_helpers';

/** Time to travel `dz` at the start speed (speed grows slowly, so allow slack). */
const secondsFor = (dz: number): number => dz / CFG.startSpeed + 0.25;

test('running into a block ends the game with a crash event', () => {
  const g = newGame();
  const w = isolate(g);
  w.obstacle('block', 1, 12);
  run(g, secondsFor(12));
  expect(g.state).toBe('over');
  expect(g.drainEvents().some((e) => e.type === 'crash')).toBe(true);
});

test('blocks in other lanes are harmless', () => {
  const g = newGame();
  const w = isolate(g);
  w.obstacle('block', 0, 12);
  w.obstacle('block', 2, 12);
  run(g, secondsFor(12) + 0.5);
  expect(g.state).toBe('playing');
});

test('low barrier: hit when running, cleared when jumping', () => {
  const a = newGame();
  isolate(a).obstacle('low', 1, 14);
  run(a, secondsFor(14));
  expect(a.state).toBe('over');

  const b = newGame();
  isolate(b).obstacle('low', 1, 14);
  const jumpAt = (14 / CFG.startSpeed) - 0.3;
  run(b, jumpAt);
  b.input('jump');
  run(b, 1.2);
  expect(b.state).toBe('playing');
  expect(b.dodges).toBe(1);
});

test('high gate: hit when running or jumping, cleared when sliding', () => {
  const a = newGame();
  isolate(a).obstacle('high', 1, 14);
  run(a, secondsFor(14));
  expect(a.state).toBe('over');

  const j = newGame();
  isolate(j).obstacle('high', 1, 14);
  run(j, 14 / CFG.startSpeed - 0.3);
  j.input('jump');
  run(j, 1.2);
  expect(j.state).toBe('over');

  const b = newGame();
  isolate(b).obstacle('high', 1, 14);
  run(b, 14 / CFG.startSpeed - 0.2);
  b.input('slide');
  run(b, 1.2);
  expect(b.state).toBe('playing');
  expect(b.dodges).toBe(1);
});

test('mid lane-change the player occupies both lanes and can side-swipe a block', () => {
  const g = newGame();
  const w = isolate(g);
  w.obstacle('block', 1, 9);
  g.input('right');
  // moving out of lane 1 begins before the obstacle arrives, finishing early enough
  run(g, 0.2);
  expect(g.player.lane).toBe(2);
  run(g, 1);
  expect(g.state).toBe('playing');

  const h = newGame();
  const w2 = isolate(h);
  w2.obstacle('block', 2, 5.2);
  h.input('right'); // lane 2 is blocked right where we arrive
  run(h, 1);
  expect(h.state).toBe('over');
});

test('dodge bonus is not awarded for blocks or for untouched lanes', () => {
  const g = newGame();
  const w = isolate(g);
  w.obstacle('low', 0, 10);
  w.obstacle('block', 2, 10);
  run(g, 1.5);
  expect(g.dodges).toBe(0);
});

test('shield absorbs one hit, then brief invulnerability, then normal rules', () => {
  const g = newGame();
  const w = isolate(g);
  g.effects.shield = true;
  const first = w.obstacle('block', 1, 10);
  run(g, secondsFor(10));
  expect(g.state).toBe('playing');
  expect(g.effects.shield).toBe(false);
  expect(first.dead).toBe(true);
  expect(g.effects.invuln).toBeGreaterThan(0);
  const ev = g.drainEvents();
  expect(ev.some((e) => e.type === 'shield-break')).toBe(true);
  // another block right away is ignored during invulnerability
  w.obstacle('block', 1, 6);
  run(g, 0.6);
  expect(g.state).toBe('playing');
  // after invulnerability a block is lethal
  run(g, CFG.shieldInvuln);
  w.obstacle('block', 1, 10);
  run(g, secondsFor(10));
  expect(g.state).toBe('over');
});

test('phase plows through obstacles, awards points, then grants a brief tail', () => {
  const g = newGame();
  const w = isolate(g);
  g.effects.phase = CFG.phaseTime;
  const o = w.obstacle('block', 1, 12);
  const before = g.score;
  run(g, 1);
  expect(g.state).toBe('playing');
  expect(o.dead).toBe(true);
  expect(g.drainEvents().some((e) => e.type === 'derez')).toBe(true);
  expect(g.score).toBeGreaterThan(before);
  run(g, CFG.phaseTime - 1 + 0.05);
  expect(g.effects.phase).toBe(0);
  expect(g.effects.invuln).toBeGreaterThan(0);
});

test('phase makes the world faster', () => {
  const a = newGame();
  isolate(a);
  const b = newGame();
  isolate(b);
  b.effects.phase = 3;
  run(a, 1);
  run(b, 1);
  expect(b.distance).toBeGreaterThan(a.distance * 1.2);
});

test('nothing collides after game over and time stops', () => {
  const g = newGame();
  isolate(g).obstacle('block', 1, 8);
  run(g, 2);
  expect(g.state).toBe('over');
  const d = g.distance;
  g.update(1);
  g.input('left');
  g.update(1);
  expect(g.distance).toBe(d);
});
