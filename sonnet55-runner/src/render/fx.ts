import * as THREE from 'three';

const MAX_PARTICLES = 700;
const MAX_VOXELS = 90;

/** Additive spark particles plus cube debris for crashes. */
export class Fx {
  readonly group = new THREE.Group();
  private pos = new Float32Array(MAX_PARTICLES * 3);
  private col = new Float32Array(MAX_PARTICLES * 3);
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES);
  private maxLife = new Float32Array(MAX_PARTICLES);
  private base = new Float32Array(MAX_PARTICLES * 3);
  private next = 0;
  private points: THREE.Points;

  private voxels: THREE.InstancedMesh;
  private vVel: THREE.Vector3[] = [];
  private vRot: THREE.Vector3[] = [];
  private vPos: THREE.Vector3[] = [];
  private vLife = 0;
  private dummy = new THREE.Object3D();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.points.frustumCulled = false;
    this.pos.fill(9999);
    this.group.add(this.points);

    this.voxels = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_VOXELS,
    );
    this.voxels.frustumCulled = false;
    this.voxels.visible = false;
    for (let i = 0; i < MAX_VOXELS; i++) {
      this.vVel.push(new THREE.Vector3());
      this.vRot.push(new THREE.Vector3());
      this.vPos.push(new THREE.Vector3());
    }
    this.group.add(this.voxels);
  }

  burst(x: number, y: number, z: number, color: THREE.ColorRepresentation, count: number, speed: number, life = 0.6, spread = 1): void {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * r * s * spread;
      this.vel[i * 3 + 1] = u * s * 0.8 + speed * 0.2;
      this.vel[i * 3 + 2] = Math.sin(a) * r * s * spread;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 3] = c.r;
      this.base[i * 3 + 1] = c.g;
      this.base[i * 3 + 2] = c.b;
    }
  }

  /** Derez the runner into voxels. */
  explode(x: number, y: number, z: number, color: THREE.ColorRepresentation): void {
    const c = new THREE.Color(color);
    (this.voxels.material as THREE.MeshBasicMaterial).color.copy(c);
    this.voxels.visible = true;
    this.vLife = 2.2;
    for (let i = 0; i < MAX_VOXELS; i++) {
      this.vPos[i]!.set(x + (Math.random() - 0.5) * 0.7, y + Math.random() * 1.8, z + (Math.random() - 0.5) * 0.4);
      this.vVel[i]!.set((Math.random() - 0.5) * 9, 2 + Math.random() * 8, -4 + Math.random() * 6);
      this.vRot[i]!.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    }
    this.burst(x, y + 1, z, color, 120, 11, 1.1);
    this.burst(x, y + 1, z, 0xffffff, 40, 8, 0.7);
  }

  clearDebris(): void {
    this.voxels.visible = false;
    this.vLife = 0;
  }

  update(dt: number, scroll: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const l = this.life[i]!;
      if (l <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.life[i] = l - dt;
      this.vel[i * 3 + 1]! -= 7 * dt;
      this.pos[i * 3] += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1]! * dt;
      // particles travel with the world while it scrolls
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2]! + scroll) * dt;
      if (this.pos[i * 3 + 1]! < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.4;
      }
      const f = Math.max(0, this.life[i]! / this.maxLife[i]!);
      this.col[i * 3] = this.base[i * 3]! * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1]! * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2]! * f;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    if (this.vLife > 0) {
      this.vLife -= dt;
      const s = Math.max(0, Math.min(1, this.vLife / 1.2));
      for (let i = 0; i < MAX_VOXELS; i++) {
        const v = this.vVel[i]!;
        const p = this.vPos[i]!;
        v.y -= 18 * dt;
        p.addScaledVector(v, dt);
        p.z += scroll * dt * 0.5;
        if (p.y < 0.08) {
          p.y = 0.08;
          v.y *= -0.35;
          v.x *= 0.8;
        }
        this.dummy.position.copy(p);
        this.dummy.rotation.set(this.vRot[i]!.x * this.vLife, this.vRot[i]!.y * this.vLife, this.vRot[i]!.z * this.vLife);
        this.dummy.scale.setScalar(s);
        this.dummy.updateMatrix();
        this.voxels.setMatrixAt(i, this.dummy.matrix);
      }
      this.voxels.instanceMatrix.needsUpdate = true;
      if (this.vLife <= 0) this.voxels.visible = false;
    }
  }
}
