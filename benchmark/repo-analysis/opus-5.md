# Opus 5
Original folder: `opus5-runner`. Model identity `claude-opus-5` and effort `high` are verified in [opus-5-session.json](../evidence/opus-5-session.json). No original project files were changed.
## Recovered metrics
| Metric | Value |
|---|---|
| Start (UTC) | 2026-10-01T18:51:16.233Z |
| End (UTC) | 2026-10-01T19:18:07.788Z |
| Session wall time | 1611.555 seconds (26m 52s) |
| input_tokens | 138 |
| output_tokens | 126,291 |
| cache_creation_input_tokens | 178,903 |
| cache_read_input_tokens | 10,193,819 |
| cached_tokens | 10,193,819 |
| input_tokens_including_cache | 10,372,860 |
| total_tokens | 10,499,151 |
| artifact_file_count | 30 |
| files_created_during_run | unavailable |
| files_changed_during_run | unavailable |
| direct_write_edit_unique_paths | 0 |
| loc_production | 3,591 |
| loc_tests | 1,003 |
| loc_code_and_config | 4,604 |
| size_source_bytes | 195,268 |
| size_repo_logical_bytes | 66,450,861 |
| full_repo_file_count | 915 |
| rebuilt_bundle_bytes | 53,806 |

Timestamps use first user prompt to final assistant response. Token values are sums over distinct message IDs; stream duplicates were checked to have identical counters. Raw per-message usage and source line numbers are retained. `cached_tokens` means cache reads. Cache creation is separate.

Author-reported metrics: `{"build_time_seconds": 1500, "token_value": 210000, "token_kind": "Approximate total context consumed, includes initial overhead", "source": "evidence/opus-5/README.md", "qualifier": "Rounded self-report, not canonical session timing/API aggregate"}`. Raw source preserved; these values use different token and time definitions.
## Validation
| Check | Outcome | Command / detail |
|---|---|
| install | passed | `npm ci --no-audit --no-fund` |
| test | passed | `npm run test` |
| build | passed | `npm run build` |
| lint | unavailable | `No lint script declared.` |
| typecheck | passed | `npm run typecheck` |
| javascript_syntax | passed | `node benchmark-set/benchmark/scripts/syntax-check.mjs` |
| Common browser smoke | passed | `node benchmark/scripts/browser-smoke.mjs` |
| Restricted storage | passed | `node benchmark/scripts/browser-storage.mjs` |
| Native browser suite | unavailable | No authored browser e2e suite. |

Browser smoke covers desktop 1280 × 720 and portrait 390 × 844 in fresh Chrome contexts, boot/canvas/overflow/score/pause/resume plus keyboard actions where state hooks exist. Portrait emulates touch availability but that common check uses keyboard actions. It does not prove swipe correctness. Opus 5 has no public state hook, so individual movement assertions are explicitly unavailable.


Runtime smoke exceptions/errors: none observed in these brief checks.
Runtime smoke warnings: none observed.
Restricted-storage errors: [].

Logs and screenshots: `benchmark/validation/opus-5/`. Passing smoke checks are not a claim of crash-free long gameplay.
## Implementation
Canvas 2D procedural city/light-cycle, camera projection, particles; TypeScript; no runtime npm dependencies.
Pure seeded simulation, fixed 1/120-second timestep; structurally restricted survivable row patterns; shared production autopilot.

- Three lanes, jump-hold, buffered jump, slide and fast-fall
- Barrier/beam/block obstacles; orbs with up-to-3× combo
- Three integrity segments, hit slowdown, temporary invulnerability
- Shield and overdrive (speed plus score boost)
- Title autopilot, HUD, pause/resume, game-over/retry, local best
- Procedural audio, mute, keyboard/swipes/tap, hidden-tab pause
- Determinism, generator, physics, invariant and autopilot-survival unit tests

Optional features absent or limitations (not automatically prompt noncompliance):

- No magnet or fullscreen control found
- No authored browser e2e or lint script
- Runtime chooses random seeds without URL seed option or public state hook

Observed defects / inspection concerns:

- None established by the common smoke; manual gameplay review remains empty.

Source evidence: `opus5-runner/src/main.ts`, `opus5-runner/src/core/constants.ts`, `opus5-runner/src/core/game.ts`, `opus5-runner/src/core/track.ts`, `opus5-runner/src/ui/input.ts`, `opus5-runner/src/render/renderer.ts`, `opus5-runner/tests/invariants.test.ts`.
## Dependencies
```json
{
  "runtime": {},
  "development": {
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  },
  "locked_direct_versions": {
    "typescript": "5.9.3",
    "vite": "5.4.21",
    "vitest": "2.1.9"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```
## Missing data

- Exact files created/changed across original run (no committed baseline; Bash writes not fully enumerated)
- Original release-ready instant independent of session endpoint
- Model training/version equivalence and original hardware load

Manual quality ratings, reviewer and notes are null in `benchmark-summary.json`. The reusable dimensions and evidence format are defined by `quality-review-schema.json`; there is no overall score.
