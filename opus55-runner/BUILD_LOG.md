# Build log

## Time
| | |
|---|---|
| Started | 2026-10-01 13:11:52 CDT |
| Release-ready (all checks green) | 2026-10-01 13:34:20 CDT |
| **Total build time** | **22 min 28 s** |

## Token usage (Claude Code session, model `claude-opus-5-5`)
| Metric | Value |
|---|---|
| Final context window | **~193,000 tokens** (19% of 1M). About 59k of that is fixed system/tool overhead; ~133k is the conversation (code written, tool output, screenshots). |
| Session token budget consumed | **~193,000** (15,000,000 → 14,806,997) |
| Pro plan, 5-hour window | 8% → 32% (**+24 points**) |
| Pro plan, weekly window | 25% → 29% (**+4 points**) |

Note: the context figure counts each token once. Billed input is higher, because every turn re-sends the context, but most of it is served from the prompt cache.

## Final verification (`npm run test:all`, exit 0)
- ESLint: 0 problems
- Vitest: 29/29 unit tests passed (rules, physics, collisions, scoring, power-ups, generator fairness, 3-minute autopilot survival on 6 seeds)
- Vite production build: ~170 KB gzipped
- Playwright: 21/21 e2e tests passed (desktop + Pixel 7 emulation; 1 keyboard test is desktop-only by design), stable across 3 consecutive runs

## Issues found and fixed during visual QA
- Bloom washed the scene out → lowered strength and raised the threshold
- Custom shaders were double gamma-encoded (grey haze) → converted sRGB to linear in the shaders
- Obstacle faces looked like flat pink blocks and 1px edges disappeared → thick neon edge bars plus near-black faces
- The bike stayed visible after a crash (invulnerability flicker overrode its visibility) → fixed
- Bit points outweighed distance points → rebalanced (2 pts/m, 10 per bit)
- The sky backdrop left a dark band at the portrait FOV → enlarged it
- A flaky e2e timing assertion under software WebGL → switched to polling
