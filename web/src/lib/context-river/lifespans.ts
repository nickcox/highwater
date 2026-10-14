import type { ContextItem, PresenceRange } from '../types';

/** Resolve the full-session ordinal axis, clamped to real calls in this segment. */
export function nearestLifespanCall(
  callIndices: readonly number[],
  range: PresenceRange,
  fraction: number,
): number | null {
  if (callIndices.length === 0 || !Number.isFinite(fraction)) return null;
  const lowerBound = (value: number) => {
    let low = 0;
    let high = callIndices.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (callIndices[middle] < value) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const first = lowerBound(range.startCall);
  const end = lowerBound(range.endCall);
  const last = end < callIndices.length && callIndices[end] === range.endCall ? end : end - 1;
  if (first > last || first >= callIndices.length) return null;
  const position = Math.round(Math.max(0, Math.min(1, fraction)) * (callIndices.length - 1));
  return callIndices[Math.max(first, Math.min(last, position))];
}

export type LifespanSortMode = 'tokenTurns' | 'size' | 'firstAppearance' | 'presenceCount';

export function presenceCount(item: ContextItem): number {
  return item.presenceCallCount;
}

export function tokenTurnExposure(item: ContextItem): number | null {
  return item.tokenTurns;
}

/** Select one numeric token profile so size comparisons never mix tokenizers. */
export function sizeComparisonProfileId(items: readonly ContextItem[]): string | null {
  const coverage = new Map<string, number>();
  for (const item of items) {
    for (const estimate of item.tokenEstimates) {
      if (estimate.tokens !== null && Number.isFinite(estimate.tokens)) {
        coverage.set(estimate.profileId, (coverage.get(estimate.profileId) ?? 0) + 1);
      }
    }
  }
  let selected: string | null = null;
  let selectedCoverage = 0;
  for (const [profileId, count] of coverage) {
    if (
      count > selectedCoverage ||
      (count === selectedCoverage && selected !== null && compareText(profileId, selected) < 0)
    ) {
      selected = profileId;
      selectedCoverage = count;
    }
  }
  return selected;
}

export function sizeEstimateTokens(item: ContextItem, profileId: string | null): number | null {
  if (profileId === null) return null;
  return item.tokenEstimates.find((estimate) => estimate.profileId === profileId)?.tokens ?? null;
}

/** Token-turn exposure across every version shown on one row; null when none is known. */
export function rowTokenTurns(versions: readonly ContextItem[]): number | null {
  const known = versions
    .map(tokenTurnExposure)
    .filter((tokenTurns): tokenTurns is number => tokenTurns !== null);
  return known.length === 0 ? null : known.reduce((total, tokenTurns) => total + tokenTurns, 0);
}

export function rowPresenceCount(versions: readonly ContextItem[]): number {
  return versions.reduce((total, version) => total + presenceCount(version), 0);
}

/**
 * Sorts rows by their first item. A row also shows that item's later versions, given by
 * `versionsOf`: its exposure and calls present are summed over them, and its size is the
 * latest version's.
 */
export function sortLifespans(
  items: readonly ContextItem[],
  mode: LifespanSortMode = 'tokenTurns',
  sizeProfileId: string | null = null,
  versionsOf: (item: ContextItem) => readonly ContextItem[] = (item) => [item],
): ContextItem[] {
  const sourceOrder = new Map(items.map((item, index) => [item.id, index]));
  const latest = (item: ContextItem) => {
    const versions = versionsOf(item);
    return versions[versions.length - 1] ?? item;
  };
  return [...items].sort((a, b) => {
    let comparison = 0;
    if (mode === 'firstAppearance') {
      comparison = compareNullableAscending(firstAppearance(a), firstAppearance(b));
    } else if (mode === 'presenceCount') {
      comparison = rowPresenceCount(versionsOf(b)) - rowPresenceCount(versionsOf(a));
    } else if (mode === 'size') {
      comparison = compareNullableDescending(
        sizeEstimateTokens(latest(a), sizeProfileId),
        sizeEstimateTokens(latest(b), sizeProfileId),
      );
    } else {
      comparison = compareNullableDescending(
        rowTokenTurns(versionsOf(a)),
        rowTokenTurns(versionsOf(b)),
      );
    }
    return (
      comparison ||
      (sourceOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (sourceOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      compareText(a.id, b.id)
    );
  });
}

export function callAxisTicks(callIndices: readonly number[], maximumTicks = 8): number[] {
  if (callIndices.length <= maximumTicks) return [...callIndices];
  const tickCount = Math.max(2, Math.floor(maximumTicks));
  const positions = new Set<number>();
  for (let index = 0; index < tickCount; index += 1) {
    positions.add(Math.round((index * (callIndices.length - 1)) / (tickCount - 1)));
  }
  return [...positions].map((position) => callIndices[position]);
}

function firstAppearance(item: ContextItem): number | null {
  return item.firstModelCall > 0 ? item.firstModelCall : null;
}

function compareNullableDescending(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableAscending(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
