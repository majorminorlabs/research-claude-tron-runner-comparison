import { expect, test } from 'vitest';
import { actionFor, hitsVertically, minGapSeconds } from '../../src/game/rules';
import { CFG } from '../../src/game/config';

test('actionFor maps cells to required actions', () => {
  expect(actionFor(null)).toBe('none');
  expect(actionFor('low')).toBe('jump');
  expect(actionFor('high')).toBe('slide');
  expect(actionFor('block')).toBe('none');
});

test('low barrier: standing hits, airborne clears', () => {
  expect(hitsVertically('low', 0, CFG.standHeight)).toBe(true);
  expect(hitsVertically('low', 0, CFG.slideHeight)).toBe(true);
  expect(hitsVertically('low', 1.2, CFG.standHeight)).toBe(false);
});

test('high gate: standing hits, sliding clears, jumping still hits', () => {
  expect(hitsVertically('high', 0, CFG.standHeight)).toBe(true);
  expect(hitsVertically('high', 0, CFG.slideHeight)).toBe(false);
  expect(hitsVertically('high', 1.5, CFG.standHeight)).toBe(true);
});

test('block always hits at any reachable jump height', () => {
  const peak = (CFG.jumpVelocity * CFG.jumpVelocity) / (2 * CFG.gravity);
  expect(hitsVertically('block', 0, CFG.standHeight)).toBe(true);
  expect(hitsVertically('block', peak, CFG.standHeight)).toBe(true);
});

test('jump peak clears the low barrier with margin and airtime is sensible', () => {
  const peak = (CFG.jumpVelocity * CFG.jumpVelocity) / (2 * CFG.gravity);
  const airtime = (2 * CFG.jumpVelocity) / CFG.gravity;
  expect(peak).toBeGreaterThan(CFG.lowHeight + 0.8);
  expect(airtime).toBeGreaterThan(0.5);
  expect(airtime).toBeLessThan(0.8);
});

test('minGapSeconds is monotonic in lane distance and never below the floor', () => {
  for (const a of ['none', 'jump', 'slide'] as const)
    for (const b of ['none', 'jump', 'slide'] as const) {
      expect(minGapSeconds(a, b, 0)).toBeGreaterThanOrEqual(0.5);
      expect(minGapSeconds(a, b, 2)).toBeGreaterThanOrEqual(minGapSeconds(a, b, 1));
      expect(minGapSeconds(a, b, 1)).toBeGreaterThanOrEqual(minGapSeconds(a, b, 0));
    }
  expect(minGapSeconds('jump', 'jump', 0)).toBeGreaterThanOrEqual(0.6);
});
