# Build stats

Everything below was measured while building GRIDRUN in a single Claude Code session
(model: Claude Sonnet 5.5, no sub-agents).

## Time

| | |
|---|---|
| Started | 2026-10-01 18:12:45 UTC |
| Finished | 2026-10-01 18:45:12 UTC |
| **Total build time** | **0h 32m** (32 minutes wall-clock, including test runs) |

## Tokens

| Metric | Value |
|---|---|
| Session context at start | 64,296 tokens (system prompt, tools, skills) |
| Session context at end | 272,743 tokens |
| **Tokens added by the build** | **208,447** (prompts, code written, tool output, reasoning) |
| Plan 5-hour window used by the build | 28 percentage points |
| Plan weekly window used by the build | 4 percentage points |

### Snapshots

| Checkpoint | Time | Context tokens | 5-hour window | Weekly window |
|---|---|---|---|---|
| baseline (before any work) | 2026-10-01 18:12:45 UTC | 64,296 | 8% | 25% |
| core logic + 78 unit tests passing | 2026-10-01 18:20:35 UTC | 124,652 | 19% | 27% |
| final (before last verification run) | 2026-10-01 18:45:12 UTC | 272,743 | 36% | 29% |

### How to read the token numbers

- "Context tokens" is the size of the session's context window as reported by Claude Code's usage panel.
  Because the context accumulates every message, tool result and generated file, the growth between the
  first and last snapshot is the best available measure of tokens consumed by the build. It does **not**
  count tokens re-read from the prompt cache on each turn, so it is far lower than billed input volume.
- The plan percentages are the account-level usage meters and also include any other activity on the
  account during that window, so treat them as an upper bound.
- Regenerate this file with `npm run stats`; add checkpoints with `node scripts/snapshot.mjs`.
