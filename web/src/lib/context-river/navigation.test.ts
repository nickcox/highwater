import { describe, expect, it } from 'vitest';
import {
  anchorForCallRange,
  anchorAtPlotX,
  requestedRangeSpacing,
  resolveSpacing,
} from './navigation';

const columns = [1, 2, 3, 4].map((callIndex) => ({
  callIndex,
  x: callIndex * 100,
  sourceRecordId: `source-${callIndex}`,
}));
describe('River navigation decisions', () => {
  it('preserves fractional midpoint and identity for reversed and single-call ranges', () => {
    const range = anchorForCallRange(columns, 3, 2, 150)!;
    expect(range.intervalCount).toBe(1);
    expect(range.anchor).toEqual({
      callIndex: 2,
      sourceRecordId: 'source-2',
      nextCallIndex: 3,
      nextSourceRecordId: 'source-3',
      fractionToNext: 0.5,
      offsetFromViewportLeft: 150,
    });
    expect(anchorForCallRange(columns, 2, 2, 150)?.intervalCount).toBe(0);
    expect(anchorForCallRange(columns, 2, 99, 150)).toBeNull();
  });
  it('interpolates pointer anchors and handles edges/no calls', () => {
    expect(anchorAtPlotX(columns, 250, 50)?.fractionToNext).toBe(0.5);
    expect(anchorAtPlotX(columns, 500, 50)?.callIndex).toBe(4);
    expect(anchorAtPlotX([], 100, 50)).toBeNull();
  });
  it('distinguishes fit, deferred anchors, unchanged-spacing movement and zoom caps', () => {
    const anchor = anchorAtPlotX(columns, 250, 50)!;
    expect(resolveSpacing(100, 30, 50, 400, anchor)).toEqual({
      spacing: null,
      adjustment: 'fit',
      immediateAnchor: null,
    });
    expect(resolveSpacing(100, 500, 50, 400, anchor)).toEqual({
      spacing: 400,
      adjustment: { kind: 'anchor', anchor },
      immediateAnchor: null,
    });
    expect(resolveSpacing(100, 100, 50, 400, anchor)).toEqual({
      spacing: 100,
      adjustment: null,
      immediateAnchor: anchor,
    });
    expect(resolveSpacing(null, null, 0, 0, null).spacing).toBeNull();
  });
  it('refits requested ranges after resize without rounding interval counts', () => {
    expect(requestedRangeSpacing(1, 800, 160)).toBe(800);
    expect(requestedRangeSpacing(2, 300, 160)).toBe(150);
    expect(requestedRangeSpacing(0, 280, 160)).toBe(20);
  });
});
