import type { ContextItem, SessionAnalysis } from './types';
import { itemVersions } from './item-versions';

export interface ItemOrder {
  /** Item IDs from the bottom of the stack to the top. */
  orderedItemIds: string[];
  /** For an item that takes the place of an earlier one, that earlier item's ID. The two are
   * never in the same call, and the later item keeps the earlier one's place and colour. */
  takesPlaceOf: Map<string, string>;
}

export function stableItemOrder(
  analysis: Pick<SessionAnalysis, 'modelCalls' | 'contextItems' | 'compactions'>,
): ItemOrder {
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
  const takesPlaceOf = new Map<string, string>();
  const takePlace = (id: string, previousId: string | undefined) => {
    const previousRank = previousId === undefined ? undefined : ranks.get(previousId);
    if (previousRank === undefined) return;
    ranks.set(id, previousRank);
    takesPlaceOf.set(id, previousId!);
  };

  // A new version of a system prompt or tool definition takes the place of the one it replaced.
  const versions = [...itemVersions(analysis.contextItems)].sort(
    ([, left], [, right]) => left.number - right.number,
  );
  for (const [id, version] of versions) takePlace(id, version.previousId ?? undefined);

  // Unrecorded request context is measured again for each segment of the session. Each
  // measurement takes the place of the one before it.
  const unrecorded = analysis.contextItems
    .filter((item) => item.kind === 'unrecordedContext' && item.presence.length > 0)
    .sort((left, right) => left.firstModelCall - right.firstModelCall);
  for (const [index, item] of unrecorded.entries()) takePlace(item.id, unrecorded[index - 1]?.id);

  // After a compaction a harness can send the same attachments again (such as Claude Code's
  // environment and skill listing). Each one takes the place of the earliest attachment with the
  // same label that the compaction removed, so a label sent several times is matched in order.
  const itemById = new Map(analysis.contextItems.map((item) => [item.id, item]));
  const byRank = (left: ContextItem, right: ContextItem) =>
    (ranks.get(left.id) ?? 0) - (ranks.get(right.id) ?? 0) || left.id.localeCompare(right.id);
  for (const compaction of analysis.compactions) {
    const removed = attachmentsByLabel(
      compaction.sourceItemIds.flatMap((id) => itemById.get(id) ?? []),
      byRank,
    );
    const sent = attachmentsByLabel(
      analysis.contextItems.filter((item) => item.firstModelCall === compaction.beforeModelCall),
      byRank,
    );
    for (const [label, sentItems] of sent) {
      const removedItems = removed.get(label) ?? [];
      for (const [index, item] of sentItems.entries()) takePlace(item.id, removedItems[index]?.id);
    }
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

  const orderedItemIds = analysis.contextItems
    .map((item) => item.id)
    .sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0) || a.localeCompare(b));
  return { orderedItemIds, takesPlaceOf };
}

function attachmentsByLabel(
  items: readonly ContextItem[],
  compare: (left: ContextItem, right: ContextItem) => number,
): Map<string, ContextItem[]> {
  const byLabel = new Map<string, ContextItem[]>();
  for (const item of items) {
    if (item.kind !== 'customMessage') continue;
    const labelItems = byLabel.get(item.label);
    if (labelItems) labelItems.push(item);
    else byLabel.set(item.label, [item]);
  }
  for (const labelItems of byLabel.values()) labelItems.sort(compare);
  return byLabel;
}
