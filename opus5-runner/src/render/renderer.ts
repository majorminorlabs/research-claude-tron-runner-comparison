import * as C from '../core/constants';
import type { Game } from '../core/game';
import { Rng } from '../core/rng';
import type { GameEvent, Lane, Obstacle, Pickup } from '../core/types';
import type { Camera } from './camera';
import { createCamera, fitCamera, project } from './camera';
import { PALETTE, rgba } from './palette';
import { Particles } from './particles';

/** Visual half-width of a hazard. Slightly wider than its hitbox, which reads
 *  as "filling the lane" while staying forgiving. */
const HAZARD_HALF_W = 1.1;
const HAZARD_HALF_D = 0.55;
const TRACK_HALF_W = C.LANE_WIDTH * 1.5;
const FAR_Z = 240;
/** Spacing of the transverse floor lines. */
const GRID_SPACING = 9;
/** How far back the light ribbon is drawn, in world units. */
const TRAIL_LENGTH = 11;

interface Building {
  x: number;
  w: number;
  h: number;
  lit: number;
}

interface TrailPoint {
  x: number;
  y: number;
  z: number;
}

export class Renderer {
  readonly cam: Camera = createCamera();
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private particles = new Particles();
  private rng = new Rng(0x5eed);
  private random = (): number => this.rng.next();

  private skyline: Building[] = [];
  private trail: TrailPoint[] = [];
  private time = 0;
  private shake = 0;
  private hitFlash = 0;
  private collectFlash = 0;
  private lastDistance = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.buildSkyline();
    this.resize();
  }

  private buildSkyline(): void {
    const rng = new Rng(0xb10c);
    this.skyline = [];
    for (let i = 0; i < 90; i++) {
      this.skyline.push({
        x: rng.range(-1.1, 1.1),
        w: rng.range(0.012, 0.055),
        h: rng.range(0.02, 0.17),
        lit: rng.next(),
      });
    }
    this.skyline.sort((a, b) => b.h - a.h);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    fitCamera(this.cam, w, h);
  }

  reset(): void {
    this.particles.clear();
    this.trail.length = 0;
    this.shake = 0;
    this.hitFlash = 0;
    this.collectFlash = 0;
    this.lastDistance = 0;
  }

  /** Turns a simulation event into sparks, shake and flashes. */
  handleEvent(e: GameEvent, game: Game): void {
    const px = game.player.x;
    switch (e.type) {
      case 'orb':
        this.particles.burst(laneCenter(e.lane), e.y, 0.4, PALETTE.cyan, 14, 5, this.random);
        this.collectFlash = Math.min(1, this.collectFlash + 0.35);
        break;
      case 'shield':
        this.particles.burst(px, 1.2, 0.4, PALETTE.shield, 26, 6, this.random);
        break;
      case 'boost':
        this.particles.burst(px, 1.0, 0.4, PALETTE.boost, 34, 8, this.random);
        break;
      case 'hit':
        this.particles.burst(laneCenter(e.lane), 1.1, 0.5, PALETTE.danger, 42, 9, this.random);
        this.shake = 1;
        this.hitFlash = 1;
        break;
      case 'shieldBreak':
        this.particles.burst(px, 1.2, 0.4, PALETTE.shield, 40, 9, this.random);
        this.shake = 0.6;
        break;
      case 'land':
        this.particles.burst(px, 0.08, 0.2, PALETTE.cyanSoft, 8, 3, this.random);
        break;
      case 'death':
        this.particles.burst(px, 1.1, 0.4, PALETTE.danger, 90, 13, this.random);
        this.shake = 1.4;
        this.hitFlash = 1;
        break;
      default:
        break;
    }
  }

  render(game: Game, dt: number): void {
    const travel = Math.max(0, game.distance - this.lastDistance);
    this.lastDistance = game.distance;
    this.time += dt;

    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.4);
    this.collectFlash = Math.max(0, this.collectFlash - dt * 3.2);
    this.particles.update(dt, travel);

    const p = game.player;
    // Lean the camera toward the player, but only part of the way: the track
    // should still visibly slide sideways when you change lanes.
    this.cam.offsetX += (p.x * 0.55 - this.cam.offsetX) * Math.min(1, dt * 9);
    const s = this.shake * this.shake * 14;
    this.cam.shakeX = (this.random() - 0.5) * s;
    this.cam.shakeY = (this.random() - 0.5) * s;

    this.updateTrail(p.x, p.y, travel);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawSky(game);
    this.drawFloor(game);
    this.drawRails(game);
    this.drawEntities(game);
    this.particles.draw(ctx, this.cam);
    this.drawPlayer(game);
    this.drawPostEffects(game);
  }

  // --- background ---------------------------------------------------------

  private drawSky(game: Game): void {
    const { ctx, width, height } = this;
    const horizon = this.cam.cy + this.cam.shakeY;

    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    sky.addColorStop(0, PALETTE.void);
    sky.addColorStop(0.7, PALETTE.deep);
    sky.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, Math.max(0, horizon));

    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, '#05121e');
    ground.addColorStop(1, PALETTE.void);
    ctx.fillStyle = ground;
    ctx.fillRect(0, Math.max(0, horizon), width, height - horizon);

    // Glow pooling on the horizon, brighter when boosting.
    const glow = ctx.createRadialGradient(
      this.cam.cx - this.cam.offsetX * 18,
      horizon,
      0,
      this.cam.cx - this.cam.offsetX * 18,
      horizon,
      width * 0.62,
    );
    const heat = game.boosting ? 0.5 : 0.3;
    glow.addColorStop(0, rgba(game.boosting ? PALETTE.boost : PALETTE.gridBright, heat));
    glow.addColorStop(0.45, rgba(PALETTE.gridBright, 0.08));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    this.drawSkyline(horizon);
  }

  private drawSkyline(horizon: number): void {
    const { ctx, width, height } = this;
    const band = height * 0.5;
    const parallax = -this.cam.offsetX * 24;
    ctx.save();
    for (const b of this.skyline) {
      const x = this.cam.cx + b.x * width * 0.95 + parallax;
      const w = b.w * width;
      const h = b.h * band;
      ctx.fillStyle = '#030a12';
      ctx.fillRect(x - w / 2, horizon - h, w, h);
      ctx.strokeStyle = rgba(PALETTE.grid, 0.5 + b.lit * 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, horizon - h);
      ctx.lineTo(x + w / 2, horizon - h);
      ctx.stroke();
      // A single lit window strip, flickering slowly.
      const pulse = 0.25 + 0.25 * Math.sin(this.time * 0.8 + b.lit * 20);
      ctx.strokeStyle = rgba(PALETTE.cyan, pulse * b.lit);
      ctx.beginPath();
      ctx.moveTo(x, horizon - h * 0.9);
      ctx.lineTo(x, horizon - h * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- floor -------------------------------------------------------------

  private drawFloor(game: Game): void {
    const ctx = this.ctx;

    // Lane beds, as one trapezoid per lane.
    for (let lane = 0 as Lane; lane < C.LANE_COUNT; lane = (lane + 1) as Lane) {
      const cx = laneCenter(lane);
      const half = C.LANE_WIDTH / 2;
      const quad = this.floorQuad(cx - half, cx + half, -6, FAR_Z);
      if (!quad) continue;
      const g = ctx.createLinearGradient(0, this.cam.cy, 0, this.height);
      const tint = lane === game.player.lane ? 0.2 : 0.1;
      g.addColorStop(0, rgba(PALETTE.gridBright, 0.02));
      g.addColorStop(1, rgba(PALETTE.gridBright, tint));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(quad[0], quad[1]);
      ctx.lineTo(quad[2], quad[3]);
      ctx.lineTo(quad[4], quad[5]);
      ctx.lineTo(quad[6], quad[7]);
      ctx.closePath();
      ctx.fill();
    }

    // Transverse lines streaming toward the camera; these carry the speed read.
    const start = Math.floor((game.distance - 8) / GRID_SPACING) * GRID_SPACING;
    for (let i = 0; i < 60; i++) {
      const worldZ = start + i * GRID_SPACING;
      const z = worldZ - game.distance;
      if (z > FAR_Z) break;
      const a = this.project(-TRACK_HALF_W, 0, z);
      const b = this.project(TRACK_HALF_W, 0, z);
      if (!a.visible || !b.visible) continue;
      const fade = Math.max(0, 1 - z / FAR_Z);
      ctx.strokeStyle = rgba(PALETTE.gridBright, 0.08 + fade * 0.5);
      ctx.lineWidth = Math.max(0.6, fade * 2.4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Lane dividers and track edges.
    const xs = [-TRACK_HALF_W, -C.LANE_WIDTH / 2, C.LANE_WIDTH / 2, TRACK_HALF_W];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i] as number;
      const edge = i === 0 || i === xs.length - 1;
      this.glowLine(
        x,
        0,
        -6,
        x,
        0,
        FAR_Z,
        edge ? PALETTE.cyan : PALETTE.gridBright,
        edge ? 3 : 1.6,
        edge ? 18 : 8,
      );
    }
  }

  /** Screen-space quad for a floor strip between two X values over a Z span. */
  private floorQuad(
    x0: number,
    x1: number,
    zNear: number,
    zFar: number,
  ): [number, number, number, number, number, number, number, number] | null {
    const a = this.project(x0, 0, zNear);
    const b = this.project(x1, 0, zNear);
    const c = this.project(x1, 0, zFar);
    const d = this.project(x0, 0, zFar);
    if (!a.visible || !b.visible || !c.visible || !d.visible) return null;
    return [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
  }

  /** Vertical light walls flanking the track. */
  private drawRails(game: Game): void {
    const ctx = this.ctx;
    const wallH = 5.2;
    for (const side of [-1, 1]) {
      const x = side * TRACK_HALF_W;
      const near = this.project(x, 0, -6);
      const nearTop = this.project(x, wallH, -6);
      const far = this.project(x, 0, FAR_Z);
      const farTop = this.project(x, wallH, FAR_Z);
      if (!near.visible || !far.visible) continue;
      const g = ctx.createLinearGradient(near.x, nearTop.y, near.x, near.y);
      g.addColorStop(0, rgba(PALETTE.cyan, 0.0));
      g.addColorStop(1, rgba(PALETTE.cyan, 0.16));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(nearTop.x, nearTop.y);
      ctx.lineTo(farTop.x, farTop.y);
      ctx.lineTo(far.x, far.y);
      ctx.closePath();
      ctx.fill();

      // Pulses running down the wall, faster the quicker you go.
      const speedPhase = (this.time * game.speed) / 26;
      for (let i = 0; i < 9; i++) {
        const t = ((i / 9 + speedPhase) % 1) ** 2.4;
        const z = -6 + t * FAR_Z;
        const p0 = this.project(x, 0.4, z);
        const p1 = this.project(x, wallH * 0.8, z);
        if (!p0.visible || !p1.visible) continue;
        ctx.strokeStyle = rgba(PALETTE.cyanSoft, 0.35 * (1 - t));
        ctx.lineWidth = Math.max(0.5, 2 * (1 - t));
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
  }

  // --- entities ----------------------------------------------------------

  private drawEntities(game: Game): void {
    type Item =
      | { z: number; kind: 'obstacle'; o: Obstacle }
      | { z: number; kind: 'pickup'; p: Pickup };
    const items: Item[] = [];
    for (const o of game.obstacles) {
      const z = o.z - game.distance;
      if (z < -5 || z > FAR_Z) continue;
      items.push({ z, kind: 'obstacle', o });
    }
    for (const p of game.pickups) {
      if (p.taken) continue;
      const z = p.z - game.distance;
      if (z < -5 || z > FAR_Z) continue;
      items.push({ z, kind: 'pickup', p });
    }
    // Painter's algorithm: far things first.
    items.sort((a, b) => b.z - a.z);
    for (const item of items) {
      if (item.kind === 'obstacle') this.drawObstacle(item.o, item.z);
      else this.drawPickup(item.p, item.z);
    }
  }

  private drawObstacle(o: Obstacle, z: number): void {
    const x = laneCenter(o.lane);
    const fade = Math.max(0.08, 1 - z / FAR_Z);
    const tint =
      o.kind === 'barrier' ? PALETTE.amber : o.kind === 'beam' ? PALETTE.violet : PALETTE.danger;
    this.drawHazardFloor(x, z, tint, fade);
    switch (o.kind) {
      case 'barrier':
        this.drawBox(x, o.bottom, o.top, z, HAZARD_HALF_W, HAZARD_HALF_D, PALETTE.amber, fade);
        this.drawChevrons(x, o.top, z, PALETTE.amberSoft, fade, 1);
        break;
      case 'beam':
        this.drawBox(x, o.bottom, o.top, z, HAZARD_HALF_W, HAZARD_HALF_D, PALETTE.violet, fade);
        this.drawChevrons(x, o.bottom, z, PALETTE.violet, fade, -1);
        break;
      case 'block':
        this.drawBox(x, o.bottom, o.top, z, HAZARD_HALF_W, HAZARD_HALF_D, PALETTE.danger, fade);
        this.drawCross(x, o.bottom, o.top, z, fade);
        break;
    }
  }

  /** A patch of lit floor under a hazard: the first thing you read at range. */
  private drawHazardFloor(x: number, z: number, color: string, fade: number): void {
    const ctx = this.ctx;
    const half = C.LANE_WIDTH / 2 - 0.08;
    const a = this.project(x - half, 0.01, z - 2.6);
    const b = this.project(x + half, 0.01, z - 2.6);
    const c = this.project(x + half, 0.01, z + 1.2);
    const d = this.project(x - half, 0.01, z + 1.2);
    if (!a.visible || !b.visible || !c.visible || !d.visible) return;
    const g = ctx.createLinearGradient(0, a.y, 0, d.y);
    g.addColorStop(0, rgba(color, 0.02 * fade));
    g.addColorStop(1, rgba(color, 0.3 * fade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }

  /** A glowing wireframe box: back face, connecting edges, then bright front. */
  private drawBox(
    x: number,
    bottom: number,
    top: number,
    z: number,
    halfW: number,
    halfD: number,
    color: string,
    fade: number,
  ): void {
    const ctx = this.ctx;
    const zf = z - halfD;
    const zb = z + halfD;
    const fl = this.project(x - halfW, bottom, zf);
    const fr = this.project(x + halfW, bottom, zf);
    const ftr = this.project(x + halfW, top, zf);
    const ftl = this.project(x - halfW, top, zf);
    const bl = this.project(x - halfW, bottom, zb);
    const br = this.project(x + halfW, bottom, zb);
    const btr = this.project(x + halfW, top, zb);
    const btl = this.project(x - halfW, top, zb);
    if (!bl.visible || !br.visible) return;

    if (fl.visible && fr.visible) {
      // Side faces, as the connective tissue that makes it read as solid.
      ctx.fillStyle = rgba(color, 0.1 * fade);
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.lineTo(btl.x, btl.y);
      ctx.lineTo(ftl.x, ftl.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fr.x, fr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(btr.x, btr.y);
      ctx.lineTo(ftr.x, ftr.y);
      ctx.closePath();
      ctx.fill();
    }

    // Back face outline, dimmer.
    ctx.strokeStyle = rgba(color, 0.35 * fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(btr.x, btr.y);
    ctx.lineTo(btl.x, btl.y);
    ctx.closePath();
    ctx.stroke();

    if (!fl.visible || !fr.visible) return;

    const g = ctx.createLinearGradient(0, ftl.y, 0, fl.y);
    g.addColorStop(0, rgba(color, 0.08 * fade));
    g.addColorStop(1, rgba(color, 0.42 * fade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(ftr.x, ftr.y);
    ctx.lineTo(ftl.x, ftl.y);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.shadowColor = rgba(color, 0.9 * fade);
    ctx.shadowBlur = 16 * fade;
    ctx.strokeStyle = rgba(PALETTE.white, 0.85 * fade);
    ctx.lineWidth = Math.max(1, 2.2 * fade);
    ctx.stroke();
    ctx.restore();
  }

  /** Direction hint: chevrons pointing the way you must move. */
  private drawChevrons(x: number, y: number, z: number, color: string, fade: number, dir: 1 | -1): void {
    const ctx = this.ctx;
    const t = (this.time * 1.6) % 1;
    for (let i = 0; i < 2; i++) {
      const off = ((i + t) / 2) * 0.55 * dir;
      const a = this.project(x - 0.55, y + 0.14 + off, z - HAZARD_HALF_D - 0.02);
      const b = this.project(x, y + 0.38 * dir + 0.14 + off, z - HAZARD_HALF_D - 0.02);
      const c = this.project(x + 0.55, y + 0.14 + off, z - HAZARD_HALF_D - 0.02);
      if (!a.visible || !b.visible || !c.visible) continue;
      ctx.strokeStyle = rgba(color, 0.55 * fade * (1 - i * 0.4));
      ctx.lineWidth = Math.max(0.8, 2 * fade);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }

  /** The "do not pass" X on a full-height block. */
  private drawCross(x: number, bottom: number, top: number, z: number, fade: number): void {
    const ctx = this.ctx;
    const zf = z - HAZARD_HALF_D - 0.02;
    const a = this.project(x - HAZARD_HALF_W * 0.7, bottom + 0.4, zf);
    const b = this.project(x + HAZARD_HALF_W * 0.7, top - 0.4, zf);
    const c = this.project(x + HAZARD_HALF_W * 0.7, bottom + 0.4, zf);
    const d = this.project(x - HAZARD_HALF_W * 0.7, top - 0.4, zf);
    if (!a.visible || !b.visible || !c.visible || !d.visible) return;
    ctx.strokeStyle = rgba(PALETTE.danger, 0.5 * fade);
    ctx.lineWidth = Math.max(0.8, 2 * fade);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  private drawPickup(p: Pickup, z: number): void {
    const ctx = this.ctx;
    const x = laneCenter(p.lane);
    const bob = Math.sin(this.time * 3 + p.id) * 0.1;
    const q = this.project(x, p.y + bob, z);
    if (!q.visible) return;
    const fade = Math.max(0.1, 1 - z / FAR_Z);
    const spin = this.time * 2.2 + p.id;

    if (p.kind === 'orb') {
      const r = Math.max(1.5, C.ORB_RADIUS * 0.52 * q.scale);
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2.4);
      g.addColorStop(0, rgba(PALETTE.white, 0.95 * fade));
      g.addColorStop(0.35, rgba(PALETTE.cyan, 0.7 * fade));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(PALETTE.cyanSoft, 0.9 * fade);
      ctx.lineWidth = Math.max(0.8, r * 0.22);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, r, r * (0.35 + 0.55 * Math.abs(Math.cos(spin))), 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const color = p.kind === 'shield' ? PALETTE.shield : PALETTE.boost;
    const r = Math.max(2, 0.6 * q.scale);
    ctx.save();
    ctx.shadowColor = rgba(color, 0.9 * fade);
    ctx.shadowBlur = 20 * fade;
    ctx.strokeStyle = rgba(color, 0.95 * fade);
    ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.beginPath();
    if (p.kind === 'shield') {
      for (let i = 0; i < 6; i++) {
        const a = spin + (i / 6) * Math.PI * 2;
        const px = q.x + Math.cos(a) * r;
        const py = q.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(q.x - r * 0.8, q.y + r * 0.7);
      ctx.lineTo(q.x, q.y - r * 0.9);
      ctx.lineTo(q.x + r * 0.8, q.y + r * 0.7);
      ctx.moveTo(q.x - r * 0.8, q.y + r * 1.25);
      ctx.lineTo(q.x, q.y - r * 0.35);
      ctx.lineTo(q.x + r * 0.8, q.y + r * 1.25);
    }
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.2 * fade);
    ctx.fill();
    ctx.restore();
  }

  // --- player ------------------------------------------------------------

  private updateTrail(x: number, y: number, travel: number): void {
    for (const t of this.trail) t.z -= travel;
    this.trail.push({ x, y, z: 0 });
    while (this.trail.length > 0 && (this.trail[0] as TrailPoint).z < -TRAIL_LENGTH) {
      this.trail.shift();
    }
    if (this.trail.length > 240) this.trail.shift();
  }

  private drawPlayer(game: Game): void {
    const ctx = this.ctx;
    const p = game.player;
    const blink = game.invulnerable && Math.floor(this.time * 14) % 2 === 0;
    const alpha = blink ? 0.3 : 1;
    const color = game.hasShield ? PALETTE.shield : game.boosting ? PALETTE.boost : PALETTE.cyan;

    this.drawTrail(game);
    this.drawCycleShadow(p.x, p.y);

    // Leaning into a lane change sells the weight of the machine.
    const lean = p.strafe < 1 ? (laneCenter(p.targetLane) - p.x) * 0.3 : 0;
    const squash = p.motion === 'sliding' ? 0.42 : 1;
    const base = p.y + 0.06;
    const nx = p.x + lean;

    // The camera sits behind the cycle, so the tail is the near end and the
    // nose the far one: we see the roof and the back panel.
    const tailZ = -0.95;
    const noseZ = 1.15;
    const wTail = 0.38;
    const wNose = 0.2;
    const yTail = base + 0.52 * squash;
    const yNose = base + 0.24 * squash;

    // Roof.
    this.fillPoly(
      [
        [nx - wTail, yTail, tailZ],
        [nx + wTail, yTail, tailZ],
        [nx + wNose, yNose, noseZ],
        [nx - wNose, yNose, noseZ],
      ],
      rgba(color, 0.4 * alpha),
      rgba(color, 0.75 * alpha),
      1.2,
      color,
      14,
    );

    // Flanks, which give the hull some thickness as it leans.
    for (const side of [-1, 1]) {
      this.fillPoly(
        [
          [nx + side * wTail, base, tailZ],
          [nx + side * wNose, base, noseZ],
          [nx + side * wNose, yNose, noseZ],
          [nx + side * wTail, yTail, tailZ],
        ],
        rgba(PALETTE.deep, 0.75 * alpha),
        rgba(color, 0.55 * alpha),
        1,
      );
    }

    // Back panel: the nearest surface, and the brightest.
    this.fillPoly(
      [
        [nx - wTail, base, tailZ],
        [nx + wTail, base, tailZ],
        [nx + wTail, yTail, tailZ],
        [nx - wTail, yTail, tailZ],
      ],
      rgba(PALETTE.deep, 0.92 * alpha),
      rgba(PALETTE.white, 0.9 * alpha),
      1.6,
      color,
      20,
    );

    // Canopy, a low bubble set just forward of the tail.
    this.fillPoly(
      [
        [nx - wTail * 0.6, yTail, tailZ + 0.25],
        [nx + wTail * 0.6, yTail, tailZ + 0.25],
        [nx + wNose * 0.8, yNose + 0.22 * squash, noseZ * 0.35],
        [nx - wNose * 0.8, yNose + 0.22 * squash, noseZ * 0.35],
      ],
      rgba(color, 0.55 * alpha),
      rgba(PALETTE.white, 0.8 * alpha),
      1.2,
      color,
      14,
    );

    // Rear light bar: the brightest thing on screen, so the eye tracks it.
    const bl = this.project(nx - wTail * 0.94, base + 0.34 * squash, tailZ - 0.01);
    const br = this.project(nx + wTail * 0.94, base + 0.34 * squash, tailZ - 0.01);
    if (bl.visible && br.visible) {
      ctx.save();
      ctx.shadowColor = rgba(color, alpha);
      ctx.shadowBlur = 24;
      ctx.strokeStyle = rgba(PALETTE.white, 0.95 * alpha);
      ctx.lineWidth = Math.max(2, 0.1 * bl.scale);
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(br.x, br.y);
      ctx.stroke();
      ctx.restore();
    }

    // Wheel glow spilling out beneath the hull.
    for (const side of [-1, 1]) {
      const w = this.project(nx + side * wTail * 0.8, base + 0.1, 0);
      if (!w.visible) continue;
      const r = Math.max(2, 0.3 * w.scale);
      const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
      g.addColorStop(0, rgba(PALETTE.white, 0.55 * alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (game.hasShield) {
      const c = this.project(p.x, p.y + 0.6, 0);
      if (c.visible) {
        const r = Math.max(6, 1.25 * c.scale);
        ctx.strokeStyle = rgba(PALETTE.shield, 0.3 + 0.2 * Math.sin(this.time * 6));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, r, r * 1.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawCycleShadow(x: number, y: number): void {
    const ctx = this.ctx;
    const gp = this.project(x, 0.02, 0);
    if (!gp.visible) return;
    const r = Math.max(4, 1.1 * gp.scale);
    const fade = 1 / (1 + y * 0.6);
    const g = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, r);
    g.addColorStop(0, rgba(PALETTE.cyan, 0.5 * fade));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gp.x, gp.y, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** The signature light ribbon, laid flat on the track behind the cycle. */
  private drawTrail(game: Game): void {
    const ctx = this.ctx;
    if (this.trail.length < 2) return;
    const color = game.boosting ? PALETTE.boost : PALETTE.cyan;
    for (let i = this.trail.length - 1; i > 0; i--) {
      const a = this.trail[i] as TrailPoint;
      const b = this.trail[i - 1] as TrailPoint;
      const t = -a.z / TRAIL_LENGTH;
      if (t > 1 || t < 0) continue;
      const w = 0.24 * (1 - t * 0.45);
      const al = this.project(a.x - w, 0.04, a.z);
      const ar = this.project(a.x + w, 0.04, a.z);
      const brr = this.project(b.x + w, 0.04, b.z);
      const blv = this.project(b.x - w, 0.04, b.z);
      if (!al.visible || !ar.visible || !brr.visible || !blv.visible) continue;
      ctx.fillStyle = rgba(color, 0.62 * (1 - t) ** 1.3);
      ctx.beginPath();
      ctx.moveTo(al.x, al.y);
      ctx.lineTo(ar.x, ar.y);
      ctx.lineTo(brr.x, brr.y);
      ctx.lineTo(blv.x, blv.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Fills and outlines a world-space polygon, with an optional glow. */
  private fillPoly(
    points: Array<[number, number, number]>,
    fill: string,
    stroke: string,
    lineWidth: number,
    glowColor?: string,
    glowBlur = 0,
  ): void {
    const ctx = this.ctx;
    const projected = points.map(([x, y, z]) => this.project(x, y, z));
    if (projected.some((q) => !q.visible)) return;
    ctx.save();
    if (glowColor && glowBlur > 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glowBlur;
    }
    ctx.beginPath();
    projected.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  // --- post --------------------------------------------------------------

  private drawPostEffects(game: Game): void {
    const { ctx, width, height } = this;

    if (game.boosting) {
      ctx.save();
      ctx.strokeStyle = rgba(PALETTE.boost, 0.16);
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const seed = (i * 97) % 211;
        const t = ((this.time * 2.4 + seed / 211) % 1) ** 2;
        const a = (seed / 211) * Math.PI * 2;
        const r0 = width * 0.12 + t * width * 0.7;
        const r1 = r0 + width * 0.1;
        ctx.beginPath();
        ctx.moveTo(this.cam.cx + Math.cos(a) * r0, this.cam.cy + Math.sin(a) * r0 * 0.6);
        ctx.lineTo(this.cam.cx + Math.cos(a) * r1, this.cam.cy + Math.sin(a) * r1 * 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.collectFlash > 0) {
      ctx.fillStyle = rgba(PALETTE.cyan, 0.07 * this.collectFlash);
      ctx.fillRect(0, 0, width, height);
    }
    if (this.hitFlash > 0) {
      ctx.fillStyle = rgba(PALETTE.danger, 0.3 * this.hitFlash);
      ctx.fillRect(0, 0, width, height);
    }

    // Vignette and scanlines, to sell the "inside a machine" feel.
    const v = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.3,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
  }

  // --- helpers -----------------------------------------------------------

  private project(x: number, y: number, z: number) {
    return project(this.cam, x, y, z);
  }

  private glowLine(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    color: string,
    width: number,
    blur: number,
  ): void {
    const a = this.project(x0, y0, z0);
    const b = this.project(x1, y1, z1);
    if (!a.visible || !b.visible) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = rgba(color, 0.85);
    ctx.shadowBlur = blur;
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

export function laneCenter(lane: Lane): number {
  return C.LANE_X[lane] as number;
}
