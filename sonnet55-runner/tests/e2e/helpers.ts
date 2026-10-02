import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

/** Collect console errors and uncaught exceptions for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

/** Use low graphics so software-rendered CI frames stay fast (unless a test overrides). */
export async function openGame(page: Page, query = 'seed=7', quality: 'low' | 'high' = 'low'): Promise<void> {
  await page.addInitScript((q) => {
    try {
      if (!localStorage.getItem('gridrun.quality')) localStorage.setItem('gridrun.quality', JSON.stringify(q));
    } catch {
      /* ignore */
    }
  }, quality);
  await page.goto(`/?debug&${query}`);
  await expect(page.locator('#title')).toBeVisible();
}

export const phase = (page: Page): Promise<string> => page.evaluate(() => (window as any).__gridrun.phase as string);

export async function waitForPhase(page: Page, want: string, timeout = 20_000): Promise<void> {
  await expect.poll(() => phase(page), { timeout }).toBe(want);
}

export async function startRun(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
  await waitForPhase(page, 'playing', 30_000);
}

export const gameState = (page: Page) =>
  page.evaluate(() => {
    const g = (window as any).__gridrun.game;
    return g
      ? {
          state: g.state as string,
          distance: g.distance as number,
          score: g.score as number,
          bits: g.bits as number,
          lane: g.player.lane as number,
          y: g.player.y as number,
          sliding: g.player.sliding as boolean,
          speed: g.speed as number,
          time: g.time as number,
        }
      : null;
  });

export interface PixelStats {
  width: number;
  height: number;
  /** fraction of pixels that are not near-black */
  lit: number;
  cyan: number;
  orange: number;
  /** distinct coarse colours: crude "is something interesting on screen" metric */
  distinct: number;
}

export interface Crop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Colour statistics of the current frame, optionally of a sub-rectangle given in 0..1 fractions. */
export async function pixelStats(page: Page, crop: Crop = { x0: 0, y0: 0, x1: 1, y1: 1 }): Promise<PixelStats> {
  const buf = await page.screenshot();
  const png = PNG.sync.read(buf);
  let lit = 0;
  let cyan = 0;
  let orange = 0;
  const seen = new Set<number>();
  const xa = Math.floor(crop.x0 * png.width);
  const xb = Math.floor(crop.x1 * png.width);
  const ya = Math.floor(crop.y0 * png.height);
  const yb = Math.floor(crop.y1 * png.height);
  const total = Math.max(1, (xb - xa) * (yb - ya));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i]!;
      const g = png.data[i + 1]!;
      const b = png.data[i + 2]!;
      if (r + g + b > 60) lit++;
      if (b > 170 && g > 170 && r < 140) cyan++;
      if (r > 190 && g > 60 && g < 200 && b < 100) orange++;
      seen.add(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
    }
  }
  return { width: png.width, height: png.height, lit: lit / total, cyan: cyan / total, orange: orange / total, distinct: seen.size };
}

/** Let a bunch of real frames render. */
export const frames = (page: Page, n = 4): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const f = (): void => {
          if (++i >= count) resolve();
          else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      }),
    n,
  );
