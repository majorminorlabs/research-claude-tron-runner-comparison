import * as THREE from 'three';
import { LANE_WIDTH } from '../game/config';
import { COLORS } from './palette';

const FOG_NEAR = 45;
const FOG_FAR = 185;

/** The Grid: glowing floor, skyline, horizon beam and drifting data motes. */
export class World {
  readonly group = new THREE.Group();
  private floorMat: THREE.ShaderMaterial;
  private towers: { group: THREE.Group; z: number; side: number; lastRel: number }[] = [];
  private motes: THREE.Points;
  private moteZ: Float32Array;
  private streaks: THREE.LineSegments;
  private streakZ: Float32Array;
  private streakMat: THREE.LineBasicMaterial;
  private sky: THREE.Mesh;
  private sunMat: THREE.MeshBasicMaterial;
  private tint = new THREE.Color(COLORS.cyan);

  constructor() {
    this.floorMat = this.buildFloor();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 420), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -170);
    this.group.add(floor);

    this.sky = this.buildSky();
    this.group.add(this.sky);

    this.sunMat = new THREE.MeshBasicMaterial({
      map: this.radialTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.85,
    });
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(260, 130), this.sunMat);
    sun.position.set(0, 28, -330);
    this.group.add(sun);

    this.group.add(this.buildMountains());
    this.buildTowers();

    const motes = this.buildMotes();
    this.motes = motes.points;
    this.moteZ = motes.z;
    this.group.add(this.motes);

    const streaks = this.buildStreaks();
    this.streaks = streaks.lines;
    this.streakZ = streaks.z;
    this.streakMat = streaks.mat;
    this.group.add(this.streaks);
  }

  // --------------------------------------------------------------- builders
  private buildFloor(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDist: { value: 0 },
        uLane: { value: LANE_WIDTH },
        uTint: { value: new THREE.Color(COLORS.cyan) },
        uFog: { value: new THREE.Color(COLORS.fog) },
        uFogRange: { value: new THREE.Vector2(FOG_NEAR, FOG_FAR) },
        uPulse: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        uniform float uDist;
        uniform float uLane;
        uniform float uPulse;
        uniform vec3 uTint;
        uniform vec3 uFog;
        uniform vec2 uFogRange;

        float line(float v, float width) {
          float fw = fwidth(v);
          float d = abs(fract(v - 0.5) - 0.5);
          return 1.0 - smoothstep(0.0, max(width * fw, 1e-4), d);
        }

        void main() {
          float x = vWorld.x;
          float tz = uDist - vWorld.z;           // track distance
          float ax = abs(x);
          float half3 = uLane * 1.5;

          // track surface: dark gloss with a faint centre sheen
          vec3 col = vec3(0.0006, 0.0018, 0.005);
          float onTrack = 1.0 - smoothstep(half3 - 0.05, half3 + 0.05, ax);
          col += onTrack * vec3(0.0, 0.006, 0.016) * (0.6 + 0.4 * sin(tz * 0.05));

          // cross lines every 6 units, scroll with distance
          float cross = line(tz / 6.0, 1.2);
          // lane dividers
          float laneLine = line((x + half3) / uLane, 1.0) * onTrack;
          // track edges (bright)
          float edge = (1.0 - smoothstep(0.0, 0.07, abs(ax - half3)));
          // outer grid (dimmer, bigger cells)
          float gx = line(x / 4.0, 1.0);
          float gz = line(tz / 4.0, 1.0);
          float outer = max(gx, gz) * (1.0 - onTrack);

          vec3 tint = uTint;
          col += tint * cross * onTrack * (0.3 + uPulse * 0.5);
          col += tint * laneLine * 0.42;
          col += tint * edge * 1.5;
          col += tint * outer * 0.08 * (1.0 - smoothstep(10.0, 70.0, ax));

          // glow halo beside the edges
          float halo = exp(-max(ax - half3, 0.0) * 1.6) * (1.0 - onTrack);
          col += tint * halo * 0.07;

          float dist = length(vWorld - cameraPosition);
          float f = smoothstep(uFogRange.x, uFogRange.y, dist);
          col = mix(col, uFog, f);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }

  private buildSky(): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTint: { value: new THREE.Color(COLORS.cyan) } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTint;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 top = vec3(0.0, 0.001, 0.005);
          vec3 horizon = vec3(0.004, 0.03, 0.075) + uTint * 0.018;
          vec3 col = mix(horizon, top, pow(h, 0.45));
          // sparse stars
          vec3 cell = floor(vDir * 160.0);
          float s = step(0.9985, hash(cell)) * smoothstep(0.08, 0.4, h);
          col += vec3(0.6, 0.9, 1.0) * s;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
    m.renderOrder = -10;
    return m;
  }

  private radialTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 2, 128, 128, 126);
    grad.addColorStop(0, 'rgba(210,252,255,1)');
    grad.addColorStop(0.15, 'rgba(60,220,255,0.65)');
    grad.addColorStop(0.5, 'rgba(10,90,190,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildMountains(): THREE.Object3D {
    const pts: number[] = [];
    const shape = new THREE.Shape();
    shape.moveTo(-320, -2);
    const peaks = 40;
    let prevX = -320;
    let prevY = 0;
    for (let i = 1; i <= peaks; i++) {
      const x = -320 + (640 * i) / peaks;
      const y = (i % 2 === 0 ? 1 : 0.25) * (14 + 26 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
      pts.push(prevX, prevY, 0, x, y, 0);
      shape.lineTo(x, y);
      prevX = x;
      prevY = y;
    }
    shape.lineTo(320, -2);
    shape.closePath();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55, fog: false }),
    );
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x00030a, fog: false }));
    fill.position.z = -0.5;
    const g = new THREE.Group();
    g.add(line, fill);
    g.position.set(0, 0, -300);
    return g;
  }

  private buildTowers(): void {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const dark = new THREE.MeshBasicMaterial({ color: 0x010409 });
    const cyan = new THREE.LineBasicMaterial({ color: COLORS.cyan });
    const orange = new THREE.LineBasicMaterial({ color: COLORS.orange });
    const count = 26;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(boxGeo, dark);
        const edges = new THREE.LineSegments(edgeGeo, Math.random() < 0.14 ? orange : cyan);
        g.add(body, edges);
        this.placeTower(g, side);
        const z = (i / count) * 330 + Math.random() * 6;
        g.position.z = -z;
        this.towers.push({ group: g, z, side, lastRel: z });
        this.group.add(g);
      }
    }
  }

  private placeTower(g: THREE.Group, side: number): void {
    const w = 2 + Math.random() * 4.5;
    const d = 2 + Math.random() * 5;
    const h = 4 + Math.pow(Math.random(), 2.2) * 30;
    g.scale.set(w, h, d);
    g.position.x = side * (16 + w / 2 + Math.random() * 30);
    g.position.y = h / 2;
  }

  private buildMotes(): { points: THREE.Points; z: Float32Array } {
    const n = 160;
    const pos = new Float32Array(n * 3);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 22 + 0.5;
      z[i] = Math.random() * 200;
      pos[i * 3 + 2] = -z[i]!;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: COLORS.cyanBright,
        size: 0.14,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pts.frustumCulled = false;
    return { points: pts, z };
  }

  private buildStreaks(): { lines: THREE.LineSegments; z: Float32Array; mat: THREE.LineBasicMaterial } {
    const n = 48;
    const pos = new Float32Array(n * 6);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (3.4 + Math.random() * 9);
      const y = 0.1 + Math.random() * 5;
      z[i] = Math.random() * 120;
      pos.set([x, y, 0, x, y, 0], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: COLORS.cyanBright,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    return { lines, z, mat };
  }

  // ----------------------------------------------------------------- update
  setTint(c: THREE.ColorRepresentation): void {
    this.tint.set(c);
    this.floorMat.uniforms.uTint!.value.copy(this.tint);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTint!.value.copy(this.tint);
  }

  /** `distance` is the game's track distance; `speed` drives streaks. */
  update(distance: number, speed: number, dt: number, pulse: number, boost: boolean): void {
    this.floorMat.uniforms.uDist!.value = distance;
    this.floorMat.uniforms.uPulse!.value = pulse;

    const span = 330;
    for (const t of this.towers) {
      // towers scroll with the track and recycle (re-randomised) once behind the camera
      let rel = (t.z - distance) % span;
      if (rel < 0) rel += span;
      if (rel > t.lastRel + 1) this.placeTower(t.group, t.side);
      t.lastRel = rel;
      t.group.position.z = 25 - rel;
    }

    const mp = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.moteZ.length; i++) {
      let z = this.moteZ[i]! - speed * dt * 0.8;
      if (z < -20) z += 220;
      this.moteZ[i] = z;
      mp.setZ(i, -z + 10);
    }
    mp.needsUpdate = true;

    const sp = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const len = 1.5 + speed * 0.22;
    for (let i = 0; i < this.streakZ.length; i++) {
      let z = this.streakZ[i]! - speed * dt * 1.4;
      if (z < -10) z += 130;
      this.streakZ[i] = z;
      sp.setZ(i * 2, 10 - z);
      sp.setZ(i * 2 + 1, 10 - z - len);
    }
    sp.needsUpdate = true;
    this.streakMat.opacity = THREE.MathUtils.clamp((speed - 24) / 40, 0, 0.55) + (boost ? 0.25 : 0);
  }
}
