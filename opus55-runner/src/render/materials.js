import * as THREE from 'three';

export const COLORS = {
  sky: 0x01030a,
  grid: new THREE.Color(0x0bd3ff),
  player: 0x2ef2ff,
  playerBody: 0x05121a,
  barrier: 0xff7a1a,
  barrierHot: 0xffb066,
  beam: 0xffc21a,
  beamHot: 0xfff0a0,
  wall: 0xff3b2f,
  wallHot: 0xff9a80,
  bit: 0xb8fbff,
  shield: 0x3d8bff,
  shieldCss: '#5aa0ff',
  magnet: 0xfff23d,
  magnetCss: '#fff23d',
  multi: 0xff3df2,
  multiCss: '#ff5af5',
};

const barGeo = new THREE.BoxGeometry(1, 1, 1);
const faceMats = new Map();
const edgeMats = new Map();

function faceMaterial(color, opacity) {
  const key = `${color}|${opacity}`;
  if (!faceMats.has(key)) {
    faceMats.set(
      key,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.035),
        transparent: true,
        opacity,
      }),
    );
  }
  return faceMats.get(key);
}

function edgeMaterial(color) {
  if (!edgeMats.has(color)) edgeMats.set(color, new THREE.MeshBasicMaterial({ color }));
  return edgeMats.get(color);
}

/**
 * A dark translucent box outlined by thick neon edge bars — the core Tron
 * look. Returns a group with `setLength(z)` that stretches it along the
 * track without fattening the edges.
 */
export function glowBox(w, h, color, faceOpacity = 0.85, t = 0.07) {
  const group = new THREE.Group();
  const face = new THREE.Mesh(barGeo, faceMaterial(color, faceOpacity));
  face.scale.set(w, h, 1);
  group.add(face);
  const mat = edgeMaterial(color);
  const along = [];
  const ends = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set((sx * w) / 2, (sy * h) / 2, 0);
      bar.scale.set(t, t, 1);
      group.add(bar);
      along.push(bar);
    }
  }
  for (const sz of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set(0, (sy * h) / 2, 0);
      bar.scale.set(w + t, t, t);
      bar.userData.sz = sz;
      group.add(bar);
      ends.push(bar);
    }
    for (const sx of [-1, 1]) {
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set((sx * w) / 2, 0, 0);
      bar.scale.set(t, h + t, t);
      bar.userData.sz = sz;
      group.add(bar);
      ends.push(bar);
    }
  }
  group.userData.setLength = (len) => {
    face.scale.z = len;
    for (const bar of along) bar.scale.z = len + t;
    for (const bar of ends) bar.position.z = (bar.userData.sz * len) / 2;
  };
  group.userData.setLength(1);
  return group;
}

export function makeLabelTexture(text, css) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.font = `900 ${text.length > 1 ? 58 : 72}px Orbitron, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = css;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, size / 2, size / 2 + 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = css;
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
