/** localStorage wrapper that never throws (private mode, blocked storage, ...). */
const PREFIX = 'gridrun.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw) as T;
    return typeof v === typeof fallback ? v : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress simply isn't remembered */
  }
}

export interface Records {
  bestScore: number;
  bestDistance: number;
  runs: number;
}

export function loadRecords(): Records {
  return {
    bestScore: Math.max(0, Math.floor(load('bestScore', 0))),
    bestDistance: Math.max(0, Math.floor(load('bestDistance', 0))),
    runs: Math.max(0, Math.floor(load('runs', 0))),
  };
}

/** Returns the updated records and whether the score is a new best. */
export function recordRun(prev: Records, score: number, distance: number): { records: Records; newBest: boolean } {
  const newBest = score > prev.bestScore;
  const records: Records = {
    bestScore: Math.max(prev.bestScore, Math.floor(score)),
    bestDistance: Math.max(prev.bestDistance, Math.floor(distance)),
    runs: prev.runs + 1,
  };
  save('bestScore', records.bestScore);
  save('bestDistance', records.bestDistance);
  save('runs', records.runs);
  return { records, newBest };
}
