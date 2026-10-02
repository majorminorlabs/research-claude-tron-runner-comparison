# Sonnet 5
Original folder: `sonnet5-runner`. Model identity `claude-sonnet-5` and effort `high` are verified in [sonnet-5-session.json](../evidence/sonnet-5-session.json). No original project files were changed.
## Recovered metrics
| Metric | Value |
|---|---|
| Start (UTC) | 2026-10-01T19:25:42.364Z |
| End (UTC) | 2026-10-01T19:39:44.103Z |
| Session wall time | 841.739 seconds (14m 02s) |
| input_tokens | 226 |
| output_tokens | 59,771 |
| cache_creation_input_tokens | 128,114 |
| cache_read_input_tokens | 14,759,815 |
| cached_tokens | 14,759,815 |
| input_tokens_including_cache | 14,888,155 |
| total_tokens | 14,947,926 |
| artifact_file_count | 8 |
| files_created_during_run | unavailable |
| files_changed_during_run | unavailable |
| direct_write_edit_unique_paths | 8 |
| loc_production | 1,029 |
| loc_tests | 139 |
| loc_code_and_config | 1,209 |
| size_source_bytes | 35,893 |
| size_repo_logical_bytes | 35,893 |
| full_repo_file_count | 8 |
| rebuilt_bundle_bytes | not_applicable |

Timestamps use first user prompt to final assistant response. Token values are sums over distinct message IDs; stream duplicates were checked to have identical counters. Raw per-message usage and source line numbers are retained. `cached_tokens` means cache reads. Cache creation is separate.

Author-reported metrics: `{"build_time_seconds": 767, "token_value": 172000, "token_kind": "Approximate final context-window occupancy; includes initial context", "source": "evidence/sonnet-5-final-report.md", "qualifier": "Approximate self-report, not canonical session timing/API aggregate"}`. Raw source preserved; these values use different token and time definitions.
## Validation
| Check | Outcome | Command / detail |
|---|---|
| install | not_required | `No dependencies declared.` |
| test | passed | `npm run test` |
| build | unavailable | `No build script declared.` |
| lint | unavailable | `No lint script declared.` |
| typecheck | unavailable | `No typecheck script declared.` |
| javascript_syntax | passed | `node benchmark-set/benchmark/scripts/syntax-check.mjs tools/serve.js test/logic.test.js src/game.js src/logic.js` |
| Common browser smoke | passed | `node benchmark/scripts/browser-smoke.mjs` |
| Restricted storage | failed | `node benchmark/scripts/browser-storage.mjs` |
| Native browser suite | unavailable | No authored browser e2e suite. |

Browser smoke covers desktop 1280 × 720 and portrait 390 × 844 in fresh Chrome contexts, boot/canvas/overflow/score/pause/resume plus keyboard actions where state hooks exist. Portrait emulates touch availability but that common check uses keyboard actions. It does not prove swipe correctness. Opus 5 has no public state hook, so individual movement assertions are explicitly unavailable.


Runtime smoke exceptions/errors: none observed in these brief checks.
Runtime smoke warnings: none observed.
Restricted-storage errors: ["benchmark: localStorage blocked"].

Logs and screenshots: `benchmark/validation/sonnet-5/`. Passing smoke checks are not a claim of crash-free long gameplay.
## Implementation
Canvas 2D with procedural perspective projection; JavaScript; zero npm dependencies.
Variable render delta capped at 50 ms; Math.random in runtime; pure helper functions tested separately.

- Three lanes, jump/slide/dodge, three obstacle types
- Energy orbs and bonus orbs, distance score, speed ramp
- Keyboard, swipes, tap to jump, on-screen touch buttons
- Start, pause/resume, game-over/retry, locally stored best score

Optional features absent or limitations (not automatically prompt noncompliance):

- No procedural audio or mute control
- No shield/magnet/boost power-ups; bonus orbs are score rewards
- No seeded replay or title autopilot
- No automatic pause on hidden tab or blur
- No guard when localStorage access throws

Observed defects / inspection concerns:

- Restricted-storage bootstrap throws an uncaught error (reproduced).
- Score HUD/best update happens after collision handling; endRun returns before updating HUD, so the old HUD may remain on death (source observation, manual severity unassessed).

Source evidence: `sonnet5-runner/src/logic.js`, `sonnet5-runner/src/game.js`, `sonnet5-runner/index.html`, `sonnet5-runner/test/logic.test.js`.
## Dependencies
```json
{
  "runtime": {},
  "development": {},
  "locked_direct_versions": {},
  "scripts": {
    "test": "node --test test/",
    "serve": "node tools/serve.js"
  }
}
```
## Missing data

- Exact files created/changed across original run (no committed baseline; Bash writes not fully enumerated)
- Original release-ready instant independent of session endpoint
- Model training/version equivalence and original hardware load

Manual quality ratings, reviewer and notes are null in `benchmark-summary.json`. The reusable dimensions and evidence format are defined by `quality-review-schema.json`; there is no overall score.
