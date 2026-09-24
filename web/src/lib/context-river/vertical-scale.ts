import { ticks } from 'd3-array';
import type { CallColumn } from './types';

export interface VisibleStackSample {
  maxWeight: number;
  /** Number of call markers whose X positions are inside the visible plot window. */
  visibleCallCount: number;
  /** True when a viewport edge falls between call columns and is linearly interpolated. */
  usesInterpolatedEdge: boolean;
}

export function visibleStackSample(
  columns: readonly CallColumn[],
  leftX: number,
  rightX: number,
): VisibleStackSample {
  if (columns.length === 0 || !Number.isFinite(leftX) || !Number.isFinite(rightX)) {
    return { maxWeight: 0, visibleCallCount: 0, usesInterpolatedEdge: false };
  }
  // layoutCallColumns returns finite, X-sorted columns; preserve that order so viewport sampling
  // stays O(log n + visible columns) while horizontal scrolling.
  const ordered = columns;
  const left = Math.min(leftX, rightX);
  const right = Math.max(leftX, rightX);
  const firstVisible = lowerBound(ordered, left);
  const afterLastVisible = upperBound(ordered, right);
  const leftSample = sampleAtX(ordered, left);
  const rightSample = sampleAtX(ordered, right);
  let maxWeight = Math.max(0, leftSample.weight, rightSample.weight);
  for (let position = firstVisible; position < afterLastVisible; position += 1) {
    maxWeight = Math.max(maxWeight, ordered[position]!.totalDisplayWeight);
  }
  return {
    maxWeight,
    visibleCallCount: Math.max(0, afterLastVisible - firstVisible),
    usesInterpolatedEdge: leftSample.interpolated || rightSample.interpolated,
  };
}

export function verticalScaleTicks(maxWeight: number, targetCount = 4): number[] {
  if (!Number.isFinite(maxWeight) || maxWeight <= 0) return [0];
  const intermediate = ticks(0, maxWeight, Math.max(1, Math.floor(targetCount))).filter(
    (value) => value > 0 && value < maxWeight,
  );
  return [0, ...intermediate, maxWeight];
}

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const decimalNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integerNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function formatVerticalTick(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return compactNumber.format(value);
  if (Number.isInteger(value)) return integerNumber.format(value);
  return decimalNumber.format(value);
}

function lowerBound(columns: readonly CallColumn[], x: number): number {
  let low = 0;
  let high = columns.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (columns[middle]!.x < x) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(columns: readonly CallColumn[], x: number): number {
  let low = 0;
  let high = columns.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (columns[middle]!.x <= x) low = middle + 1;
    else high = middle;
  }
  return low;
}

function sampleAtX(
  columns: readonly CallColumn[],
  x: number,
): { weight: number; interpolated: boolean } {
  const first = columns[0]!;
  const last = columns[columns.length - 1]!;
  if (x <= first.x) return { weight: Math.max(0, first.totalDisplayWeight), interpolated: false };
  if (x >= last.x) return { weight: Math.max(0, last.totalDisplayWeight), interpolated: false };

  const rightPosition = lowerBound(columns, x);
  const right = columns[rightPosition]!;
  if (Math.abs(right.x - x) < 1e-8) {
    return { weight: Math.max(0, right.totalDisplayWeight), interpolated: false };
  }
  const left = columns[rightPosition - 1]!;
  const span = right.x - left.x;
  if (span <= 0) return { weight: Math.max(0, right.totalDisplayWeight), interpolated: false };
  const fraction = Math.min(1, Math.max(0, (x - left.x) / span));
  return {
    weight: Math.max(
      0,
      left.totalDisplayWeight + (right.totalDisplayWeight - left.totalDisplayWeight) * fraction,
    ),
    interpolated: true,
  };
}
