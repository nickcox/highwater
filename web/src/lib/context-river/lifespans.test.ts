import { describe, expect, it } from 'vitest';
import {
  callAxisTicks,
  presenceCount,
  sizeComparisonProfileId,
  sizeEstimateTokens,
  sortLifespans,
} from './lifespans';
import { testAnalysis } from './test-data';

describe('lifespans', () => {
  it('counts separate ranges rather than filling gaps', () => {
    const gap = testAnalysis().contextItems.find((item) => item.id === 'gap')!;
    expect(presenceCount(gap)).toBe(2);
  });

  it('sorts token-turn exposure descending with stable source-order ties', () => {
    const items = testAnalysis().contextItems;
    expect(sortLifespans(items).map((item) => item.id)).toEqual([
      'a',
      'summary',
      'retained',
      'gap',
    ]);

    const tied = structuredClone(items.slice(0, 2));
    tied[0].tokenTurns = 5;
    tied[1].tokenTurns = 5;
    expect(sortLifespans(tied).map((item) => item.id)).toEqual(tied.map((item) => item.id));
  });

  it('compares sizes only under the most widely covered numeric token profile', () => {
    const items = structuredClone(testAnalysis().contextItems.slice(0, 3));
    items[0].tokenEstimates = [estimate('z-profile', 999)];
    items[1].tokenEstimates = [estimate('a-profile', 40)];
    items[2].tokenEstimates = [estimate('a-profile', 20), estimate('z-profile', 1)];

    const profile = sizeComparisonProfileId(items);
    expect(profile).toBe('a-profile');
    expect(sizeEstimateTokens(items[0], profile)).toBeNull();
    expect(sortLifespans(items, 'size', profile).map((item) => item.id)).toEqual([
      items[1].id,
      items[2].id,
      items[0].id,
    ]);
  });

  it('sorts lifetime by calls actually present, with zero-presence items last and stable ties', () => {
    const items = structuredClone(testAnalysis().contextItems);
    items.push({
      ...items[0],
      id: 'terminal',
      firstModelCall: 0,
      lastModelCall: 0,
      presence: [],
      presenceCallCount: 0,
    });
    expect(sortLifespans(items, 'presenceCount').map((item) => item.id)).toEqual([
      'retained',
      'a',
      'summary',
      'gap',
      'terminal',
    ]);
  });

  it('sorts first appearance chronologically and leaves presence-less items last', () => {
    const items = structuredClone(testAnalysis().contextItems);
    items.push({
      ...items[0],
      id: 'terminal',
      firstModelCall: 0,
      lastModelCall: 0,
      presence: [],
      presenceCallCount: 0,
      tokenTurns: null,
    });
    expect(sortLifespans(items, 'firstAppearance').map((item) => item.id)).toEqual([
      'a',
      'gap',
      'retained',
      'summary',
      'terminal',
    ]);
  });

  it('selects at most eight deterministic call-axis ticks including both endpoints', () => {
    const calls = Array.from({ length: 160 }, (_, index) => index + 1);
    const ticks = callAxisTicks(calls);
    expect(ticks).toHaveLength(8);
    expect(ticks[0]).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(160);
    expect(callAxisTicks([4, 8, 12])).toEqual([4, 8, 12]);
  });
});

function estimate(profileId: string, tokens: number) {
  return {
    profileId,
    tokens,
    method: 'modelTokenizer' as const,
    coverage: 'complete' as const,
    noteCodes: [],
  };
}
