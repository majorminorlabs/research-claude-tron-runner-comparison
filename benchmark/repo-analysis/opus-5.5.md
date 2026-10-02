# Opus 5.5
Original folder: `opus55-runner`. Model identity `claude-opus-5-5` and effort `high` are verified in [opus-5.5-session.json](../evidence/opus-5.5-session.json). No original project files were changed.
## Recovered metrics
| Metric | Value |
|---|---|
| Start (UTC) | 2026-10-01T18:11:46.690Z |
| End (UTC) | 2026-10-01T18:34:49.212Z |
| Session wall time | 1382.522 seconds (23m 03s) |
| input_tokens | 118 |
| output_tokens | 100,631 |
| cache_creation_input_tokens | 156,524 |
| cache_read_input_tokens | 8,022,765 |
| cached_tokens | 8,022,765 |
| input_tokens_including_cache | 8,179,407 |
| total_tokens | 8,280,038 |
| artifact_file_count | 29 |
| files_created_during_run | unavailable |
| files_changed_during_run | unavailable |
| direct_write_edit_unique_paths | 21 |
| loc_production | 2,779 |
| loc_tests | 575 |
| loc_code_and_config | 3,414 |
| size_source_bytes | 187,821 |
| size_repo_logical_bytes | 90,739,223 |
| full_repo_file_count | 3,411 |
| rebuilt_bundle_bytes | 694,554 |

Timestamps use first user prompt to final assistant response. Token values are sums over distinct message IDs; stream duplicates were checked to have identical counters. Raw per-message usage and source line numbers are retained. `cached_tokens` means cache reads. Cache creation is separate.

Author-reported metrics: `{"build_time_seconds": 1348, "token_value": 193000, "token_kind": "Approximate final context-window occupancy; includes overhead", "source": "evidence/opus-5.5/BUILD_LOG.md", "qualifier": "Self-reported release-ready checkpoint; budget arithmetic 193003 is separate"}`. Raw source preserved; these values use different token and time definitions.
## Validation
| Check | Outcome | Command / detail |
|---|---|
| install | passed | `npm ci --no-audit --no-fund` |
| test | passed | `npm run test` |
| build | passed | `npm run build` |
| lint | passed | `npm run lint` |
| typecheck | unavailable | `No typecheck script declared.` |
| javascript_syntax | passed | `node benchmark-set/benchmark/scripts/syntax-check.mjs playwright.config.js vite.config.js eslint.config.js src/main.js src/audio.js src/input.js src/storage.js src/render/materials.js src/render/scenery.js src/render/floor.js src/render/trail.js src/render/cycle.js src/render/view.js src/render/particles.js src/game/rng.js src/game/game.js src/game/autopilot.js src/game/config.js tests/unit/game.test.js tests/e2e/game.spec.js` |
| Common browser smoke | passed | `node benchmark/scripts/browser-smoke.mjs` |
| Restricted storage | passed | `node benchmark/scripts/browser-storage.mjs` |
| Native browser suite | passed | `npm run test:e2e -- --config benchmark-set/benchmark/validation/opus-5.5/native-playwright.config.js --workers=1 --retries=0` |

Browser smoke covers desktop 1280 × 720 and portrait 390 × 844 in fresh Chrome contexts, boot/canvas/overflow/score/pause/resume plus keyboard actions where state hooks exist. Portrait emulates touch availability but that common check uses keyboard actions. It does not prove swipe correctness. Opus 5 has no public state hook, so individual movement assertions are explicitly unavailable.

- Native attempt: **invalid**, exit 1; [validation/opus-5.5/e2e.log](../validation/opus-5.5/e2e.log). Port 4173 reused Sonnet 5.5 preview after its suite timed out. Missing Opus-specific data-testid=title and Sonnet page snapshot confirm wrong application. These failures are harness contamination, not Opus gameplay failures.
- Native attempt: **invalid**, exit 1; [validation/opus-5.5/e2e-isolated-attempt-1.log](../validation/opus-5.5/e2e-isolated-attempt-1.log). Benchmark wrapper readiness address was 127.0.0.1 but inherited Opus preview bound localhost; no tests ran before webServer readiness timed out. Wrapper now explicitly binds 127.0.0.1.
- Native attempt: **passed**, exit 0; [validation/opus-5.5/e2e-isolated.log](../validation/opus-5.5/e2e-isolated.log). Native tests unchanged; benchmark wrapper isolates port and server ownership, uses already-built production bundle, one worker, zero retries, native browser flags.

Runtime smoke exceptions/errors: none observed in these brief checks.
Runtime smoke warnings: none observed.
Restricted-storage errors: [].

Logs and screenshots: `benchmark/validation/opus-5.5/`. Passing smoke checks are not a claim of crash-free long gameplay.
## Implementation
Three.js WebGL, light-cycle model, custom grid shader, bloom, pooling/particles, bundled Orbitron; JavaScript.
Pure seeded simulation, fixed 120 Hz timestep; adjacent guaranteed safe lanes and wall-length restrictions; title/test autopilot.

- Three lanes, buffered jump, slide/fast-fall, wall side-bump behavior
- Barriers/gates/walls, bits, clean-dodge bonuses
- Shield, magnet and double-score multiplier
- Seeded URL replay, rising speed, title autopilot
- HUD/power timers, pause/resume/quit, results/retry, local best
- Procedural audio/music, persistent mute, adaptive quality
- Keyboard/swipes, hidden-tab/blur pause, WebGL-unavailable error state
- ESLint, unit tests and desktop/mobile browser tests

Optional features absent or limitations (not automatically prompt noncompliance):

- No separate TypeScript/typecheck setup
- No phase power-up, multiple integrity lives or fullscreen control found

Observed defects / inspection concerns:

- None established by the common smoke; manual gameplay review remains empty.

Source evidence: `opus55-runner/src/main.js`, `opus55-runner/src/game/config.js`, `opus55-runner/src/game/game.js`, `opus55-runner/src/render/view.js`, `opus55-runner/src/audio.js`, `opus55-runner/src/input.js`, `opus55-runner/tests/e2e/game.spec.js`.
## Dependencies
```json
{
  "runtime": {
    "@fontsource/orbitron": "^5.3.0",
    "three": "^0.186.1"
  },
  "development": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.63.0",
    "eslint": "^10.11.0",
    "globals": "^17.13.0",
    "vite": "^8.3.2",
    "vitest": "^4.1.11"
  },
  "locked_direct_versions": {
    "@fontsource/orbitron": "5.3.0",
    "three": "0.186.1",
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.63.0",
    "eslint": "10.11.0",
    "globals": "17.13.0",
    "vite": "8.3.2",
    "vitest": "4.1.11"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "npm run lint && npm run test && npm run build && npm run test:e2e"
  }
}
```
## Missing data

- Exact files created/changed across original run (no committed baseline; Bash writes not fully enumerated)
- Original release-ready instant independent of session endpoint
- Model training/version equivalence and original hardware load

Manual quality ratings, reviewer and notes are null in `benchmark-summary.json`. The reusable dimensions and evidence format are defined by `quality-review-schema.json`; there is no overall score.
