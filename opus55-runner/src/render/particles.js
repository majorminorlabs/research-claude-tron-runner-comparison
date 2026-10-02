import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Fixed-capacity additive spark system. Particles are anchored to the track,
// so they stream past the camera like the rest of the world.
export function createParticles(capacity) {
  const pos = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const base = new Float32Array(capacity * 3);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.22,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  points.frustumCulled = false;

  const color = new THREE.Color();
  function spawn(x, y, z, vx, vy, vz, c, l) {
    const i = cursor;
    cursor = (cursor + 1) % capacity;
    pos.set([x, y, z], i * 3);
    vel.set([vx, vy, vz], i * 3);
    base.set([c.r, c.g, c.b], i * 3);
    life[i] = maxLife[i] = l;
  }

  return {
    points,
    clear() {
      life.fill(0);
      col.fill(0);
      geo.attributes.color.needsUpdate = true;
    },
    burst(at, count, hex, speed, lifetime) {
      color.set(hex);
      for (let n = 0; n < count; n++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const s = speed * (0.35 + Math.random() * 0.65);
        spawn(
          at.x, at.y, at.z,
          Math.sin(phi) * Math.cos(theta) * s,
          Math.abs(Math.cos(phi)) * s * 0.8 + 1,
          Math.sin(phi) * Math.sin(theta) * s,
          color,
          lifetime * (0.6 + Math.random() * 0.6),
        );
      }
    },
    // Disintegrate an object into a cloud of voxels-sparks.
    derez(object, hex) {
      color.set(hex);
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      for (let n = 0; n < 320; n++) {
        const x = box.min.x + Math.random() * size.x;
        const y = box.min.y + Math.random() * size.y;
        const z = box.min.z + Math.random() * size.z;
        spawn(x, y, z, (Math.random() - 0.5) * 6, Math.random() * 7, (Math.random() - 0.3) * 8, color, 1.2 + Math.random() * 1.3);
      }
    },
    update(dt, travelled) {
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        const o = i * 3;
        if (life[i] <= 0) {
          col[o] = col[o + 1] = col[o + 2] = 0;
          continue;
        }
        vel[o + 1] -= 9 * dt;
        pos[o] += vel[o] * dt;
        pos[o + 1] = Math.max(0.02, pos[o + 1] + vel[o + 1] * dt);
        pos[o + 2] += vel[o + 2] * dt + travelled;
        const f = life[i] / maxLife[i];
        col[o] = base[o] * f;
        col[o + 1] = base[o + 1] * f;
        col[o + 2] = base[o + 2] * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
