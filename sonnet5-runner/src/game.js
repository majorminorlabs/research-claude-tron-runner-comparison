import {
  LANES,
  OBSTACLE_TYPES,
  REWARD_TYPES,
  PLAYER_ACTIONS,
  JUMP_DURATION,
  SLIDE_DURATION,
  generateRow,
  resolveObstacleHit,
  canCollectReward,
  rewardValue,
  currentSpeed,
  clampLane,
  advanceZ,
  isInHitWindow,
  shouldRemoveRow,
  distanceScore,
} from './logic.js';

const HIGH_SCORE_KEY = 'tron-runner-best';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hud = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  speed: document.getElementById('speed'),
};
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const overlayButton = document.getElementById('overlay-button');

let W = 0;
let H = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// World / perspective projection
// ---------------------------------------------------------------------------
// z: 1 = spawn point (far horizon), 0 = player plane (near bottom of screen).
// We project z -> screen Y and a per-lane screen X using a simple perspective lerp.

function horizonY() {
  return H * 0.32;
}
function groundY() {
  return H * 0.92;
}
function vanishX() {
  return W / 2;
}
function laneGroundX(lane) {
  const spread = W * 0.78;
  const left = W / 2 - spread / 2;
  const laneWidth = spread / LANES;
  return left + laneWidth * (lane + 0.5);
}
function projectT(z) {
  // t=0 far, t=1 near. Ease so things near the player grow/move fast (perspective feel).
  const t = clamp01(1 - z);
  return t;
}
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
function screenY(z) {
  const t = projectT(z);
  return horizonY() + (groundY() - horizonY()) * Math.pow(t, 1.8);
}
function screenX(lane, z) {
  const t = projectT(z);
  return vanishX() + (laneGroundX(lane) - vanishX()) * Math.pow(t, 1.15);
}
function scaleAt(z) {
  const t = projectT(z);
  return 0.12 + 0.88 * Math.pow(t, 1.3);
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

const SPAWN_INTERVAL = 0.85; // seconds of world-time between spawn rows at base speed
const SPAWN_Z = 1.0;
const PLAYER_GROUND_Z = 0;

function freshState() {
  return {
    mode: 'start', // 'start' | 'playing' | 'paused' | 'gameover'
    elapsed: 0,
    distance: 0,
    score: 0,
    scoreBonus: 0,
    best: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
    lane: 1,
    targetLane: 1,
    laneAnim: 0, // 0..1 progress of current lane change tween
    fromLane: 1,
    action: PLAYER_ACTIONS.RUN,
    actionTimer: 0,
    rows: [], // active spawned rows: {z, obstacles[], rewards[], resolved[]}
    spawnClock: 0,
    particles: [],
    shake: 0,
    comboFlash: 0,
    gridScroll: 0,
  };
}

let state = freshState();
let rand = Math.random;

function resetRun() {
  const best = state.best;
  state = freshState();
  state.best = best;
  state.mode = 'playing';
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function tryMoveLane(delta) {
  if (state.mode !== 'playing') return;
  const next = clampLane(state.lane + delta);
  if (next === state.lane) return;
  state.fromLane = state.lane;
  state.lane = next;
  state.laneAnim = 0;
}

function tryJump() {
  if (state.mode !== 'playing') return;
  if (state.action === PLAYER_ACTIONS.JUMP) return;
  state.action = PLAYER_ACTIONS.JUMP;
  state.actionTimer = JUMP_DURATION;
}

function trySlide() {
  if (state.mode !== 'playing') return;
  if (state.action === PLAYER_ACTIONS.SLIDE) return;
  state.action = PLAYER_ACTIONS.SLIDE;
  state.actionTimer = SLIDE_DURATION;
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    showOverlay('PAUSED', 'Press P or Esc to resume', 'Resume');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    hideOverlay();
  }
}

function handleStartAction() {
  if (state.mode === 'start' || state.mode === 'gameover') {
    resetRun();
    hideOverlay();
  } else if (state.mode === 'paused') {
    togglePause();
  }
}

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      e.preventDefault();
      if (state.mode === 'start' || state.mode === 'gameover') handleStartAction();
      else tryMoveLane(-1);
      break;
    case 'ArrowRight':
    case 'KeyD':
      e.preventDefault();
      if (state.mode === 'start' || state.mode === 'gameover') handleStartAction();
      else tryMoveLane(1);
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      e.preventDefault();
      if (state.mode === 'start' || state.mode === 'gameover') handleStartAction();
      else tryJump();
      break;
    case 'ArrowDown':
    case 'KeyS':
      e.preventDefault();
      if (state.mode === 'start' || state.mode === 'gameover') handleStartAction();
      else trySlide();
      break;
    case 'KeyP':
    case 'Escape':
      e.preventDefault();
      togglePause();
      break;
    case 'Enter':
      handleStartAction();
      break;
  }
});

overlayButton.addEventListener('click', () => handleStartAction());

// Touch / swipe controls
let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;
canvas.addEventListener('touchstart', (e) => {
  if (state.mode !== 'playing') {
    handleStartAction();
    return;
  }
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchActive = true;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!touchActive) return;
  touchActive = false;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const SWIPE_MIN = 24;
  if (absX < SWIPE_MIN && absY < SWIPE_MIN) {
    tryJump(); // tap = jump
    return;
  }
  if (absX > absY) {
    tryMoveLane(dx > 0 ? 1 : -1);
  } else if (dy < 0) {
    tryJump();
  } else {
    trySlide();
  }
}, { passive: true });

document.getElementById('btn-left').addEventListener('click', () => {
  if (state.mode === 'playing') tryMoveLane(-1); else handleStartAction();
});
document.getElementById('btn-right').addEventListener('click', () => {
  if (state.mode === 'playing') tryMoveLane(1); else handleStartAction();
});
document.getElementById('btn-jump').addEventListener('click', () => {
  if (state.mode === 'playing') tryJump(); else handleStartAction();
});
document.getElementById('btn-slide').addEventListener('click', () => {
  if (state.mode === 'playing') trySlide(); else handleStartAction();
});

// ---------------------------------------------------------------------------
// Overlay helpers
// ---------------------------------------------------------------------------

function showOverlay(title, body, buttonLabel) {
  overlayTitle.textContent = title;
  overlayBody.innerHTML = body;
  overlayButton.textContent = buttonLabel;
  overlay.classList.remove('hidden');
}
function hideOverlay() {
  overlay.classList.add('hidden');
}

showOverlay(
  'TRON RUNNER',
  'Dodge <b>&larr; &rarr;</b> &nbsp; Jump <b>&uarr;</b> &nbsp; Slide <b>&darr;</b><br>Survive the grid. Collect energy. Beat your best.',
  'Start Run',
);

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (rand() - 0.5) * 220,
      vy: (rand() - 0.5) * 220 - 40,
      life: 0.5 + rand() * 0.4,
      age: 0,
      color,
    });
  }
}

function endRun() {
  state.mode = 'gameover';
  state.shake = 0.4;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(state.best));
    showOverlay('GRID FAILURE', `New best: <b>${state.best}</b><br>Distance ${distanceScore(state.distance)}m`, 'Run Again');
  } else {
    showOverlay('GRID FAILURE', `Score ${state.score} &middot; Best ${state.best}<br>Distance ${distanceScore(state.distance)}m`, 'Run Again');
  }
}

function update(dt) {
  state.gridScroll += dt;

  if (state.mode !== 'playing') {
    updateParticles(dt);
    return;
  }

  state.elapsed += dt;
  const speed = currentSpeed(state.elapsed);
  state.distance += speed * dt * 40;
  state.score = distanceScore(state.distance) + state.scoreBonus;

  // lane tween
  if (state.laneAnim < 1) {
    state.laneAnim = Math.min(1, state.laneAnim + dt * 8);
  }

  // action timer
  if (state.actionTimer > 0) {
    state.actionTimer -= dt;
    if (state.actionTimer <= 0) {
      state.actionTimer = 0;
      state.action = PLAYER_ACTIONS.RUN;
    }
  }

  // spawn rows
  state.spawnClock -= dt * (speed / 0.42);
  if (state.spawnClock <= 0) {
    state.spawnClock = SPAWN_INTERVAL;
    const row = generateRow(rand);
    state.rows.push({
      z: SPAWN_Z,
      obstacles: row.obstacles,
      rewards: row.rewards,
      resolved: [false, false, false],
      rewardResolved: [false, false, false],
    });
  }

  // advance rows, resolve collisions / pickups
  for (const row of state.rows) {
    row.z = advanceZ(row.z, speed, dt);

    if (isInHitWindow(row.z)) {
      for (let lane = 0; lane < LANES; lane++) {
        if (row.resolved[lane]) continue;
        if (row.obstacles[lane] === OBSTACLE_TYPES.NONE) continue;
        if (lane !== state.lane) continue;
        row.resolved[lane] = true;
        const hit = resolveObstacleHit(state.lane, state.action, lane, row.obstacles[lane]);
        if (hit) {
          spawnParticles(screenX(lane, 0), screenY(0) - 40, '#ff2d6e', 26);
          endRun();
          return;
        } else {
          spawnParticles(screenX(lane, 0), screenY(0) - 20, '#2df8ff', 8);
        }
      }
      for (let lane = 0; lane < LANES; lane++) {
        if (row.rewardResolved[lane]) continue;
        if (!row.rewards[lane]) continue;
        if (lane !== state.lane) continue;
        if (canCollectReward(state.lane, lane, row.rewards[lane])) {
          row.rewardResolved[lane] = true;
          state.scoreBonus = (state.scoreBonus || 0) + rewardValue(row.rewards[lane]);
          state.comboFlash = 0.25;
          const color = row.rewards[lane] === REWARD_TYPES.BONUS ? '#ffe700' : '#2df8ff';
          spawnParticles(screenX(lane, 0), screenY(0) - 30, color, 14);
        }
      }
    }
  }
  state.rows = state.rows.filter((row) => !shouldRemoveRow(row.z));

  if (state.comboFlash > 0) state.comboFlash = Math.max(0, state.comboFlash - dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

  updateParticles(dt);

  hud.score.textContent = String(state.score);
  hud.best.textContent = String(state.best);
  hud.speed.textContent = `${Math.round((speed / 0.42) * 100)}%`;
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
  }
  state.particles = state.particles.filter((p) => p.age < p.life);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function drawGrid() {
  const hy = horizonY();
  const gy = groundY();
  ctx.save();
  ctx.strokeStyle = 'rgba(45, 248, 255, 0.55)';
  ctx.lineWidth = 1;

  // horizon glow band
  const grad = ctx.createLinearGradient(0, hy - 60, 0, hy + 20);
  grad.addColorStop(0, 'rgba(45,248,255,0)');
  grad.addColorStop(1, 'rgba(45,248,255,0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, hy - 60, W, 80);

  // converging lane lines (including outer road edges)
  for (let lane = 0; lane <= LANES; lane++) {
    const groundLaneX = (() => {
      const spread = W * 0.78;
      const left = W / 2 - spread / 2;
      const laneWidth = spread / LANES;
      return left + laneWidth * lane;
    })();
    ctx.beginPath();
    ctx.moveTo(vanishX(), hy);
    ctx.lineTo(W / 2 + (groundLaneX - W / 2) * 1.0, gy);
    ctx.strokeStyle = 'rgba(45,248,255,0.35)';
    ctx.stroke();
  }

  // horizontal rungs scrolling toward the player
  const rungCount = 14;
  for (let i = 0; i < rungCount; i++) {
    const phase = ((i / rungCount) + (state.gridScroll * (0.25 + currentSpeed(state.elapsed))) % 1) % 1;
    const z = 1 - phase;
    const y = screenY(z);
    const xLeft = screenX(-0.02, z);
    const xRight = screenX(LANES + 0.02, z);
    const alpha = 0.08 + 0.35 * projectT(z);
    ctx.strokeStyle = `rgba(45,248,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 1 + projectT(z) * 1.5;
    ctx.beginPath();
    ctx.moveTo(xLeft, y);
    ctx.lineTo(xRight, y);
    ctx.stroke();
  }
  ctx.restore();
}

function glowRect(x, y, w, h, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

function laneCurrentX() {
  const a = screenX(state.fromLane, 0);
  const b = screenX(state.lane, 0);
  const e = easeOutCubic(state.laneAnim);
  return a + (b - a) * e;
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawPlayer() {
  const baseY = screenY(0);
  const x = laneCurrentX();
  let y = baseY;
  let squashX = 1;
  let squashY = 1;

  if (state.action === PLAYER_ACTIONS.JUMP) {
    const t = 1 - state.actionTimer / JUMP_DURATION;
    const arc = Math.sin(Math.min(1, t) * Math.PI);
    y = baseY - arc * 95;
    squashY = 1 - arc * 0.15;
    squashX = 1 + arc * 0.1;
  } else if (state.action === PLAYER_ACTIONS.SLIDE) {
    squashY = 0.5;
    squashX = 1.25;
    y = baseY - 6;
  }

  // trail
  for (let i = 1; i <= 5; i++) {
    const a = 0.16 - i * 0.025;
    if (a <= 0) continue;
    glowRect(x, y + i * 7, 34 * squashX, 10 * squashY, `rgba(45,248,255,${a})`, 10);
  }

  // body
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = '#4bf7ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#bffcff';
  const w = 36 * squashX;
  const h = 52 * squashY;
  roundRect(-w / 2, -h, w, h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a2a30';
  roundRect(-w / 2 + 6, -h + 10, w - 12, h * 0.35, 5);
  ctx.fill();
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawObstacle(lane, type, z) {
  const x = screenX(lane, z);
  const y = screenY(z);
  const s = scaleAt(z);
  if (type === OBSTACLE_TYPES.LOW) {
    glowRect(x, y - 14 * s, 70 * s, 28 * s, '#ff9500', 18 * s + 4);
  } else if (type === OBSTACLE_TYPES.HIGH) {
    glowRect(x, y - 95 * s, 70 * s, 22 * s, '#ff2d6e', 18 * s + 4);
    ctx.save();
    ctx.strokeStyle = `rgba(255,45,110,${0.5 * s})`;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, y);
    ctx.lineTo(x - 30 * s, y - 95 * s);
    ctx.moveTo(x + 30 * s, y);
    ctx.lineTo(x + 30 * s, y - 95 * s);
    ctx.stroke();
    ctx.restore();
  } else if (type === OBSTACLE_TYPES.BLOCK) {
    glowRect(x, y - 60 * s, 76 * s, 120 * s, '#ff2d6e', 24 * s + 4);
  }
}

function drawReward(lane, type, z) {
  const x = screenX(lane, z);
  const y = screenY(z) - 50 * scaleAt(z);
  const s = scaleAt(z);
  const pulse = 0.75 + 0.25 * Math.sin(state.gridScroll * 6 + lane);
  const color = type === REWARD_TYPES.BONUS ? '#ffe700' : '#2df8ff';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(state.gridScroll * 2 + lane);
  ctx.shadowColor = color;
  ctx.shadowBlur = (16 + 10 * pulse) * s;
  ctx.fillStyle = color;
  const size = (type === REWARD_TYPES.BONUS ? 20 : 14) * s * pulse;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    const a = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function render() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((rand() - 0.5) * state.shake * 24, (rand() - 0.5) * state.shake * 24);
  }

  ctx.fillStyle = '#01050a';
  ctx.fillRect(0, 0, W, H);

  drawGrid();

  // sort far-to-near so closer things draw on top
  const drawables = [];
  for (const row of state.rows) {
    for (let lane = 0; lane < LANES; lane++) {
      if (row.obstacles[lane] !== OBSTACLE_TYPES.NONE && row.z <= 1.02) {
        drawables.push({ z: row.z, draw: () => drawObstacle(lane, row.obstacles[lane], row.z) });
      }
      if (row.rewards[lane] && !row.rewardResolved[lane]) {
        drawables.push({ z: row.z, draw: () => drawReward(lane, row.rewards[lane], row.z) });
      }
    }
  }
  drawables.sort((a, b) => b.z - a.z);
  for (const d of drawables) d.draw();

  drawPlayer();
  drawParticles();

  if (state.comboFlash > 0) {
    ctx.fillStyle = `rgba(45,248,255,${state.comboFlash * 0.12})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

resize();
hud.best.textContent = String(state.best);
requestAnimationFrame(loop);

// Expose a tiny debug/test hook (not used by the pure logic tests, but handy
// for manual console inspection while developing).
window.__tronRunnerDebug = { getState: () => state };
