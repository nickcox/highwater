import { describe, expect, it } from 'vitest';
import { binCachePoints } from './cache-overview';
import type { CacheTrackPoint } from './economics-track';

function point(
  callIndex: number,
  promptTokens: number,
  read: number,
  fresh: number,
): CacheTrackPoint {
  const segments = [
    { kind: 'cacheRead' as const, label: 'Cache read', value: read },
    { kind: 'fresh' as const, label: 'Fresh input', value: fresh },
  ];
  return {
    callIndex,
    status: promptTokens === 0 ? 'zero' : 'complete',
    promptTokens,
    segments,
    shareSegments:
      promptTokens > 0
        ? segments.map((segment) => ({
            ...segment,
            percentage: (segment.value / promptTokens) * 100,
          }))
        : [],
    shareStatus: promptTokens > 0 ? 'complete' : 'zeroPrompt',
    shareDenominator: promptTokens,
    note: '',
    discontinuity: null,
  };
}

describe('cache overview bins', () => {
  it('uses summed token weights instead of averaging per-call percentages', () => {
    const bins = binCachePoints([point(1, 100, 100, 0), point(2, 900, 0, 900)], 1);
    expect(bins).toHaveLength(1);
    expect(bins[0]?.tokenTotals.find((segment) => segment.kind === 'cacheRead')?.percentage).toBe(
      10,
    );
    expect(bins[0]?.promptTokenTotal).toBe(1000);
    expect(bins[0]?.shareComplete).toBe(true);
  });

  it('discloses incomplete members rather than presenting a complete ratio', () => {
    const incomplete = {
      ...point(2, 100, 0, 100),
      shareStatus: 'unavailable' as const,
      shareSegments: [],
      shareDenominator: null,
    };
    const bins = binCachePoints([point(1, 100, 100, 0), incomplete], 1);
    expect(bins[0]?.coverageLabel).toBe('1 of 2 calls complete');
    expect(bins[0]?.shareComplete).toBe(false);
  });
});
