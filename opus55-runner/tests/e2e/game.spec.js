import { test, expect } from '@playwright/test';

// Seeds chosen from the deterministic generator:
//  - FAST_CRASH: an idle player hits the first obstacle row after ~3s.
//  - SLOW_CRASH: an idle player survives ~7s, leaving time to test controls.
const FAST_CRASH = 3;
const SLOW_CRASH = 35;

const snapshot = (page) => page.evaluate(() => window.__gridRunner.snapshot());

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function boot(page, query = '') {
  await page.goto(`/${query}`);
  await expect(page.getByTestId('title')).toBeVisible();
  await page.waitForFunction(() => window.__gridRunner?.phase === 'title');
}

async function startRun(page) {
  await page.getByTestId('start').click();
  await page.waitForFunction(() => window.__gridRunner.phase === 'playing');
}

test('boots to the title screen with a running attract demo and no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page).toHaveTitle('GRID RUNNER');
  await expect(page.locator('h1')).toContainText('GRID');
  const a = await snapshot(page);
  // the attract demo keeps running behind the menu
  await expect.poll(async () => (await snapshot(page)).distance).toBeGreaterThan(a.distance);
  const hasGl = await page.evaluate(() => {
    const c = document.getElementById('game');
    return c.width > 0 && c.height > 0;
  });
  expect(hasGl).toBe(true);
  await expect(page.locator('#hud')).toBeHidden();
  expect(errors).toEqual([]);
});

test('starting a run shows the HUD and the score climbs', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, `?seed=${SLOW_CRASH}`);
  await startRun(page);
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.getByTestId('title')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).score).toBeGreaterThan(0);
  expect((await snapshot(page)).seed).toBe(SLOW_CRASH);
  await expect(page.getByTestId('score')).not.toHaveText('0');
  expect(errors).toEqual([]);
});

test('keyboard controls: lanes, jump and slide', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test runs on desktop');
  await boot(page, `?seed=${SLOW_CRASH}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gridRunner.phase === 'playing');

  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).lane).toBe(0);
  await page.keyboard.press('ArrowLeft'); // already at the edge
  await expect.poll(async () => (await snapshot(page)).lane).toBe(0);
  await page.keyboard.press('KeyD');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).lane).toBe(2);

  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).y).toBeGreaterThan(0.3);
  await expect.poll(async () => (await snapshot(page)).y).toBe(0);

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(true);
});

test('swipe controls work with pointer drags', async ({ page }) => {
  await boot(page, `?seed=${SLOW_CRASH}`);
  await startRun(page);
  const vp = page.viewportSize();
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  const swipe = async (dx, dy) => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 2 });
    await page.mouse.move(cx + dx, cy + dy, { steps: 2 });
    await page.mouse.up();
  };
  await swipe(120, 0);
  await expect.poll(async () => (await snapshot(page)).lane).toBe(2);
  await swipe(-120, 0);
  await expect.poll(async () => (await snapshot(page)).lane).toBe(1);
  await swipe(0, -120);
  await expect.poll(async () => (await snapshot(page)).y).toBeGreaterThan(0.3);
});

test('pause freezes the run and resume continues it', async ({ page }) => {
  await boot(page, `?seed=${SLOW_CRASH}`);
  await startRun(page);
  await page.waitForTimeout(300);
  await page.locator('#btn-pause').click();
  await expect(page.getByTestId('paused')).toBeVisible();
  const a = await snapshot(page);
  await page.waitForTimeout(500);
  const b = await snapshot(page);
  expect(b.distance).toBe(a.distance);
  expect(b.phase).toBe('paused');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('paused')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).distance).toBeGreaterThan(b.distance);
});

test('losing focus auto-pauses', async ({ page }) => {
  await boot(page, `?seed=${SLOW_CRASH}`);
  await startRun(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('paused')).toBeVisible();
});

test('crashing shows results, saves the best score and allows a retry', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, `?seed=${FAST_CRASH}`);
  await startRun(page);
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15_000 });
  const finalScore = await page.getByTestId('final-score').textContent();
  expect(Number(finalScore.replace(/,/g, ''))).toBeGreaterThan(0);
  await expect(page.locator('#final-best')).toHaveText(finalScore);

  await page.getByTestId('retry').click();
  await page.waitForFunction(() => window.__gridRunner.phase === 'playing');
  await expect(page.getByTestId('gameover')).toBeHidden();

  await page.reload();
  await expect(page.locator('#best-title')).toHaveText(finalScore);
  expect(errors).toEqual([]);
});

test('menu button returns to the title screen', async ({ page }) => {
  await boot(page, `?seed=${FAST_CRASH}`);
  await startRun(page);
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByTestId('title')).toBeVisible();
  await page.waitForFunction(() => window.__gridRunner.phase === 'title');
});

test('mute toggle persists across reloads', async ({ page }) => {
  await boot(page);
  const btn = page.locator('#btn-mute');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#btn-mute')).toHaveAttribute('aria-pressed', 'true');
});

test('shows a friendly message when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith('webgl')) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto('/');
  await expect(page.getByText('Grid offline')).toBeVisible();
  await expect(page.getByTestId('title')).toBeHidden();
});

test('works without localStorage', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await boot(page, `?seed=${FAST_CRASH}`);
  await startRun(page);
  await expect(page.getByTestId('gameover')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
