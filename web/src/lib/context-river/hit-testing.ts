import type { CallColumn } from './types';

export function nearestCallIndex(pointerX: number, columns: readonly CallColumn[]): number | null {
  if (columns.length === 0) return null;
  let low = 0;
  let high = columns.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (columns[middle].x < pointerX) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return columns[0].callIndex;
  if (low === columns.length) return columns[columns.length - 1]?.callIndex ?? null;
  const before = columns[low - 1];
  const after = columns[low];
  // A midpoint belongs to the earlier call, making ties deterministic.
  return pointerX - before.x <= after.x - pointerX ? before.callIndex : after.callIndex;
}

export function clientXToViewBox(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  viewBoxWidth: number,
): number {
  if (rectWidth <= 0) return 0;
  return ((clientX - rectLeft) / rectWidth) * viewBoxWidth;
}
