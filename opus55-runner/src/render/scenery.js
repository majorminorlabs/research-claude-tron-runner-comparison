import * as THREE from 'three';
import { createRng } from '../game/rng.js';

const PILLAR_SPACING = 16;
const PILLAR_COUNT = 14;

// Background set dressing: light pillars streaming past, a distant wireframe
// city, a horizon glow and a huge ring hanging in the sky.
export function createScenery() {
  const group = new THREE.Group();
  const rng = createRng(2049);

  // Horizon glow backdrop
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 700),
    new THREE.ShaderMaterial({
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          float h = vUv.y;
          float horizon = 0.358; // world y ≈ 0 on the 700-tall plane
          float glow = exp(-abs(h - horizon) * 48.0);
          vec3 col = mix(vec3(0.0, 0.01, 0.03), vec3(0.0, 0.03, 0.08), smoothstep(horizon + 0.15, horizon, h));
          col += vec3(0.0, 0.45, 0.7) * glow * 0.9;
          col += vec3(1.0, 0.35, 0.05) * exp(-abs(h - horizon) * 160.0) * 0.45;
          // Colours above are authored in sRGB; the output pass re-encodes linear.
          gl_FragColor = vec4(pow(max(col, 0.0), vec3(2.2)), 1.0);
        }
      `,
    }),
  );
  sky.position.set(0, 100, -360);
  group.add(sky);

  // Sky ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(70, 0.6, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0xff6a1a, fog: false, transparent: true, opacity: 0.55 }),
  );
  ring.position.set(0, 38, -340);
  group.add(ring);
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(58, 0.25, 6, 128),
    new THREE.MeshBasicMaterial({ color: 0x19c8ff, fog: false, transparent: true, opacity: 0.4 }),
  );
  ring2.position.copy(ring.position);
  group.add(ring2);

  // Distant city of wireframe towers
  const cityPositions = [];
  const cityColors = [];
  const cyan = new THREE.Color(0x0e7fa8);
  const amber = new THREE.Color(0x8a3c10);
  for (let i = 0; i < 110; i++) {
    const side = rng.chance(0.5) ? -1 : 1;
    const x = side * rng.range(18, 220);
    const z = -rng.range(200, 320);
    const w = rng.range(4, 14);
    const d = rng.range(4, 14);
    const h = rng.range(6, 60) * (Math.abs(x) < 60 ? 0.6 : 1);
    const c = rng.chance(0.18) ? amber : cyan;
    const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    box.translate(x, h / 2, z);
    const arr = box.attributes.position.array;
    for (let k = 0; k < arr.length; k += 3) {
      cityPositions.push(arr[k], arr[k + 1], arr[k + 2]);
      cityColors.push(c.r, c.g, c.b);
    }
  }
  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPositions, 3));
  cityGeo.setAttribute('color', new THREE.Float32BufferAttribute(cityColors, 3));
  group.add(new THREE.LineSegments(cityGeo, new THREE.LineBasicMaterial({ vertexColors: true, fog: false })));

  // Stars
  const starPos = [];
  for (let i = 0; i < 260; i++) {
    starPos.push(rng.range(-450, 450), rng.range(45, 170), -rng.range(300, 350));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  group.add(
    new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x5fa8c8, size: 1.2, sizeAttenuation: false, fog: false })),
  );

  // Light pillars that stream past on both sides
  const pillarGeo = new THREE.BoxGeometry(0.18, 7, 0.18);
  pillarGeo.translate(0, 3.5, 0);
  const pillars = new THREE.InstancedMesh(
    pillarGeo,
    new THREE.MeshBasicMaterial({ color: 0x0b9fd0 }),
    PILLAR_COUNT * 2,
  );
  pillars.frustumCulled = false;
  group.add(pillars);
  const capGeo = new THREE.BoxGeometry(2.6, 0.12, 0.12);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: 0xff7a1a }), PILLAR_COUNT * 2);
  caps.frustumCulled = false;
  group.add(caps);

  const tmp = new THREE.Object3D();
  return {
    group,
    update(distance, time) {
      const offset = distance % PILLAR_SPACING;
      let n = 0;
      for (let i = 0; i < PILLAR_COUNT; i++) {
        const z = -i * PILLAR_SPACING + offset + 8;
        for (const side of [-1, 1]) {
          tmp.position.set(side * 8.5, 0, z);
          tmp.rotation.set(0, 0, 0);
          tmp.scale.set(1, 1, 1);
          tmp.updateMatrix();
          pillars.setMatrixAt(n, tmp.matrix);
          tmp.position.set(side * 7.4, 7, z);
          tmp.updateMatrix();
          caps.setMatrixAt(n, tmp.matrix);
          n++;
        }
      }
      pillars.instanceMatrix.needsUpdate = true;
      caps.instanceMatrix.needsUpdate = true;
      ring.rotation.z = time * 0.05;
      ring2.rotation.z = -time * 0.08;
    },
  };
}
