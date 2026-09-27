import type { ContextItem, SessionAnalysis } from '../types';
import { testAnalysis } from '../context-river/test-data';

function coverage(
  completeItems: number,
  partialItems: number,
  unavailableItems: number,
  totalItems: number,
  coveredCalls: number,
  totalCalls: number,
) {
  return { completeItems, partialItems, unavailableItems, totalItems, coveredCalls, totalCalls };
}

/** Dense deterministic call-composition data; values are synthetic and never describe a real session. */
export function compositionScenario(itemCount = 220, allZero = false): SessionAnalysis {
  const analysis = structuredClone(testAnalysis());
  const calls = analysis.modelCalls;
  const template = analysis.contextItems[0];
  const kinds: ContextItem['kind'][] = [
    'system',
    'toolDefinition',
    'userMessage',
    'assistantMessage',
    'toolResult',
    'compactionSummary',
    'customMessage',
    'branchSummary',
    'other',
  ];
  let completeItems = 0;
  let partialItems = 0;
  let unavailableItems = 0;
  let totalTokenTurns = 0;
  let completeTurns = 0;
  let partialTurns = 0;
  let unavailableTurns = 0;
  let coveredTurns = 0;

  const items = Array.from({ length: Math.max(1, Math.floor(itemCount)) }, (_, index) => {
    let profile1Tokens: number | null;
    let profile2Tokens: number | null;
    if (allZero) {
      profile1Tokens = 0;
      profile2Tokens = 0;
    } else if (index === 0) {
      profile1Tokens = 10_000;
      profile2Tokens = 75;
    } else if (index === 1) {
      profile1Tokens = 20;
      profile2Tokens = 8_000;
    } else if (index === 2) {
      profile1Tokens = 0;
      profile2Tokens = 0;
    } else if (index === 3) {
      profile1Tokens = null;
      profile2Tokens = null;
    } else {
      profile1Tokens = index % 29 === 0 ? 0 : 1;
      profile2Tokens = index % 31 === 0 ? 0 : 1;
    }

    const isUnavailable = profile1Tokens === null && profile2Tokens === null;
    const isPartial = !allZero && index === 2;
    const estimateCoverage = isUnavailable ? 'unavailable' : isPartial ? 'partial' : 'complete';
    if (isUnavailable) unavailableItems += 1;
    else if (isPartial) partialItems += 1;
    else completeItems += 1;

    const tokenTurns =
      profile1Tokens === null || profile2Tokens === null
        ? null
        : profile1Tokens * 2 + profile2Tokens * 2;
    if (tokenTurns === null) unavailableTurns += 1;
    else if (isPartial) {
      partialTurns += 1;
      coveredTurns += 4;
      totalTokenTurns += tokenTurns;
    } else {
      completeTurns += 1;
      coveredTurns += 4;
      totalTokenTurns += tokenTurns;
    }

    return {
      ...structuredClone(template),
      id: `composition-item-${String(index).padStart(3, '0')}`,
      kind: kinds[index % kinds.length],
      label:
        index === 0 ? 'Dominant call item' : `Composition item ${String(index).padStart(3, '0')}`,
      sourceRecordId: `composition-record-${index}`,
      sourceToolCallId: null,
      firstModelCall: 1,
      lastModelCall: 4,
      ageAtFinalModelCall: 3,
      displayWeight: 0,
      presence: [{ startCall: 1, endCall: 4 }],
      presenceCallCount: 4,
      metadata: {},
      tokenEstimates: [
        {
          profileId: 'profile-1',
          tokens: profile1Tokens,
          method: profile1Tokens === null ? 'unavailable' : 'modelTokenizer',
          coverage: estimateCoverage,
          noteCodes: isPartial
            ? ['unsupportedImage']
            : isUnavailable
              ? ['unsupportedTokenizer']
              : [],
        },
        {
          profileId: 'profile-2',
          tokens: profile2Tokens,
          method: profile2Tokens === null ? 'unavailable' : 'modelTokenizer',
          coverage: estimateCoverage,
          noteCodes: isPartial
            ? ['unsupportedImage']
            : isUnavailable
              ? ['unsupportedTokenizer']
              : [],
        },
      ],
      tokenTurns,
      tokenTurnsCoverage: coverage(
        isUnavailable ? 0 : isPartial ? 0 : 1,
        isPartial ? 1 : 0,
        isUnavailable ? 1 : 0,
        1,
        tokenTurns === null ? 0 : 4,
        4,
      ),
    } satisfies ContextItem;
  });

  const itemIds = items.map((item) => item.id);
  analysis.contextItems = items;
  analysis.compactions = [];
  analysis.lineage = [];
  analysis.modelCalls = calls;
  for (const [position, call] of calls.entries()) {
    call.contextItemIds = [...itemIds];
    call.addedItemIds = position === 0 ? [...itemIds] : [];
    call.droppedItemIds = [];
    call.transitionItemCounts = {
      added: position === 0 ? itemIds.length : 0,
      retained: position === 0 ? 0 : itemIds.length,
      dropped: 0,
    };
    call.compactionBefore = null;
    call.tokenizationProfileId = position % 2 === 0 ? 'profile-1' : 'profile-2';
    call.tokenAnalysis.calculatedVisibleTokens = null;
    call.tokenAnalysis.estimateCoverage = coverage(
      completeItems,
      partialItems,
      unavailableItems,
      items.length,
      items.length - unavailableItems,
      items.length,
    );
  }

  const estimateSummary = coverage(
    completeItems,
    partialItems,
    unavailableItems,
    items.length,
    (items.length - unavailableItems) * 4,
    items.length * 4,
  );
  const turnSummary = coverage(
    completeTurns,
    partialTurns,
    unavailableTurns,
    items.length,
    coveredTurns,
    items.length * 4,
  );
  analysis.displayWeightUnit = 'unavailable';
  analysis.tokenAnalysis.chartUnit = 'unavailable';
  analysis.tokenAnalysis.profiles.push({
    ...analysis.tokenAnalysis.profiles[0],
    id: 'profile-2',
    model: 'composition-alternate',
  });
  analysis.tokenAnalysis.itemEstimateCoverage = estimateSummary;
  analysis.tokenAnalysis.totalCalculatedTokenTurns = unavailableTurns > 0 ? null : totalTokenTurns;
  analysis.tokenAnalysis.totalTokenTurnsCoverage = turnSummary;
  analysis.tokenAnalysis.tokenizerMethods = { modelTokenizer: items.length * 2 };
  analysis.session.calculatedTokenTurns = unavailableTurns > 0 ? null : totalTokenTurns;
  analysis.session.calculatedTokenTurnsCoverage = turnSummary;
  analysis.session.peakCalculatedVisibleTokens = null;
  analysis.session.reportedCostTotal = 0.06;
  for (const call of calls) call.compactionBefore = null;
  return analysis;
}
