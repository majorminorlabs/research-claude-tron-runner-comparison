# GRIDRUNNER

A three-lane endless runner on the light grid. Dodge, jump and slide through a
Tron-styled city at 260 kph until your integrity runs out.

Browser-based, no login, no leaderboard, no network calls, no assets to
download — the graphics are drawn to a 2D canvas and the sound is synthesised in
the browser at runtime.

## Play

```bash
npm install && npm run dev
```

Then open the printed URL. For a production bundle:

```bash
npm run build && npm run preview
```

The build is a static `dist/` folder with relative paths, so it can be dropped
on any static host or opened from a file server.

### Controls

| Action      | Keyboard                | Touch           |
| ----------- | ----------------------- | --------------- |
| Switch lane | `←` `→` / `A` `D`       | Swipe left/right |
| Jump        | `↑` / `W` / `Space`     | Swipe up, or tap |
| Slide       | `↓` / `S` / `Shift`     | Swipe down      |
| Pause       | `P` / `Esc`             | —               |
| Mute        | `M`                     | Button, top right |

Holding jump floats you slightly further. A jump pressed just before you land
still fires on touchdown, and a slide pressed in mid-air becomes a fast-fall.

### What's on the track

| Colour        | Hazard  | How to clear it |
| ------------- | ------- | --------------- |
| Amber         | Barrier | Jump it |
| Violet        | Beam    | Slide under it |
| Red           | Block   | Change lane |
| Cyan orbs     | Reward  | Build the combo multiplier, up to x3 |
| Green hexagon | Shield  | Absorbs one hit |
| Yellow chevrons | Overdrive | +16 speed and double score for 5s |

You start with three integrity segments. A hit costs one, slows you down and
breaks your combo, with a brief invulnerability window so a single wall can't
take two. At zero, you're derezzed.

## How it's built

```
src/core/      the simulation — no DOM, no canvas, no wall-clock time
src/render/    camera projection, canvas renderer, particles
src/ui/        HUD, input, local best-score storage
src/audio.ts   runtime WebAudio synthesis
tests/         96 tests over the core
```

Three decisions shaped the rest:

**The simulation is pure and deterministic.** `Game` knows nothing about
rendering or input devices. It runs on a fixed 1/120s timestep driven by a
seeded PRNG, so the same seed always produces the same run — which is what makes
the test suite able to assert on gameplay rather than just on units.

**Track generation can only emit survivable rows.** The generator is restricted
to three row shapes: one with a free lane, one that is barriers in every lane
(jump clears it), and one that is beams in every lane (slide clears it). Two
forcing rows never appear back to back, and row spacing always exceeds a full
jump's airtime. The combinations that would be unfair — say a barrier, a beam
and a block across the three lanes — are simply not expressible.

**The autopilot is production code.** `src/core/autopilot.ts` plays the
attract-mode demo behind the title screen, and the test suite reuses it as a
fairness proof: it clears 150 seconds untouched on ten different seeds, and 300
seconds at top speed on one. It reacts about a third of a second before contact,
not on the exact frame, so surviving means a human could too.

### Tests

```bash
npm test          # 96 tests
npm run typecheck
```

Covering the PRNG, movement and collision for every hazard/stance pair, pickups
and scoring, damage and death, determinism, frame-rate independence, entity
culling, track solvability across eight seeds and 20 km of track, autopilot
survival, and a set of tuning invariants that fail if a constant is retuned into
an unwinnable game (jump apex vs. barrier height, slide height vs. beam
clearance, row spacing vs. airtime, step size vs. tunnelling, and so on).

## Build metrics

| | |
| --- | --- |
| Wall-clock time | **25 minutes** (13:51–14:16 CDT, 1 Oct 2026) |
| Tokens used | **~210,000** of a 1M context (21%) |
| Model | Claude Opus 5 |
| Hand-written code | 3,912 lines TypeScript + 682 lines HTML/CSS |
| Production bundle | 39 KB JS + 7.5 KB CSS (12.8 KB + 2.4 KB gzipped) |
| Tests | 96, all passing |
| Measured performance | 60 fps, p95 frame 17.5 ms, worst 18.8 ms |

Token usage was read from the session's own context accounting; the figure is
the total context consumed over the build, not a per-request cost.
