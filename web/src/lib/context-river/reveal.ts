import type { PresenceRange } from '../types';
import type { RibbonSegment } from './types';

export interface CallHorizontalPosition {
  callIndex: number;
  x: number;
}

export interface HorizontalExtent {
  left: number;
  right: number;
}

/** Use actual rendered ribbon bounds so interpolated and single-call spans count as visible. */
export function hasVisibleItemPresence(
  itemId: string,
  ribbons: readonly RibbonSegment[],
  clip: HorizontalExtent,
): boolean {
  if (!Number.isFinite(clip.left) || !Number.isFinite(clip.right) || clip.right < clip.left) {
    return false;
  }
  return ribbons.some((ribbon) => {
    if (ribbon.itemId !== itemId || ribbon.points.length === 0) return false;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const point of ribbon.points) {
      if (!Number.isFinite(point.x)) continue;
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
    }
    return right >= clip.left && left <= clip.right;
  });
}

export function itemPresentAtCall(presence: readonly PresenceRange[], callIndex: number): boolean {
  return presence.some((range) => range.startCall <= callIndex && callIndex <= range.endCall);
}

/** Prefer the pinned call when present; otherwise choose the nearest actual present call. */
export function nearestPresentCall(
  presence: readonly PresenceRange[],
  positions: readonly CallHorizontalPosition[],
  referenceX: number,
  preferredCallIndex: number | null = null,
): number | null {
  if (preferredCallIndex !== null && itemPresentAtCall(presence, preferredCallIndex)) {
    return positions.some((position) => position.callIndex === preferredCallIndex)
      ? preferredCallIndex
      : null;
  }
  if (presence.length === 0 || positions.length === 0) return null;

  const anchorX = Number.isFinite(referenceX)
    ? referenceX
    : preferredCallIndex === null
      ? Number.NaN
      : (positions.find((position) => position.callIndex === preferredCallIndex)?.x ?? Number.NaN);
  if (!Number.isFinite(anchorX)) return null;

  let nearest: { callIndex: number; x: number; distance: number } | null = null;
  for (const position of positions) {
    if (!itemPresentAtCall(presence, position.callIndex) || !Number.isFinite(position.x)) continue;
    const distance = Math.abs(position.x - anchorX);
    if (nearest === null || distance < nearest.distance) {
      nearest = { ...position, distance };
    }
  }
  return nearest ? nearest.callIndex : null;
}
