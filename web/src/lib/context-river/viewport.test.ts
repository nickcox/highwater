import { describe, expect, it } from 'vitest';
import {
  captureViewportAnchor,
  comfortableCallScroll,
  stepCallTarget,
  clampScrollLeft,
  latestScrollTarget,
  resolveJumpCallIndex,
  scrollTargetForAnchor,
  visibleCallRange,
} from './viewport';

const columns = [
  { callIndex: 1, x: 42, sourceRecordId: 'a' },
  { callIndex: 2, x: 100, sourceRecordId: 'b' },
  { callIndex: 3, x: 200, sourceRecordId: 'c' },
  { callIndex: 4, x: 420, sourceRecordId: 'd' },
];

describe('Context River viewport math', () => {
  it('steps actual calls from the pin or centre, but starts at the first call in the overview', () => {
    const viewport = {
      ready: true,
      isFitAll: false,
      zoomFactor: 2,
      canZoomIn: true,
      canZoomOut: true,
      totalCallCount: 3,
      hasOverflow: true,
      firstVisibleCallIndex: 4,
      lastVisibleCallIndex: 8,
      centerCallIndex: 4,
    };
    const calls = [1, 4, 8];
    expect(stepCallTarget(calls, null, viewport, 1)).toBe(8);
    expect(stepCallTarget(calls, null, viewport, -1)).toBe(1);
    expect(stepCallTarget(calls, 1, viewport, -1)).toBeNull();
    expect(stepCallTarget(calls, 8, viewport, 1)).toBeNull();
    expect(stepCallTarget(calls, null, { ...viewport, isFitAll: true }, 1)).toBe(1);
    expect(stepCallTarget(calls, null, { ...viewport, isFitAll: true }, -1)).toBeNull();
    expect(stepCallTarget(calls, 4, { ...viewport, isFitAll: true }, -1)).toBe(1);
    expect(stepCallTarget([], null, viewport, 1)).toBeNull();
    expect(stepCallTarget([7], null, { ...viewport, isFitAll: true }, 1)).toBe(7);
    expect(stepCallTarget([7], 7, viewport, 1)).toBeNull();
    expect(stepCallTarget(calls, null, { ...viewport, ready: false }, 1)).toBeNull();
  });
  it('nudges only near/outside edges, with a 15% inset and scroll-bound clamping', () => {
    expect(comfortableCallScroll(150, 100, 200, 1000)).toBe(100);
    expect(comfortableCallScroll(120, 100, 200, 1000)).toBe(90);
    expect(comfortableCallScroll(285, 100, 200, 1000)).toBe(115);
    expect(comfortableCallScroll(500, 100, 200, 1000)).toBe(330);
    expect(comfortableCallScroll(0, 0, 200, 1000)).toBe(0);
    expect(comfortableCallScroll(1000, 800, 200, 1000)).toBe(800);
    expect(comfortableCallScroll(100, 0, 200, 200)).toBe(0);
  });
  it('clamps non-finite and out-of-range scroll offsets', () => {
    expect(clampScrollLeft(-20, 500, 100)).toBe(0);
    expect(clampScrollLeft(900, 500, 100)).toBe(400);
    expect(clampScrollLeft(Number.NaN, 500, 100)).toBe(0);
    expect(clampScrollLeft(20, Number.POSITIVE_INFINITY, 100)).toBe(0);
  });

  it('maps actual nonuniform call positions to the visible range', () => {
    expect(visibleCallRange(columns, 80, 125)).toEqual({
      firstVisibleCallIndex: 2,
      lastVisibleCallIndex: 3,
    });
    expect(visibleCallRange(columns, 310, 120)).toEqual({
      firstVisibleCallIndex: 4,
      lastVisibleCallIndex: 4,
    });
  });

  it('accounts for chart offset and includes calls on viewport boundaries', () => {
    expect(visibleCallRange(columns, 50, 100, 8)).toEqual({
      firstVisibleCallIndex: 1,
      lastVisibleCallIndex: 2,
    });
    expect(visibleCallRange(columns, 1000, 100)).toEqual({
      firstVisibleCallIndex: null,
      lastVisibleCallIndex: null,
    });
  });

  it('handles empty and single-call domains', () => {
    expect(visibleCallRange([], 0, 500)).toEqual({
      firstVisibleCallIndex: null,
      lastVisibleCallIndex: null,
    });
    expect(visibleCallRange([{ callIndex: 9, x: 72 }], 0, 100)).toEqual({
      firstVisibleCallIndex: 9,
      lastVisibleCallIndex: 9,
    });
    expect(
      scrollTargetForAnchor(
        { callIndex: 9, sourceRecordId: null, offsetFromViewportLeft: 150 },
        [{ callIndex: 9, x: 72 }],
        300,
        300,
      ),
    ).toBe(0);
    expect(latestScrollTarget(300, 400)).toBe(0);
  });

  it('centers an anchored call when possible and clamps near chart edges', () => {
    const centerCall = (callIndex: number) => {
      const column = columns.find((candidate) => candidate.callIndex === callIndex);
      return column
        ? {
            callIndex,
            sourceRecordId: column.sourceRecordId ?? null,
            offsetFromViewportLeft: 50,
          }
        : null;
    };
    expect(scrollTargetForAnchor(centerCall(3)!, columns, 100, 500)).toBe(150);
    expect(scrollTargetForAnchor(centerCall(1)!, columns, 100, 500)).toBe(0);
    expect(scrollTargetForAnchor(centerCall(4)!, columns, 100, 500)).toBe(370);
    expect(
      scrollTargetForAnchor(
        { callIndex: 99, sourceRecordId: null, offsetFromViewportLeft: 50 },
        columns,
        100,
        500,
      ),
    ).toBeNull();
    expect(latestScrollTarget(500, 100)).toBe(400);
  });

  it('preserves the visible call anchor across reflow and call-index changes', () => {
    const anchor = captureViewportAnchor(columns, 82, 120);
    expect(anchor).toEqual({ callIndex: 2, sourceRecordId: 'b', offsetFromViewportLeft: 18 });
    const replacement = [
      { callIndex: 1, x: 50, sourceRecordId: 'new' },
      { callIndex: 7, x: 250, sourceRecordId: 'b' },
      { callIndex: 8, x: 450, sourceRecordId: 'c' },
    ];
    expect(scrollTargetForAnchor(anchor!, replacement, 120, 600)).toBe(232);
  });

  it('preserves a fractional pointer anchor between calls through reflow', () => {
    const anchor = {
      callIndex: 1,
      sourceRecordId: 'a',
      nextCallIndex: 2,
      nextSourceRecordId: 'b',
      fractionToNext: 0.5,
      offsetFromViewportLeft: 25,
    };
    const replacement = [
      { callIndex: 1, x: 50, sourceRecordId: 'a' },
      { callIndex: 2, x: 250, sourceRecordId: 'b' },
    ];
    expect(scrollTargetForAnchor(anchor, replacement, 100, 500)).toBe(125);
  });

  it('resolves jump input by validating integers and clamping to real calls', () => {
    expect(resolveJumpCallIndex('3', [1, 2, 3, 4])).toBe(3);
    expect(resolveJumpCallIndex('0', [1, 2, 3, 4])).toBe(1);
    expect(resolveJumpCallIndex('99', [1, 2, 3, 4])).toBe(4);
    expect(resolveJumpCallIndex('5', [1, 4, 8])).toBe(4);
    expect(resolveJumpCallIndex('2.5', [1, 2, 3])).toBeNull();
    expect(resolveJumpCallIndex('', [1])).toBeNull();
    expect(resolveJumpCallIndex('1', [])).toBeNull();
  });
});
