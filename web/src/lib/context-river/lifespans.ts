import type { ContextItem } from '../types';

export type LifespanSortMode = 'tokenTurns' | 'size' | 'firstAppearance';

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

export function sortLifespans(
  items: readonly ContextItem[],
  mode: LifespanSortMode = 'tokenTurns',
  sizeProfileId: string | null = null,
): ContextItem[] {
  const sourceOrder = new Map(items.map((item, index) => [item.id, index]));
  return [...items].sort((a, b) => {
    let comparison = 0;
    if (mode === 'firstAppearance') {
      comparison = compareNullableAscending(firstAppearance(a), firstAppearance(b));
    } else if (mode === 'size') {
      comparison = compareNullableDescending(
        sizeEstimateTokens(a, sizeProfileId),
        sizeEstimateTokens(b, sizeProfileId),
      );
    } else {
      comparison = compareNullableDescending(tokenTurnExposure(a), tokenTurnExposure(b));
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
