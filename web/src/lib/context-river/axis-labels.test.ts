import { describe, expect, it } from 'vitest';
import { nonOverlappingCallLabelPositions } from './axis-labels';

describe('nonOverlappingCallLabelPositions', () => {
  it('keeps the pinned turn label and removes nearby regular labels', () => {
    const columns = Array.from({ length: 12 }, (_, position) => ({
      callIndex: position + 1,
      x: 42 + position * 10,
    }));
    const visible = nonOverlappingCallLabelPositions(columns, 52, 7);

    expect(visible.has(6)).toBe(true);
    expect(visible.has(5)).toBe(false);
    expect(visible.has(11)).toBe(true);
    const labels = [...visible]
      .map((position) => columns[position])
      .filter((column) => column !== undefined)
      .sort((first, second) => first.x - second.x);
    for (let position = 1; position < labels.length; position += 1) {
      expect(labels[position]!.x - labels[position - 1]!.x).toBeGreaterThanOrEqual(15);
    }
  });

  it('allows dense labels only when their measured-width estimate fits', () => {
    const columns = [
      { callIndex: 100, x: 0 },
      { callIndex: 101, x: 25 },
      { callIndex: 102, x: 50 },
      { callIndex: 103, x: 75 },
    ];
    const visible = nonOverlappingCallLabelPositions(columns, 52, null);
    const positions = [...visible].sort((a, b) => a - b);
    expect(positions).toEqual([0, 3]);
  });

  it('handles empty and invalid-stride input', () => {
    expect(nonOverlappingCallLabelPositions([], 0, null)).toEqual(new Set());
    expect(nonOverlappingCallLabelPositions([{ callIndex: 1, x: 0 }], Number.NaN, null)).toEqual(
      new Set([0]),
    );
  });
});
