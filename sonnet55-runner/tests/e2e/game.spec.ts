import { expect, test } from '@playwright/test';
import { frames, gameState, openGame, phase, pixelStats, startRun, waitForPhase, watchErrors } from './helpers';

test.describe('boot & title', () => {
  test('loads cleanly, renders the Grid and shows the title screen', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await frames(page, 6);
    await expect(page).toHaveTitle(/GRIDRUN/);
    await expect(page.locator('h1.logo')).toContainText('GRIDRUN');
    await expect(page.locator('#btn-play')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();
    const s = await pixelStats(page);
    expect(s.lit).toBeGreaterThan(0.1);
    expect(s.distinct).toBeGreaterThan(12);
    expect(errors).toEqual([]);
  });

  test('attract-mode demo runs behind the title and never crashes', async ({ page }) => {
    await openGame(page);
    const a = await page.evaluate(() => (window as any).__gridrun.demo.distance as number);
    await page.waitForTimeout(1500);
    const b = await page.evaluate(() => (window as any).__gridrun.demo.distance as number);
    expect(b).toBeGreaterThan(a + 5);
    const st = await page.evaluate(() => (window as any).__gridrun.demo.state as string);
    expect(st).toBe('playing');
  });

  test('has no horizontal scrollbars and the controls legend is listed', async ({ page }) => {
    await openGame(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await expect(page.getByLabel('Controls')).toContainText('Jump');
  });
});

test.describe('gameplay flow', () => {
  test('Enter starts: 3-2-1 countdown, then HUD and a running game', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#title')).toBeHidden();
    await expect(page.locator('#countdown')).toBeVisible();
    expect(await phase(page)).toBe('countdown');
    await waitForPhase(page, 'playing', 30_000);
    await expect(page.locator('#hud')).toBeVisible();
    await expect.poll(async () => (await gameState(page))!.distance, { timeout: 15_000 }).toBeGreaterThan(5);
    await expect(page.locator('#score')).not.toHaveText('0');
    expect(errors).toEqual([]);
  });

  test('PLAY button works too', async ({ page }) => {
    await openGame(page);
    await page.locator('#btn-play').click();
    await waitForPhase(page, 'playing', 30_000);
  });

  test('keyboard: lanes, jump and slide change the player state', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    // freeze obstacles out of the way so inputs can be tested deterministically
    await page.evaluate(() => {
      const g = (window as any).__gridrun.game;
      g.obstacles = [];
      g.rows = [];
    });
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await gameState(page))!.lane).toBe(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await gameState(page))!.lane).toBe(2);
    await page.keyboard.press('a');
    await expect.poll(async () => (await gameState(page))!.lane).toBe(1);
    await page.keyboard.press('d');
    await expect.poll(async () => (await gameState(page))!.lane).toBe(2);

    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await gameState(page))!.y, { timeout: 3000 }).toBeGreaterThan(0.3);
    await expect.poll(async () => (await gameState(page))!.y, { timeout: 5000 }).toBe(0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await gameState(page))!.sliding, { timeout: 3000 }).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await gameState(page))!.y, { timeout: 3000 }).toBeGreaterThan(0.3);
  });

  test('swipe gestures drive the player on touch devices', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => {
      const g = (window as any).__gridrun.game;
      g.obstacles = [];
      g.rows = [];
    });
    const swipe = (dx: number, dy: number) =>
      page.evaluate(
        ({ dx, dy }) => {
          const c = document.getElementById('scene')!;
          const opts = (x: number, y: number) => ({ pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true });
          c.dispatchEvent(new PointerEvent('pointerdown', opts(300, 300)));
          c.dispatchEvent(new PointerEvent('pointermove', opts(300 + dx, 300 + dy)));
          c.dispatchEvent(new PointerEvent('pointerup', opts(300 + dx, 300 + dy)));
        },
        { dx, dy },
      );
    await swipe(-80, 5);
    await expect.poll(async () => (await gameState(page))!.lane).toBe(0);
    await swipe(80, -4);
    await expect.poll(async () => (await gameState(page))!.lane).toBe(1);
    await swipe(2, -90);
    await expect.poll(async () => (await gameState(page))!.y, { timeout: 3000 }).toBeGreaterThan(0.3);
    await expect.poll(async () => (await gameState(page))!.y, { timeout: 5000 }).toBe(0);
    await swipe(0, 90);
    await expect.poll(async () => (await gameState(page))!.sliding, { timeout: 3000 }).toBe(true);
  });

  test('autopilot survives and collects bits through the real render loop', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, 'seed=21');
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.setAutopilot(true));
    await page.evaluate(() => (window as any).__gridrun.advance(45));
    await frames(page, 5);
    const s = (await gameState(page))!;
    expect(s.state).toBe('playing');
    expect(s.time).toBeGreaterThan(44);
    expect(s.bits).toBeGreaterThan(20);
    expect(s.score).toBeGreaterThan(1500);
    const stats = await pixelStats(page);
    expect(stats.lit).toBeGreaterThan(0.1);
    expect(errors).toEqual([]);
  });

  test('hazards appear on the track as orange; player and grid as cyan', async ({ page }) => {
    await openGame(page, 'seed=21');
    await startRun(page);
    const centre = { x0: 0.38, y0: 0.3, x1: 0.62, y1: 0.6 };
    await page.evaluate(() => {
      const g = (window as any).__gridrun.game;
      g.pause(); // freeze the world so the frame is stable
      g.obstacles = [];
      g.pickups = [];
    });
    await frames(page, 6);
    const empty = await pixelStats(page, centre);
    expect(empty.orange).toBeLessThan(0.0005);
    expect((await pixelStats(page)).cyan).toBeGreaterThan(0.002);
    await page.evaluate(() => {
      const g = (window as any).__gridrun.game;
      g.addObstacle('block', 1, g.distance + 14);
      g.addObstacle('low', 0, g.distance + 14);
      g.addObstacle('high', 2, g.distance + 14);
    });
    await frames(page, 6);
    const withHazards = await pixelStats(page, centre);
    expect(withHazards.orange).toBeGreaterThan(0.002);
    expect(withHazards.orange).toBeGreaterThan(empty.orange * 5);
  });
});

test.describe('death, retry, records', () => {
  test('standing still crashes into an obstacle -> game over screen with stats', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.advance(120));
    await waitForPhase(page, 'over', 15_000);
    await expect(page.locator('#over')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#over')).toContainText('CONNECTION LOST');
    const score = Number((await page.locator('#f-score').textContent())!.replace(/,/g, ''));
    expect(score).toBeGreaterThan(0);
    await expect(page.locator('#f-dist')).toContainText('M');
    await expect(page.locator('#hud')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('retry via Enter starts a fresh run immediately; best score persists across reload', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.advance(120));
    await expect(page.locator('#over')).toBeVisible({ timeout: 15_000 });
    const best = await page.evaluate(() => (window as any).__gridrun.records.bestScore as number);
    expect(best).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await waitForPhase(page, 'playing', 5_000);
    const s = (await gameState(page))!;
    expect(s.score).toBeLessThan(200);
    expect(s.state).toBe('playing');

    await page.reload();
    await expect(page.locator('#records')).toContainText(String(best.toLocaleString('en-US')));
    await expect(page.locator('#records')).toContainText('RUNS');
  });

  test('menu button returns to the title and the demo resumes', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.advance(120));
    await expect(page.locator('#over')).toBeVisible({ timeout: 15_000 });
    await page.locator('#btn-menu').click();
    await expect(page.locator('#title')).toBeVisible();
    expect(await phase(page)).toBe('title');
  });

  test('pressing Enter right after a crash cannot instantly skip the game over screen', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.advance(120));
    await waitForPhase(page, 'over');
    await page.keyboard.press('Enter');
    expect(await phase(page)).toBe('over');
  });
});

test.describe('pause, sound, quality', () => {
  test('P pauses the world, resume counts down and continues', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => (window as any).__gridrun.setAutopilot(true));
    await page.keyboard.press('p');
    await expect(page.locator('#pause')).toBeVisible();
    expect(await phase(page)).toBe('paused');
    const a = (await gameState(page))!;
    await page.waitForTimeout(900);
    const b = (await gameState(page))!;
    expect(b.distance).toBe(a.distance);
    expect(b.state).toBe('paused');
    await page.keyboard.press('Enter'); // confirm = resume
    expect(await phase(page)).toBe('countdown');
    await waitForPhase(page, 'playing', 30_000);
    await expect.poll(async () => (await gameState(page))!.distance, { timeout: 15_000 }).toBeGreaterThan(a.distance + 3);
  });

  test('Escape pauses and the RESUME / RESTART / QUIT buttons work', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause')).toBeVisible();
    await page.locator('#btn-resume').click();
    await waitForPhase(page, 'playing', 30_000);
    await page.locator('#btn-pause').click();
    await expect(page.locator('#pause')).toBeVisible();
    await page.locator('#btn-restart').click();
    await waitForPhase(page, 'playing', 5_000);
    expect((await gameState(page))!.time).toBeLessThan(2);
    await page.keyboard.press('Escape');
    await page.locator('#btn-quit').click();
    await expect(page.locator('#title')).toBeVisible();
  });

  test('hiding the tab auto-pauses', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await phase(page)).toBe('paused');
  });

  test('sound toggle (M key and button) persists across reloads', async ({ page }) => {
    await openGame(page);
    expect(await page.evaluate(() => (window as any).__gridrun.muted)).toBe(false);
    await page.keyboard.press('m');
    expect(await page.evaluate(() => (window as any).__gridrun.muted)).toBe(true);
    await expect(page.locator('#tgl-sound')).toHaveText('SOUND: OFF');
    await page.reload();
    expect(await page.evaluate(() => (window as any).__gridrun.muted)).toBe(true);
    await page.locator('#tgl-sound').click();
    expect(await page.evaluate(() => (window as any).__gridrun.muted)).toBe(false);
  });

  test('graphics toggle switches between high and low and still renders', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, 'seed=7', 'high');
    expect(await page.evaluate(() => (window as any).__gridrun.quality)).toBe('high');
    await frames(page, 4);
    const high = await pixelStats(page);
    expect(high.lit).toBeGreaterThan(0.1);
    await page.keyboard.press('g');
    expect(await page.evaluate(() => (window as any).__gridrun.quality)).toBe('low');
    await frames(page, 4);
    const low = await pixelStats(page);
    expect(low.lit).toBeGreaterThan(0.1);
    expect(errors).toEqual([]);
  });
});

test.describe('audio & render budget', () => {
  test('audio context starts on the first user gesture without errors', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    expect(await page.evaluate(() => (window as any).__gridrun.audioState)).toBe('none');
    await startRun(page);
    await expect.poll(() => page.evaluate(() => (window as any).__gridrun.audioState)).toBe('running');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('draw calls and triangles stay inside a mobile-friendly budget at full speed', async ({ page }) => {
    await openGame(page, 'seed=33');
    await startRun(page);
    await page.evaluate(() => {
      (window as any).__gridrun.setAutopilot(true);
      (window as any).__gridrun.advance(100);
    });
    await frames(page, 6);
    const st = await page.evaluate(() => (window as any).__gridrun.stats as { calls: number; triangles: number });
    expect(st.calls).toBeGreaterThan(20);
    expect(st.calls).toBeLessThan(450);
    expect(st.triangles).toBeLessThan(40_000);
  });

  test('high quality (bloom) run with real power-ups stays error free', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, 'seed=5', 'high');
    await startRun(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__gridrun.setAutopilot(true);
      const g = w.__gridrun.game;
      g.effects.shield = true;
      g.effects.magnet = 8;
      g.effects.overclock = 8;
      g.effects.phase = 4;
      w.__gridrun.advance(30);
    });
    await frames(page, 6);
    expect((await gameState(page))!.state).toBe('playing');
    await expect(page.locator('#powers')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('layouts', () => {
  test('portrait phone: title fits, game runs, HUD is visible', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await openGame(page);
    await expect(page.locator('#btn-play')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.locator('#btn-play').tap();
    await waitForPhase(page, 'playing', 30_000);
    await expect(page.locator('#score')).toBeInViewport();
    await expect(page.locator('#btn-pause')).toBeInViewport();
    await frames(page, 4);
    const s = await pixelStats(page);
    expect(s.lit).toBeGreaterThan(0.1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('short landscape phone: play button reachable', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await openGame(page);
    await expect(page.locator('#btn-play')).toBeInViewport();
    await ctx.close();
  });
});

test('title shows the build-time and token credit', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('#credit')).toContainText(/BUILT IN .*TOKENS/);
});
