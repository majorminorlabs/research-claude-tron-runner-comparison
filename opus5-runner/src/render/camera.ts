/**
 * A fixed chase camera. The track is straight and flat, so a plain pinhole
 * projection is enough — and because every track line is either constant-X or
 * constant-Z, each one projects to a straight screen line.
 */
export interface Camera {
  focal: number;
  cx: number;
  /** Screen Y of the horizon: everything converges here. */
  cy: number;
  height: number;
  /** Camera position behind the player, in world units. */
  back: number;
  shakeX: number;
  shakeY: number;
  /** Lateral lean, nudged toward the player's X for a sense of weight. */
  offsetX: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Pixels per world unit at this depth; 0 when behind the near plane. */
  scale: number;
  visible: boolean;
}

export const NEAR_PLANE = 0.75;

export function createCamera(): Camera {
  return {
    focal: 1,
    cx: 0,
    cy: 0,
    height: 3.8,
    back: 8.6,
    shakeX: 0,
    shakeY: 0,
    offsetX: 0,
  };
}

/**
 * Recomputes the screen-space parameters for a canvas size. The focal length is
 * bounded by width as well as height: on a tall phone a height-only fit would
 * push the track edges past the sides of the screen.
 */
export function fitCamera(cam: Camera, width: number, height: number): void {
  cam.focal = Math.min(width * 0.9, height * 0.92);
  cam.cx = width * 0.5;
  // Portrait screens get a higher horizon, so less of the frame is empty sky.
  const aspect = width / Math.max(1, height);
  const horizonFraction = Math.min(0.44, Math.max(0.34, 0.26 + 0.12 * aspect));
  cam.cy = height * horizonFraction;
}

/** Projects a world point. `z` is distance ahead of the player (may be < 0). */
export function project(cam: Camera, x: number, y: number, z: number): Projected {
  const depth = z + cam.back;
  if (depth < NEAR_PLANE) return { x: 0, y: 0, scale: 0, visible: false };
  const scale = cam.focal / depth;
  return {
    x: cam.cx + (x - cam.offsetX) * scale + cam.shakeX,
    y: cam.cy - (y - cam.height) * scale + cam.shakeY,
    scale,
    visible: true,
  };
}
