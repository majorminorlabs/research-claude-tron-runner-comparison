import { actionFor, minGapSeconds, type Row } from './rules';
import type { Action } from './config';

export interface Plan {
  /** Lane to be in for each row (same length as `rows`). */
  lanes: number[];
}

/**
 * Independent reachability search over a list of rows. Returns a lane per row
 * such that every transition respects `minGapSeconds`, or null if the rows
 * cannot be survived. Used by the autopilot and by the fairness tests.
 *
 * `startLane` / `timeToFirst` describe the player's situation: settled in
 * `startLane` with `timeToFirst` seconds until the first row is reached.
 */
export function solveRows(
  rows: readonly Row[],
  speed: number,
  startLane: number,
  timeToFirst: number,
): Plan | null {
  const n = rows.length;
  if (n === 0) return { lanes: [] };
  const INF = 1e9;
  // cost[i][lane] = number of lane changes to reach lane at row i, parent for backtracking
  const cost: number[][] = [];
  const parent: number[][] = [];
  for (let i = 0; i < n; i++) {
    cost.push([INF, INF, INF]);
    parent.push([-1, -1, -1]);
  }
  for (let lane = 0; lane < 3; lane++) {
    const cell = rows[0]!.cells[lane]!;
    if (cell === 'block') continue;
    const d = Math.abs(lane - startLane);
    if (timeToFirst < d * 0.2 - 1e-9) continue;
    cost[0]![lane] = d;
    parent[0]![lane] = startLane;
  }
  for (let i = 1; i < n; i++) {
    const gapT = (rows[i]!.z - rows[i - 1]!.z) / speed;
    for (let to = 0; to < 3; to++) {
      const cell = rows[i]!.cells[to] ?? null;
      if (cell === 'block') continue;
      const act: Action = actionFor(cell);
      for (let from = 0; from < 3; from++) {
        if (cost[i - 1]![from]! >= INF) continue;
        const prevAct = actionFor(rows[i - 1]!.cells[from] ?? null);
        const need = minGapSeconds(prevAct, act, Math.abs(to - from));
        if (gapT + 1e-9 < need) continue;
        const c = cost[i - 1]![from]! + Math.abs(to - from);
        if (c < cost[i]![to]!) {
          cost[i]![to] = c;
          parent[i]![to] = from;
        }
      }
    }
  }
  let best = -1;
  for (let lane = 0; lane < 3; lane++) {
    if (cost[n - 1]![lane]! < INF && (best < 0 || cost[n - 1]![lane]! < cost[n - 1]![best]!)) best = lane;
  }
  if (best < 0) return null;
  const lanes = new Array<number>(n);
  let cur = best;
  for (let i = n - 1; i >= 0; i--) {
    lanes[i] = cur;
    cur = parent[i]![cur]!;
  }
  return { lanes };
}
