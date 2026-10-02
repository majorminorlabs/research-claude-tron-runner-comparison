# Instructions

- Following Playwright test failedbenchmark-set
- Explain why, be concise, respect Playwright best practicesbenchmark-set
- Provide a snippet of code with the fix, if possiblebenchmark-set

# Test info

- Name: gamebenchmark-setspecbenchmark-setts >> gameplay flow >> swipe gestures drive the player on touch devices
- Location: tests/e2e/gamebenchmark-setspecbenchmark-setts:86:3

# Error details

```
Error: expect(received)benchmark-settoBe(expected) // Objectbenchmark-setis equality

Expected: 0
Received: 2benchmark-set033333333333332

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic "Game view" [ref=e2]
  - generic:
    - generic:
      - generic: SCORE
      - generic: "50"
      - generic: 1 BITS · 25 M
    - generic:
      - generic: SECTOR 01
      - generic "Speed"
    - generic:
      - generic: BEST
      - generic: "0"
      - generic:
        - button "Toggle sound (M)" [ref=e3] [cursor=pointer]
        - button "Pause (P)" [ref=e6] [cursor=pointer]
    - generic "Active power-ups"
```

# Test source

```ts
  11  |     await expect(pagebenchmark-setlocator('#btn-play'))benchmark-settoBeVisible();
  12  |     await expect(pagebenchmark-setlocator('#hud'))benchmark-settoBeHidden();
  13  |     const s = await pixelStats(page);
  14  |     expect(sbenchmark-setlit)benchmark-settoBeGreaterThan(0benchmark-set1);
  15  |     expect(sbenchmark-setdistinct)benchmark-settoBeGreaterThan(12);
  16  |     expect(errors)benchmark-settoEqual([]);
  17  |   });
  18  | 
  19  |   test('attract-mode demo runs behind the title and never crashes', async ({ page }) => {
  20  |     await openGame(page);
  21  |     const a = await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setdemobenchmark-setdistance as number);
  22  |     await pagebenchmark-setwaitForTimeout(1500);
  23  |     const b = await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setdemobenchmark-setdistance as number);
  24  |     expect(b)benchmark-settoBeGreaterThan(a + 5);
  25  |     const st = await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setdemobenchmark-setstate as string);
  26  |     expect(st)benchmark-settoBe('playing');
  27  |   });
  28  | 
  29  |   test('has no horizontal scrollbars and the controls legend is listed', async ({ page }) => {
  30  |     await openGame(page);
  31  |     const overflow = await pagebenchmark-setevaluate(() => documentbenchmark-setdocumentElementbenchmark-setscrollWidth > innerWidth);
  32  |     expect(overflow)benchmark-settoBe(false);
  33  |     await expect(pagebenchmark-setgetByLabel('Controls'))benchmark-settoContainText('Jump');
  34  |   });
  35  | });
  36  | 
  37  | testbenchmark-setdescribe('gameplay flow', () => {
  38  |   test('Enter starts: 3-2-1 countdown, then HUD and a running game', async ({ page }) => {
  39  |     const errors = watchErrors(page);
  40  |     await openGame(page);
  41  |     await pagebenchmark-setkeyboardbenchmark-setpress('Enter');
  42  |     await expect(pagebenchmark-setlocator('#title'))benchmark-settoBeHidden();
  43  |     await expect(pagebenchmark-setlocator('#countdown'))benchmark-settoBeVisible();
  44  |     expect(await phase(page))benchmark-settoBe('countdown');
  45  |     await waitForPhase(page, 'playing', 30_000);
  46  |     await expect(pagebenchmark-setlocator('#hud'))benchmark-settoBeVisible();
  47  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setdistance, { timeout: 15_000 })benchmark-settoBeGreaterThan(5);
  48  |     await expect(pagebenchmark-setlocator('#score'))benchmark-setnotbenchmark-settoHaveText('0');
  49  |     expect(errors)benchmark-settoEqual([]);
  50  |   });
  51  | 
  52  |   test('PLAY button works too', async ({ page }) => {
  53  |     await openGame(page);
  54  |     await pagebenchmark-setlocator('#btn-play')benchmark-setclick();
  55  |     await waitForPhase(page, 'playing', 30_000);
  56  |   });
  57  | 
  58  |   test('keyboard: lanes, jump and slide change the player state', async ({ page }) => {
  59  |     await openGame(page);
  60  |     await startRun(page);
  61  |     // freeze obstacles out of the way so inputs can be tested deterministically
  62  |     await pagebenchmark-setevaluate(() => {
  63  |       const g = (window as any)benchmark-set__gridrunbenchmark-setgame;
  64  |       gbenchmark-setobstacles = [];
  65  |       gbenchmark-setrows = [];
  66  |     });
  67  |     await pagebenchmark-setkeyboardbenchmark-setpress('ArrowLeft');
  68  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(0);
  69  |     await pagebenchmark-setkeyboardbenchmark-setpress('ArrowRight');
  70  |     await pagebenchmark-setkeyboardbenchmark-setpress('ArrowRight');
  71  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(2);
  72  |     await pagebenchmark-setkeyboardbenchmark-setpress('a');
  73  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(1);
  74  |     await pagebenchmark-setkeyboardbenchmark-setpress('d');
  75  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(2);
  76  | 
  77  |     await pagebenchmark-setkeyboardbenchmark-setpress('ArrowUp');
  78  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 3000 })benchmark-settoBeGreaterThan(0benchmark-set3);
  79  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 5000 })benchmark-settoBe(0);
  80  |     await pagebenchmark-setkeyboardbenchmark-setpress('ArrowDown');
  81  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setsliding, { timeout: 3000 })benchmark-settoBe(true);
  82  |     await pagebenchmark-setkeyboardbenchmark-setpress('Space');
  83  |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 3000 })benchmark-settoBeGreaterThan(0benchmark-set3);
  84  |   });
  85  | 
  86  |   test('swipe gestures drive the player on touch devices', async ({ page }) => {
  87  |     await openGame(page);
  88  |     await startRun(page);
  89  |     await pagebenchmark-setevaluate(() => {
  90  |       const g = (window as any)benchmark-set__gridrunbenchmark-setgame;
  91  |       gbenchmark-setobstacles = [];
  92  |       gbenchmark-setrows = [];
  93  |     });
  94  |     const swipe = (dx: number, dy: number) =>
  95  |       pagebenchmark-setevaluate(
  96  |         ({ dx, dy }) => {
  97  |           const c = documentbenchmark-setgetElementById('scene')!;
  98  |           const opts = (x: number, y: number) => ({ pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true });
  99  |           cbenchmark-setdispatchEvent(new PointerEvent('pointerdown', opts(300, 300)));
  100 |           cbenchmark-setdispatchEvent(new PointerEvent('pointermove', opts(300 + dx, 300 + dy)));
  101 |           cbenchmark-setdispatchEvent(new PointerEvent('pointerup', opts(300 + dx, 300 + dy)));
  102 |         },
  103 |         { dx, dy },
  104 |       );
  105 |     await swipe(-80, 5);
  106 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(0);
  107 |     await swipe(80, -4);
  108 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setlane)benchmark-settoBe(1);
  109 |     await swipe(2, -90);
  110 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 3000 })benchmark-settoBeGreaterThan(0benchmark-set3);
> 111 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 5000 })benchmark-settoBe(0);
      |                                                                                  ^ Error: expect(received)benchmark-settoBe(expected) // Objectbenchmark-setis equality
  112 |     await swipe(0, 90);
  113 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setsliding, { timeout: 3000 })benchmark-settoBe(true);
  114 |   });
  115 | 
  116 |   test('autopilot survives and collects bits through the real render loop', async ({ page }) => {
  117 |     const errors = watchErrors(page);
  118 |     await openGame(page, 'seed=21');
  119 |     await startRun(page);
  120 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setsetAutopilot(true));
  121 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setadvance(45));
  122 |     await frames(page, 5);
  123 |     const s = (await gameState(page))!;
  124 |     expect(sbenchmark-setstate)benchmark-settoBe('playing');
  125 |     expect(sbenchmark-settime)benchmark-settoBeGreaterThan(44);
  126 |     expect(sbenchmark-setbits)benchmark-settoBeGreaterThan(20);
  127 |     expect(sbenchmark-setscore)benchmark-settoBeGreaterThan(1500);
  128 |     const stats = await pixelStats(page);
  129 |     expect(statsbenchmark-setlit)benchmark-settoBeGreaterThan(0benchmark-set1);
  130 |     expect(errors)benchmark-settoEqual([]);
  131 |   });
  132 | 
  133 |   test('hazards appear on the track as orange; player and grid as cyan', async ({ page }) => {
  134 |     await openGame(page, 'seed=21');
  135 |     await startRun(page);
  136 |     const centre = { x0: 0benchmark-set38, y0: 0benchmark-set3, x1: 0benchmark-set62, y1: 0benchmark-set6 };
  137 |     await pagebenchmark-setevaluate(() => {
  138 |       const g = (window as any)benchmark-set__gridrunbenchmark-setgame;
  139 |       gbenchmark-setpause(); // freeze the world so the frame is stable
  140 |       gbenchmark-setobstacles = [];
  141 |       gbenchmark-setpickups = [];
  142 |     });
  143 |     await frames(page, 6);
  144 |     const empty = await pixelStats(page, centre);
  145 |     expect(emptybenchmark-setorange)benchmark-settoBeLessThan(0benchmark-set0005);
  146 |     expect((await pixelStats(page))benchmark-setcyan)benchmark-settoBeGreaterThan(0benchmark-set002);
  147 |     await pagebenchmark-setevaluate(() => {
  148 |       const g = (window as any)benchmark-set__gridrunbenchmark-setgame;
  149 |       gbenchmark-setaddObstacle('block', 1, gbenchmark-setdistance + 14);
  150 |       gbenchmark-setaddObstacle('low', 0, gbenchmark-setdistance + 14);
  151 |       gbenchmark-setaddObstacle('high', 2, gbenchmark-setdistance + 14);
  152 |     });
  153 |     await frames(page, 6);
  154 |     const withHazards = await pixelStats(page, centre);
  155 |     expect(withHazardsbenchmark-setorange)benchmark-settoBeGreaterThan(0benchmark-set002);
  156 |     expect(withHazardsbenchmark-setorange)benchmark-settoBeGreaterThan(emptybenchmark-setorange * 5);
  157 |   });
  158 | });
  159 | 
  160 | testbenchmark-setdescribe('death, retry, records', () => {
  161 |   test('standing still crashes into an obstacle -> game over screen with stats', async ({ page }) => {
  162 |     const errors = watchErrors(page);
  163 |     await openGame(page);
  164 |     await startRun(page);
  165 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setadvance(120));
  166 |     await waitForPhase(page, 'over', 15_000);
  167 |     await expect(pagebenchmark-setlocator('#over'))benchmark-settoBeVisible({ timeout: 10_000 });
  168 |     await expect(pagebenchmark-setlocator('#over'))benchmark-settoContainText('CONNECTION LOST');
  169 |     const score = Number((await pagebenchmark-setlocator('#f-score')benchmark-settextContent())!benchmark-setreplace(/,/g, ''));
  170 |     expect(score)benchmark-settoBeGreaterThan(0);
  171 |     await expect(pagebenchmark-setlocator('#f-dist'))benchmark-settoContainText('M');
  172 |     await expect(pagebenchmark-setlocator('#hud'))benchmark-settoBeHidden();
  173 |     expect(errors)benchmark-settoEqual([]);
  174 |   });
  175 | 
  176 |   test('retry via Enter starts a fresh run immediately; best score persists across reload', async ({ page }) => {
  177 |     await openGame(page);
  178 |     await startRun(page);
  179 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setadvance(120));
  180 |     await expect(pagebenchmark-setlocator('#over'))benchmark-settoBeVisible({ timeout: 15_000 });
  181 |     const best = await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setrecordsbenchmark-setbestScore as number);
  182 |     expect(best)benchmark-settoBeGreaterThan(0);
  183 |     await pagebenchmark-setwaitForTimeout(400);
  184 |     await pagebenchmark-setkeyboardbenchmark-setpress('Enter');
  185 |     await waitForPhase(page, 'playing', 5_000);
  186 |     const s = (await gameState(page))!;
  187 |     expect(sbenchmark-setscore)benchmark-settoBeLessThan(200);
  188 |     expect(sbenchmark-setstate)benchmark-settoBe('playing');
  189 | 
  190 |     await pagebenchmark-setreload();
  191 |     await expect(pagebenchmark-setlocator('#records'))benchmark-settoContainText(String(bestbenchmark-settoLocaleString('en-US')));
  192 |     await expect(pagebenchmark-setlocator('#records'))benchmark-settoContainText('RUNS');
  193 |   });
  194 | 
  195 |   test('menu button returns to the title and the demo resumes', async ({ page }) => {
  196 |     await openGame(page);
  197 |     await startRun(page);
  198 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setadvance(120));
  199 |     await expect(pagebenchmark-setlocator('#over'))benchmark-settoBeVisible({ timeout: 15_000 });
  200 |     await pagebenchmark-setlocator('#btn-menu')benchmark-setclick();
  201 |     await expect(pagebenchmark-setlocator('#title'))benchmark-settoBeVisible();
  202 |     expect(await phase(page))benchmark-settoBe('title');
  203 |   });
  204 | 
  205 |   test('pressing Enter right after a crash cannot instantly skip the game over screen', async ({ page }) => {
  206 |     await openGame(page);
  207 |     await startRun(page);
  208 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setadvance(120));
  209 |     await waitForPhase(page, 'over');
  210 |     await pagebenchmark-setkeyboardbenchmark-setpress('Enter');
  211 |     expect(await phase(page))benchmark-settoBe('over');
```