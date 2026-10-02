// Three.js presentation layer: reads game state, never mutates it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LANE_WIDTH, MAX_SPEED, START_SPEED } from '../game/config.js';
import { createFloor } from './floor.js';
import { createCycle } from './cycle.js';
import { createTrail } from './trail.js';
import { createParticles } from './particles.js';
import { createScenery } from './scenery.js';
import { COLORS, glowBox, makeLabelTexture } from './materials.js';

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(COLORS.sky, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.sky, 40, 175);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  const camBase = new THREE.Vector3(0, 4.9, 8.2);
  camera.position.copy(camBase);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.45, 0.32);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const floor = createFloor();
  scene.add(floor.mesh);
  const scenery = createScenery();
  scene.add(scenery.group);

  const cycle = createCycle();
  scene.add(cycle.group);
  const trail = createTrail();
  scene.add(trail.mesh);
  const particles = createParticles(900);
  scene.add(particles.points);

  // Shield bubble
  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 1),
    new THREE.MeshBasicMaterial({
      color: COLORS.shield,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shield.visible = false;
  scene.add(shield);

  // ---- Obstacles (pooled per type, keyed by id) ----
  const obstacleMeshes = new Map();
  const pools = { barrier: [], beam: [], wall: [] };
  // Each builder returns a group whose userData.setLength stretches it.
  const builders = {
    barrier: () => {
      const g = new THREE.Group();
      const box = glowBox(LANE_WIDTH * 0.8, 1.0, COLORS.barrier, 0.8);
      box.position.y = 0.5;
      g.add(box);
      const stripe = glowBox(LANE_WIDTH * 0.8, 0.0, COLORS.barrierHot, 0, 0.05);
      stripe.position.y = 0.5;
      g.add(stripe);
      g.userData.parts = [box, stripe];
      return g;
    },
    beam: () => {
      const g = new THREE.Group();
      const panel = glowBox(LANE_WIDTH * 0.8, 2.05, COLORS.beam, 0.7);
      panel.position.y = 1.05 + 2.05 / 2;
      g.add(panel);
      const bar = glowBox(LANE_WIDTH * 0.8, 0.0, COLORS.beamHot, 0, 0.12);
      bar.position.y = 1.12;
      g.add(bar);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 1.05, 0.1),
          new THREE.MeshBasicMaterial({ color: COLORS.beam }),
        );
        post.position.set((side * LANE_WIDTH * 0.8) / 2, 0.52, 0);
        g.add(post);
      }
      g.userData.parts = [panel, bar];
      return g;
    },
    wall: () => {
      const g = new THREE.Group();
      const block = glowBox(LANE_WIDTH * 0.8, 3.2, COLORS.wall, 0.9, 0.09);
      block.position.y = 1.6;
      g.add(block);
      const band = glowBox(LANE_WIDTH * 0.8, 0.0, COLORS.wallHot, 0, 0.06);
      band.position.y = 2.5;
      g.add(band);
      g.userData.parts = [block, band];
      return g;
    },
  };

  // ---- Bits (instanced) ----
  const MAX_BITS = 256;
  const bitMesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshBasicMaterial({ color: COLORS.bit }),
    MAX_BITS,
  );
  bitMesh.frustumCulled = false;
  scene.add(bitMesh);
  const tmp = new THREE.Object3D();

  // ---- Power-ups ----
  const powerMeshes = new Map();
  const powerTextures = {
    shield: makeLabelTexture('◆', COLORS.shieldCss),
    magnet: makeLabelTexture('U', COLORS.magnetCss),
    multiplier: makeLabelTexture('×2', COLORS.multiCss),
  };
  const powerColors = { shield: COLORS.shield, magnet: COLORS.magnet, multiplier: COLORS.multi };
  function buildPower(type) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: powerColors[type] }),
    );
    g.add(ring);
    const cage = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshBasicMaterial({ color: powerColors[type], wireframe: true, transparent: true, opacity: 0.6 }),
    );
    g.add(cage);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: powerTextures[type], transparent: true, depthWrite: false }),
    );
    label.scale.set(0.9, 0.9, 1);
    g.add(label);
    g.userData = { ring, cage };
    return g;
  }

  // ---- State for effects ----
  let shake = 0;
  let flash = 0;
  let width = 1;
  let height = 1;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let crashed = false;
  let lastDistance = 0;
  const camLook = new THREE.Vector3(0, 0.8, -12);

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    bloom.resolution.set(width / 2, height / 2);
    camera.aspect = width / height;
    // Keep all three lanes in frame on narrow (portrait) screens.
    camera.fov = width / height < 0.8 ? 78 : 62;
    camera.updateProjectionMatrix();
  }

  function setQuality(ratio) {
    pixelRatio = ratio;
    resize();
  }

  function reset() {
    for (const [, mesh] of obstacleMeshes) {
      scene.remove(mesh);
      pools[mesh.userData.type].push(mesh);
    }
    obstacleMeshes.clear();
    for (const [, mesh] of powerMeshes) scene.remove(mesh);
    powerMeshes.clear();
    trail.reset();
    particles.clear();
    crashed = false;
    cycle.group.visible = true;
    trail.mesh.visible = true;
    shake = 0;
    lastDistance = 0;
  }

  function handleEvents(game, events) {
    const p = game.player;
    for (const e of events) {
      switch (e.type) {
        case 'collect':
          particles.burst({ x: e.x, y: e.y, z: -0.5 }, 6, COLORS.bit, 5, 0.35);
          break;
        case 'powerup':
          particles.burst({ x: e.x, y: e.y, z: -0.5 }, 40, powerColors[e.power], 9, 0.7);
          flash = 0.35;
          break;
        case 'clear':
          particles.burst({ x: p.x, y: p.y + 0.4, z: 0.6 }, 10, COLORS.player, 4, 0.4);
          break;
        case 'bump':
          shake = Math.max(shake, 0.25);
          particles.burst({ x: p.x, y: 0.8, z: 0 }, 14, COLORS.barrierHot, 6, 0.4);
          break;
        case 'shieldBreak':
          shake = Math.max(shake, 0.5);
          flash = 0.5;
          particles.burst({ x: p.x, y: e.y, z: -0.6 }, 80, COLORS.shield, 12, 0.9);
          break;
        case 'crash':
          crashed = true;
          shake = 0.9;
          flash = 0.8;
          cycle.group.visible = false;
          particles.derez(cycle.group, COLORS.player);
          particles.burst({ x: e.x, y: e.y, z: -0.6 }, 120, COLORS.barrierHot, 14, 1.2);
          break;
        default:
          break;
      }
    }
  }

  function sync(game, dt, events = []) {
    const D = game.distance;
    const travelled = D - lastDistance;
    lastDistance = D;
    handleEvents(game, events);

    const p = game.player;
    floor.update(D, game.time);
    scenery.update(D, game.time);

    // Player
    if (!crashed) cycle.update(game, dt, travelled);
    trail.update(game, crashed);

    shield.visible = game.powers.shield && !crashed;
    if (shield.visible) {
      shield.position.set(p.x, p.y + (p.sliding ? 0.45 : 0.8), 0);
      shield.rotation.y += dt * 1.5;
      shield.rotation.x += dt * 0.7;
      shield.material.opacity = 0.35 + Math.sin(game.time * 8) * 0.12;
    }
    if (!crashed) cycle.setGhost(p.invulnerable > 0 ? 0.5 + 0.5 * Math.sin(game.time * 40) : 1);

    // Obstacles
    const seen = new Set();
    for (const o of game.obstacles) {
      seen.add(o.id);
      let mesh = obstacleMeshes.get(o.id);
      if (!mesh) {
        mesh = pools[o.type].pop() || builders[o.type]();
        mesh.userData.type = o.type;
        mesh.userData.length = -1;
        obstacleMeshes.set(o.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(o.x, 0, D - (o.d + o.length / 2));
      if (mesh.userData.length !== o.length) {
        mesh.userData.length = o.length;
        for (const part of mesh.userData.parts) part.userData.setLength(o.length);
      }
      mesh.visible = !o.hit;
    }
    for (const [id, mesh] of obstacleMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        pools[mesh.userData.type].push(mesh);
        obstacleMeshes.delete(id);
      }
    }

    // Bits
    let n = 0;
    const spin = game.time * 3;
    for (const b of game.bits) {
      if (n >= MAX_BITS) break;
      const z = D - b.d;
      if (z < -180) continue;
      tmp.position.set(b.x, b.y + Math.sin(spin + b.d * 0.3) * 0.12, z);
      tmp.rotation.set(0, spin + b.d, 0);
      tmp.scale.setScalar(b.attracted ? 0.75 : 1);
      tmp.updateMatrix();
      bitMesh.setMatrixAt(n++, tmp.matrix);
    }
    bitMesh.count = n;
    bitMesh.instanceMatrix.needsUpdate = true;

    // Power-ups
    const seenP = new Set();
    for (const pu of game.powerups) {
      seenP.add(pu.id);
      let mesh = powerMeshes.get(pu.id);
      if (!mesh) {
        mesh = buildPower(pu.type);
        powerMeshes.set(pu.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(pu.x, pu.y + Math.sin(game.time * 3) * 0.15, D - pu.d);
      mesh.userData.ring.rotation.y = game.time * 2.5;
      mesh.userData.cage.rotation.y = -game.time * 1.2;
      mesh.userData.cage.rotation.x = game.time * 0.8;
    }
    for (const [id, mesh] of powerMeshes) {
      if (!seenP.has(id)) {
        scene.remove(mesh);
        mesh.traverse((c) => c.geometry?.dispose());
        powerMeshes.delete(id);
      }
    }

    particles.update(dt, travelled);

    // Camera: follow lane + jump, widen FOV with speed, shake on impacts.
    const speedT = (game.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
    const targetX = p.x * 0.62;
    const targetY = camBase.y + p.y * 0.35;
    const k = 1 - Math.exp(-dt * 7);
    camera.position.x += (targetX - camera.position.x) * k;
    camera.position.y += (targetY - camera.position.y) * k;
    camera.position.z = camBase.z - speedT * 0.6;
    shake = Math.max(0, shake - dt * 1.6);
    const s = shake * shake;
    camLook.set(p.x * 0.35 + (Math.random() - 0.5) * s, 0.8 + p.y * 0.2 + (Math.random() - 0.5) * s, -12);
    camera.position.x += (Math.random() - 0.5) * s * 0.6;
    camera.lookAt(camLook);
    camera.rotation.z += (targetX - camera.position.x) * 0.04; // bank into lane changes
    const baseFov = width / height < 0.8 ? 78 : 62;
    const fov = baseFov + speedT * 8;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    flash = Math.max(0, flash - dt * 2);
    bloom.strength = 0.75 + flash * 1.0;
  }

  function render() {
    composer.render();
  }

  function dispose() {
    renderer.dispose();
  }

  resize();
  return { sync, render, resize, reset, setQuality, dispose, renderer, get pixelRatio() { return pixelRatio; } };
}
