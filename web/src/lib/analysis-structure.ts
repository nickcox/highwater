import type {
  CompactionEvent,
  ContextItem,
  IndexedAnalysis,
  LineageEdge,
  SessionAnalysis,
} from './types';
import { stableItemOrder } from './analysis-ordering';
import { AnalysisValidationError, assertUnique } from './analysis-validation';

function addToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

/** Validation and returned indexes share the same lookup structures. */
export function validateAndIndexAnalysis(analysis: SessionAnalysis): IndexedAnalysis {
  assertUnique(
    analysis.contextItems.map((item) => item.id),
    'context item ID',
  );
  const callIndices = analysis.modelCalls.map((call) => call.index);
  if (new Set(callIndices).size !== callIndices.length) {
    throw new AnalysisValidationError('Duplicate model-call index');
  }

  const itemById = new Map(analysis.contextItems.map((item) => [item.id, item]));
  const callByIndex = new Map(analysis.modelCalls.map((call) => [call.index, call]));
  const contextSetByCall = new Map(
    analysis.modelCalls.map((call) => [call.index, new Set(call.contextItemIds)]),
  );
  const itemEstimateByProfile = new Map<
    string,
    Map<string, ContextItem['tokenEstimates'][number]>
  >();
  for (const item of analysis.contextItems) {
    itemEstimateByProfile.set(
      item.id,
      new Map(item.tokenEstimates.map((estimate) => [estimate.profileId, estimate])),
    );
  }
  const orderedItemIds = stableItemOrder(analysis);
  const rank = new Map(orderedItemIds.map((id, index) => [id, index]));
  const orderedItemIdsByCall = new Map(
    analysis.modelCalls.map((call) => [
      call.index,
      [...call.contextItemIds].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)),
    ]),
  );
  const firstCall = analysis.modelCalls[0]?.index ?? 0;
  const lastCall = analysis.modelCalls[analysis.modelCalls.length - 1]?.index ?? 0;
  const terminalBoundary = lastCall + 1;
  // A checkpoint may be replaced again before any recorded call uses it.
  // It remains a structural summary, not fabricated context exposure.
  const structuralSummaryIds = new Set(analysis.compactions.map((event) => event.summaryItemId));
  const terminalSummaryIds = new Set(
    analysis.compactions
      .filter((compaction) => compaction.beforeModelCall === terminalBoundary)
      .map((compaction) => compaction.summaryItemId),
  );
  const presenceCallsByItem = new Map<string, Set<number>>();

  for (const item of analysis.contextItems) {
    if (!Number.isFinite(item.displayWeight) || item.displayWeight < 0) {
      throw new AnalysisValidationError(`Item ${item.id} has an invalid display weight`);
    }
    if (
      item.ageAtFinalModelCall !== null &&
      (!Number.isSafeInteger(item.ageAtFinalModelCall) || item.ageAtFinalModelCall < 0)
    ) {
      throw new AnalysisValidationError(`Item ${item.id} has an invalid final age`);
    }
    if (item.preview !== null) {
      if (
        !['text', 'toolCall', 'toolResult', 'summary', 'image', 'unavailable'].includes(
          item.preview.kind,
        )
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has an unsupported preview kind`);
      }
      if (
        typeof item.preview.text !== 'string' ||
        typeof item.preview.truncated !== 'boolean' ||
        typeof item.preview.expandedText !== 'string' ||
        typeof item.preview.expandedTruncated !== 'boolean' ||
        [...item.preview.text].length > 160 ||
        [...item.preview.expandedText].length > 640
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has an invalid preview`);
      }
    }
    const estimateProfiles = item.tokenEstimates.map((estimate) => estimate.profileId);
    assertUnique(estimateProfiles, `token estimate profile for item ${item.id}`);
    for (const estimate of item.tokenEstimates) {
      if (
        estimate.tokens !== null &&
        (!Number.isSafeInteger(estimate.tokens) || estimate.tokens < 0)
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has an invalid token estimate`);
      }
      if (
        ![
          'modelTokenizer',
          'apiSerializationEstimate',
          'characterHeuristic',
          'unavailable',
        ].includes(estimate.method)
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has an unsupported tokenization method`);
      }
      if (!['complete', 'partial', 'unavailable'].includes(estimate.coverage)) {
        throw new AnalysisValidationError(`Item ${item.id} has an unsupported token coverage`);
      }
    }
    if (
      item.presenceCallCount !==
      item.presence.reduce((total, range) => total + range.endCall - range.startCall + 1, 0)
    ) {
      throw new AnalysisValidationError(`Item ${item.id} has an invalid presence call count`);
    }
    const isTerminalSummary = terminalSummaryIds.has(item.id);
    if (item.presence.length === 0) {
      if (
        !structuralSummaryIds.has(item.id) ||
        item.firstModelCall !== 0 ||
        item.lastModelCall !== 0
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has no presence ranges`);
      }
      presenceCallsByItem.set(item.id, new Set());
      continue;
    }
    if (isTerminalSummary) {
      throw new AnalysisValidationError(
        `Terminal compaction summary ${item.id} has presence ranges`,
      );
    }
    const presenceCalls = new Set<number>();
    let previousEnd = 0;
    for (const range of item.presence) {
      if (
        !Number.isInteger(range.startCall) ||
        !Number.isInteger(range.endCall) ||
        range.startCall > range.endCall ||
        range.startCall < firstCall ||
        range.endCall > lastCall
      ) {
        throw new AnalysisValidationError(`Item ${item.id} has an invalid presence range`);
      }
      if (range.startCall <= previousEnd) {
        throw new AnalysisValidationError(
          `Item ${item.id} has overlapping or unsorted presence ranges`,
        );
      }
      previousEnd = range.endCall;
      for (let callIndex = range.startCall; callIndex <= range.endCall; callIndex += 1) {
        presenceCalls.add(callIndex);
        if (!contextSetByCall.get(callIndex)?.has(item.id)) {
          throw new AnalysisValidationError(
            `Item ${item.id} presence disagrees with model call ${callIndex}`,
          );
        }
      }
    }
    if (item.firstModelCall !== item.presence[0].startCall || item.lastModelCall !== previousEnd) {
      throw new AnalysisValidationError(
        `Item ${item.id} lifetime does not match its presence ranges`,
      );
    }
    presenceCallsByItem.set(item.id, presenceCalls);
  }

  for (const [position, call] of analysis.modelCalls.entries()) {
    const currentSet = contextSetByCall.get(call.index) ?? new Set<string>();
    for (const id of call.contextItemIds) {
      if (!itemById.has(id))
        throw new AnalysisValidationError(`Call ${call.index} references unknown item ${id}`);
    }
    if (['calculatedTokens', 'estimatedTokens'].includes(analysis.displayWeightUnit)) {
      if (call.tokenizationProfileId === null) {
        throw new AnalysisValidationError(`Call ${call.index} has no tokenization profile`);
      }
      for (const id of call.contextItemIds) {
        const estimate = itemEstimateByProfile.get(id)?.get(call.tokenizationProfileId);
        if (!estimate || estimate.tokens === null) {
          throw new AnalysisValidationError(
            `Call ${call.index} is missing a token weight for ${id}`,
          );
        }
      }
    }
    for (const [field, ids] of [
      ['context', call.contextItemIds],
      ['added', call.addedItemIds],
      ['dropped', call.droppedItemIds],
    ] as const) {
      assertUnique(ids, `${field} item reference in call ${call.index}`);
      for (const id of ids) {
        if (!itemById.has(id)) {
          throw new AnalysisValidationError(`Call ${call.index} references unknown item ${id}`);
        }
      }
    }
    const previousSet =
      position === 0
        ? new Set<string>()
        : (contextSetByCall.get(analysis.modelCalls[position - 1].index) ?? new Set<string>());
    const expectedAdded = call.contextItemIds.filter((id) => !previousSet.has(id));
    const expectedDropped = [...previousSet].filter((id) => !currentSet.has(id));
    if (
      expectedAdded.join('\0') !== call.addedItemIds.join('\0') ||
      expectedDropped.join('\0') !== call.droppedItemIds.join('\0')
    ) {
      throw new AnalysisValidationError(`Call ${call.index} has invalid context deltas`);
    }
    const expectedRetained = call.contextItemIds.length - expectedAdded.length;
    if (
      call.transitionItemCounts.added !== expectedAdded.length ||
      call.transitionItemCounts.retained !== expectedRetained ||
      call.transitionItemCounts.dropped !== expectedDropped.length
    ) {
      throw new AnalysisValidationError(`Call ${call.index} has invalid transition counts`);
    }
    for (const id of call.contextItemIds) {
      if (!presenceCallsByItem.get(id)?.has(call.index)) {
        throw new AnalysisValidationError(
          `Model call ${call.index} references item ${id} outside its presence ranges`,
        );
      }
    }
  }

  const compactionById = new Map<string, CompactionEvent>();
  const compactionBySummaryId = new Map<string, CompactionEvent>();
  const compactionsBySummaryId = new Map<string, CompactionEvent[]>();
  const compactionBySourceId = new Map<string, CompactionEvent[]>();
  const compactionsByRetainedId = new Map<string, CompactionEvent[]>();
  for (const compaction of analysis.compactions) {
    if (compactionById.has(compaction.id)) {
      throw new AnalysisValidationError(`Duplicate compaction ID ${compaction.id}`);
    }
    if (
      !Number.isInteger(compaction.beforeModelCall) ||
      compaction.beforeModelCall < (firstCall || 1) ||
      compaction.beforeModelCall > terminalBoundary
    ) {
      throw new AnalysisValidationError(`Compaction ${compaction.id} has an invalid call boundary`);
    }
    if (!itemById.has(compaction.summaryItemId)) {
      throw new AnalysisValidationError(`Compaction ${compaction.id} references a missing summary`);
    }
    for (const id of [...compaction.sourceItemIds, ...compaction.retainedItemIds]) {
      if (!itemById.has(id)) {
        throw new AnalysisValidationError(
          `Compaction ${compaction.id} references unknown item ${id}`,
        );
      }
    }
    compactionById.set(compaction.id, compaction);
    compactionBySummaryId.set(compaction.summaryItemId, compaction);
    addToMap(compactionsBySummaryId, compaction.summaryItemId, compaction);
    for (const id of compaction.sourceItemIds) addToMap(compactionBySourceId, id, compaction);
    for (const id of compaction.retainedItemIds) addToMap(compactionsByRetainedId, id, compaction);
  }

  const outgoingLineage = new Map<string, LineageEdge[]>();
  const incomingLineage = new Map<string, LineageEdge[]>();
  for (const edge of analysis.lineage) {
    if (!itemById.has(edge.from) || !itemById.has(edge.to)) {
      throw new AnalysisValidationError(
        `Lineage references missing item ${edge.from} → ${edge.to}`,
      );
    }
    if (edge.kind !== 'frameworkCompaction') {
      throw new AnalysisValidationError(`Unsupported lineage kind ${String(edge.kind)}`);
    }
    addToMap(outgoingLineage, edge.from, edge);
    addToMap(incomingLineage, edge.to, edge);
  }

  const indexed = {
    analysis,
    itemById,
    callByIndex,
    outgoingLineage,
    incomingLineage,
    compactionById,
    compactionBySummaryId,
    compactionsBySummaryId,
    compactionBySourceId,
    compactionsByRetainedId,
    itemEstimateByProfile,
    contextSetByCall,
    orderedItemIdsByCall,
  };
  return indexed;
}
