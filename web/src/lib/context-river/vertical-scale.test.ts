import { describe, expect, it } from 'vitest';
import type { CallColumn } from './types';
import { formatVerticalTick, verticalScaleTicks, visibleStackSample } from './vertical-scale';

const columns: CallColumn[] = [
  { callIndex: 1, x: 0, totalDisplayWeight: 10 },
  { callIndex: 2, x: 100, totalDisplayWeight: 30 },
  { callIndex: 3, x: 200, totalDisplayWeight: 10 },
];

describe('visible vertical scale sampling', () => {
  it('uses visible call columns and interpolated viewport boundaries', () => {
    expect(visibleStackSample(columns, 25, 175)).toEqual({
      maxWeight: 30,
      visibleCallCount: 1,
      usesInterpolatedEdge: true,
    });
    expect(visibleStackSample(columns, 0, 200)).toEqual({
      maxWeight: 30,
      visibleCallCount: 3,
      usesInterpolatedEdge: false,
    });
  });

  it('samples a viewport between call markers instead of falling back to a session maximum', () => {
    expect(visibleStackSample(columns, 25, 75)).toEqual({
      maxWeight: 25,
      visibleCallCount: 0,
      usesInterpolatedEdge: true,
    });
  });

  it('handles single columns, zero weights, empty input, and reversed boundaries', () => {
    expect(visibleStackSample([columns[1]!], 40, 60)).toEqual({
      maxWeight: 30,
      visibleCallCount: 0,
      usesInterpolatedEdge: false,
    });
    expect(visibleStackSample([{ callIndex: 1, x: 2, totalDisplayWeight: 0 }], 2, 2)).toEqual({
      maxWeight: 0,
      visibleCallCount: 1,
      usesInterpolatedEdge: false,
    });
    expect(visibleStackSample([], 0, 10)).toEqual({
      maxWeight: 0,
      visibleCallCount: 0,
      usesInterpolatedEdge: false,
    });
    expect(visibleStackSample(columns, 175, 25)).toEqual(visibleStackSample(columns, 25, 175));
  });

  it('builds readable ticks without inventing positive values for an empty stack', () => {
    expect(verticalScaleTicks(0)).toEqual([0]);
    expect(verticalScaleTicks(100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(verticalScaleTicks(95).slice(-1)[0]).toBe(95);
    expect(formatVerticalTick(0)).toBe('0');
    expect(formatVerticalTick(0.25)).toBe('0.3');
    expect(formatVerticalTick(12_000)).toMatch(/12/);
  });
});
