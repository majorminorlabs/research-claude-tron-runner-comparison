# Instructions

- Following Playwright test failedbenchmark-set
- Explain why, be concise, respect Playwright best practicesbenchmark-set
- Provide a snippet of code with the fix, if possiblebenchmark-set

# Test info

- Name: gamebenchmark-setspecbenchmark-setts >> death, retry, records >> retry via Enter starts a fresh run immediately; best score persists across reload
- Location: tests/e2e/gamebenchmark-setspecbenchmark-setts:176:3

# Error details

```
Test timeout of 60000ms exceededbenchmark-set
```

```
Error: pagebenchmark-setreload: Test timeout of 60000ms exceededbenchmark-set
Call log:
  - waiting for navigation until "load"
    - navigated to "http://127benchmark-set0benchmark-set0benchmark-set1:4173/?debug&seed=7"

```

# Test source

```ts
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
  111 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-sety, { timeout: 5000 })benchmark-settoBe(0);
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
> 190 |     await pagebenchmark-setreload();
      |                ^ Error: pagebenchmark-setreload: Test timeout of 60000ms exceededbenchmark-set
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
  212 |   });
  213 | });
  214 | 
  215 | testbenchmark-setdescribe('pause, sound, quality', () => {
  216 |   test('P pauses the world, resume counts down and continues', async ({ page }) => {
  217 |     await openGame(page);
  218 |     await startRun(page);
  219 |     await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setsetAutopilot(true));
  220 |     await pagebenchmark-setkeyboardbenchmark-setpress('p');
  221 |     await expect(pagebenchmark-setlocator('#pause'))benchmark-settoBeVisible();
  222 |     expect(await phase(page))benchmark-settoBe('paused');
  223 |     const a = (await gameState(page))!;
  224 |     await pagebenchmark-setwaitForTimeout(900);
  225 |     const b = (await gameState(page))!;
  226 |     expect(bbenchmark-setdistance)benchmark-settoBe(abenchmark-setdistance);
  227 |     expect(bbenchmark-setstate)benchmark-settoBe('paused');
  228 |     await pagebenchmark-setkeyboardbenchmark-setpress('Enter'); // confirm = resume
  229 |     expect(await phase(page))benchmark-settoBe('countdown');
  230 |     await waitForPhase(page, 'playing', 30_000);
  231 |     await expectbenchmark-setpoll(async () => (await gameState(page))!benchmark-setdistance, { timeout: 15_000 })benchmark-settoBeGreaterThan(abenchmark-setdistance + 3);
  232 |   });
  233 | 
  234 |   test('Escape pauses and the RESUME / RESTART / QUIT buttons work', async ({ page }) => {
  235 |     await openGame(page);
  236 |     await startRun(page);
  237 |     await pagebenchmark-setkeyboardbenchmark-setpress('Escape');
  238 |     await expect(pagebenchmark-setlocator('#pause'))benchmark-settoBeVisible();
  239 |     await pagebenchmark-setlocator('#btn-resume')benchmark-setclick();
  240 |     await waitForPhase(page, 'playing', 30_000);
  241 |     await pagebenchmark-setlocator('#btn-pause')benchmark-setclick();
  242 |     await expect(pagebenchmark-setlocator('#pause'))benchmark-settoBeVisible();
  243 |     await pagebenchmark-setlocator('#btn-restart')benchmark-setclick();
  244 |     await waitForPhase(page, 'playing', 5_000);
  245 |     expect((await gameState(page))!benchmark-settime)benchmark-settoBeLessThan(2);
  246 |     await pagebenchmark-setkeyboardbenchmark-setpress('Escape');
  247 |     await pagebenchmark-setlocator('#btn-quit')benchmark-setclick();
  248 |     await expect(pagebenchmark-setlocator('#title'))benchmark-settoBeVisible();
  249 |   });
  250 | 
  251 |   test('hiding the tab auto-pauses', async ({ page }) => {
  252 |     await openGame(page);
  253 |     await startRun(page);
  254 |     await pagebenchmark-setevaluate(() => {
  255 |       Objectbenchmark-setdefineProperty(document, 'hidden', { value: true, configurable: true });
  256 |       documentbenchmark-setdispatchEvent(new Event('visibilitychange'));
  257 |     });
  258 |     expect(await phase(page))benchmark-settoBe('paused');
  259 |   });
  260 | 
  261 |   test('sound toggle (M key and button) persists across reloads', async ({ page }) => {
  262 |     await openGame(page);
  263 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setmuted))benchmark-settoBe(false);
  264 |     await pagebenchmark-setkeyboardbenchmark-setpress('m');
  265 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setmuted))benchmark-settoBe(true);
  266 |     await expect(pagebenchmark-setlocator('#tgl-sound'))benchmark-settoHaveText('SOUND: OFF');
  267 |     await pagebenchmark-setreload();
  268 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setmuted))benchmark-settoBe(true);
  269 |     await pagebenchmark-setlocator('#tgl-sound')benchmark-setclick();
  270 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setmuted))benchmark-settoBe(false);
  271 |   });
  272 | 
  273 |   test('graphics toggle switches between high and low and still renders', async ({ page }) => {
  274 |     const errors = watchErrors(page);
  275 |     await openGame(page, 'seed=7', 'high');
  276 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setquality))benchmark-settoBe('high');
  277 |     await frames(page, 4);
  278 |     const high = await pixelStats(page);
  279 |     expect(highbenchmark-setlit)benchmark-settoBeGreaterThan(0benchmark-set1);
  280 |     await pagebenchmark-setkeyboardbenchmark-setpress('g');
  281 |     expect(await pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setquality))benchmark-settoBe('low');
  282 |     await frames(page, 4);
  283 |     const low = await pixelStats(page);
  284 |     expect(lowbenchmark-setlit)benchmark-settoBeGreaterThan(0benchmark-set1);
  285 |     expect(errors)benchmark-settoEqual([]);
  286 |   });
  287 | });
  288 | 
  289 | testbenchmark-setdescribe('audio & render budget', () => {
  290 |   test('audio context starts on the first user gesture without errors', async ({ page }) => {
```