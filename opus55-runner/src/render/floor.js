import * as THREE from 'three';
import { LANE_WIDTH } from '../game/config.js';

// Infinite scrolling neon grid, drawn analytically in a fragment shader so
// lines stay crisp (anti-aliased with fwidth) at any distance.
export function createFloor() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uDist: { value: 0 },
      uTime: { value: 0 },
      uHalfLane: { value: LANE_WIDTH / 2 },
      uFogNear: { value: 30 },
      uFogFar: { value: 175 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDist;
      uniform float uTime;
      uniform float uHalfLane;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;

      float line(float coord, float spacing, float width) {
        float c = coord / spacing;
        float d = abs(fract(c - 0.5) - 0.5) * spacing;
        float aa = fwidth(coord) * 1.2;
        return 1.0 - smoothstep(width, width + aa, d);
      }

      void main() {
        float x = vWorld.x;
        float along = uDist - vWorld.z; // track coordinate
        float ax = abs(x);
        float trackEdge = uHalfLane * 3.0;
        float onTrack = 1.0 - step(trackEdge, ax);

        vec3 cyan = vec3(0.04, 0.83, 1.0);
        vec3 deep = vec3(0.0, 0.25, 0.45);
        vec3 col = mix(vec3(0.01, 0.025, 0.05), vec3(0.02, 0.06, 0.1), onTrack);

        // Track: lane dividers, bright edges, scrolling cross-lines.
        float divider = line(x + uHalfLane, uHalfLane * 2.0, 0.03) * onTrack;
        float edge = 1.0 - smoothstep(0.06, 0.06 + fwidth(ax) * 1.5, abs(ax - trackEdge));
        float cross = line(along, 4.0, 0.035) * onTrack;
        float pulse = line(along, 48.0, 0.25) * onTrack;
        col += cyan * divider * 0.45;
        col += cyan * cross * 0.22;
        col += cyan * pulse * 0.25;
        col += vec3(0.5, 0.95, 1.0) * edge * 1.1;
        // Soft glow hugging the edges.
        col += cyan * exp(-abs(ax - trackEdge) * 3.0) * 0.08;

        // Outer grid.
        float off = 1.0 - onTrack;
        float gx = line(x, 6.0, 0.04);
        float gz = line(along, 6.0, 0.04);
        col += deep * max(gx, gz) * off * 0.9;

        float dist = length(vWorld.xz - cameraPosition.xz);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, vec3(0.01, 0.03, 0.07), fog);
        // Colours above are authored in sRGB; the output pass re-encodes linear.
        gl_FragColor = vec4(pow(max(col, 0.0), vec3(2.2)), 1.0);
      }
    `,
  });
  const geo = new THREE.PlaneGeometry(260, 420, 1, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -170;
  return {
    mesh,
    update(distance, time) {
      material.uniforms.uDist.value = distance % 4800;
      material.uniforms.uTime.value = time;
    },
  };
}
