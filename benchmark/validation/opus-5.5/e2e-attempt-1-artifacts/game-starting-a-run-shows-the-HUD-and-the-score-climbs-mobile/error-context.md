# Instructions

- Following Playwright test failedbenchmark-set
- Explain why, be concise, respect Playwright best practicesbenchmark-set
- Provide a snippet of code with the fix, if possiblebenchmark-set

# Test info

- Name: gamebenchmark-setspecbenchmark-setjs >> starting a run shows the HUD and the score climbs
- Location: tests/e2e/gamebenchmark-setspecbenchmark-setjs:48:1

# Error details

```
Error: pagebenchmark-setgoto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/?seed=35
Call log:
  - navigating to "http://localhost:4173/?seed=35", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Seeds chosen from the deterministic generator:
  4   | //  - FAST_CRASH: an idle player hits the first obstacle row after ~3sbenchmark-set
  5   | //  - SLOW_CRASH: an idle player survives ~7s, leaving time to test controlsbenchmark-set
  6   | const FAST_CRASH = 3;
  7   | const SLOW_CRASH = 35;
  8   | 
  9   | const snapshot = (page) => pagebenchmark-setevaluate(() => windowbenchmark-set__gridRunnerbenchmark-setsnapshot());
  10  | 
  11  | function trackErrors(page) {
  12  |   const errors = [];
  13  |   pagebenchmark-seton('pageerror', (err) => errorsbenchmark-setpush(errbenchmark-setmessage));
  14  |   pagebenchmark-seton('console', (msg) => {
  15  |     if (msgbenchmark-settype() === 'error') errorsbenchmark-setpush(msgbenchmark-settext());
  16  |   });
  17  |   return errors;
  18  | }
  19  | 
  20  | async function boot(page, query = '') {
> 21  |   await pagebenchmark-setgoto(`/${query}`);
      |              ^ Error: pagebenchmark-setgoto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/?seed=35
  22  |   await expect(pagebenchmark-setgetByTestId('title'))benchmark-settoBeVisible();
  23  |   await pagebenchmark-setwaitForFunction(() => windowbenchmark-set__gridRunner?benchmark-setphase === 'title');
  24  | }
  25  | 
  26  | async function startRun(page) {
  27  |   await pagebenchmark-setgetByTestId('start')benchmark-setclick();
  28  |   await pagebenchmark-setwaitForFunction(() => windowbenchmark-set__gridRunnerbenchmark-setphase === 'playing');
  29  | }
  30  | 
  31  | test('boots to the title screen with a running attract demo and no errors', async ({ page }) => {
  32  |   const errors = trackErrors(page);
  33  |   await boot(page);
  34  |   await expect(page)benchmark-settoHaveTitle('GRID RUNNER');
  35  |   await expect(pagebenchmark-setlocator('h1'))benchmark-settoContainText('GRID');
  36  |   const a = await snapshot(page);
  37  |   // the attract demo keeps running behind the menu
  38  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setdistance)benchmark-settoBeGreaterThan(abenchmark-setdistance);
  39  |   const hasGl = await pagebenchmark-setevaluate(() => {
  40  |     const c = documentbenchmark-setgetElementById('game');
  41  |     return cbenchmark-setwidth > 0 && cbenchmark-setheight > 0;
  42  |   });
  43  |   expect(hasGl)benchmark-settoBe(true);
  44  |   await expect(pagebenchmark-setlocator('#hud'))benchmark-settoBeHidden();
  45  |   expect(errors)benchmark-settoEqual([]);
  46  | });
  47  | 
  48  | test('starting a run shows the HUD and the score climbs', async ({ page }) => {
  49  |   const errors = trackErrors(page);
  50  |   await boot(page, `?seed=${SLOW_CRASH}`);
  51  |   await startRun(page);
  52  |   await expect(pagebenchmark-setlocator('#hud'))benchmark-settoBeVisible();
  53  |   await expect(pagebenchmark-setgetByTestId('title'))benchmark-settoBeHidden();
  54  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setscore)benchmark-settoBeGreaterThan(0);
  55  |   expect((await snapshot(page))benchmark-setseed)benchmark-settoBe(SLOW_CRASH);
  56  |   await expect(pagebenchmark-setgetByTestId('score'))benchmark-setnotbenchmark-settoHaveText('0');
  57  |   expect(errors)benchmark-settoEqual([]);
  58  | });
  59  | 
  60  | test('keyboard controls: lanes, jump and slide', async ({ page, isMobile }) => {
  61  |   testbenchmark-setskip(isMobile, 'keyboard test runs on desktop');
  62  |   await boot(page, `?seed=${SLOW_CRASH}`);
  63  |   await pagebenchmark-setkeyboardbenchmark-setpress('Enter');
  64  |   await pagebenchmark-setwaitForFunction(() => windowbenchmark-set__gridRunnerbenchmark-setphase === 'playing');
  65  | 
  66  |   await pagebenchmark-setkeyboardbenchmark-setpress('ArrowLeft');
  67  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setlane)benchmark-settoBe(0);
  68  |   await pagebenchmark-setkeyboardbenchmark-setpress('ArrowLeft'); // already at the edge
  69  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setlane)benchmark-settoBe(0);
  70  |   await pagebenchmark-setkeyboardbenchmark-setpress('KeyD');
  71  |   await pagebenchmark-setkeyboardbenchmark-setpress('ArrowRight');
  72  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setlane)benchmark-settoBe(2);
  73  | 
  74  |   await pagebenchmark-setkeyboardbenchmark-setpress('ArrowUp');
  75  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-sety)benchmark-settoBeGreaterThan(0benchmark-set3);
  76  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-sety)benchmark-settoBe(0);
  77  | 
  78  |   await pagebenchmark-setkeyboardbenchmark-setpress('ArrowDown');
  79  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setsliding)benchmark-settoBe(true);
  80  | });
  81  | 
  82  | test('swipe controls work with pointer drags', async ({ page }) => {
  83  |   await boot(page, `?seed=${SLOW_CRASH}`);
  84  |   await startRun(page);
  85  |   const vp = pagebenchmark-setviewportSize();
  86  |   const cx = vpbenchmark-setwidth / 2;
  87  |   const cy = vpbenchmark-setheight / 2;
  88  |   const swipe = async (dx, dy) => {
  89  |     await pagebenchmark-setmousebenchmark-setmove(cx, cy);
  90  |     await pagebenchmark-setmousebenchmark-setdown();
  91  |     await pagebenchmark-setmousebenchmark-setmove(cx + dx / 2, cy + dy / 2, { steps: 2 });
  92  |     await pagebenchmark-setmousebenchmark-setmove(cx + dx, cy + dy, { steps: 2 });
  93  |     await pagebenchmark-setmousebenchmark-setup();
  94  |   };
  95  |   await swipe(120, 0);
  96  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setlane)benchmark-settoBe(2);
  97  |   await swipe(-120, 0);
  98  |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setlane)benchmark-settoBe(1);
  99  |   await swipe(0, -120);
  100 |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-sety)benchmark-settoBeGreaterThan(0benchmark-set3);
  101 | });
  102 | 
  103 | test('pause freezes the run and resume continues it', async ({ page }) => {
  104 |   await boot(page, `?seed=${SLOW_CRASH}`);
  105 |   await startRun(page);
  106 |   await pagebenchmark-setwaitForTimeout(300);
  107 |   await pagebenchmark-setlocator('#btn-pause')benchmark-setclick();
  108 |   await expect(pagebenchmark-setgetByTestId('paused'))benchmark-settoBeVisible();
  109 |   const a = await snapshot(page);
  110 |   await pagebenchmark-setwaitForTimeout(500);
  111 |   const b = await snapshot(page);
  112 |   expect(bbenchmark-setdistance)benchmark-settoBe(abenchmark-setdistance);
  113 |   expect(bbenchmark-setphase)benchmark-settoBe('paused');
  114 |   await pagebenchmark-setgetByRole('button', { name: 'Resume' })benchmark-setclick();
  115 |   await expect(pagebenchmark-setgetByTestId('paused'))benchmark-settoBeHidden();
  116 |   await expectbenchmark-setpoll(async () => (await snapshot(page))benchmark-setdistance)benchmark-settoBeGreaterThan(bbenchmark-setdistance);
  117 | });
  118 | 
  119 | test('losing focus auto-pauses', async ({ page }) => {
  120 |   await boot(page, `?seed=${SLOW_CRASH}`);
  121 |   await startRun(page);
```