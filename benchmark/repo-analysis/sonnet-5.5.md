# Sonnet 5.5
Original folder: `sonnet55-runner`. Model identity `claude-sonnet-5-5` and effort `high` are verified in [sonnet-5.5-session.json](../evidence/sonnet-5.5-session.json). No original project files were changed.
## Recovered metrics
| Metric | Value |
|---|---|
| Start (UTC) | 2026-10-01T18:12:38.744Z |
| End (UTC) | 2026-10-01T18:47:35.395Z |
| Session wall time | 2096.651 seconds (34m 57s) |
| input_tokens | 152 |
| output_tokens | 174,189 |
| cache_creation_input_tokens | 233,440 |
| cache_read_input_tokens | 14,032,456 |
| cached_tokens | 14,032,456 |
| input_tokens_including_cache | 14,266,048 |
| total_tokens | 14,440,237 |
| artifact_file_count | 44 |
| files_created_during_run | unavailable |
| files_changed_during_run | unavailable |
| direct_write_edit_unique_paths | 0 |
| loc_production | 3,500 |
| loc_tests | 1,413 |
| loc_code_and_config | 5,058 |
| size_source_bytes | 247,901 |
| size_repo_logical_bytes | 124,540,681 |
| full_repo_file_count | 4,085 |
| rebuilt_bundle_bytes | 1,069,801 |

Timestamps use first user prompt to final assistant response. Token values are sums over distinct message IDs; stream duplicates were checked to have identical counters. Raw per-message usage and source line numbers are retained. `cached_tokens` means cache reads. Cache creation is separate.

Author-reported metrics: `{"build_time_seconds": 1947, "token_value": 208447, "token_kind": "Context growth: 272743 minus 64296", "source": "evidence/sonnet-5.5/scripts/build-meta.json", "qualifier": "Recorded internal checkpoint ending before final verification/response"}`. Raw source preserved; these values use different token and time definitions.
## Validation
| Check | Outcome | Command / detail |
|---|---|
| install | passed | `npm ci --no-audit --no-fund` |
| test | passed | `npm run test` |
| build | passed | `npm run build` |
| lint | unavailable | `No lint script declared.` |
| typecheck | passed | `npm run typecheck` |
| javascript_syntax | passed | `node benchmark-set/benchmark/scripts/syntax-check.mjs scripts/build-stats.mjs scripts/snapshot.mjs` |
| Common browser smoke | passed | `node benchmark/scripts/browser-smoke.mjs` |
| Restricted storage | passed | `node benchmark/scripts/browser-storage.mjs` |
| Native browser suite | passed | `npm run test:e2e -- --workers=1` |

Browser smoke covers desktop 1280 × 720 and portrait 390 × 844 in fresh Chrome contexts, boot/canvas/overflow/score/pause/resume plus keyboard actions where state hooks exist. Portrait emulates touch availability but that common check uses keyboard actions. It does not prove swipe correctness. Opus 5 has no public state hook, so individual movement assertions are explicitly unavailable.

- Native attempt: **incomplete**, exit 124; [validation/sonnet-5.5/e2e.log](../validation/sonnet-5.5/e2e.log). Whole suite hit benchmark 500-second timeout while other browser validation was running. Four test failure contexts preserved; result cannot establish an overall suite outcome.
- Native attempt: **passed**, exit 0; [validation/sonnet-5.5/e2e-recheck.log](../validation/sonnet-5.5/e2e-recheck.log). Streamed rerun after common smoke and first renderer layout checks ended; owned Sonnet preview verified by successful native assertions. No claim of exclusive hardware load. Initial timeout/artifacts retained.

Runtime smoke exceptions/errors: none observed in these brief checks.
Runtime smoke warnings: ["[.WebGL-0x114007d8800]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels", "[.WebGL-0x114007d8800]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)"].
Restricted-storage errors: [].

Logs and screenshots: `benchmark/validation/sonnet-5.5/`. Passing smoke checks are not a claim of crash-free long gameplay.
## Implementation
Three.js WebGL, custom floor shader, articulated runner, bloom, bundled Orbitron/Rajdhani; TypeScript.
Seeded RNG, deterministic game logic, generator plus independent route solver/autopilot; fixed 120 Hz accumulator in main loop.

- Three lanes, buffered lane changes/jump, slide and fast-fall
- Barriers, gates and walls; bits, clean-dodge bonuses, chains
- Shield, magnet, overclock multiplier and phase invulnerability/speed boost
- Sectors and increasing difficulty; seeded URL replay
- Title autopilot, countdown, HUD, power timers, pause/restart/quit/retry
- Procedural music/SFX, persistent mute/records, graphics toggle and automatic quality fallback
- Keyboard and swipes, fullscreen, hidden-tab and blur pause, reduced-motion handling
- Unit fairness/soak tests and authored desktop/mobile browser tests

Optional features absent or limitations (not automatically prompt noncompliance):

- No backend, login or leaderboard by prompt design
- No external asset/remote font fetch required

Observed defects / inspection concerns:

- None established by the common smoke; manual gameplay review remains empty.

Source evidence: `sonnet55-runner/src/main.ts`, `sonnet55-runner/src/game/game.ts`, `sonnet55-runner/src/game/config.ts`, `sonnet55-runner/src/game/generator.ts`, `sonnet55-runner/src/game/solver.ts`, `sonnet55-runner/src/render/view.ts`, `sonnet55-runner/src/storage.ts`, `sonnet55-runner/tests/e2e/game.spec.ts`.
## Dependencies
```json
{
  "runtime": {
    "@fontsource/orbitron": "^5.3.0",
    "@fontsource/rajdhani": "^5.3.0",
    "three": "^0.186.1"
  },
  "development": {
    "@playwright/test": "^1.63.0",
    "@types/pngjs": "^6.0.5",
    "@types/three": "^0.186.0",
    "pngjs": "^7.0.0",
    "typescript": "^7.0.2",
    "vite": "^8.3.2",
    "vitest": "^4.1.11"
  },
  "locked_direct_versions": {
    "@fontsource/orbitron": "5.3.0",
    "@fontsource/rajdhani": "5.3.0",
    "three": "0.186.1",
    "@playwright/test": "1.63.0",
    "@types/pngjs": "6.0.5",
    "@types/three": "0.186.0",
    "pngjs": "7.0.0",
    "typescript": "7.0.2",
    "vite": "8.3.2",
    "vitest": "4.1.11"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173 --strictPort",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "npm run typecheck && npm test && npm run build && npm run test:e2e",
    "stats": "node scripts/build-stats.mjs"
  }
}
```
## Missing data

- Exact files created/changed across original run (no committed baseline; Bash writes not fully enumerated)
- Original release-ready instant independent of session endpoint
- Model training/version equivalence and original hardware load

Manual quality ratings, reviewer and notes are null in `benchmark-summary.json`. The reusable dimensions and evidence format are defined by `quality-review-schema.json`; there is no overall score.
