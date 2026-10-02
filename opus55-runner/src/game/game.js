// Pure, DOM-free game simulation. The renderer and audio layers only read
// this state and consume `game.events`; nothing here touches the browser,
// which keeps the whole ruleset unit-testable and deterministic per seed.
//
// Coordinates: the track runs along "d" (distance from the start). The
// player sits at d = game.distance; something at track position d appears
// at view depth z = distance - d (negative = ahead of the player).

import {
  LANES,
  START_SPEED,
  MAX_SPEED,
  ACCELERATION,
  LANE_SWITCH_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  FAST_FALL_VELOCITY,
  SLIDE_DURATION,
  JUMP_BUFFER,
  PLAYER,
  OBSTACLES,
  BIT_SPACING,
  BIT_SCORE,
  DISTANCE_SCORE,
  POWERUPS,
  POWERUP_DURATION,
  POWERUP_CHANCE,
  MAGNET_RANGE,
  SPAWN_AHEAD,
  DESPAWN_BEHIND,
  FIRST_ROW_DISTANCE,
  HIT_INVULNERABILITY,
  NEAR_MISS_BONUS,
} from './config.js';
import { createRng } from './rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function createGame({ seed } = {}) {
  const resolvedSeed = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  const game = {
    seed: resolvedSeed,
    rng: createRng(resolvedSeed),
    time: 0,
    distance: 0,
    speed: START_SPEED,
    score: 0,
    bitsCollected: 0,
    clears: 0,
    alive: true,
    player: {
      lane: 1,
      x: LANES[1],
      y: 0,
      vy: 0,
      grounded: true,
      sliding: false,
      slideTimer: 0,
      slideQueued: false,
      jumpBuffer: 0,
      invulnerable: 0,
    },
    powers: { shield: false, magnet: 0, multiplier: 0 },
    obstacles: [],
    bits: [],
    powerups: [],
    rows: [],
    nextRowD: FIRST_ROW_DISTANCE,
    plannedSafeLane: 1,
    laneBlockedUntil: [0, 0, 0],
    nextId: 1,
    queue: [],
    events: [],
  };
  // A friendly line of bits down the middle to start the run.
  for (let d = 14; d < FIRST_ROW_DISTANCE - 6; d += BIT_SPACING) addBit(game, 1, d, 1);
  return game;
}

export function difficulty(game) {
  return clamp((game.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1);
}

export function multiplier(game) {
  return game.powers.multiplier > 0 ? 2 : 1;
}

export function playerHeight(game) {
  return game.player.sliding ? PLAYER.slideHeight : PLAYER.height;
}

/** Queue a player action: 'left' | 'right' | 'jump' | 'slide'. */
export function input(game, action) {
  if (game.alive) game.queue.push(action);
}

export function update(game, dt) {
  game.events = [];
  if (!game.alive) return game.events;
  dt = Math.min(dt, 1 / 20); // never tunnel through obstacles on a hitch

  game.time += dt;
  game.speed = Math.min(MAX_SPEED, game.speed + ACCELERATION * dt);
  const step = game.speed * dt;
  game.distance += step;
  game.score += step * DISTANCE_SCORE * multiplier(game);

  const prevX = game.player.x;
  for (const action of game.queue) applyAction(game, action);
  game.queue.length = 0;

  updatePlayer(game, dt);
  while (game.nextRowD < game.distance + SPAWN_AHEAD) spawnRow(game);
  checkObstacles(game, prevX, step);
  updatePickups(game, dt);
  updatePowers(game, dt);
  despawn(game);
  return game.events;
}

function emit(game, type, data = {}) {
  game.events.push({ type, ...data });
}

function applyAction(game, action) {
  const p = game.player;
  switch (action) {
    case 'left':
    case 'right': {
      const lane = clamp(p.lane + (action === 'left' ? -1 : 1), 0, 2);
      if (lane !== p.lane) {
        p.lane = lane;
        emit(game, 'lane', { lane });
      } else {
        emit(game, 'edge');
      }
      break;
    }
    case 'jump':
      if (p.grounded) startJump(game);
      else p.jumpBuffer = JUMP_BUFFER;
      break;
    case 'slide':
      if (p.grounded) startSlide(game);
      else {
        p.vy = Math.min(p.vy, FAST_FALL_VELOCITY);
        p.slideQueued = true;
        p.jumpBuffer = 0;
      }
      break;
    default:
      break;
  }
}

function startJump(game) {
  const p = game.player;
  p.vy = JUMP_VELOCITY;
  p.grounded = false;
  p.sliding = false;
  p.slideTimer = 0;
  p.slideQueued = false;
  p.jumpBuffer = 0;
  emit(game, 'jump');
}

function startSlide(game) {
  const p = game.player;
  p.sliding = true;
  p.slideTimer = SLIDE_DURATION;
  p.slideQueued = false;
  emit(game, 'slide');
}

function updatePlayer(game, dt) {
  const p = game.player;
  const targetX = LANES[p.lane];
  const dx = targetX - p.x;
  p.x += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SWITCH_SPEED * dt);

  if (!p.grounded) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
      emit(game, 'land');
      if (p.slideQueued) startSlide(game);
      else if (p.jumpBuffer > 0) startJump(game);
    }
  }
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

  if (p.sliding) {
    p.slideTimer -= dt;
    if (p.slideTimer <= 0) p.sliding = false;
  }
  p.invulnerable = Math.max(0, p.invulnerable - dt);
}

// ---------------------------------------------------------------------------
// Track generation. Every row has a "safe lane" that never holds a wall, and
// the safe lane moves by at most one lane between rows, with enough clear
// track after any wall to make the switch. That guarantees a survivable path.

function rowSpacing(game) {
  const diff = difficulty(game);
  const seconds = lerp(1.2, 0.72, diff) * game.rng.range(0.92, 1.2);
  let gap = game.speed * seconds;
  if (game.rng.chance(0.1)) gap += game.speed * 0.9; // occasional breather
  return gap;
}

function spawnRow(game) {
  const { rng } = game;
  const diff = difficulty(game);
  const d = game.nextRowD;
  const safe = game.plannedSafeLane;
  const gap = rowSpacing(game);
  const nextSafe = clamp(safe + rng.pick([-1, 0, 0, 1]), 0, 2);

  const types = [null, null, null];
  types[safe] = rng.chance(0.45 + 0.3 * diff) ? rng.pick(['barrier', 'beam']) : null;
  for (let lane = 0; lane < 3; lane++) {
    if (lane === safe) continue;
    const r = rng.next();
    const pWall = 0.3 + 0.3 * diff;
    if (r < pWall) types[lane] = 'wall';
    else if (r < pWall + 0.2) types[lane] = 'barrier';
    else if (r < pWall + 0.4) types[lane] = 'beam';
  }
  if (types.every((t) => t === null)) types[rng.int(0, 2)] = 'barrier';

  // Walls may stretch into long "data trains", but always end early enough
  // that the player can still reach the next row's safe lane.
  const maxWall = Math.max(OBSTACLES.wall.depth, gap - game.speed * 0.6);
  for (let lane = 0; lane < 3; lane++) {
    const type = types[lane];
    if (!type) continue;
    const def = OBSTACLES[type];
    let length = def.depth;
    if (type === 'wall' && rng.chance(0.35 + 0.3 * diff)) {
      length = Math.min(maxWall, rng.range(8, 22));
    }
    length = Math.max(def.depth, Math.min(length, maxWall));
    game.obstacles.push({
      id: game.nextId++,
      type,
      lane,
      x: LANES[lane],
      d,
      length,
      yMin: def.yMin,
      yMax: def.yMax,
      halfWidth: def.halfWidth,
      hit: false,
      passed: false,
    });
    game.laneBlockedUntil[lane] = Math.max(game.laneBlockedUntil[lane], d + length);
  }
  game.rows.push({ d, safeLane: safe, types });

  // An arc of bits over a jumpable barrier in the safe lane.
  if (types[safe] === 'barrier' && rng.chance(0.5)) {
    [-2.6, 0, 2.6].forEach((off, i) => addBit(game, safe, d + off, i === 1 ? 2.6 : 2.0));
  }

  // Bits / power-up in the gap leading to the next row's safe lane.
  const start = Math.max(d + 3, game.laneBlockedUntil[nextSafe] + 2.5);
  const end = d + gap - 3;
  if (end - start > 4) {
    let powerAt = null;
    if (rng.chance(POWERUP_CHANCE + 0.04 * diff)) {
      powerAt = (start + end) / 2;
      const choices = POWERUPS.filter((t) => !(t === 'shield' && game.powers.shield));
      game.powerups.push({
        id: game.nextId++,
        type: rng.pick(choices),
        lane: nextSafe,
        x: LANES[nextSafe],
        y: 1.1,
        d: powerAt,
      });
    }
    if (rng.chance(0.65)) {
      for (let bd = start; bd <= end; bd += BIT_SPACING) {
        if (powerAt !== null && Math.abs(bd - powerAt) < 3) continue;
        addBit(game, nextSafe, bd, 1);
      }
    }
  }

  game.plannedSafeLane = nextSafe;
  game.nextRowD = d + gap;
}

function addBit(game, lane, d, y) {
  game.bits.push({ id: game.nextId++, lane, x: LANES[lane], y, d, attracted: false, collected: false });
}

// ---------------------------------------------------------------------------
// Collisions.

function overlapsX(px, o) {
  return Math.abs(px - o.x) < PLAYER.halfWidth + o.halfWidth;
}

function overlapsZ(z, halfLen) {
  return Math.abs(z) < halfLen + PLAYER.halfDepth;
}

function checkObstacles(game, prevX, step) {
  const p = game.player;
  const h = playerHeight(game);
  for (const o of game.obstacles) {
    const halfLen = o.length / 2;
    const z = game.distance - (o.d + halfLen);

    if (!o.passed && z - halfLen > PLAYER.halfDepth) {
      o.passed = true;
      if (!o.hit && o.type !== 'wall' && overlapsX(p.x, o)) {
        game.clears += 1;
        game.score += NEAR_MISS_BONUS * multiplier(game);
        emit(game, 'clear', { obstacle: o.type });
      }
    }
    if (o.hit || o.passed) continue;
    if (!overlapsZ(z, halfLen) || !overlapsX(p.x, o)) continue;
    if (!(p.y < o.yMax && p.y + h > o.yMin)) continue;

    // Steering into the side of something is a bump, not a crash: the
    // player bounces back to where they came from.
    const sideHit = overlapsZ(z - step, halfLen) && !overlapsX(prevX, o);
    if (sideHit) {
      const back = clamp(p.lane + (p.x < o.x ? -1 : 1), 0, 2);
      p.lane = back;
      p.x = prevX;
      emit(game, 'bump', { x: p.x });
      continue;
    }
    if (p.invulnerable > 0) continue;
    if (game.powers.shield) {
      game.powers.shield = false;
      p.invulnerable = HIT_INVULNERABILITY;
      o.hit = true;
      emit(game, 'shieldBreak', { x: o.x, y: p.y + h / 2 });
      continue;
    }
    game.alive = false;
    emit(game, 'crash', { x: p.x, y: p.y + h / 2, obstacle: o.type });
    return;
  }
}

function touchesPlayer(game, x, y, d, reach) {
  const p = game.player;
  const h = playerHeight(game);
  return (
    Math.abs(game.distance - d) < PLAYER.halfDepth + reach &&
    Math.abs(x - p.x) < PLAYER.halfWidth + reach &&
    y > p.y - reach &&
    y < p.y + h + reach
  );
}

function updatePickups(game, dt) {
  const p = game.player;
  const magnet = game.powers.magnet > 0;
  for (const b of game.bits) {
    if (b.collected) continue;
    const ahead = b.d - game.distance;
    if (magnet && !b.attracted && ahead < MAGNET_RANGE && ahead > -1) b.attracted = true;
    if (b.attracted) {
      const tx = p.x - b.x;
      const ty = p.y + 0.9 - b.y;
      const td = game.distance - b.d;
      const len = Math.hypot(tx, ty, td);
      const move = (game.speed + 30) * dt;
      if (len <= move + 0.6) {
        collectBit(game, b);
        continue;
      }
      b.x += (tx / len) * move;
      b.y += (ty / len) * move;
      b.d += (td / len) * move;
    }
    if (touchesPlayer(game, b.x, b.y, b.d, 0.45)) collectBit(game, b);
  }
  for (const pu of game.powerups) {
    if (pu.collected) continue;
    if (touchesPlayer(game, pu.x, pu.y, pu.d, 0.6)) {
      pu.collected = true;
      if (pu.type === 'shield') game.powers.shield = true;
      else game.powers[pu.type] = POWERUP_DURATION[pu.type];
      emit(game, 'powerup', { power: pu.type, x: pu.x, y: pu.y });
    }
  }
}

function collectBit(game, b) {
  b.collected = true;
  game.bitsCollected += 1;
  game.score += BIT_SCORE * multiplier(game);
  emit(game, 'collect', { x: b.x, y: b.y });
}

function updatePowers(game, dt) {
  for (const key of ['magnet', 'multiplier']) {
    if (game.powers[key] > 0) {
      game.powers[key] = Math.max(0, game.powers[key] - dt);
      if (game.powers[key] === 0) emit(game, 'powerEnd', { power: key });
    }
  }
}

function despawn(game) {
  const limit = game.distance - DESPAWN_BEHIND;
  game.obstacles = game.obstacles.filter((o) => o.d + o.length > limit);
  game.bits = game.bits.filter((b) => !b.collected && b.d > limit);
  game.powerups = game.powerups.filter((p) => !p.collected && p.d > limit);
  game.rows = game.rows.filter((r) => r.d > limit - 40);
}
