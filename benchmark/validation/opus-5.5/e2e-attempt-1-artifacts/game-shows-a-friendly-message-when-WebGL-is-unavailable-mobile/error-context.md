# Instructions

- Following Playwright test failedbenchmark-set
- Explain why, be concise, respect Playwright best practicesbenchmark-set
- Provide a snippet of code with the fix, if possiblebenchmark-set

# Test info

- Name: gamebenchmark-setspecbenchmark-setjs >> shows a friendly message when WebGL is unavailable
- Location: tests/e2e/gamebenchmark-setspecbenchmark-setjs:163:1

# Error details

```
Error: pagebenchmark-setgoto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
Call log:
  - navigating to "http://localhost:4173/", waiting until "load"

```

# Test source

```ts
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
  122 |   await pagebenchmark-setevaluate(() => windowbenchmark-setdispatchEvent(new Event('blur')));
  123 |   await expect(pagebenchmark-setgetByTestId('paused'))benchmark-settoBeVisible();
  124 | });
  125 | 
  126 | test('crashing shows results, saves the best score and allows a retry', async ({ page }) => {
  127 |   const errors = trackErrors(page);
  128 |   await boot(page, `?seed=${FAST_CRASH}`);
  129 |   await startRun(page);
  130 |   await expect(pagebenchmark-setgetByTestId('gameover'))benchmark-settoBeVisible({ timeout: 15_000 });
  131 |   const finalScore = await pagebenchmark-setgetByTestId('final-score')benchmark-settextContent();
  132 |   expect(Number(finalScorebenchmark-setreplace(/,/g, '')))benchmark-settoBeGreaterThan(0);
  133 |   await expect(pagebenchmark-setlocator('#final-best'))benchmark-settoHaveText(finalScore);
  134 | 
  135 |   await pagebenchmark-setgetByTestId('retry')benchmark-setclick();
  136 |   await pagebenchmark-setwaitForFunction(() => windowbenchmark-set__gridRunnerbenchmark-setphase === 'playing');
  137 |   await expect(pagebenchmark-setgetByTestId('gameover'))benchmark-settoBeHidden();
  138 | 
  139 |   await pagebenchmark-setreload();
  140 |   await expect(pagebenchmark-setlocator('#best-title'))benchmark-settoHaveText(finalScore);
  141 |   expect(errors)benchmark-settoEqual([]);
  142 | });
  143 | 
  144 | test('menu button returns to the title screen', async ({ page }) => {
  145 |   await boot(page, `?seed=${FAST_CRASH}`);
  146 |   await startRun(page);
  147 |   await expect(pagebenchmark-setgetByTestId('gameover'))benchmark-settoBeVisible({ timeout: 15_000 });
  148 |   await pagebenchmark-setgetByRole('button', { name: 'Menu' })benchmark-setclick();
  149 |   await expect(pagebenchmark-setgetByTestId('title'))benchmark-settoBeVisible();
  150 |   await pagebenchmark-setwaitForFunction(() => windowbenchmark-set__gridRunnerbenchmark-setphase === 'title');
  151 | });
  152 | 
  153 | test('mute toggle persists across reloads', async ({ page }) => {
  154 |   await boot(page);
  155 |   const btn = pagebenchmark-setlocator('#btn-mute');
  156 |   await expect(btn)benchmark-settoHaveAttribute('aria-pressed', 'false');
  157 |   await btnbenchmark-setclick();
  158 |   await expect(btn)benchmark-settoHaveAttribute('aria-pressed', 'true');
  159 |   await pagebenchmark-setreload();
  160 |   await expect(pagebenchmark-setlocator('#btn-mute'))benchmark-settoHaveAttribute('aria-pressed', 'true');
  161 | });
  162 | 
  163 | test('shows a friendly message when WebGL is unavailable', async ({ page }) => {
  164 |   await pagebenchmark-setaddInitScript(() => {
  165 |     const orig = HTMLCanvasElementbenchmark-setprototypebenchmark-setgetContext;
  166 |     HTMLCanvasElementbenchmark-setprototypebenchmark-setgetContext = function (type, benchmark-setbenchmark-setbenchmark-setrest) {
  167 |       if (String(type)benchmark-setstartsWith('webgl')) return null;
  168 |       return origbenchmark-setcall(this, type, benchmark-setbenchmark-setbenchmark-setrest);
  169 |     };
  170 |   });
> 171 |   await pagebenchmark-setgoto('/');
      |              ^ Error: pagebenchmark-setgoto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
  172 |   await expect(pagebenchmark-setgetByText('Grid offline'))benchmark-settoBeVisible();
  173 |   await expect(pagebenchmark-setgetByTestId('title'))benchmark-settoBeHidden();
  174 | });
  175 | 
  176 | test('works without localStorage', async ({ page }) => {
  177 |   const errors = trackErrors(page);
  178 |   await pagebenchmark-setaddInitScript(() => {
  179 |     Objectbenchmark-setdefineProperty(window, 'localStorage', {
  180 |       get() {
  181 |         throw new Error('blocked');
  182 |       },
  183 |     });
  184 |   });
  185 |   await boot(page, `?seed=${FAST_CRASH}`);
  186 |   await startRun(page);
  187 |   await expect(pagebenchmark-setgetByTestId('gameover'))benchmark-settoBeVisible({ timeout: 15_000 });
  188 |   expect(errors)benchmark-settoEqual([]);
  189 | });
  190 | 
```