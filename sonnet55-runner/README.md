# GRIDRUN

A neon, Tron-style **3-lane endless runner** that runs entirely in the browser.
No login, no leaderboard, no server: just open it and run. Your personal best is
kept in your browser's local storage.

![stack](https://img.shields.io/badge/three.js-WebGL-19e6ff) ![tests](https://img.shields.io/badge/tests-unit%20%2B%20e2e-6dff8a)

## How to play

| Action | Keyboard | Touch |
|---|---|---|
| Switch lane | `←` `→` / `A` `D` | swipe left / right |
| Jump | `↑` / `W` / `Space` | swipe up |
| Slide | `↓` / `S` | swipe down |
| Pause | `P` / `Esc` | pause button |
| Sound / graphics | `M` / `G` | menu toggles |
| Fullscreen | `F` | – |

- **Orange = deadly.** Low barriers must be jumped, overhead gates slid under, and
  data walls dodged by changing lane. Pressing *down* in mid-air fast-falls into a slide.
- **Bits** (cyan diamonds) score points. Arcs of bits float over low barriers — jump for them.
- **Clean dodges** (jumping a barrier / sliding a gate) pay a bonus.
- **Power-ups** (tall light beams):
  - 🔵 **Shield** – absorbs one hit.
  - 🟣 **Magnet** – pulls bits in from every lane.
  - 🟡 **Overclock** – doubles all points for 10 s.
  - 🟢 **Phase** – speed boost and total invulnerability: smash through everything for points.
- The Grid speeds up the longer you survive, and the track gets denser every sector (1,500 m).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (Vite default)
npm run build      # production build -> dist/
npm run preview    # serve dist/ on http://127.0.0.1:4173
```

`dist/` is a fully static site (relative asset paths): drop it on any static host
(Vercel, Netlify, GitHub Pages, S3, itch.io, …).

## Tests

```bash
npm test           # 83 unit tests (game rules, generator fairness, autopilot soak)
npm run test:e2e   # Playwright end-to-end tests, 24 of them (uses your installed Google Chrome)
npm run test:all   # typecheck + unit + production build + e2e
```

What is covered:

- **Rules & physics** – lane changes (buffering, wall bumps), jump arc and air time,
  slide, fast-fall, collisions for every obstacle type, shield / phase / magnet / overclock,
  scoring, sectors, pause.
- **Track generator fairness** – every generated row has a guaranteed survivable lane and
  gaps respect the physics at the speed the row will actually arrive. An *independent solver*
  re-checks 40 seeds × 14 km of track.
- **Autopilot soak** – a bot that only sees the generated rows plays 16 seeds for 4 minutes of
  game time each (up to max speed) without dying, which proves generator and physics agree.
  Idle / jump-only players are verified to die.
- **Browser e2e** – boot with no console errors, rendering sanity via screenshot pixel checks,
  countdown, keyboard + swipe controls, pause / resume / restart / quit, game over and records
  persistence, auto-pause on tab hide, mute persistence, quality toggle (bloom on/off),
  audio context start, render budget, portrait and landscape phone layouts.

> The e2e suite drives the real production bundle. A `?debug` URL flag exposes a tiny
> `window.__gridrun` hook (state, autopilot, fast-forward) used only by the tests;
> `?seed=123` makes a run reproducible.

## Project layout

```
src/game/      pure, deterministic game logic (no DOM / WebGL) – fully unit tested
  config.ts      all tuning values
  game.ts        simulation: player, collisions, pickups, power-ups, scoring
  generator.ts   seeded, fairness-guaranteed track generator
  solver.ts      independent route solver (used by the bot and the fairness tests)
  bot.ts         autopilot (title-screen demo + test oracle)
src/render/    three.js scene: floor shader, skyline, runner rig, obstacles, FX, bloom
src/audio/     fully procedural Web Audio synthwave music + SFX (no audio files)
src/ui/        HUD and DOM helpers
src/main.ts    app state machine (title → countdown → playing ⇄ paused → game over)
tests/unit/    vitest
tests/e2e/     Playwright
```

## Performance notes

~230 draw calls and ~3 k triangles per frame. The renderer uses bloom post-processing on
the *High* setting; if the frame rate stays under ~28 fps it drops itself to *Low*
(no bloom, 1× pixel ratio). You can switch manually with `G` or from the menu.
`prefers-reduced-motion` damps screen shake and flashes.

## Build stats

See [BUILD_STATS.md](BUILD_STATS.md) for the time and token usage of building this game
(regenerate with `npm run stats`).
