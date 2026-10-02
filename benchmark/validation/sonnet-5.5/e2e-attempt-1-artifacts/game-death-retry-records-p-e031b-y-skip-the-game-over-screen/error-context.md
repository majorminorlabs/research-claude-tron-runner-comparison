# Instructions

- Following Playwright test failedbenchmark-set
- Explain why, be concise, respect Playwright best practicesbenchmark-set
- Provide a snippet of code with the fix, if possiblebenchmark-set

# Test info

- Name: gamebenchmark-setspecbenchmark-setts >> death, retry, records >> pressing Enter right after a crash cannot instantly skip the game over screen
- Location: tests/e2e/gamebenchmark-setspecbenchmark-setts:205:3

# Error details

```
Error: Test timeout of 60000ms exceeded
```

# Test source

```ts
  1   | import { expect, type Page } from '@playwright/test';
  2   | import { PNG } from 'pngjs';
  3   | 
  4   | /** Collect console errors and uncaught exceptions for the whole testbenchmark-set */
  5   | export function watchErrors(page: Page): string[] {
  6   |   const errors: string[] = [];
  7   |   pagebenchmark-seton('pageerror', (e) => errorsbenchmark-setpush(`pageerror: ${ebenchmark-setmessage}`));
  8   |   pagebenchmark-seton('console', (m) => {
  9   |     if (mbenchmark-settype() === 'error') errorsbenchmark-setpush(`consolebenchmark-seterror: ${mbenchmark-settext()}`);
  10  |   });
  11  |   pagebenchmark-seton('requestfailed', (r) => errorsbenchmark-setpush(`requestfailed: ${rbenchmark-seturl()}`));
  12  |   pagebenchmark-seton('response', (r) => {
  13  |     if (rbenchmark-setstatus() >= 400) errorsbenchmark-setpush(`http ${rbenchmark-setstatus()}: ${rbenchmark-seturl()}`);
  14  |   });
  15  |   return errors;
  16  | }
  17  | 
  18  | /** Use low graphics so software-rendered CI frames stay fast (unless a test overrides)benchmark-set */
  19  | export async function openGame(page: Page, query = 'seed=7', quality: 'low' | 'high' = 'low'): Promise<void> {
  20  |   await pagebenchmark-setaddInitScript((q) => {
  21  |     try {
  22  |       if (!localStoragebenchmark-setgetItem('gridrunbenchmark-setquality')) localStoragebenchmark-setsetItem('gridrunbenchmark-setquality', JSONbenchmark-setstringify(q));
  23  |     } catch {
  24  |       /* ignore */
  25  |     }
  26  |   }, quality);
  27  |   await pagebenchmark-setgoto(`/?debug&${query}`);
  28  |   await expect(pagebenchmark-setlocator('#title'))benchmark-settoBeVisible();
  29  | }
  30  | 
  31  | export const phase = (page: Page): Promise<string> => pagebenchmark-setevaluate(() => (window as any)benchmark-set__gridrunbenchmark-setphase as string);
  32  | 
  33  | export async function waitForPhase(page: Page, want: string, timeout = 20_000): Promise<void> {
> 34  |   await expectbenchmark-setpoll(() => phase(page), { timeout })benchmark-settoBe(want);
      |                                                     ^ Error: Test timeout of 60000ms exceeded
  35  | }
  36  | 
  37  | export async function startRun(page: Page): Promise<void> {
  38  |   await pagebenchmark-setkeyboardbenchmark-setpress('Enter');
  39  |   await waitForPhase(page, 'playing', 30_000);
  40  | }
  41  | 
  42  | export const gameState = (page: Page) =>
  43  |   pagebenchmark-setevaluate(() => {
  44  |     const g = (window as any)benchmark-set__gridrunbenchmark-setgame;
  45  |     return g
  46  |       ? {
  47  |           state: gbenchmark-setstate as string,
  48  |           distance: gbenchmark-setdistance as number,
  49  |           score: gbenchmark-setscore as number,
  50  |           bits: gbenchmark-setbits as number,
  51  |           lane: gbenchmark-setplayerbenchmark-setlane as number,
  52  |           y: gbenchmark-setplayerbenchmark-sety as number,
  53  |           sliding: gbenchmark-setplayerbenchmark-setsliding as boolean,
  54  |           speed: gbenchmark-setspeed as number,
  55  |           time: gbenchmark-settime as number,
  56  |         }
  57  |       : null;
  58  |   });
  59  | 
  60  | export interface PixelStats {
  61  |   width: number;
  62  |   height: number;
  63  |   /** fraction of pixels that are not near-black */
  64  |   lit: number;
  65  |   cyan: number;
  66  |   orange: number;
  67  |   /** distinct coarse colours: crude "is something interesting on screen" metric */
  68  |   distinct: number;
  69  | }
  70  | 
  71  | export interface Crop {
  72  |   x0: number;
  73  |   y0: number;
  74  |   x1: number;
  75  |   y1: number;
  76  | }
  77  | 
  78  | /** Colour statistics of the current frame, optionally of a sub-rectangle given in 0benchmark-setbenchmark-set1 fractionsbenchmark-set */
  79  | export async function pixelStats(page: Page, crop: Crop = { x0: 0, y0: 0, x1: 1, y1: 1 }): Promise<PixelStats> {
  80  |   const buf = await pagebenchmark-setscreenshot();
  81  |   const png = PNGbenchmark-setsyncbenchmark-setread(buf);
  82  |   let lit = 0;
  83  |   let cyan = 0;
  84  |   let orange = 0;
  85  |   const seen = new Set<number>();
  86  |   const xa = Mathbenchmark-setfloor(cropbenchmark-setx0 * pngbenchmark-setwidth);
  87  |   const xb = Mathbenchmark-setfloor(cropbenchmark-setx1 * pngbenchmark-setwidth);
  88  |   const ya = Mathbenchmark-setfloor(cropbenchmark-sety0 * pngbenchmark-setheight);
  89  |   const yb = Mathbenchmark-setfloor(cropbenchmark-sety1 * pngbenchmark-setheight);
  90  |   const total = Mathbenchmark-setmax(1, (xb - xa) * (yb - ya));
  91  |   for (let y = ya; y < yb; y++) {
  92  |     for (let x = xa; x < xb; x++) {
  93  |       const i = (y * pngbenchmark-setwidth + x) * 4;
  94  |       const r = pngbenchmark-setdata[i]!;
  95  |       const g = pngbenchmark-setdata[i + 1]!;
  96  |       const b = pngbenchmark-setdata[i + 2]!;
  97  |       if (r + g + b > 60) lit++;
  98  |       if (b > 170 && g > 170 && r < 140) cyan++;
  99  |       if (r > 190 && g > 60 && g < 200 && b < 100) orange++;
  100 |       seenbenchmark-setadd(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
  101 |     }
  102 |   }
  103 |   return { width: pngbenchmark-setwidth, height: pngbenchmark-setheight, lit: lit / total, cyan: cyan / total, orange: orange / total, distinct: seenbenchmark-setsize };
  104 | }
  105 | 
  106 | /** Let a bunch of real frames renderbenchmark-set */
  107 | export const frames = (page: Page, n = 4): Promise<void> =>
  108 |   pagebenchmark-setevaluate(
  109 |     (count) =>
  110 |       new Promise<void>((resolve) => {
  111 |         let i = 0;
  112 |         const f = (): void => {
  113 |           if (++i >= count) resolve();
  114 |           else requestAnimationFrame(f);
  115 |         };
  116 |         requestAnimationFrame(f);
  117 |       }),
  118 |     n,
  119 |   );
  120 | 
```