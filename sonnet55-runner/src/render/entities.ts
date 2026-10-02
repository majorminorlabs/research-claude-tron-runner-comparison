import * as THREE from 'three';
import { CFG, LANE_WIDTH, laneX, type ObstacleKind, type PickupKind } from '../game/config';
import type { Game, Pickup } from '../game/game';
import type { Obstacle } from '../game/rules';
import { COLORS, POWER_COLORS } from './palette';

const W = LANE_WIDTH - 0.3;

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const boxEdges = new THREE.EdgesGeometry(boxGeo);
const darkMat = new THREE.MeshBasicMaterial({ color: 0x07090f });
const glassMat = new THREE.MeshBasicMaterial({ color: 0x1a0a04, transparent: true, opacity: 0.55, depthWrite: false });
const orangeLine = new THREE.LineBasicMaterial({ color: COLORS.orange });
const orangeGlow = new THREE.MeshBasicMaterial({ color: COLORS.orange });
const hotGlow = new THREE.MeshBasicMaterial({ color: COLORS.orangeHot });
const redGlow = new THREE.MeshBasicMaterial({ color: COLORS.red });

function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D, edges?: THREE.LineBasicMaterial): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  if (edges) {
    const e = new THREE.LineSegments(boxEdges, edges);
    m.add(e);
  }
  parent.add(m);
  return m;
}

function buildObstacle(kind: ObstacleKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'low') {
    // low barrier: glowing hurdle
    box(W, CFG.lowHeight, CFG.lowDepth, 0, CFG.lowHeight / 2, 0, darkMat, g, orangeLine);
    box(W + 0.02, 0.1, CFG.lowDepth + 0.02, 0, CFG.lowHeight - 0.05, 0, orangeGlow, g);
    box(W + 0.02, 0.05, CFG.lowDepth + 0.02, 0, 0.03, 0, orangeGlow, g);
    box(0.12, CFG.lowHeight * 0.55, CFG.lowDepth + 0.03, -W / 4, CFG.lowHeight * 0.45, 0, hotGlow, g);
    box(0.12, CFG.lowHeight * 0.55, CFG.lowDepth + 0.03, W / 4, CFG.lowHeight * 0.45, 0, hotGlow, g);
  } else if (kind === 'high') {
    // overhead gate: posts + glass panel + hot lower beam
    const h = CFG.highTop - CFG.highBottom;
    box(0.2, CFG.highTop, 0.4, -W / 2 - 0.05, CFG.highTop / 2, 0, darkMat, g, orangeLine);
    box(0.2, CFG.highTop, 0.4, W / 2 + 0.05, CFG.highTop / 2, 0, darkMat, g, orangeLine);
    box(W, h, 0.35, 0, CFG.highBottom + h / 2, 0, glassMat, g, orangeLine);
    box(W + 0.2, 0.14, 0.45, 0, CFG.highBottom + 0.07, 0, redGlow, g);
    box(W, 0.05, 0.4, 0, CFG.highTop - 0.03, 0, orangeGlow, g);
    box(0.05, 0.05, 0.05, 0, CFG.highBottom - 0.2, 0, hotGlow, g);
  } else {
    // data wall: tall monolith with glowing slits
    box(W, CFG.blockTop, CFG.blockDepth, 0, CFG.blockTop / 2, 0, darkMat, g, orangeLine);
    for (let i = 0; i < 4; i++) box(W + 0.03, 0.07, CFG.blockDepth + 0.03, 0, 0.55 + i * 0.8, 0, i % 2 ? hotGlow : orangeGlow, g);
    box(W + 0.03, 0.08, CFG.blockDepth + 0.03, 0, CFG.blockTop, 0, redGlow, g);
    box(0.08, CFG.blockTop, CFG.blockDepth + 0.03, -W / 2, CFG.blockTop / 2, 0, orangeGlow, g);
    box(0.08, CFG.blockTop, CFG.blockDepth + 0.03, W / 2, CFG.blockTop / 2, 0, orangeGlow, g);
  }
  return g;
}

const bitGeo = new THREE.OctahedronGeometry(0.24, 0);
const bitMat = new THREE.MeshBasicMaterial({ color: COLORS.cyanBright });
const bitEdge = new THREE.EdgesGeometry(bitGeo);
const bitEdgeMat = new THREE.LineBasicMaterial({ color: COLORS.white });

function buildPickup(kind: PickupKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'bit') {
    g.add(new THREE.Mesh(bitGeo, bitMat), new THREE.LineSegments(bitEdge, bitEdgeMat));
    g.scale.setScalar(1.15);
    return g;
  }
  const color = POWER_COLORS[kind];
  const lineMat = new THREE.LineBasicMaterial({ color });
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color }));
  ring.name = 'ring';
  g.add(ring);
  let inner: THREE.Mesh;
  switch (kind) {
    case 'shield':
      inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), glow);
      break;
    case 'magnet':
      inner = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 20, Math.PI * 1.25), glow);
      inner.rotation.z = Math.PI * 0.4;
      break;
    case 'overclock':
      inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glow);
      inner.scale.y = 1.5;
      break;
    default:
      inner = new THREE.Mesh(new THREE.TetrahedronGeometry(0.36, 0), glow);
  }
  inner.name = 'inner';
  inner.add(new THREE.LineSegments(new THREE.EdgesGeometry(inner.geometry), lineMat));
  g.add(inner);
  // vertical light beam so they read from far away
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 6, 6, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beam.position.y = 1.5;
  g.add(beam);
  return g;
}

/** Keeps a Three.js mesh for every live obstacle / pickup in the game. */
export class Entities {
  readonly group = new THREE.Group();
  private obstacles = new Map<number, THREE.Group>();
  private pickups = new Map<number, THREE.Group>();
  private obstaclePool: Record<ObstacleKind, THREE.Group[]> = { low: [], high: [], block: [] };
  private pickupPool: Record<PickupKind, THREE.Group[]> = { bit: [], shield: [], magnet: [], overclock: [], phase: [] };
  private seen = new Set<number>();

  update(game: Game, time: number): void {
    const dist = game.distance;
    this.seen.clear();

    for (const o of game.obstacles) {
      if (o.dead) continue;
      const dz = o.z - dist;
      if (dz > CFG.spawnHorizon + 20 || dz < -12) continue;
      this.seen.add(o.id);
      let m = this.obstacles.get(o.id);
      if (!m) {
        m = this.takeObstacle(o);
        this.obstacles.set(o.id, m);
      }
      m.position.set(laneX(o.lane), 0, -dz);
    }
    for (const [id, m] of this.obstacles) {
      if (this.seen.has(id)) continue;
      this.obstacles.delete(id);
      this.releaseObstacle(m);
    }

    this.seen.clear();
    for (const p of game.pickups) {
      if (p.collected) continue;
      const dz = p.z - dist;
      if (dz > CFG.spawnHorizon + 20 || dz < -12) continue;
      this.seen.add(p.id);
      let m = this.pickups.get(p.id);
      if (!m) {
        m = this.takePickup(p);
        this.pickups.set(p.id, m);
      }
      this.placePickup(m, p, game, dz, time);
    }
    for (const [id, m] of this.pickups) {
      if (this.seen.has(id)) continue;
      this.pickups.delete(id);
      this.releasePickup(m);
    }
  }

  private placePickup(m: THREE.Group, p: Pickup, game: Game, dz: number, time: number): void {
    let x = laneX(p.lane);
    let y = p.y;
    if (p.pulled) {
      // fly towards the runner
      const t = 1 - Math.min(1, Math.max(0, dz / CFG.magnetRange));
      const e = t * t;
      x += (laneX(game.laneFloat) - x) * e;
      y += (game.player.y + 0.9 - y) * e;
    }
    const bob = p.kind === 'bit' ? Math.sin(time * 4 + p.id) * 0.06 : Math.sin(time * 2.4 + p.id) * 0.12;
    m.position.set(x, y + bob, -dz);
    m.rotation.y = time * (p.kind === 'bit' ? 2.6 : 1.6) + p.id;
    if (p.kind !== 'bit') {
      const ring = m.getObjectByName('ring');
      if (ring) ring.rotation.x = time * 1.3;
      const s = 1 + 0.06 * Math.sin(time * 5);
      m.scale.setScalar(s);
    }
  }

  private takeObstacle(o: Obstacle): THREE.Group {
    const pooled = this.obstaclePool[o.kind].pop() ?? buildObstacle(o.kind);
    pooled.userData.kind = o.kind;
    pooled.visible = true;
    this.group.add(pooled);
    return pooled;
  }
  private releaseObstacle(m: THREE.Group): void {
    m.visible = false;
    this.group.remove(m);
    const kind = m.userData.kind as ObstacleKind | undefined;
    if (kind) this.obstaclePool[kind].push(m);
  }
  private takePickup(p: Pickup): THREE.Group {
    const g = this.pickupPool[p.kind].pop() ?? buildPickup(p.kind);
    g.userData.kind = p.kind;
    g.visible = true;
    this.group.add(g);
    return g;
  }
  private releasePickup(m: THREE.Group): void {
    m.visible = false;
    this.group.remove(m);
    const kind = m.userData.kind as PickupKind;
    this.pickupPool[kind].push(m);
  }

  clear(): void {
    for (const m of this.obstacles.values()) this.releaseObstacle(m);
    for (const m of this.pickups.values()) this.releasePickup(m);
    this.obstacles.clear();
    this.pickups.clear();
  }
}
