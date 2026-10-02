// Generates BUILD_STATS.md from scripts/build-meta.json.
// Usage: node scripts/build-stats.mjs [--finish]   (--finish stamps the finish time)
import { readFileSync, writeFileSync } from 'node:fs';

const metaUrl = new URL('./build-meta.json', import.meta.url);
const meta = JSON.parse(readFileSync(metaUrl, 'utf8'));
if (process.argv.includes('--finish')) {
  meta.finishedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  writeFileSync(metaUrl, JSON.stringify(meta, null, 2) + '\n');
}

const start = new Date(meta.startedAt);
const end = new Date(meta.finishedAt ?? Date.now());
const mins = Math.round((end - start) / 60000);
const hhmm = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
const fmt = (n) => n.toLocaleString('en-US');

const first = meta.tokenSnapshots[0];
const last = meta.tokenSnapshots[meta.tokenSnapshots.length - 1];

const rows = meta.tokenSnapshots
  .map((s) => `| ${s.label} | ${s.at.replace('T', ' ').replace('Z', ' UTC')} | ${fmt(s.contextTokens)} | ${s.fiveHourPct}% | ${s.weeklyPct}% |`)
  .join('\n');

const md = `# Build stats

Everything below was measured while building GRIDRUN in a single Claude Code session
(model: Claude Sonnet 5.5, no sub-agents).

## Time

| | |
|---|---|
| Started | ${meta.startedAt.replace('T', ' ').replace('Z', ' UTC')} |
| ${meta.finishedAt ? 'Finished' : 'Now (in progress)'} | ${end.toISOString().replace(/\.\d+Z$/, 'Z').replace('T', ' ').replace('Z', ' UTC')} |
| **Total build time** | **${hhmm}** (${mins} minutes wall-clock, including test runs) |

## Tokens

| Metric | Value |
|---|---|
| Session context at start | ${fmt(first.contextTokens)} tokens (system prompt, tools, skills) |
| Session context at end | ${fmt(last.contextTokens)} tokens |
| **Tokens added by the build** | **${fmt(last.contextTokens - first.contextTokens)}** (prompts, code written, tool output, reasoning) |
| Plan 5-hour window used by the build | ${last.fiveHourPct - first.fiveHourPct} percentage points |
| Plan weekly window used by the build | ${last.weeklyPct - first.weeklyPct} percentage points |

### Snapshots

| Checkpoint | Time | Context tokens | 5-hour window | Weekly window |
|---|---|---|---|---|
${rows}

### How to read the token numbers

- "Context tokens" is the size of the session's context window as reported by Claude Code's usage panel.
  Because the context accumulates every message, tool result and generated file, the growth between the
  first and last snapshot is the best available measure of tokens consumed by the build. It does **not**
  count tokens re-read from the prompt cache on each turn, so it is far lower than billed input volume.
- The plan percentages are the account-level usage meters and also include any other activity on the
  account during that window, so treat them as an upper bound.
- Regenerate this file with \`npm run stats\`; add checkpoints with \`node scripts/snapshot.mjs\`.
`;
writeFileSync(new URL('../BUILD_STATS.md', import.meta.url), md);
console.log(md);
