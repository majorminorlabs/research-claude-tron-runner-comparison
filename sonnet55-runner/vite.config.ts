import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** Build time / token figures shown on the title screen (see scripts/build-stats.mjs). */
function buildInfo(): { minutes: number; tokens: number; model: string } {
  try {
    const meta = JSON.parse(readFileSync(new URL('./scripts/build-meta.json', import.meta.url), 'utf8'));
    const start = new Date(meta.startedAt).getTime();
    const end = meta.finishedAt ? new Date(meta.finishedAt).getTime() : Date.now();
    const snaps = meta.tokenSnapshots as { contextTokens: number }[];
    return {
      minutes: Math.max(0, Math.round((end - start) / 60000)),
      tokens: Math.max(0, snaps[snaps.length - 1]!.contextTokens - snaps[0]!.contextTokens),
      model: 'Claude Sonnet 5.5',
    };
  } catch {
    return { minutes: 0, tokens: 0, model: 'Claude' };
  }
}

export default defineConfig({
  base: './',
  define: { __BUILD_INFO__: JSON.stringify(buildInfo()) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
  },
});
