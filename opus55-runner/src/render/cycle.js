import * as THREE from 'three';
import { LANES } from '../game/config.js';
import { COLORS } from './materials.js';

const WHEEL_R = 0.36;

// The player's light cycle: an extruded side profile with neon edges,
// glowing wheel rims and a rider. Banks into turns, pitches on jumps and
// lays down sideways for a power slide.
export function createCycle() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(1.12);
  group.add(body);

  const profile = new THREE.Shape();
  const pts = [
    [-1.05, 0.3], [-1.0, 0.56], [-0.62, 0.8], [0.0, 0.84], [0.42, 0.98],
    [0.92, 0.82], [1.06, 0.48], [0.96, 0.2], [0.62, 0.1], [-0.62, 0.1], [-0.96, 0.18],
  ];
  profile.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) profile.lineTo(x, y);
  profile.closePath();
  const shell = new THREE.ExtrudeGeometry(profile, { depth: 0.46, bevelEnabled: false });
  shell.translate(0, 0, -0.23);
  shell.rotateY(-Math.PI / 2); // profile x → track -z (nose forward)

  const shellMat = new THREE.MeshBasicMaterial({ color: COLORS.playerBody });
  body.add(new THREE.Mesh(shell, shellMat));
  const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.player });
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(shell, 20), edgeMat));

  // Side light stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.05, 1.7),
    new THREE.MeshBasicMaterial({ color: COLORS.player }),
  );
  stripe.position.set(0, 0.5, 0);
  body.add(stripe);

  // Tail light and nose light so the bike reads clearly from behind.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tail.position.set(0, 0.62, 1.03);
  body.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), new THREE.MeshBasicMaterial({ color: COLORS.player }));
  fin.position.set(0, 0.8, 0.98);
  body.add(fin);

  // Wheels
  const wheels = [];
  const rimMat = new THREE.MeshBasicMaterial({ color: COLORS.player });
  const hubMat = new THREE.MeshBasicMaterial({ color: 0x02080c });
  for (const z of [-0.68, 0.68]) {
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.05, 8, 28), rimMat);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 0.6, 0.025, 6, 20), rimMat);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.95, WHEEL_R * 0.95, 0.5, 20), hubMat);
    hub.rotation.x = Math.PI / 2;
    for (const side of [-0.26, 0.26]) {
      const r = rim.clone();
      r.position.z = side;
      wheel.add(r);
      const i2 = inner.clone();
      i2.position.z = side;
      wheel.add(i2);
    }
    wheel.add(hub);
    // spokes so rotation is visible
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(WHEEL_R * 1.7, 0.04, 0.54), rimMat);
      spoke.rotation.z = (k * Math.PI) / 3;
      wheel.add(spoke);
    }
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, WHEEL_R, z);
    body.add(wheel);
    wheels.push(wheel);
  }

  // Rider
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 4, 10), shellMat);
  torso.rotation.x = Math.PI / 2 - 0.35;
  torso.position.set(0, 1.0, 0.18);
  rider.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), shellMat);
  helmet.position.set(0, 1.18, -0.28);
  rider.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.022, 6, 24, Math.PI),
    new THREE.MeshBasicMaterial({ color: COLORS.player }),
  );
  visor.rotation.set(0, Math.PI / 2, Math.PI / 2);
  visor.position.copy(helmet.position);
  rider.add(visor);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), rimMat);
  spine.position.set(0, 1.12, 0.12);
  spine.rotation.x = -0.35;
  rider.add(spine);
  body.add(rider);

  let roll = 0;
  let pitch = 0;
  let slideRoll = 0;
  let slideDir = 1;
  let ghost = 1;

  return {
    group,
    setGhost(v) {
      ghost = v;
      group.visible = ghost > 0.5;
    },
    update(game, dt, travelled) {
      const p = game.player;
      const k = 1 - Math.exp(-dt * 12);
      const lateral = LANES[p.lane] - p.x;
      if (Math.abs(lateral) > 0.05) slideDir = lateral < 0 ? 1 : -1;
      roll += (THREE.MathUtils.clamp(lateral * 0.28, -0.5, 0.5) - roll) * k;
      const targetPitch = p.grounded ? 0 : THREE.MathUtils.clamp(p.vy * 0.022, -0.3, 0.3);
      pitch += (targetPitch - pitch) * k;
      slideRoll += ((p.sliding ? 1.25 * slideDir : 0) - slideRoll) * (1 - Math.exp(-dt * 18));

      group.position.set(p.x, p.y, 0);
      body.rotation.set(pitch, 0, roll + slideRoll);
      // Lay the bike on its side: lower so the top of the hull hugs the floor.
      body.position.y = Math.abs(slideRoll) * 0.12;
      rider.visible = Math.abs(slideRoll) < 0.6;
      for (const w of wheels) w.rotation.z += travelled / WHEEL_R;
    },
  };
}
