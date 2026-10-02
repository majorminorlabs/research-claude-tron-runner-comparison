# Methodology

This is an evidence-based comparison of four single game-building sessions. It is not a statistical model evaluation. All new artifacts and execution copies live under `benchmark/`. The games were not fixed, reformatted, upgraded, instrumented, or committed.

## Prompt design

The prompt was intentionally left thin: it set the genre, core controls and delivery constraints, then left each model to decide how to turn them into a playable game. Rendering, presentation, difficulty, reward systems and validation strategy were deliberately unspecified. This comparison examines the decisions each model made from that sparse brief; optional additions are observable choices, not retroactive requirements.

The intentionally sparse brief was shared by all four runs. Differences in the models' chosen implementations are part of the comparison. The exact prompt remains unchanged.

## Held constant

- All four normalized first human prompts are identical. The exact text is in `evidence/original-prompt.txt`; original pasted-content wrappers are also retained in each session evidence file.
- Every assistant row records session `effort: high`. The 5.5 models also record `perTurnEffort: high`; the 5 models record null there. A null per-turn value does not override the verified session effort.
- Local session logs record Claude Desktop / Claude Code version 2.1.284, matching project working directories and model IDs. Model mapping is established from `message.model`, not folder names.
- Current validation uses fresh copies of the same captured source files, existing exact lockfiles and `npm ci --no-audit --no-fund` where dependencies exist. No original `node_modules`, build output or test-result directory is used for validation.
- All existing unit suites are executed. Existing build, lint and typecheck scripts are executed without rewriting their requirements.
- Common browser smoke uses installed Google Chrome, headless, the same SwiftShader flags, 1280 × 720 desktop and 390 × 844 portrait, device pixel ratio 1 and fresh isolated browser contexts. It serves production output for bundled games and unbundled source for Sonnet 5 on distinct ports 4380–4383.
- Storage denial is tested equivalently in all four by making the `localStorage` getter throw, in fresh desktop contexts on ports 4390–4393.
- Size and line counts apply one published definition to every project. Missing measurements are marked `unavailable`; unsupported checks are not fabricated.

## What differed

One model session per project; architecture, code volume, chosen packages/versions, extra features, stopping decisions, original browser interactions and number/depth of tests all differ. Original initial request input including cache is recovered in `environment_original`; fixed system/tool context parity is not established. Only Opus 5.5 explicitly invokes a browser skill in the log. No sidechain records are present in these recovered sessions; hidden activity cannot be excluded.

Sonnet 5 and Opus 5 use Canvas 2D. The 5.5 projects use Three.js/WebGL with bloom and bundled font packages. Sonnet 5 uses an external Google Fonts stylesheet. Sonnet 5 has no dependency install or build step. Only Opus 5.5 declares lint, and only Sonnet 5.5 / Opus 5 declare typecheck. Only the 5.5 projects include authored browser suites.

The games differ in health, speed units/curves, scoring, obstacle cadence and power-ups. Features beyond the prompt are catalogued as observable differences, not automatic required features or quality penalties. Equal numeric seeds do not produce equal tracks; only the 5.5 games support seed URL options. Raw scores and survival times cannot directly rank them.

## Evidence recovery

Each model's local JSONL log is discovered under `~/.claude/projects/` by its exact working-directory encoding. Evidence extracts retain the absolute source path, SHA-256, line numbers, model/effort values, raw prompt, raw usage objects, request/message IDs, timing endpoints, available Git outputs and initial directory-listing proof. No complete conversation log is copied. In the public projection, local filesystem paths and user names are redacted; raw counter values, original log hashes and source line numbers remain. Original report files and package/lock files are copied under `evidence/<model-id>/` for comparison against claims.

Model IDs: `claude-sonnet-5`, `claude-sonnet-5-5`, `claude-opus-5`, `claude-opus-5-5`. All four match their corresponding original folders.

`benchmark-summary.json` uses the same fields across all four: identity, original prompt, run, tokens, files, dependencies, validation, implementation, self-reported metrics, environment, sources, metric provenance and null manual review fields. `benchmark-summary.csv` flattens the comparable quantitative fields. Each metric group names its evidence and calculation.

### Timing

Canonical **observed session wall time** is the timestamp of the first string human user prompt to the timestamp of the final assistant message, including setup, planning, coding, tool calls, testing, browser QA and final response. UTC ISO timestamps and fractional seconds are preserved. Queue submission and stop-hook times are retained separately. This is a reproducible boundary for all four; it is not model compute time or exact release-ready time.

The repository-reported times use different, often rounded internal checkpoints. Those are retained under `self_reported_metrics`, separate from the canonical comparison. Sonnet 5.5's final internal snapshot explicitly precedes the last verification run. No filesystem mtimes are substituted for original run timestamps. Opus 5.5 and Sonnet 5.5 original sessions overlap, so their build times may include shared-host/account contention. Original hardware, load, network latency and user interruptions are not fully recoverable.

### Tokens

Assistant messages stream multiple content blocks with the same `message.id` and repeated `message.usage`. For every project, duplicate rows were verified to contain identical usage objects. Count each unique message ID once, retain all source line numbers, and sum only these top-level fields:

```text
uncached input = sum(input_tokens)
cache writes   = sum(cache_creation_input_tokens)
cached input   = sum(cache_read_input_tokens)
all input      = uncached input + cache writes + cached input
total tokens   = all input + sum(output_tokens)
```

`input_tokens` in the JSON is the raw uncached field; `input_tokens_including_cache` is the total input volume. `cached_tokens` means cache reads, not writes. Output includes whatever thinking usage the provider reports in that counter. Raw thinking details are retained but never added again. Do not additionally sum nested `iterations`, `cache_creation` TTL subtotals or repeated streamed blocks. This would double count.

These are aggregate **observed assistant request usage** counters. Re-reading the same cached context on many requests counts repeatedly, so totals reach millions even though a context window occupied roughly 172k–273k tokens. The repositories' occupancy/growth reports do not measure the same thing. Cache-heavy tokens also have different cost semantics: no monetary costs, invoice completeness, hidden classifier/advisor usage or token estimates are inferred.

### Files, LOC and size

- `artifact_file_count`: files in the original source artifact, excluding `node_modules`, `.git`, `dist`, `test-results`, `playwright-report`, and `.DS_Store`. Includes docs, config and lockfiles; this is a present-state count, not a historical changed-file count.
- `loc_production`: physical lines, including blank lines and comments, in production `src` code and root `index.html` / `style.css`. Code suffixes: `.ts`, `.js`, `.mjs`, `.css`, `.html`, `.svg`. Tests/config/scripts are excluded.
- `loc_tests`: physical code lines in `test/` or `tests/`.
- `loc_code_and_config`: all code suffixes in the source artifact, including tests, scripts, SVG and config; excludes lockfiles and dependencies/generated output. These counts intentionally measure source volume, not complexity or quality.
- `size_source_bytes`: sum of logical file lengths in the artifact inventory, including docs and lockfiles.
- `size_repo_logical_bytes`: all original files, including installed dependencies, `.git`, existing `dist` and test artifacts. Logical bytes are not allocated disk blocks. This is confounded by installation state and is reported alongside source size.
- `rebuilt_bundle_bytes`: all files in the fresh production `dist`, including fonts; no bundle exists/was fabricated for Sonnet 5.
- Exact cumulative files created/changed during the run are `unavailable`. Three folders lack `.git`; Opus 5 has an initialized Git directory without a committed history. Initial listings show empty directories or one timing scratch file, but do not establish all later/deleted files or attribute desktop launch configs to model writes. Unique direct Write/Edit paths are retained as a partial diagnostic; Bash writes make them unsuitable as a comparison metric.

Each artifact file has its byte size and SHA-256 in `evidence/<model-id>-inventory.json`. `validation/original-integrity.json` compares all original files (including existing generated outputs) against the pre-validation inventory, excluding dependency and Git internals. No source changes or fixes were required.

## Validation commands and scope

Original validation ran on macOS arm64, Node v20.19.4/npm 10.8.2, installed Chrome 154.0.8037.59 with SwiftShader. Native suites used their original browser choices. The published logs retain exact commands; local paths have been redacted. The clean release supplies `benchmark/scripts/reproduce.py` to run the same current validation on disposable copies without overwriting published evidence. See the repository README for commands. Private session collection/summary regeneration scripts are excluded.

Per project, validation invokes `npm run test`, plus each declared `build`, `lint`, and `typecheck`. It also runs `node --check` over source JavaScript without applying a linter or synthesizing a TypeScript configuration. A zero-file JavaScript syntax pass for Opus 5 is not a substitute for its actual TypeScript check. Logs contain the exact commands, exit codes and elapsed check times. Current validation duration is not original build duration.

Common smoke performs boot, start-button visibility, nonzero canvas, horizontal overflow, score progress, pause and resume. It sends left/right/jump/slide keyboard actions in both viewports and asserts the state where a public hook exists. Opus 5 lacks such a hook, so those four assertions are explicitly unavailable; its authored core tests cover movement/collisions. Portrait contexts emulate touch availability but common actions use keyboard, so swipe correctness is only assessed by applicable native tests/manual review. No measured frame rate or blanket crash-free claim is made.

### Native suite attempts and fairness

First attempts used `npm run test:e2e -- --workers=1` with existing configs. Sonnet 5.5 hit a 500-second whole-suite benchmark timeout while other browser checks ran, and four failure contexts were retained. The captured first timeout log lacks full streamed stdout; its error-context artifacts are preserved.

Opus 5.5's first attempt reused the preceding preview on port 4173 because the native configs allow an existing server. The first failures reference missing Opus-specific title test IDs and show Sonnet's page; later failures include connection loss. This attempt is marked **invalid**, never attributed to Opus gameplay. This was a benchmark harness error.

All first-attempt statuses, text logs and sanitized text error contexts are retained publicly. Binary browser traces remain privately retained and are excluded from publication. Final native results: Sonnet 5.5 **24 passed**; Opus 5.5 **21 passed, 1 intentionally skipped**. Neither original project was repaired. An intermediate Opus wrapper attempt also failed readiness because it inherited a localhost bind while checking 127.0.0.1; it ran no tests and is retained as invalid harness evidence. The reusable wrapper explicitly binds 127.0.0.1.

Sonnet 5.5 gets a streamed recheck after common/browser-layout work finishes. The reusable isolated native harness writes a wrapper config **inside benchmark/**, keeps source tests and browser flags unchanged, gives each project a dedicated port (4471/4472), disables server reuse, uses already-built production output, one worker and zero retries, and streams complete logs with a 1200-second outer cap. Ports and ownership are harness adaptations, not game fixes. The final status and every earlier attempt remain separate in the summary. Software rendering can make simulation-time waits fail; native-suite failures cannot automatically be labeled product bugs without reproduction.

## Manual review and footage

`quality-review-schema.json` covers prompt compliance, feature completeness, controls/gameplay, visual polish, UI completeness, bugs, crashes, responsiveness and implementation defects. All manual ratings/notes/reviewer fields remain null and evidence arrays empty. Runtime/inspection findings are held separately. No overall quality score is calculated.

Four real MOV screen recordings were supplied after the initial benchmark. Release validation visually matched the gameplay to the implementations and remuxed the original H.264 packets into the four expected MP4 paths. All source recordings are 1920×1080/60fps and include container audio tracks. Public source clips strip captured audio and container metadata; the final comparison is muted. Audio implementation is source-confirmed in three games, absent in Sonnet 5, and not rated.

The release composition uses the first 90 continuous seconds of each source, all offsets zero, output 30fps. No selective cuts, loops, source cropping or speed changes are used. Starting game state, input/seed/graphics policy and capture hardware were not established as equivalent, so this is illustrative gameplay, not a controlled performance/survival test. Video packet hashes, source durations, conversion policy and final decode/visual validation accompany the release. The eight initial renderer QA layouts were placeholders used solely to check composition geometry; they are excluded from public screenshots.

For fair recording: same machine/browser, capture FPS/resolution, starting state and graphics policy; show comparable early and later gameplay moments with the same human input policy. Log seeds when supported, keep full HUDs visible, and avoid cherry-picking a flawless run for one game and a failure for another. Record difficulty/power-up differences. Use the manifest offsets/durations to align moments, not source-video edits. Audio defaults to muted; choose a single source explicitly if needed.

Missing/unverifiable: exact historical created/changed counts, independently proven release-ready instants, original load/system-prompt parity, hidden/invoice-complete token activity, broad real-device/long-session behavior, manual review judgments and undocumented recording controls. Verified session timing and observed API counters are available for all four.
