// Usage: node scripts/snapshot.mjs "<label>" <contextTokens> <fiveHourPct> <weeklyPct>
// Appends a usage snapshot (read from the Claude Code session usage panel) to build-meta.json.
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('./build-meta.json', import.meta.url);
const meta = JSON.parse(readFileSync(file, 'utf8'));
const [label, ctx, five, weekly] = process.argv.slice(2);
meta.tokenSnapshots.push({
  label,
  at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  contextTokens: Number(ctx),
  fiveHourPct: Number(five),
  weeklyPct: Number(weekly),
});
writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
console.log('snapshot recorded:', label);
