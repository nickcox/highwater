import type { ContextItem, SessionAnalysis } from '../types';
import { costSummaryFor, testAnalysis } from '../context-river/test-data';

export type SessionScenario =
  | 'empty'
  | 'singleCall'
  | 'longSession'
  | 'partialGeometry'
  | 'unavailableGeometry'
  | 'terminalCompaction'
  | 'terminalSummaryOnly'
  | 'labelStress'
  | 'multipleToolsMissingMetadata';

function cloneBase(): SessionAnalysis {
  return structuredClone(testAnalysis());
}

function emptyScenario(): SessionAnalysis {
  const analysis = cloneBase();
  analysis.modelCalls = [];
  analysis.contextItems = [];
  analysis.compactions = [];
  analysis.lineage = [];
  return analysis;
}

function singleCallScenario(): SessionAnalysis {
  const analysis = cloneBase();
  const call = analysis.modelCalls[0];
  analysis.modelCalls = [call];
  analysis.contextItems = analysis.contextItems
    .filter((item) => call.contextItemIds.includes(item.id))
    .map((item) => ({
      ...item,
      firstModelCall: 1,
      lastModelCall: 1,
      presence: [{ startCall: 1, endCall: 1 }],
      presenceCallCount: 1,
    }));
  analysis.compactions = [];
  analysis.lineage = [];
  return analysis;
}

function appendRepeatedCall(analysis: SessionAnalysis, index: number): void {
  const previousIndex = analysis.modelCalls[analysis.modelCalls.length - 1].index;
  const next = structuredClone(analysis.modelCalls[analysis.modelCalls.length - 1]);
  next.index = index;
  next.sourceRecordId = `generated-call-${index}`;
  next.addedItemIds = [];
  next.droppedItemIds = [];
  next.transitionItemCounts = { added: 0, retained: next.contextItemIds.length, dropped: 0 };
  next.toolCallsAfter = [];
  analysis.modelCalls.push(next);

  for (const item of analysis.contextItems) {
    const finalRange = item.presence[item.presence.length - 1];
    if (!finalRange || finalRange.endCall !== previousIndex) continue;
    finalRange.endCall = index;
    item.lastModelCall = index;
    item.presenceCallCount += 1;
  }
}

function longSessionScenario(): SessionAnalysis {
  const analysis = cloneBase();
  for (let call = analysis.modelCalls.length + 1; call <= 160; call += 1) {
    appendRepeatedCall(analysis, call);
  }
  return analysis;
}

function partialGeometryScenario(): SessionAnalysis {
  const analysis = cloneBase();
  analysis.contextItems[0].tokenEstimates[0].coverage = 'partial';
  analysis.contextItems[0].tokenEstimates[0].noteCodes = ['partialContentCoverage'];
  analysis.tokenAnalysis.itemEstimateCoverage.completeItems -= 1;
  analysis.tokenAnalysis.itemEstimateCoverage.partialItems += 1;
  return analysis;
}

function unavailableGeometryScenario(): SessionAnalysis {
  const analysis = cloneBase();
  analysis.displayWeightUnit = 'unavailable';
  analysis.tokenAnalysis.chartUnit = 'unavailable';
  analysis.tokenAnalysis.itemEstimateCoverage = {
    completeItems: 0,
    partialItems: 0,
    unavailableItems: analysis.contextItems.length,
    totalItems: analysis.contextItems.length,
    coveredCalls: 0,
    totalCalls: analysis.modelCalls.length,
  };
  for (const call of analysis.modelCalls) call.tokenizationProfileId = null;
  for (const item of analysis.contextItems) {
    item.displayWeight = 0;
    item.tokenEstimates = [
      {
        profileId: 'profile-1',
        tokens: null,
        method: 'unavailable',
        coverage: 'unavailable',
        noteCodes: ['noTokenGeometry'],
      },
    ];
  }
  return analysis;
}

function terminalCompactionScenario(): SessionAnalysis {
  const analysis = cloneBase();
  const summary: ContextItem = {
    id: 'terminal-summary',
    kind: 'compactionSummary',
    label: 'Terminal compaction summary',
    preview: null,
    sourceRecordId: 'terminal-compaction-record',
    sourceToolCallId: null,
    firstModelCall: 0,
    lastModelCall: 0,
    ageAtFinalModelCall: null,
    displayWeight: 0,
    presence: [],
    presenceCallCount: 0,
    metadata: {},
    tokenEstimates: [
      {
        profileId: 'profile-1',
        tokens: null,
        method: 'unavailable',
        coverage: 'unavailable',
        noteCodes: ['terminalSummary'],
      },
    ],
    tokenTurns: null,
    tokenTurnsCoverage: {
      completeItems: 0,
      partialItems: 0,
      unavailableItems: 1,
      totalItems: 1,
      coveredCalls: 0,
      totalCalls: 0,
    },
  };
  analysis.contextItems.push(summary);
  analysis.compactions.push({
    id: 'terminal-compaction',
    beforeModelCall: analysis.modelCalls.length + 1,
    sourceItemIds: ['a'],
    retainedItemIds: ['retained'],
    summaryItemId: summary.id,
    tokensBefore: 100,
  });
  analysis.lineage.push({ from: 'a', to: summary.id, kind: 'frameworkCompaction' });
  return analysis;
}

function terminalSummaryOnlyScenario(): SessionAnalysis {
  const analysis = terminalCompactionScenario();
  const summary = analysis.contextItems.find((item) => item.id === 'terminal-summary')!;
  analysis.modelCalls = [];
  analysis.contextItems = [
    {
      ...summary,
      displayWeight: 0,
      tokenEstimates: [
        {
          profileId: 'profile-1',
          tokens: null,
          method: 'unavailable',
          coverage: 'unavailable',
          noteCodes: ['terminalSummary'],
        },
      ],
    },
  ];
  analysis.compactions = [
    {
      id: 'terminal-compaction',
      beforeModelCall: 1,
      sourceItemIds: [],
      retainedItemIds: [],
      summaryItemId: summary.id,
      tokensBefore: 100,
    },
  ];
  analysis.lineage = [];
  analysis.displayWeightUnit = 'unavailable';
  analysis.tokenAnalysis.chartUnit = 'unavailable';
  analysis.tokenAnalysis.itemEstimateCoverage = {
    completeItems: 0,
    partialItems: 0,
    unavailableItems: 1,
    totalItems: 1,
    coveredCalls: 0,
    totalCalls: 0,
  };
  analysis.tokenAnalysis.totalTokenTurnsCoverage = analysis.tokenAnalysis.itemEstimateCoverage;
  analysis.tokenAnalysis.totalCalculatedTokenTurns = null;
  Object.assign(analysis.session, {
    reportedPromptTokens: null,
    reportedCompletionTokens: null,
    reportedReasoningTokens: null,
    reportedCostTotal: null,
    reportedCostCoverage: {
      recordedCalls: 0,
      failedAttemptCalls: 0,
      missingCalls: analysis.modelCalls.length,
    },
    reportedUsageCompleteness: 'missing',
    reportedUsageCoverage: {
      recordedCalls: 0,
      failedAttemptCalls: 0,
      missingCalls: analysis.modelCalls.length,
    },
    calculatedTokenTurns: null,
    calculatedTokenTurnsCoverage: analysis.tokenAnalysis.itemEstimateCoverage,
    peakCalculatedVisibleTokens: null,
    reconciliationCompleteCalls: 0,
    reconciliationComparableCalls: 0,
    medianAbsoluteResidualPercent: null,
    maximumAbsoluteResidualPercent: null,
    negativeResidualCalls: 0,
    missingProviderUsageCalls: 0,
  });
  return analysis;
}

function renameItemIds(analysis: SessionAnalysis): void {
  const suffix = `-${'id'.repeat(100)}`;
  const ids = new Map(analysis.contextItems.map((item) => [item.id, `${item.id}${suffix}`]));
  for (const item of analysis.contextItems) {
    item.id = ids.get(item.id)!;
    item.sourceRecordId = `${item.sourceRecordId ?? 'missing'}${suffix}`;
    if (item.sourceToolCallId) item.sourceToolCallId += suffix;
  }
  for (const call of analysis.modelCalls) {
    call.sourceRecordId += suffix;
    call.contextItemIds = call.contextItemIds.map((id) => ids.get(id)!);
    call.addedItemIds = call.addedItemIds.map((id) => ids.get(id)!);
    call.droppedItemIds = call.droppedItemIds.map((id) => ids.get(id)!);
    for (const toolCall of call.toolCallsAfter) toolCall.id += suffix;
  }
  for (const compaction of analysis.compactions) {
    compaction.sourceItemIds = compaction.sourceItemIds.map((id) => ids.get(id)!);
    compaction.retainedItemIds = compaction.retainedItemIds.map((id) => ids.get(id)!);
    compaction.summaryItemId = ids.get(compaction.summaryItemId)!;
  }
  for (const edge of analysis.lineage) {
    edge.from = ids.get(edge.from)!;
    edge.to = ids.get(edge.to)!;
  }
}

function labelStressScenario(): SessionAnalysis {
  const analysis = cloneBase();
  analysis.contextItems[0].label = 'Repeated read';
  analysis.contextItems[1].label = 'Repeated read';
  analysis.contextItems[2].label = `Unicode label · ${'📦'.repeat(100)}`;
  analysis.contextItems[3].label = `<img src=x onerror=alert(1)> ${'unbroken'.repeat(30)}`;
  renameItemIds(analysis);
  return analysis;
}

function multipleToolsMissingMetadataScenario(): SessionAnalysis {
  const analysis = cloneBase();
  analysis.modelCalls[0].toolCallsAfter = [
    { id: 'tool-1', name: 'bash', failed: false },
    { id: 'tool-2', name: 'read', failed: false },
    { id: 'tool-3', name: 'custom', failed: true },
  ];
  analysis.contextItems[0].sourceToolCallId = null;
  analysis.contextItems[0].metadata = {};
  return analysis;
}

export function sessionScenario(name: SessionScenario): SessionAnalysis {
  const analysis = buildScenario(name);
  // Scenarios add and remove calls, so the cost summary is recounted afterwards.
  // An unnamed scenario has no analysis; browser mocks then use their default.
  if (analysis) analysis.session.costSummary = costSummaryFor(analysis.modelCalls);
  return analysis;
}

function buildScenario(name: SessionScenario): SessionAnalysis {
  switch (name) {
    case 'empty':
      return emptyScenario();
    case 'singleCall':
      return singleCallScenario();
    case 'longSession':
      return longSessionScenario();
    case 'partialGeometry':
      return partialGeometryScenario();
    case 'unavailableGeometry':
      return unavailableGeometryScenario();
    case 'terminalCompaction':
      return terminalCompactionScenario();
    case 'terminalSummaryOnly':
      return terminalSummaryOnlyScenario();
    case 'labelStress':
      return labelStressScenario();
    case 'multipleToolsMissingMetadata':
      return multipleToolsMissingMetadataScenario();
  }
}

export function liveAppendReplacementScenario(): {
  initial: SessionAnalysis;
  replacement: SessionAnalysis;
} {
  const initial = cloneBase();
  const replacement = structuredClone(initial);
  replacement.modelCalls[1].model = 'replaced-model';
  appendRepeatedCall(replacement, replacement.modelCalls.length + 1);
  return { initial, replacement };
}
