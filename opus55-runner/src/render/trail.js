import * as THREE from 'three';
import { COLORS } from './materials.js';

const MAX_SAMPLES = 90;
const TRAIL_LENGTH = 34;
const REAR_OFFSET = 1.0;

// The light-cycle's light wall: a vertical ribbon that records the player's
// lateral position over the last stretch of track.
export function createTrail() {
  const positions = new Float32Array(MAX_SAMPLES * 2 * 3);
  const colors = new Float32Array(MAX_SAMPLES * 2 * 3);
  const indices = [];
  for (let i = 0; i < MAX_SAMPLES - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(indices);

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.frustumCulled = false;

  const base = new THREE.Color(COLORS.player);
  let samples = [];

  return {
    mesh,
    reset() {
      samples = [];
      geo.setDrawRange(0, 0);
    },
    update(game, frozen) {
      const p = game.player;
      const D = game.distance;
      if (!frozen) {
        const top = p.sliding ? 0.35 : 0.72;
        const last = samples[samples.length - 1];
        const sample = { d: D - REAR_OFFSET, x: p.x, y: p.y + 0.12, h: top };
        if (!last || D - REAR_OFFSET - last.d > 0.45) samples.push(sample);
        else Object.assign(last, sample);
        while (samples.length > MAX_SAMPLES || (samples.length && D - samples[0].d > TRAIL_LENGTH)) {
          samples.shift();
        }
      }
      const n = samples.length;
      if (n < 2) {
        geo.setDrawRange(0, 0);
        return;
      }
      for (let i = 0; i < n; i++) {
        const s = samples[n - 1 - i]; // i = 0 is the newest (at the bike)
        const z = D - s.d;
        const fade = Math.pow(1 - i / (n - 1), 1.6) * (frozen ? 0.6 : 1);
        const o = i * 6;
        positions[o] = s.x;
        positions[o + 1] = s.y;
        positions[o + 2] = z;
        positions[o + 3] = s.x;
        positions[o + 4] = s.y + s.h;
        positions[o + 5] = z;
        colors[o] = base.r * fade * 0.5;
        colors[o + 1] = base.g * fade * 0.5;
        colors[o + 2] = base.b * fade * 0.5;
        colors[o + 3] = base.r * fade;
        colors[o + 4] = base.g * fade;
        colors[o + 5] = base.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.setDrawRange(0, (n - 1) * 6);
    },
  };
}
