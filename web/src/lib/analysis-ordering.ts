import type { SessionAnalysis } from './types';
import { itemVersions } from './item-versions';

export function stableItemOrder(
  analysis: Pick<SessionAnalysis, 'modelCalls' | 'contextItems' | 'compactions'>,
): string[] {
  const firstAppearance = new Map<string, number>();
  let sequence = 0;
  for (const call of analysis.modelCalls) {
    for (const id of call.contextItemIds) {
      if (!firstAppearance.has(id)) firstAppearance.set(id, sequence++);
    }
  }

  const ranks = new Map<string, number>();
  for (const item of analysis.contextItems) {
    const base = firstAppearance.get(item.id) ?? Number.MAX_SAFE_INTEGER / 2;
    if (item.kind === 'system') ranks.set(item.id, -2_000_000 + base);
    else if (item.kind === 'toolDefinition') ranks.set(item.id, -1_000_000 + base);
    else ranks.set(item.id, base);
  }

  // A new version of a system prompt or tool definition takes the place of the one it replaced.
  const versions = [...itemVersions(analysis.contextItems)].sort(
    ([, left], [, right]) => left.number - right.number,
  );
  for (const [id, version] of versions) {
    const previousRank = version.previousId === null ? undefined : ranks.get(version.previousId);
    if (previousRank !== undefined) ranks.set(id, previousRank);
  }

  // Compactions are sorted, so a summary from an earlier event can itself anchor
  // a later summary. A median rank keeps replacement summaries near their sources.
  for (const compaction of analysis.compactions) {
    const sourceRanks = compaction.sourceItemIds
      .map((id) => ranks.get(id))
      .filter((rank): rank is number => rank !== undefined)
      .sort((a, b) => a - b);
    if (sourceRanks.length === 0) continue;
    const middle = Math.floor(sourceRanks.length / 2);
    const median =
      sourceRanks.length % 2 === 0
        ? (sourceRanks[middle - 1] + sourceRanks[middle]) / 2
        : sourceRanks[middle];
    ranks.set(compaction.summaryItemId, median + 0.0001);
  }

  return analysis.contextItems
    .map((item) => item.id)
    .sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0) || a.localeCompare(b));
}
