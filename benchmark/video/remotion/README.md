# Gameplay comparison renderer

Original gameplay only. The public release provides four silent gameplay MP4s as release assets and in the package archive. No coding footage is used. The renderer refuses to export while a selected recording is missing. Studio may display clearly labeled missing-recording panels; the PNGs under `benchmark/validation/renderer/` are layout checks, not footage.

## Install and render

From the benchmark-set parent directory:

```sh
npm --prefix benchmark/video/remotion ci
npm --prefix benchmark/video/remotion run verify
npm --prefix benchmark/video/remotion run preflight
npm --prefix benchmark/video/remotion run render -- --kind Grid --format 16x9
```

First output: `benchmark/video/remotion/out/Grid-16x9.mp4` (H.264, yuv420p, CRF 18). Existing output files are not overwritten. Choose a new `--output out/name.mp4` to retain earlier renders.

Requires Node.js 20.19.4 or newer, npm, `ffprobe` on PATH, and Chrome. Remotion downloads its supported browser when needed. To use installed Chrome on this machine:

```sh
export REMOTION_BROWSER_EXECUTABLE='<CHROME_EXECUTABLE>'
```

The pinned lockfile preserves the tested dependency versions.

## Recordings and alignment

Drop these exact original files under `benchmark/video/gameplay/`:

| Model | Filename |
|---|---|
| Sonnet 5 | `sonnet-5.mp4` |
| Sonnet 5.5 | `sonnet-5.5.mp4` |
| Opus 5 | `opus-5.mp4` |
| Opus 5.5 | `opus-5.5.mp4` |

Edit `benchmark/video/manifest.json`:

- `fps`: output FPS, default 30; source FPS may differ.
- Each `offsetSeconds`: skip that many seconds from the beginning of that model's source.
- Each `durationSeconds`: cap that source segment. `null` selects all remaining footage.
- Top-level `durationSeconds`: optional output duration. `null` uses the shortest selected segment.
- `matchup`: two model IDs for the default matchup.
- `audioModel`: `null` mutes every panel; select exactly one model to use its audio. That model must be in the selected composition.

Offsets round to the nearest output frame; durations round down. The renderer rejects negative offsets, clips with no remaining frames, and requested durations exceeding available footage. It uses the video-stream duration when available, avoiding a longer audio track extending gameplay. It never loops, pads, speeds up, freezes, or substitutes recordings to equalize lengths.

Example: set Sonnet 5's offset to 12.5 and its duration to 30, set the other offsets to their equivalent gameplay moment, then set the top-level duration to 30 if all selected clips have at least 30 seconds remaining. Source videos stay unchanged.

## Compositions

```sh
# Two-model side-by-side; --models overrides manifest.matchup
npm --prefix benchmark/video/remotion run render -- --kind Matchup --format 16x9 --models sonnet-5.5,opus-5.5

# Other output shapes
npm --prefix benchmark/video/remotion run render -- --kind Grid --format 4x3
npm --prefix benchmark/video/remotion run render -- --kind Grid --format 1x1
npm --prefix benchmark/video/remotion run render -- --kind Grid --format 9x16

# Preview; rerun after changing manifest or replacing recordings
npm --prefix benchmark/video/remotion run studio
```

| Format | Resolution | Four models | Two models |
|---|---|---|---|
| 16:9 | 1920 × 1080 | 2 × 2 | Side by side |
| 4:3 | 1600 × 1200 | 2 × 2 | Side by side |
| 1:1 | 1440 × 1440 | 2 × 2 | Side by side |
| 9:16 | 1080 × 1920 | Four full-width rows | Two full-width rows |

Tall output stacks panels to keep each gameplay view larger than a portrait 2 × 2 grid. All source video uses `object-fit: contain`, with its full HUD and aspect ratio intact. Widescreen is the primary comparison format; portrait still reduces detail and is best viewed fullscreen.

Labels and metric strips sit outside the gameplay. Metrics come from `benchmark-summary.json`: original observed session time, aggregate total tokens (including repeated cache reads), and logged effort. No quality score is displayed. MAJOR//MINOR appears only in the small top-right brand line. Data fields marked `unavailable` render as such.

## Validation

`npm run verify` runs TypeScript and timeline/preflight tests. `node scripts/qa-stills.mjs` renders all eight layouts to labeled PNGs in `benchmark/validation/renderer/`. Those checks verify registration, bundling, dimensions, metrics and layout without manufacturing source video. Full MP4 decoding, trim alignment, audio sync and final gameplay export must be verified once the originals are supplied.

API references: [OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo), [calculateMetadata](https://www.remotion.dev/docs/calculate-metadata), [renderMedia](https://www.remotion.dev/docs/renderer/render-media), [bundle](https://www.remotion.dev/docs/bundle).
