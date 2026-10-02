import { describe, it, expect } from 'vitest';
import { createGame, update, input, multiplier, difficulty, playerHeight } from '../../src/game/game.js';
import { createRng } from '../../src/game/rng.js';
import {
  LANES,
  START_SPEED,
  MAX_SPEED,
  OBSTACLES,
  SLIDE_DURATION,
  BIT_SCORE,
  NEAR_MISS_BONUS,
  POWERUP_DURATION,
  DISTANCE_SCORE,
} from '../../src/game/config.js';
import { botStep } from '../../src/game/autopilot.js';

const DT = 1 / 60;

function run(game, seconds, each) {
  const steps = Math.round(seconds / DT);
  const events = [];
  for (let i = 0; i < steps && game.alive; i++) {
    each?.(game);
    events.push(...update(game, DT));
  }
  return events;
}

/** A game with procedural content cleared so tests can place things by hand. */
function emptyGame(seed = 1) {
  const game = createGame({ seed });
  game.nextRowD = Infinity;
  game.obstacles = [];
  game.bits = [];
  game.powerups = [];
  game.rows = [];
  return game;
}

function place(game, type, lane, aheadBy, length = OBSTACLES[type].depth) {
  const def = OBSTACLES[type];
  const o = {
    id: game.nextId++,
    type,
    lane,
    x: LANES[lane],
    d: game.distance + aheadBy,
    length,
    yMin: def.yMin,
    yMax: def.yMax,
    halfWidth: def.halfWidth,
    hit: false,
    passed: false,
  };
  game.obstacles.push(o);
  return o;
}

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('int stays in range inclusive', () => {
    const r = createRng(7);
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(r.int(0, 2));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('movement', () => {
  it('starts in the centre lane at start speed', () => {
    const g = createGame({ seed: 1 });
    expect(g.player.lane).toBe(1);
    expect(g.player.x).toBe(0);
    expect(g.speed).toBe(START_SPEED);
    expect(g.alive).toBe(true);
  });

  it('switches lanes and clamps at the edges', () => {
    const g = emptyGame();
    input(g, 'left');
    run(g, 0.5);
    expect(g.player.lane).toBe(0);
    expect(g.player.x).toBeCloseTo(LANES[0]);
    input(g, 'left');
    const ev = run(g, 0.1);
    expect(g.player.lane).toBe(0);
    expect(ev.some((e) => e.type === 'edge')).toBe(true);
    input(g, 'right');
    input(g, 'right');
    run(g, 0.5);
    expect(g.player.lane).toBe(2);
    expect(g.player.x).toBeCloseTo(LANES[2]);
  });

  it('jumps and lands', () => {
    const g = emptyGame();
    input(g, 'jump');
    const ev = run(g, 0.2);
    expect(g.player.grounded).toBe(false);
    expect(g.player.y).toBeGreaterThan(1);
    ev.push(...run(g, 1));
    expect(g.player.grounded).toBe(true);
    expect(g.player.y).toBe(0);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['jump', 'land']));
  });

  it('cannot double jump but buffers a jump pressed just before landing', () => {
    const g = emptyGame();
    input(g, 'jump');
    run(g, 0.2);
    const peakVy = g.player.vy;
    input(g, 'jump');
    update(g, DT);
    expect(g.player.vy).toBeLessThan(peakVy); // no mid-air boost
    // fall until just before landing, then press jump
    while (g.player.y > 0.3 || g.player.vy > 0) update(g, DT);
    input(g, 'jump');
    run(g, 0.15);
    expect(g.player.grounded).toBe(false);
    expect(g.player.vy).toBeGreaterThan(0);
  });

  it('slides for a fixed duration with reduced height', () => {
    const g = emptyGame();
    input(g, 'slide');
    update(g, DT);
    expect(g.player.sliding).toBe(true);
    expect(playerHeight(g)).toBeLessThan(1);
    run(g, SLIDE_DURATION + 0.05);
    expect(g.player.sliding).toBe(false);
  });

  it('slide in mid-air fast-falls and slides on landing', () => {
    const g = emptyGame();
    input(g, 'jump');
    run(g, 0.15);
    input(g, 'slide');
    update(g, DT);
    expect(g.player.vy).toBeLessThan(-20);
    run(g, 0.2);
    expect(g.player.grounded).toBe(true);
    expect(g.player.sliding).toBe(true);
  });

  it('jumping cancels a slide', () => {
    const g = emptyGame();
    input(g, 'slide');
    update(g, DT);
    input(g, 'jump');
    update(g, DT);
    expect(g.player.sliding).toBe(false);
    expect(g.player.grounded).toBe(false);
  });

  it('accelerates up to the max speed', () => {
    const g = emptyGame();
    run(g, 10);
    expect(g.speed).toBeGreaterThan(START_SPEED);
    run(g, 400);
    expect(g.speed).toBe(MAX_SPEED);
    expect(difficulty(g)).toBe(1);
  });
});

describe('obstacles', () => {
  it('a wall in your lane ends the run', () => {
    const g = emptyGame();
    place(g, 'wall', 1, 10);
    const ev = run(g, 2);
    expect(g.alive).toBe(false);
    expect(ev.at(-1)).toMatchObject({ type: 'crash', obstacle: 'wall' });
  });

  it('obstacles in other lanes are harmless', () => {
    const g = emptyGame();
    place(g, 'wall', 0, 10);
    place(g, 'wall', 2, 10);
    run(g, 2);
    expect(g.alive).toBe(true);
  });

  it('a barrier must be jumped', () => {
    const hit = emptyGame();
    place(hit, 'barrier', 1, 10);
    run(hit, 2);
    expect(hit.alive).toBe(false);

    const ok = emptyGame();
    place(ok, 'barrier', 1, 10);
    const ev = run(ok, 2, (g) => {
      if (g.distance > 10 - g.speed * 0.22 - 0.9 && g.player.grounded && g.time < 1) input(g, 'jump');
    });
    expect(ok.alive).toBe(true);
    expect(ok.clears).toBe(1);
    expect(ev.some((e) => e.type === 'clear')).toBe(true);
  });

  it('a beam must be slid under, and cannot be jumped', () => {
    const hit = emptyGame();
    place(hit, 'beam', 1, 10);
    run(hit, 2, (g) => g.player.grounded && input(g, 'jump'));
    expect(hit.alive).toBe(false);

    const ok = emptyGame();
    place(ok, 'beam', 1, 12);
    run(ok, 2, (g) => {
      if (g.distance > 12 - g.speed * 0.3 - 0.9 && !g.player.sliding && g.time < 1) input(g, 'slide');
    });
    expect(ok.alive).toBe(true);
    expect(ok.clears).toBe(1);
  });

  it('awards a bonus for clearing an obstacle', () => {
    const g = emptyGame();
    place(g, 'beam', 1, 12);
    input(g, 'slide');
    run(g, 0.3);
    input(g, 'slide');
    const before = g.score;
    run(g, 0.5);
    expect(g.clears).toBe(1);
    expect(g.score - before).toBeGreaterThan(NEAR_MISS_BONUS);
  });

  it('steering into the side of a wall bumps you back instead of crashing', () => {
    const g = emptyGame();
    place(g, 'wall', 0, -5, 30); // a long wall already alongside the player
    input(g, 'left');
    const ev = run(g, 0.3);
    expect(g.alive).toBe(true);
    expect(ev.some((e) => e.type === 'bump')).toBe(true);
    expect(g.player.lane).toBe(1);
  });

  it('a shield absorbs one hit then is consumed', () => {
    const g = emptyGame();
    g.powers.shield = true;
    place(g, 'wall', 1, 8);
    const ev = run(g, 1.2);
    expect(g.alive).toBe(true);
    expect(g.powers.shield).toBe(false);
    expect(ev.some((e) => e.type === 'shieldBreak')).toBe(true);
    place(g, 'wall', 1, 10);
    run(g, 2);
    expect(g.alive).toBe(false);
  });

  it('a dead game no longer updates', () => {
    const g = emptyGame();
    place(g, 'wall', 1, 2);
    run(g, 1);
    const snapshot = { d: g.distance, s: g.score };
    update(g, DT);
    input(g, 'jump');
    expect(g.distance).toBe(snapshot.d);
    expect(g.score).toBe(snapshot.s);
    expect(g.queue).toHaveLength(0);
  });
});

describe('pickups & scoring', () => {
  it('distance adds score', () => {
    const g = emptyGame();
    run(g, 1);
    expect(g.score).toBeCloseTo(g.distance * DISTANCE_SCORE, 5);
  });

  it('collects bits in your lane only', () => {
    const g = emptyGame();
    g.bits.push({ id: 1, lane: 1, x: 0, y: 1, d: 10, collected: false, attracted: false });
    g.bits.push({ id: 2, lane: 0, x: LANES[0], y: 1, d: 10, collected: false, attracted: false });
    const ev = run(g, 1.5);
    expect(g.bitsCollected).toBe(1);
    expect(ev.filter((e) => e.type === 'collect')).toHaveLength(1);
    expect(g.score).toBeCloseTo(g.distance * DISTANCE_SCORE + BIT_SCORE, 5);
  });

  it('multiplier doubles points', () => {
    const g = emptyGame();
    g.powers.multiplier = 5;
    expect(multiplier(g)).toBe(2);
    run(g, 1);
    expect(g.score).toBeCloseTo(g.distance * DISTANCE_SCORE * 2, 5);
  });

  it('power-ups activate and expire', () => {
    const g = emptyGame();
    g.powerups.push({ id: 9, type: 'magnet', lane: 1, x: 0, y: 1.1, d: 8 });
    const ev = run(g, 1);
    expect(ev.some((e) => e.type === 'powerup' && e.power === 'magnet')).toBe(true);
    expect(g.powers.magnet).toBeGreaterThan(POWERUP_DURATION.magnet - 1);
    const later = run(g, POWERUP_DURATION.magnet);
    expect(g.powers.magnet).toBe(0);
    expect(later.some((e) => e.type === 'powerEnd' && e.power === 'magnet')).toBe(true);
  });

  it('magnet pulls in bits from other lanes', () => {
    const g = emptyGame();
    g.powers.magnet = 10;
    for (let i = 0; i < 5; i++) {
      g.bits.push({ id: 100 + i, lane: 2, x: LANES[2], y: 1, d: 10 + i * 3, collected: false, attracted: false });
    }
    run(g, 2);
    expect(g.bitsCollected).toBe(5);
  });
});

describe('track generation', () => {
  it('is deterministic per seed', () => {
    const a = createGame({ seed: 99 });
    const b = createGame({ seed: 99 });
    run(a, 5);
    run(b, 5);
    expect(a.obstacles.map((o) => [o.type, o.lane, o.d])).toEqual(b.obstacles.map((o) => [o.type, o.lane, o.d]));
  });

  it('every row keeps a wall-free safe lane that moves at most one lane', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame({ seed });
      g.speed = MAX_SPEED; // hardest settings
      const rows = [];
      let prev = 1;
      for (let i = 0; i < 300; i++) {
        g.distance = g.nextRowD - 100;
        update(g, 0); // dt 0: spawn only
        g.alive = true;
        rows.push(...g.rows.filter((r) => !rows.includes(r)));
      }
      for (const row of rows) {
        expect(row.types[row.safeLane]).not.toBe('wall');
        expect(Math.abs(row.safeLane - prev)).toBeLessThanOrEqual(1);
        expect(row.types.some(Boolean)).toBe(true);
        prev = row.safeLane;
      }
    }
  });

  it('never places collectibles inside obstacles', () => {
    const g = createGame({ seed: 5 });
    run(g, 0.1);
    for (let i = 0; i < 200; i++) {
      g.distance = g.nextRowD - 120;
      update(g, 0);
    }
    for (const b of [...g.bits, ...g.powerups]) {
      const inside = g.obstacles.some(
        (o) => o.lane === b.lane && b.d > o.d - 0.6 && b.d < o.d + o.length + 0.6 && b.y < o.yMax && b.y > o.yMin,
      );
      expect(inside).toBe(false);
    }
  });

  it('an autopilot following the safe path survives long runs at full speed', () => {
    for (const seed of [1, 2, 3, 42, 1337, 20261001]) {
      const g = createGame({ seed });
      run(g, 180, botStep);
      expect({ seed, alive: g.alive, t: Math.round(g.time) }).toEqual({ seed, alive: true, t: 180 });
      expect(g.speed).toBe(MAX_SPEED);
      expect(g.bitsCollected).toBeGreaterThan(50);
    }
  });

  it('doing nothing eventually crashes', () => {
    const g = createGame({ seed: 3 });
    run(g, 120);
    expect(g.alive).toBe(false);
  });

  it('keeps entity counts bounded', () => {
    const g = createGame({ seed: 11 });
    let maxObs = 0;
    run(g, 120, (gg) => {
      botStep(gg);
      maxObs = Math.max(maxObs, gg.obstacles.length + gg.bits.length + gg.powerups.length);
    });
    expect(maxObs).toBeLessThan(200);
  });
});
