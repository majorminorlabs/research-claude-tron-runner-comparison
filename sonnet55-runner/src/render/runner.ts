import * as THREE from 'three';
import { CFG, laneX } from '../game/config';
import type { Game } from '../game/game';
import { COLORS } from './palette';

const TRAIL_POINTS = 28;
const TRAIL_LENGTH = 5.5;

interface Limb {
  pivot: THREE.Group;
  lower: THREE.Group;
}

/** The light-suited runner: a procedural humanoid with glowing circuit lines. */
export class Runner {
  readonly group = new THREE.Group();
  /** Body root (leaned / lowered for poses). */
  private body = new THREE.Group();
  private legs: Limb[] = [];
  private arms: Limb[] = [];
  private head = new THREE.Group();
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private lineMats: THREE.LineBasicMaterial[] = [];
  private suitMat = new THREE.MeshBasicMaterial({ color: COLORS.suit });
  private pool: THREE.Mesh;
  private shield: THREE.Mesh;
  private magnet: THREE.Mesh;
  private aura: THREE.Mesh;
  private trail: THREE.Mesh;
  private trailPos: Float32Array;
  private trailCol: Float32Array;
  private history: { d: number; x: number }[] = [];
  private slideBlend = 0;
  private airBlend = 0;
  private lean = 0;
  private lastX = 0;
  private color = new THREE.Color(COLORS.cyan);
  private runPhase = 0;
  private blink = 0;
  hidden = false;

  constructor() {
    this.buildBody();
    this.group.add(this.body);

    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        map: Runner.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.8,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.03;
    this.group.add(this.pool);

    this.shield = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x4aa8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.shield.position.y = 0.95;
    this.shield.visible = false;
    this.group.add(this.shield);

    this.magnet = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.magenta, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.magnet.position.y = 0.95;
    this.magnet.rotation.x = Math.PI / 2;
    this.magnet.visible = false;
    this.group.add(this.magnet);

    this.aura = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 2.1, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: COLORS.yellow, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.aura.position.y = 1;
    this.aura.visible = false;
    this.group.add(this.aura);

    const geo = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(TRAIL_POINTS * 2 * 3);
    this.trailCol = new Float32Array(TRAIL_POINTS * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_POINTS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.trail = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.trail.frustumCulled = false;
  }

  /** The trail lives in world space, so it is added to the scene separately. */
  get trailObject(): THREE.Object3D {
    return this.trail;
  }

  private static glowTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(120,240,255,0.9)');
    grad.addColorStop(0.4, 'rgba(25,200,255,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ------------------------------------------------------------------ model
  private glowMat(): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ color: this.color });
    this.glowMats.push(m);
    return m;
  }
  private lineMat(): THREE.LineBasicMaterial {
    const m = new THREE.LineBasicMaterial({ color: this.color });
    this.lineMats.push(m);
    return m;
  }

  private part(w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D, edges = true): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, this.suitMat);
    m.position.set(x, y, z);
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.lineMat()));
    parent.add(m);
    return m;
  }

  private strip(w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D): void {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.glowMat());
    m.position.set(x, y, z);
    parent.add(m);
  }

  private buildBody(): void {
    const b = this.body;
    // torso, hips
    this.part(0.52, 0.62, 0.3, 0, 1.2, 0, b);
    this.part(0.42, 0.2, 0.28, 0, 0.8, 0, b);
    this.strip(0.06, 0.52, 0.02, 0, 1.2, 0.16, b); // chest line
    this.strip(0.36, 0.04, 0.02, 0, 1.38, 0.16, b);
    this.strip(0.3, 0.04, 0.02, 0, 0.88, 0.15, b); // belt
    // identity disc on the back
    const disc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), this.glowMat());
    disc.position.set(0, 1.22, -0.17);
    b.add(disc);
    // head + helmet visor
    this.head.position.set(0, 1.72, 0);
    this.part(0.3, 0.32, 0.32, 0, 0, 0, this.head);
    this.strip(0.26, 0.06, 0.02, 0, 0.02, 0.17, this.head);
    b.add(this.head);

    for (const s of [-1, 1]) {
      // legs
      const leg = new THREE.Group();
      leg.position.set(s * 0.13, 0.72, 0);
      this.part(0.17, 0.38, 0.2, 0, -0.19, 0, leg);
      this.strip(0.03, 0.34, 0.02, 0, -0.19, 0.11, leg);
      const lower = new THREE.Group();
      lower.position.set(0, -0.38, 0);
      this.part(0.15, 0.36, 0.17, 0, -0.18, 0, lower);
      this.strip(0.03, 0.3, 0.02, 0, -0.18, 0.095, lower);
      this.part(0.17, 0.09, 0.28, 0, -0.38, 0.05, lower);
      leg.add(lower);
      b.add(leg);
      this.legs.push({ pivot: leg, lower });
      // arms
      const arm = new THREE.Group();
      arm.position.set(s * 0.36, 1.42, 0);
      this.part(0.13, 0.3, 0.14, 0, -0.15, 0, arm);
      this.strip(0.025, 0.26, 0.02, 0, -0.15, 0.08, arm);
      const fore = new THREE.Group();
      fore.position.set(0, -0.3, 0);
      this.part(0.12, 0.28, 0.13, 0, -0.14, 0, fore);
      this.strip(0.025, 0.22, 0.02, 0, -0.14, 0.075, fore);
      arm.add(fore);
      b.add(arm);
      this.arms.push({ pivot: arm, lower: fore });
    }
  }

  // ----------------------------------------------------------------- update
  setColor(c: THREE.ColorRepresentation): void {
    this.color.set(c);
    for (const m of this.glowMats) m.color.copy(this.color);
    for (const m of this.lineMats) m.color.copy(this.color);
  }

  /** `idle` = standing at the start line. */
  update(game: Game, dt: number, time: number, idle: boolean): void {
    const p = game.player;
    const x = laneX(game.laneFloat);
    const vx = (x - this.lastX) / Math.max(dt, 1e-4);
    this.lastX = x;
    this.group.position.set(x, p.y, 0);

    // pose blends
    const tgtSlide = p.sliding ? 1 : 0;
    const tgtAir = p.grounded ? 0 : 1;
    const k = 1 - Math.exp(-dt * 22);
    this.slideBlend += (tgtSlide - this.slideBlend) * k;
    this.airBlend += (tgtAir - this.airBlend) * k;
    this.lean += ((-vx * 0.045) - this.lean) * (1 - Math.exp(-dt * 14));

    if (!idle) this.runPhase += game.speed * dt * 0.62;
    const ph = this.runPhase;
    const run = (1 - this.slideBlend) * (1 - this.airBlend);

    // legs / arms
    const swing = Math.sin(ph) * 0.95 * run;
    const swing2 = Math.sin(ph + Math.PI) * 0.95 * run;
    const air = this.airBlend;
    const slide = this.slideBlend;
    const leg0 = this.legs[0]!;
    const leg1 = this.legs[1]!;
    leg0.pivot.rotation.x = swing * 0.9 + air * -0.9 + slide * -1.15;
    leg1.pivot.rotation.x = swing2 * 0.9 + air * 0.55 + slide * -1.0;
    leg0.lower.rotation.x = Math.max(0, -swing) * 1.3 + air * 1.3 + slide * 0.2;
    leg1.lower.rotation.x = Math.max(0, -swing2) * 1.3 + air * 0.4 + slide * 0.1;
    const arm0 = this.arms[0]!;
    const arm1 = this.arms[1]!;
    arm0.pivot.rotation.x = swing2 * 0.8 + air * -2.5 + slide * -1.6;
    arm1.pivot.rotation.x = swing * 0.8 + air * -2.3 + slide * -1.6;
    arm0.lower.rotation.x = -0.9 * run - air * 0.4;
    arm1.lower.rotation.x = -0.9 * run - air * 0.4;
    arm0.pivot.rotation.z = -air * 0.45;
    arm1.pivot.rotation.z = air * 0.45;

    // body: forward lean while running, lie back while sliding
    const bob = Math.abs(Math.sin(ph)) * 0.06 * run;
    this.body.rotation.x = 0.12 * run - slide * 1.25 + air * 0.08;
    this.body.position.y = bob - slide * 0.55;
    this.body.position.z = slide * 0.15;
    this.body.rotation.z = this.lean;
    this.body.rotation.y = this.lean * 0.6;
    this.head.rotation.x = -this.body.rotation.x * 0.5;

    // effects
    const e = game.effects;
    this.shield.visible = e.shield;
    if (e.shield) {
      this.shield.rotation.y += dt * 1.4;
      this.shield.rotation.x += dt * 0.6;
      const m = this.shield.material as THREE.MeshBasicMaterial;
      m.opacity = e.invuln > 0 ? 0.2 + 0.3 * Math.abs(Math.sin(time * 18)) : 0.32;
    }
    this.magnet.visible = e.magnet > 0;
    if (e.magnet > 0) {
      this.magnet.rotation.z += dt * 3;
      const s = 1 + 0.12 * Math.sin(time * 8);
      this.magnet.scale.set(s, s, s);
      (this.magnet.material as THREE.MeshBasicMaterial).opacity = e.magnet < 2 ? 0.4 + 0.5 * Math.abs(Math.sin(time * 14)) : 0.9;
    }
    this.aura.visible = e.overclock > 0;
    if (e.overclock > 0) {
      this.aura.rotation.y += dt * 4;
      (this.aura.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.12 * Math.sin(time * 12);
    }

    // suit colour reacts to power-ups
    let tint: number = COLORS.cyan;
    if (e.phase > 0) tint = COLORS.lime;
    else if (e.overclock > 0) tint = COLORS.yellow;
    this.setColor(tint);

    // invulnerability blink
    this.blink = e.invuln > 0 && e.phase <= 0 ? Math.sin(time * 40) : 1;
    this.group.visible = !this.hidden && this.blink > -0.2;
    this.trail.visible = !this.hidden;

    const pm = this.pool.material as THREE.MeshBasicMaterial;
    pm.color.set(tint);
    pm.opacity = 0.55 + 0.2 * Math.min(1, game.speed / CFG.maxSpeed) - p.y * 0.12;
    this.pool.position.y = 0.03 - p.y;
    this.pool.scale.setScalar(1 + p.y * 0.25);

    this.updateTrail(game, tint, idle, x);
  }

  private updateTrail(game: Game, tint: number, idle: boolean, x: number): void {
    const hist = this.history;
    const d = game.distance;
    if (idle) hist.length = 0;
    if (!idle && (hist.length === 0 || d - hist[hist.length - 1]!.d > 0.35)) {
      hist.push({ d, x });
      while (hist.length > 1 && d - hist[0]!.d > TRAIL_LENGTH + 1) hist.shift();
    }
    const col = new THREE.Color(tint);
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const age = (i / (TRAIL_POINTS - 1)) * TRAIL_LENGTH;
      const target = d - age;
      let hx = x;
      // find the history sample closest to `target`
      if (hist.length > 0) {
        let lo = hist[0]!;
        for (const h of hist) {
          if (h.d <= target) lo = h;
          else break;
        }
        hx = lo.x;
        if (age < 0.4) hx = x + (hx - x) * (age / 0.4);
      }
      const z = age + 0.3;
      const fade = Math.pow(1 - i / (TRAIL_POINTS - 1), 1.6);
      const top = 0.1 + 0.85 * fade;
      this.trailPos.set([hx, 0.05, z, hx, top, z], i * 6);
      const a = fade * 0.9;
      this.trailCol.set([col.r, col.g, col.b, a, col.r, col.g, col.b, a * 0.15], i * 8);
    }
    (this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.trail.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  resetTrail(): void {
    this.history.length = 0;
  }
}
