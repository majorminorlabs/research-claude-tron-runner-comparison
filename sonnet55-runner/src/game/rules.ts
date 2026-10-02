import { CFG, type Action, type Cell } from './config';

export interface Obstacle {
  id: number;
  kind: 'low' | 'high' | 'block';
  lane: number;
  /** Track distance of the obstacle's centre. */
  z: number;
  depth: number;
  /** Player has overlapped it without being hit. */
  crossed: boolean;
  /** Dodge bonus has been awarded. */
  awarded: boolean;
  /** Destroyed by shield / phase; no longer collides. */
  dead: boolean;
}

export interface Row {
  z: number;
  cells: [Cell, Cell, Cell];
  /** Lane the generator guaranteed to be passable. */
  path: number;
}

export function actionFor(c: Cell): Action {
  return c === 'low' ? 'jump' : c === 'high' ? 'slide' : 'none';
}

/**
 * Minimum time (seconds) between two consecutive rows so that a player who
 * clears the first with `prev` and needs `next` for the second, shifting
 * `dLane` lanes in between, can still make it. Deliberately conservative
 * versus the raw physics so it is also fair for humans.
 */
export function minGapSeconds(prev: Action, next: Action, dLane: number): number {
  const laneTime = dLane * 0.2;
  let actTime = 0;
  if (prev === 'jump') actTime = next === 'none' ? 0 : next === 'jump' ? 0.6 : 0.55;
  else if (prev === 'slide') actTime = next === 'jump' ? 0.4 : next === 'slide' ? 0.35 : 0;
  return Math.max(laneTime, actTime, 0.5);
}

/** Does an obstacle collide with a player body spanning [feetY, feetY+height]? */
export function hitsVertically(kind: Obstacle['kind'], feetY: number, height: number): boolean {
  switch (kind) {
    case 'low':
      return feetY < CFG.lowHeight - CFG.lowGrace;
    case 'high':
      return feetY < CFG.highTop && feetY + height > CFG.highBottom;
    case 'block':
      return feetY < CFG.blockTop;
  }
}
