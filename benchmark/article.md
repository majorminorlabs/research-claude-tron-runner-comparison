# Four Claude models, one runner prompt

[Watch the four-way comparison](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/releases/download/v1.0.0/comparison-web.mp4)

One prompt produced four browser games with different renderers, failure rules and feature sets. We kept the implementations, recovered the session evidence and validated them under the same current browser-smoke harness. The result is a controlled one-shot artifact comparison: one run per model, not a statistical model-performance benchmark.

The video shows the first 90 continuous seconds of each supplied recording. Each game keeps its full recorded frame and HUD. There are no selective cuts, loops or speed changes. Audio is muted. The recordings begin at different gameplay states, and their input policy, seed and graphics settings were not recorded. Treat the footage as evidence of these artifacts, not a race or a measure of survival skill.

## The exact prompt

```text
Build an endless runner in Tron visual style.
3 lanes, jump/slide/dodge, obstacles, rewards, etc.
Web browser based game. No Login. No leaderboard.
Keep track of token usage and total time spent building the game.
Do not stop until it passes all tests and is ready to release.
```

This is the verbatim human prompt body used in all four sessions. Three logs wrap it in a pasted-content envelope; the fourth records it directly. The [raw per-session payloads](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/tree/main/benchmark/evidence/prompts) preserve those transport differences. The prompt asks for three lanes, jump/slide/dodge, obstacles, rewards and a browser game without login or a leaderboard. It does not prescribe a renderer, character model, health system, power-up catalogue or test-suite size.

The prompt was intentionally left thin: it set the genre, core controls and delivery constraints, then left each model to decide how to turn them into a playable game. Rendering, presentation, difficulty, reward systems and validation strategy were deliberately unspecified. This comparison examines the decisions each model made from that sparse brief; optional additions are observable choices, not retroactive requirements.

## Four-way results

| Model | Effort | Session time | Request tokens¹ | Production LOC² | Rendering | Audio in source |
|---|---|---:|---:|---:|---|---|
| Sonnet 5 | high | 14m 02s | 14,947,926 | 1,029 | Canvas 2D | Absent |
| Sonnet 5.5 | high | 34m 57s | 14,440,237 | 3,500 | Three.js / WebGL | Procedural |
| Opus 5 | high | 26m 52s | 10,499,151 | 3,591 | Canvas 2D | Procedural |
| Opus 5.5 | high | 23m 03s | 8,280,038 | 2,779 | Three.js / WebGL | Procedural |

¹ Aggregate observed request counters include repeated cache reads; they are neither unique generated tokens nor invoice-complete costs. ² Physical production lines include comments/blanks; tests, configuration and build output are excluded.

Model identities come from the session logs, rather than folder names: `claude-sonnet-5`, `claude-sonnet-5-5`, `claude-opus-5` and `claude-opus-5-5`. Every session records `effort: high`. The 5.5 logs also record a high per-turn effort; the 5 logs leave that field null. That null does not erase the recorded session setting.

Time here has one boundary for all four runs: first user prompt to final assistant response. It includes tools, testing, browser work and the final report. We cannot independently recover the exact release-ready instant or isolate model compute time. The two original 5.5 sessions overlapped, so host/account contention is another limit on timing comparisons.

## What the token totals count

The totals are large because the logs count context read on successive requests. We deduplicated streamed assistant rows by message ID, checked that repeated usage objects agreed, and summed uncached input, cache creation, cache reads and output once per distinct message. Nested iteration counters and thinking subtotals were not added again.

They measure observed request usage, not unique text written, context occupancy or invoice-complete cost. Cache-heavy input has different cost semantics. The games' own build-stat displays and reports preserve their smaller context-window figures; those figures use another definition and are not substituted into this comparison. The [JSON](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/blob/main/benchmark/benchmark-summary.json) retains each raw counter and source reference. No missing usage was estimated.

## Two rendering approaches

Sonnet 5 and Opus 5 use Canvas 2D with procedural perspective. Sonnet 5 has no npm dependencies and no bundling step. Its recorded scene uses a sparse track, small vehicle, horizon band and solid obstacle colours. Opus 5 adds a procedural city silhouette, wireframe obstacles, particles and a light-cycle form, while still requiring no runtime npm package. Both implement the requested three-lane movement and rewards.

The 5.5 implementations use Three.js/WebGL, custom floor/grid shaders and bloom. Sonnet 5.5 draws an articulated runner amid illuminated buildings and mountain silhouettes. Opus 5.5 draws a light-cycle scene with wireframe towers, arches and orange/cyan lighting. Those are visible implementation choices. They do not establish that WebGL is necessary for prompt compliance or that a denser scene is a better game.

Runtime packages also differ. Sonnet 5.5 bundles Three.js, Orbitron and Rajdhani; Opus 5.5 bundles Three.js and Orbitron. Sonnet 5 uses a remote Google Fonts stylesheet. Opus 5 uses system/procedural presentation without runtime npm dependencies. Dev tooling and exact lockfile versions are included in the [source repository](https://github.com/majorminorlabs/research-claude-tron-runner-comparison). These dependency choices change installation, offline-font and rendering requirements.

## The games make different mistakes survivable

Opus 5 exposes three integrity segments, temporary invulnerability and a slowdown after a hit. Its source includes shields, overdrive and an orb combo up to 3×. Its recorded HUD shows integrity, a shield and a multiplier. This changes the meaning of a collision and makes its run length or score incomparable with games that use another damage rule.

Sonnet 5 keeps a smaller reward system: energy and bonus orbs, a distance score and a speed ramp. Its inspected source has no procedural audio, shield/magnet/boost system or title autopilot. Those additions were not named as requirements in the prompt, so absence alone is not scored as failure.

Sonnet 5.5 includes shield, magnet, overclock and phase effects, clean-dodge bonuses, chains and sector progression. Opus 5.5 includes shield, magnet and a double-score multiplier, plus a side-bump rule for walls. Both support URL seeds and title/test autopilots. Equal seed numbers would still generate different tracks because the generators differ.

Opus 5 and both 5.5 artifacts use seeded simulation and a fixed 120 Hz timestep. Sonnet 5 uses runtime `Math.random` and a capped variable render delta. Sonnet 5.5 includes an independent route solver; the other larger implementations enforce their own safe-pattern rules. This is a difference in how the source constrains generated obstacles. We did not measure frame rate, responsiveness or long-run human play well enough to rank those approaches.

## Audio and interface completeness

Source inspection finds procedural audio in Opus 5, Sonnet 5.5 and Opus 5.5, with mute controls. Sonnet 5 has no audio implementation. All four recording containers have audio tracks, but a container track is not proof of game sound. We removed captured sound from the public source clips and muted the final comparison, so this publication does not assess audio quality or audibility.

All four have start, pause/resume, results/retry and local best-score UI. The larger artifacts add power-up indicators and title autopilot. Sonnet 5.5 also includes fullscreen and graphics controls. The implementation reports separate source-confirmed features, reproduced behavior and unreviewed concerns. The manual quality schema remains empty, including visual polish and responsiveness; there is no aggregate rating.

## Validation preserves failures

| Model | Build / delivery | Lint | Typecheck | Unit suite | Native browser suite | Common smoke | Storage denied |
|---|---|---|---|---|---|---|---|
| Sonnet 5 | Static ES modules; no build step | unavailable | unavailable | 15 passed | unavailable | passed | failed |
| Sonnet 5.5 | passed | unavailable | passed | 83 passed | 24 passed | passed | passed |
| Opus 5 | passed | unavailable | passed | 96 passed | unavailable | passed | passed |
| Opus 5.5 | passed | passed | unavailable | 29 passed | 21 passed / 1 intentional skip | passed | passed |

These test counts belong to different authored suites. They are not directly comparable quality scores or evidence of equivalent coverage. Missing scripts are `unavailable`, not passes. All four authored unit suites passed. The three declared production builds passed; Sonnet 5 is delivered directly as static ES modules. Typecheck passed where declared, and the only declared lint check, Opus 5.5's, passed.

Common smoke used fresh headless Chrome contexts at 1280 × 720 and 390 × 844 with the same SwiftShader flags. All four booted and passed the brief score/pause/resume checks without uncaught or console errors. Movement assertions were unavailable for Opus 5 because it exposes no public state hook. Portrait smoke used keyboard actions despite touch emulation, so it does not validate swipe behavior across all four.

The equivalent denied-storage check reproduced a bootstrap error in Sonnet 5. The other three passed. That failure remains in the package and the game was not repaired. Sonnet 5.5 produced software-WebGL GPU-stall warnings during desktop screenshot capture; these are not native-GPU performance measurements.

The first Sonnet 5.5 authored browser attempt timed out. The first Opus 5.5 attempt reused the preceding game's server; an intermediate isolation wrapper then failed readiness before running tests. Those two Opus attempts are marked invalid harness attempts, not gameplay failures. Final authored results were 24 passed for Sonnet 5.5 and 21 passed with one intentional mobile keyboard skip for Opus 5.5. The original tests were unchanged. Logs retain the attempts and explain the port/server isolation.

## What this comparison can support

The same recovered human prompt, logged high effort and client version provide a controlled prompt/configuration boundary. System/tool context parity, original hardware load, recording controls and hidden token activity are not established. Test depth, scoring, difficulty, optional features and packages differ. Each model has exactly one observed build, so this cannot establish average model quality, statistical superiority or a reliable future-build distribution.

Exact historical file-change counts, an independently proven release-ready instant and invoice-complete usage are unavailable. Production LOC measures source volume, not elegance or correctness. Passing short smoke does not establish crash-free long gameplay or broad device compatibility. The footage illustrates four particular artifacts; we leave broader conclusions open.

## Inspect and reproduce

The [GitHub repository](https://github.com/majorminorlabs/research-claude-tron-runner-comparison) contains all four implementations, exact prompts, raw-derived session evidence, [results CSV](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/blob/main/benchmark/benchmark-summary.csv), [methodology](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/blob/main/benchmark/methodology.md), [limitations](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/blob/main/benchmark/limitations.md), [validation logs and screenshots](https://github.com/majorminorlabs/research-claude-tron-runner-comparison/tree/main/benchmark/validation), source hashes and the reusable gameplay renderer. The release includes silent source recordings and both the master and web comparison video. No game source was repaired for publication.

Every comparison should remain traceable to a source file, a check log or an observed frame. These artifacts let readers check the implementation choices and the failures without turning either code volume or test count into a fabricated ranking.
