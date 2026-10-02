const KEY = 'gridrunner.best.v1';

/**
 * Personal best, kept in this browser only. Every access is guarded: storage
 * throws in private windows and when site data is blocked.
 */
export function readBest(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return 0;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeBest(score: number): void {
  try {
    localStorage.setItem(KEY, String(Math.floor(score)));
  } catch {
    // Nothing to do; a lost personal best is not worth interrupting play.
  }
}
