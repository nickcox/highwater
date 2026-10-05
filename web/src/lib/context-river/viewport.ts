export interface ViewportCallPosition {
  callIndex: number;
  x: number;
  sourceRecordId?: string | null;
}

export interface VisibleCallRange {
  firstVisibleCallIndex: number | null;
  lastVisibleCallIndex: number | null;
}

export interface RiverViewportStatus extends VisibleCallRange {
  ready: boolean;
  /** True only when the complete session is fitted into the viewport. */
  isFitAll: boolean;
  /** Horizontal scale relative to Fit all. */
  zoomFactor: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  totalCallCount: number;
  hasOverflow: boolean;
  /** Nearest real call to the measured viewport centre. */
  centerCallIndex?: number | null;
}

export type RiverNavigationCommand =
  | { id: number; kind: 'latest' }
  | { id: number; kind: 'fit' }
  | { id: number; kind: 'zoom-in' }
  | { id: number; kind: 'zoom-out' }
  | { id: number; kind: 'call'; callIndex: number }
  | { id: number; kind: 'ensure-call'; callIndex: number }
  | { id: number; kind: 'range'; startCallIndex: number; endCallIndex: number }
  | {
      id: number;
      kind: 'reveal-item';
      itemId: string;
      referenceCallIndex: number | null;
    };

export function stepCallTarget(
  calls: readonly number[],
  pinned: number | null,
  viewport: RiverViewportStatus,
  direction: -1 | 1,
): number | null {
  if (!viewport.ready || calls.length === 0) return null;
  if (pinned === null && viewport.isFitAll) return direction === 1 ? calls[0] : null;
  const reference = pinned ?? viewport.centerCallIndex;
  const position = reference === null || reference === undefined ? -1 : calls.indexOf(reference);
  if (position < 0) return null;
  return calls[position + direction] ?? null;
}

/** Scroll only enough to place the target within a 15% inset; never change spacing. */
export function comfortableCallScroll(
  x: number,
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): number {
  const inset = clientWidth * 0.15;
  const offset = x - scrollLeft;
  const target =
    offset < inset
      ? x - inset
      : offset > clientWidth - inset
        ? x - clientWidth + inset
        : scrollLeft;
  return clampScrollLeft(target, scrollWidth, clientWidth);
}

export interface ViewportAnchor {
  callIndex: number;
  sourceRecordId: string | null;
  /** Optional fractional position between this call and the next, for pointer-anchored zoom. */
  nextCallIndex?: number;
  nextSourceRecordId?: string | null;
  fractionToNext?: number;
  /** Call-column distance from the viewport's left edge, in CSS pixels. */
  offsetFromViewportLeft: number;
}

export function clampScrollLeft(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): number {
  const safeScrollWidth = Number.isFinite(scrollWidth) ? Math.max(0, scrollWidth) : 0;
  const safeClientWidth = Number.isFinite(clientWidth) ? Math.max(0, clientWidth) : 0;
  const safeScrollLeft = Number.isFinite(scrollLeft) ? scrollLeft : 0;
  return Math.min(Math.max(0, safeScrollLeft), Math.max(0, safeScrollWidth - safeClientWidth));
}

export function visibleCallRange(
  columns: readonly ViewportCallPosition[],
  scrollLeft: number,
  clientWidth: number,
  contentOffsetX = 0,
): VisibleCallRange {
  if (columns.length === 0 || !Number.isFinite(clientWidth) || clientWidth <= 0) {
    return { firstVisibleCallIndex: null, lastVisibleCallIndex: null };
  }
  const left = scrollLeft - contentOffsetX;
  const right = left + clientWidth;
  const visible = columns
    .filter((column) => Number.isFinite(column.x) && column.x >= left && column.x <= right)
    .sort((a, b) => a.x - b.x);
  return {
    firstVisibleCallIndex: visible[0]?.callIndex ?? null,
    lastVisibleCallIndex: visible[visible.length - 1]?.callIndex ?? null,
  };
}

export function latestScrollTarget(scrollWidth: number, clientWidth: number): number {
  return clampScrollLeft(scrollWidth, scrollWidth, clientWidth);
}

export function captureViewportAnchor(
  columns: readonly ViewportCallPosition[],
  scrollLeft: number,
  clientWidth: number,
  contentOffsetX = 0,
): ViewportAnchor | null {
  if (columns.length === 0) return null;
  const left = scrollLeft - contentOffsetX;
  const ordered = columns.filter((column) => Number.isFinite(column.x)).sort((a, b) => a.x - b.x);
  if (ordered.length === 0) return null;
  const column = ordered.find((candidate) => candidate.x >= left) ?? ordered[ordered.length - 1];
  if (!column) return null;
  return {
    callIndex: column.callIndex,
    sourceRecordId: column.sourceRecordId ?? null,
    offsetFromViewportLeft: contentOffsetX + column.x - scrollLeft,
  };
}

export function scrollTargetForAnchor(
  anchor: ViewportAnchor,
  columns: readonly ViewportCallPosition[],
  clientWidth: number,
  scrollWidth: number,
  contentOffsetX = 0,
): number | null {
  const column =
    (anchor.sourceRecordId
      ? columns.find((candidate) => candidate.sourceRecordId === anchor.sourceRecordId)
      : undefined) ?? columns.find((candidate) => candidate.callIndex === anchor.callIndex);
  if (!column || !Number.isFinite(clientWidth)) return null;
  const nextColumn = anchor.nextSourceRecordId
    ? columns.find((candidate) => candidate.sourceRecordId === anchor.nextSourceRecordId)
    : anchor.nextCallIndex === undefined
      ? undefined
      : columns.find((candidate) => candidate.callIndex === anchor.nextCallIndex);
  const fraction = Number.isFinite(anchor.fractionToNext)
    ? Math.min(1, Math.max(0, anchor.fractionToNext as number))
    : 0;
  const anchorX =
    nextColumn && Number.isFinite(nextColumn.x)
      ? column.x + (nextColumn.x - column.x) * fraction
      : column.x;
  return clampScrollLeft(
    contentOffsetX + anchorX - anchor.offsetFromViewportLeft,
    scrollWidth,
    clientWidth,
  );
}

export function resolveJumpCallIndex(input: string, callIndices: readonly number[]): number | null {
  if (callIndices.length === 0 || input.trim() === '') return null;
  const value = Number(input);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  const ordered = [...callIndices].filter(Number.isFinite).sort((a, b) => a - b);
  if (ordered.length === 0) return null;
  const clamped = Math.min(Math.max(value, ordered[0]), ordered[ordered.length - 1]);
  return ordered.reduce((nearest, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(nearest - clamped) ? candidate : nearest,
  );
}
