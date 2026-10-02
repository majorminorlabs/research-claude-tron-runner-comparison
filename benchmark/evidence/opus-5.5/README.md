# GRID RUNNER

A neon, Tron-styled 3-lane endless runner for the browser. You ride a light cycle down the grid, jumping, sliding and dodging obstacles while collecting bits and power-ups. No login, no leaderboard: your best score is kept locally in your browser.

## Play

```bash
npm install
npm run dev
```

Open the printed URL. For a production build:

```bash
npm run build
npm run preview
```

`dist/` is a fully static site with relative paths, so any static host works (Vercel, Netlify, GitHub Pages, S3, itch.io).

### Controls

| Action      | Keyboard              | Touch       |
| ----------- | --------------------- | ----------- |
| Change lane | ← → / A D             | Swipe left / right |
| Jump        | ↑ / W / Space         | Swipe up    |
| Slide       | ↓ / S / Shift         | Swipe down  |
| Pause       | P / Esc               | ⏸ button    |
| Sound       | M                     | 🔊 button   |
| Start / retry | Enter / Space       | Tap button  |

Sliding in mid-air fast-falls you to the ground. A jump pressed just before landing is buffered.

### Obstacles
- **Low barrier** (orange): jump over it.
- **High gate** (amber): slide under it.
- **Wall / data train** (red): change lanes. Steering into the side of one bounces you back instead of ending the run.

### Rewards
- **Bits**: +10 each.
- **Clean dodge**: +50 for jumping or sliding through an obstacle in your lane.
- **Shield** (blue): absorbs one hit.
- **Magnet** (yellow): pulls in nearby bits for 10 seconds.
- **Score ×2** (magenta): doubles all points for 10 seconds.

Distance scores 2 points per metre. Speed ramps up steadily to a cap.

### URL options
- `?seed=1234`: plays a reproducible track.

## Development

```bash
npm run lint       # ESLint
npm test           # Vitest unit tests (game rules + generator fairness)
npm run test:e2e   # Playwright end-to-end tests (desktop + mobile emulation)
npm run test:all   # everything above, plus a production build
```

Run `npx playwright install chromium` once before the first e2e run.

### Architecture

```
src/
  game/        pure, DOM-free simulation (deterministic per seed)
    config.js    tuning constants
    game.js      state, physics, collisions, track generator, scoring
    autopilot.js bot that follows the guaranteed safe path (title demo + tests)
    rng.js       seedable PRNG
  render/      Three.js view: reads game state, never mutates it
    view.js      scene, camera, bloom, entity pooling, effects
    floor.js     analytic scrolling grid shader
    cycle.js     light cycle model and animation
    trail.js     light-wall ribbon
    particles.js sparks and derez effect
    scenery.js   pillars, wireframe city, horizon, sky ring
  audio.js     WebAudio-synthesised SFX and music (no audio files)
  input.js     keyboard + swipe → actions
  main.js      game flow, HUD, menus, main loop (fixed 120 Hz timestep)
```

**Fairness guarantee:** every obstacle row has a wall-free "safe lane". The safe lane moves at most one lane between rows, and walls always end early enough to make that switch. A unit test runs the autopilot for 3 minutes at full speed on several seeds to prove each track can be survived.
