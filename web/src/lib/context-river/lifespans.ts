import type { ContextItem } from '../types';

export function presenceCount(item: ContextItem): number {
  return item.presenceCallCount;
}

export function displayWeightExposure(item: ContextItem): number {
  return item.displayWeight * presenceCount(item);
}

export function tokenTurnExposure(item: ContextItem): number | null {
  return item.tokenTurns;
}

export function sortLifespans(items: readonly ContextItem[]): ContextItem[] {
  return [...items].sort((a, b) => {
    const aComplete = a.tokenTurnsCoverage.unavailableItems === 0 && a.tokenTurnsCoverage.partialItems === 0;
    const bComplete = b.tokenTurnsCoverage.unavailableItems === 0 && b.tokenTurnsCoverage.partialItems === 0;
    return Number(bComplete) - Number(aComplete)
      || (b.tokenTurns ?? -1) - (a.tokenTurns ?? -1)
      || displayWeightExposure(b) - displayWeightExposure(a)
      || presenceCount(b) - presenceCount(a)
      || a.firstModelCall - b.firstModelCall
      || a.id.localeCompare(b.id);
  });
}
