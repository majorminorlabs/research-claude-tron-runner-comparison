import type { Camera } from './camera';
import { project } from './camera';
import { rgba } from './palette';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** Particles sit in world space and drift back with the track. */
  anchored: boolean;
}

/** A small pool of world-space sparks for pickups, hits and landings. */
export class Particles {
  private items: Particle[] = [];
  private readonly limit = 420;

  burst(
    x: number,
    y: number,
    z: number,
    color: string,
    count: number,
    speed: number,
    rng: () => number,
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.limit) break;
      const a = rng() * Math.PI * 2;
      const b = (rng() - 0.5) * Math.PI;
      const s = speed * (0.35 + rng() * 0.65);
      const life = 0.35 + rng() * 0.5;
      this.items.push({
        x,
        y,
        z,
        vx: Math.cos(a) * Math.cos(b) * s,
        vy: Math.sin(b) * s + s * 0.4,
        vz: Math.sin(a) * Math.cos(b) * s * 0.6,
        life,
        maxLife: life,
        size: 1.6 + rng() * 2.6,
        color,
        anchored: true,
      });
    }
  }

  /** `travel` is how far the track moved this frame, in world units. */
  update(dt: number, travel: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9 * dt;
      if (p.anchored) p.z -= travel;
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const p of this.items) {
      const q = project(cam, p.x, Math.max(p.y, 0), p.z);
      if (!q.visible) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      const r = Math.max(0.6, (p.size * q.scale) / 46);
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clear(): void {
    this.items.length = 0;
  }

  get count(): number {
    return this.items.length;
  }
}
