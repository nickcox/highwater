import type { ViewportAnchor, ViewportCallPosition } from './viewport';

export type RequestedRange = { startCallIndex: number; endCallIndex: number };
export type ViewportAdjustment = 'fit' | { kind: 'anchor'; anchor: ViewportAnchor };
export interface CallRangeAnchor {
  intervalCount: number;
  anchor: ViewportAnchor;
}

export function anchorForCall(
  columns: readonly ViewportCallPosition[],
  callIndex: number,
  offsetFromViewportLeft: number,
): ViewportAnchor | null {
  const call = columns.find((column) => column.callIndex === callIndex);
  return call
    ? { callIndex, sourceRecordId: call.sourceRecordId ?? null, offsetFromViewportLeft }
    : null;
}

/** A fractional midpoint, not a rounded call index, keeps both range endpoints visible. */
export function anchorForCallRange(
  columns: readonly ViewportCallPosition[],
  startCallIndex: number,
  endCallIndex: number,
  offsetFromViewportLeft: number,
): CallRangeAnchor | null {
  const start = columns.findIndex((column) => column.callIndex === startCallIndex);
  const end = columns.findIndex((column) => column.callIndex === endCallIndex);
  if (start < 0 || end < 0) return null;
  if (start === end) {
    const anchor = anchorForCall(columns, startCallIndex, offsetFromViewportLeft);
    return anchor ? { intervalCount: 0, anchor } : null;
  }
  const first = columns[Math.min(start, end)];
  const last = columns[Math.max(start, end)];
  return {
    intervalCount: Math.abs(end - start),
    anchor: {
      callIndex: first.callIndex,
      sourceRecordId: first.sourceRecordId ?? null,
      nextCallIndex: last.callIndex,
      nextSourceRecordId: last.sourceRecordId ?? null,
      fractionToNext: 0.5,
      offsetFromViewportLeft,
    },
  };
}

/** DOM coordinates are converted/clamped by the caller before reaching this decision. */
export function anchorAtPlotX(
  columns: readonly ViewportCallPosition[],
  x: number,
  offsetFromViewportLeft: number,
): ViewportAnchor | null {
  if (columns.length === 0) return null;
  const rightPosition = columns.findIndex((column) => column.x >= x);
  const left =
    rightPosition < 0
      ? columns[columns.length - 1]
      : rightPosition === 0
        ? columns[0]
        : columns[rightPosition - 1];
  const right = rightPosition > 0 ? columns[rightPosition] : undefined;
  return {
    callIndex: left.callIndex,
    sourceRecordId: left.sourceRecordId ?? null,
    ...(right
      ? {
          nextCallIndex: right.callIndex,
          nextSourceRecordId: right.sourceRecordId ?? null,
          fractionToNext: Math.min(1, Math.max(0, (x - left.x) / (right.x - left.x))),
        }
      : {}),
    offsetFromViewportLeft,
  };
}

export function requestedRangeSpacing(
  intervalCount: number,
  fitInnerWidth: number,
  callCount: number,
): number {
  return intervalCount === 0
    ? fitInnerWidth / (Math.min(15, callCount) - 1)
    : fitInnerWidth / intervalCount;
}

/** Explicit spacing remains distinct from Fit all, including unchanged-scale anchor movement. */
export function resolveSpacing(
  current: number | null,
  next: number | null,
  fit: number,
  maximum: number,
  anchor: ViewportAnchor | null,
): {
  spacing: number | null;
  adjustment: ViewportAdjustment | null;
  immediateAnchor: ViewportAnchor | null;
} {
  const spacing =
    next === null || fit <= 0 || next <= fit * 1.005
      ? null
      : Math.min(maximum, Math.max(fit, next));
  return {
    spacing,
    adjustment:
      spacing === null ? 'fit' : anchor && current !== spacing ? { kind: 'anchor', anchor } : null,
    immediateAnchor: spacing !== null && current === spacing ? anchor : null,
  };
}
