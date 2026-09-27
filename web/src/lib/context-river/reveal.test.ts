import { describe, expect, it } from 'vitest';
import { hasVisibleItemPresence, nearestPresentCall } from './reveal';
import type { RibbonSegment } from './types';

const segment = (itemId: string, callIndices: number[], xs: number[]): RibbonSegment => ({
  key: `${itemId}:${callIndices[0]}`,
  itemId,
  rangeIndex: 0,
  startCall: callIndices[0],
  endCall: callIndices[callIndices.length - 1],
  points: xs.map((x, index) => ({ callIndex: callIndices[index], x, y0: 10, y1: 20 })),
  path: '',
  hitPath: '',
  isSubpixel: false,
});

describe('selection reveal geometry', () => {
  it('recognizes an interpolated span when neither endpoint marker is visible', () => {
    expect(
      hasVisibleItemPresence('item', [segment('item', [1, 2], [0, 100])], {
        left: 45,
        right: 55,
      }),
    ).toBe(true);
  });

  it('uses disjoint presence ranges instead of first/last lifetime bounds', () => {
    const ribbons = [segment('item', [1], [0]), segment('item', [4], [100])];
    expect(hasVisibleItemPresence('item', ribbons, { left: 45, right: 55 })).toBe(false);
    expect(hasVisibleItemPresence('item', ribbons, { left: 95, right: 105 })).toBe(true);
  });

  it('prefers a pinned present call and otherwise chooses the nearest present call with earlier ties', () => {
    const presence = [
      { startCall: 1, endCall: 1 },
      { startCall: 4, endCall: 4 },
    ];
    const positions = [
      { callIndex: 1, x: 0 },
      { callIndex: 2, x: 25 },
      { callIndex: 3, x: 75 },
      { callIndex: 4, x: 100 },
    ];
    expect(nearestPresentCall(presence, positions, 50, 4)).toBe(4);
    expect(nearestPresentCall(presence, positions, 50)).toBe(1);
    expect(nearestPresentCall([], positions, 50)).toBeNull();
  });
});
