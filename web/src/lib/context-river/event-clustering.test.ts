import { describe, expect, it } from 'vitest';
import { clusterEconomicsEvents, eventCallRanges, eventCompositionLabel } from './event-clustering';

const event = (
  id: string,
  x: number,
  callIndex: number,
  kind: 'compaction' | 'targetChange' | 'ratioChange',
) => ({
  id,
  x,
  callIndex,
  kind,
});

describe('economics event clustering', () => {
  it('conserves event membership and exposes type composition', () => {
    const events = [
      event('a', 48, 2, 'ratioChange'),
      event('b', 51, 3, 'compaction'),
      event('c', 53, 4, 'targetChange'),
      event('d', 160, 8, 'compaction'),
    ];
    const clusters = clusterEconomicsEvents(events, { chartWidth: 220, left: 42, right: 24 });
    expect(clusters.flatMap((cluster) => cluster.events).map(({ id }) => id)).toEqual(
      events.map(({ id }) => id),
    );
    expect(clusters[0]?.compositionLabel).toContain('3 economics events');
    expect(clusters[0]?.compositionLabel).toContain('1 compaction');
    expect(clusters[0]?.badgeLabel).toBe('3 · C1 M1 Δ1');
    expect(clusters[0]?.callRanges).toBe('2-4');
  });

  it('clamps narrow and edge clusters without overlapping final hit bounds', () => {
    const clusters = clusterEconomicsEvents(
      [event('left', 0, 1, 'compaction'), event('right', 100, 2, 'ratioChange')],
      { chartWidth: 70, left: 42, right: 24 },
    );
    expect(clusters.every((cluster) => cluster.left >= 42 - 0.001)).toBe(true);
    expect(clusters.every((cluster) => cluster.right <= 70 - 24 + 0.001)).toBe(true);
    for (let index = 1; index < clusters.length; index += 1) {
      expect(clusters[index]!.left).toBeGreaterThanOrEqual(clusters[index - 1]!.right + 6);
    }
  });

  it('formats distinct call ranges separately', () => {
    const events = [
      event('a', 1, 1, 'compaction'),
      event('b', 2, 3, 'ratioChange'),
      event('c', 3, 4, 'targetChange'),
    ];
    expect(eventCallRanges(events)).toBe('1, 3-4');
    expect(eventCompositionLabel(events)).toContain('1 model/provider change');
  });
});
