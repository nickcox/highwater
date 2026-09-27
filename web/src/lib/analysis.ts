import { stableItemOrder } from './analysis-ordering';
import type {
  CallEconomics,
  CompactionEvent,
  ContextItem,
  ContextItemKind,
  EconomicsSummary,
  IndexedAnalysis,
  LineageEdge,
  ModelCall,
  SessionAnalysis,
} from './types';

const KNOWN_ECONOMICS_COST_BASES = new Set([
  'piModelRates',
  'sourceModelRates',
  'providerReported',
  'unknown',
]);

const KNOWN_KINDS = new Set<ContextItemKind>([
  'system',
  'toolDefinition',
  'userMessage',
  'assistantMessage',
  'toolResult',
  'compactionSummary',
  'customMessage',
  'branchSummary',
  'other',
]);

export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

function normalizedKind(kind: string): ContextItemKind {
  return KNOWN_KINDS.has(kind as ContextItemKind) ? (kind as ContextItemKind) : 'other';
}

function addToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function assertUnique(values: readonly string[], description: string): void {
  if (new Set(values).size !== values.length) {
    throw new AnalysisValidationError(`Duplicate ${description}`);
  }
}

const ECONOMICS_POLICIES = {
  'anthropic-messages-cache-v1': {
    provider: 'anthropic',
    api: 'anthropic-messages',
    cacheWriteStatus: 'reported',
    hasFreshRatio: true,
    hasWriteRatio: true,
  },
  'openai-completions-cache-v1': {
    provider: 'openai',
    api: 'openai-completions',
    cacheWriteStatus: 'notReported',
    hasFreshRatio: true,
    hasWriteRatio: false,
  },
  'openai-responses-cache-read-v1': {
    provider: 'openai',
    api: 'openai-responses',
    cacheWriteStatus: 'notRetainedByPi',
    hasFreshRatio: false,
    hasWriteRatio: false,
  },
  'openai-codex-responses-cache-read-v1': {
    provider: 'openai-codex',
    api: 'openai-codex-responses',
    cacheWriteStatus: 'notRetainedByPi',
    hasFreshRatio: false,
    hasWriteRatio: false,
  },
} as const;
const ECONOMICS_COMPLETENESS = new Set(['complete', 'partial', 'missing', 'unsupported']);
const CACHE_WRITE_STATUSES = new Set(['reported', 'notReported', 'notRetainedByPi', 'unsupported']);
const CACHE_RATIO_CHANGE_THRESHOLD = 0.25;
const CACHE_RATIO_LARGE_THRESHOLD = 0.5;
const CACHE_RATIO_CHANGE_METHOD = 'adjacent-cache-read-share-v1';
const MIN_CACHE_RATIO_PROMPT_TOKENS = 1000;

function assertSafeToken(value: number | null, description: string): void {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new AnalysisValidationError(`${description} is not a safe non-negative integer`);
  }
}

function assertRatio(value: number | null, description: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new AnalysisValidationError(`${description} is outside 0..1`);
  }
}

function assertRatioMatches(
  actual: number | null,
  numerator: number,
  denominator: number,
  description: string,
): void {
  if (denominator === 0) {
    if (actual !== null || numerator !== 0) {
      throw new AnalysisValidationError(`${description} has an invalid zero denominator`);
    }
    return;
  }
  const expected = numerator / denominator;
  if (actual === null || Math.abs(actual - expected) > Math.max(1e-12, expected * 1e-9)) {
    throw new AnalysisValidationError(`${description} disagrees with its reported token buckets`);
  }
}

function assertCallEconomics(call: ModelCall): void {
  const economics = call.economics as CallEconomics | null | undefined;
  if (!economics || typeof economics !== 'object') {
    throw new AnalysisValidationError(`Call ${call.index} has no economics record`);
  }
  if (
    !ECONOMICS_COMPLETENESS.has(economics.usageCompleteness) ||
    !ECONOMICS_COMPLETENESS.has(economics.costCompleteness) ||
    !CACHE_WRITE_STATUSES.has(economics.cacheWriteStatus)
  ) {
    throw new AnalysisValidationError(`Call ${call.index} has an unsupported economics status`);
  }
  if (
    !Array.isArray(economics.explanationCodes) ||
    economics.explanationCodes.some((code) => typeof code !== 'string')
  ) {
    throw new AnalysisValidationError(`Call ${call.index} has invalid economics explanations`);
  }
  assertSafeToken(economics.promptTokens, `Call ${call.index} economics promptTokens`);
  for (const [name, value] of [
    ['input', call.usage.input],
    ['output', call.usage.output],
    ['cacheRead', call.usage.cacheRead],
    ['cacheWrite', call.usage.cacheWrite],
    ['cacheWrite1h', call.usage.cacheWrite1h],
    ['reasoning', call.usage.reasoning],
    ['totalTokens', call.usage.totalTokens],
    ['reportedPromptTokens', call.reportedPromptTokens],
    ['reportedCompletionTokens', call.reportedCompletionTokens],
    ['reportedTotalTokens', call.reportedTotalTokens],
    ['cumulativeReportedPromptTokens', call.cumulativeReportedPromptTokens],
    ['cumulativeReportedCompletionTokens', call.cumulativeReportedCompletionTokens],
    ['cumulativeReportedReasoningTokens', call.cumulativeReportedReasoningTokens],
  ] as const) {
    assertSafeToken(value, `Call ${call.index} ${name}`);
  }
  const costValues = call.cost
    ? [
        call.cost.input,
        call.cost.output,
        call.cost.cacheRead,
        call.cost.cacheWrite,
        call.cost.total,
      ]
    : [];
  for (const value of costValues) {
    if (value !== null && !Number.isFinite(value)) {
      throw new AnalysisValidationError(`Call ${call.index} has a non-finite raw cost`);
    }
  }
  const hasNegativeCost = costValues.some((value) => value !== null && value < 0);
  if (hasNegativeCost && economics.costCompleteness === 'complete') {
    throw new AnalysisValidationError(
      `Call ${call.index} marks negative cost components as complete`,
    );
  }
  for (const [name, value] of [
    ['cacheReadRatio', economics.cacheReadRatio],
    ['cacheWriteRatio', economics.cacheWriteRatio],
    ['freshRatio', economics.freshRatio],
  ] as const) {
    assertRatio(value, `Call ${call.index} economics ${name}`);
  }
  assertDiscontinuityShape(call);
  if (
    economics.piPromptCost !== null &&
    (!Number.isFinite(economics.piPromptCost) || economics.piPromptCost < 0)
  ) {
    throw new AnalysisValidationError(`Call ${call.index} has an invalid calculated prompt cost`);
  }

  const policy =
    economics.policyId === null
      ? null
      : ECONOMICS_POLICIES[economics.policyId as keyof typeof ECONOMICS_POLICIES];
  if (economics.policyId === null) {
    if (
      economics.usageCompleteness !== 'unsupported' ||
      economics.costCompleteness !== 'unsupported' ||
      economics.cacheWriteStatus !== 'unsupported' ||
      economics.promptTokens !== null ||
      economics.cacheReadRatio !== null ||
      economics.cacheWriteRatio !== null ||
      economics.freshRatio !== null ||
      economics.piPromptCost !== null ||
      economics.cacheRatioDiscontinuity !== null
    ) {
      throw new AnalysisValidationError(
        `Call ${call.index} has economics without a supported policy`,
      );
    }
    return;
  }
  if (
    !policy ||
    call.provider !== policy.provider ||
    call.api !== policy.api ||
    economics.cacheWriteStatus !== policy.cacheWriteStatus
  ) {
    throw new AnalysisValidationError(`Call ${call.index} has an unsupported economics policy`);
  }
  if (
    economics.usageCompleteness === 'unsupported' ||
    economics.costCompleteness === 'unsupported'
  ) {
    throw new AnalysisValidationError(`Call ${call.index} marks a supported policy as unsupported`);
  }
  if (economics.piPromptCost !== null && economics.costCompleteness !== 'complete') {
    throw new AnalysisValidationError(
      `Call ${call.index} has a prompt cost with incomplete components`,
    );
  }
  if (economics.usageCompleteness !== 'complete') {
    if (
      economics.promptTokens !== null ||
      economics.cacheReadRatio !== null ||
      economics.cacheWriteRatio !== null ||
      economics.freshRatio !== null
    ) {
      throw new AnalysisValidationError(`Call ${call.index} derives ratios from incomplete usage`);
    }
    return;
  }
  if (economics.promptTokens === null) {
    throw new AnalysisValidationError(
      `Call ${call.index} has complete usage without prompt tokens`,
    );
  }

  const input = call.usage.input;
  const read = call.usage.cacheRead;
  const write = call.usage.cacheWrite;
  assertSafeToken(input, `Call ${call.index} input`);
  assertSafeToken(read, `Call ${call.index} cacheRead`);
  assertSafeToken(write, `Call ${call.index} cacheWrite`);
  if (input === null || read === null || (policy.hasWriteRatio && write === null)) {
    throw new AnalysisValidationError(
      `Call ${call.index} has incomplete normalized prompt buckets`,
    );
  }
  const bucketTotal = BigInt(input) + BigInt(read) + BigInt(policy.hasWriteRatio ? write! : 0);
  if (bucketTotal !== BigInt(economics.promptTokens)) {
    throw new AnalysisValidationError(
      `Call ${call.index} prompt tokens disagree with normalized buckets`,
    );
  }
  assertRatioMatches(
    economics.cacheReadRatio,
    read,
    economics.promptTokens,
    `Call ${call.index} cacheReadRatio`,
  );
  if (policy.hasWriteRatio) {
    assertRatioMatches(
      economics.cacheWriteRatio,
      write!,
      economics.promptTokens,
      `Call ${call.index} cacheWriteRatio`,
    );
  } else if (economics.cacheWriteRatio !== null) {
    throw new AnalysisValidationError(`Call ${call.index} has an unsupported cache-write ratio`);
  }
  if (policy.hasFreshRatio) {
    assertRatioMatches(
      economics.freshRatio,
      input,
      economics.promptTokens,
      `Call ${call.index} freshRatio`,
    );
  } else if (economics.freshRatio !== null) {
    throw new AnalysisValidationError(`Call ${call.index} has an unsupported fresh-input ratio`);
  }
  if (
    economics.costCompleteness === 'complete' &&
    economics.usageCompleteness === 'complete' &&
    policy.hasFreshRatio &&
    economics.piPromptCost === null
  ) {
    throw new AnalysisValidationError(`Call ${call.index} is missing a complete prompt cost`);
  }
}

function assertDiscontinuityShape(call: ModelCall): void {
  const discontinuity = call.economics.cacheRatioDiscontinuity;
  if (discontinuity === null) return;
  if (!discontinuity || typeof discontinuity !== 'object') {
    throw new AnalysisValidationError(`Call ${call.index} has invalid cache-ratio change data`);
  }
  if (
    !Number.isSafeInteger(discontinuity.previousCallIndex) ||
    discontinuity.previousCallIndex < 0 ||
    !['drop', 'rise'].includes(discontinuity.direction) ||
    !['notable', 'large'].includes(discontinuity.magnitude) ||
    discontinuity.method !== CACHE_RATIO_CHANGE_METHOD ||
    !Number.isFinite(discontinuity.previousRatio) ||
    !Number.isFinite(discontinuity.currentRatio) ||
    !Number.isFinite(discontinuity.delta) ||
    discontinuity.delta < CACHE_RATIO_CHANGE_THRESHOLD ||
    discontinuity.delta > 1 ||
    (discontinuity.compactionBefore !== null && typeof discontinuity.compactionBefore !== 'string')
  ) {
    throw new AnalysisValidationError(`Call ${call.index} has invalid cache-ratio change data`);
  }
  assertSafeToken(discontinuity.previousPromptTokens, `Call ${call.index} previous prompt tokens`);
  assertSafeToken(discontinuity.currentPromptTokens, `Call ${call.index} current prompt tokens`);
  assertRatio(discontinuity.previousRatio, `Call ${call.index} previous cache-read ratio`);
  assertRatio(discontinuity.currentRatio, `Call ${call.index} current cache-read ratio`);
  const actualDelta = Math.abs(discontinuity.currentRatio - discontinuity.previousRatio);
  if (
    Math.abs(actualDelta - discontinuity.delta) > Math.max(1e-12, actualDelta * 1e-9) ||
    discontinuity.direction !==
      (discontinuity.currentRatio < discontinuity.previousRatio ? 'drop' : 'rise') ||
    discontinuity.magnitude !==
      (discontinuity.delta >= CACHE_RATIO_LARGE_THRESHOLD ? 'large' : 'notable') ||
    discontinuity.compactionBefore !== call.compactionBefore
  ) {
    throw new AnalysisValidationError(
      `Call ${call.index} has inconsistent cache-ratio change data`,
    );
  }
}

function assertAdjacentDiscontinuities(calls: ModelCall[]): void {
  const orderedCalls = [...calls].sort((a, b) => a.index - b.index);
  for (let position = 0; position < orderedCalls.length; position += 1) {
    const current = orderedCalls[position];
    const discontinuity = current.economics.cacheRatioDiscontinuity;
    if (discontinuity === null) continue;
    const previous = orderedCalls[position - 1];
    if (
      !previous ||
      previous.index + 1 !== current.index ||
      discontinuity.previousCallIndex !== previous.index ||
      discontinuity.previousPromptTokens !== previous.economics.promptTokens ||
      discontinuity.currentPromptTokens !== current.economics.promptTokens ||
      previous.economics.usageCompleteness !== 'complete' ||
      current.economics.usageCompleteness !== 'complete' ||
      previous.economics.policyId === null ||
      previous.economics.policyId !== current.economics.policyId ||
      previous.provider !== current.provider ||
      previous.model !== current.model ||
      previous.api !== current.api ||
      previous.economics.cacheReadRatio !== discontinuity.previousRatio ||
      current.economics.cacheReadRatio !== discontinuity.currentRatio ||
      (previous.economics.promptTokens ?? 0) < MIN_CACHE_RATIO_PROMPT_TOKENS ||
      (current.economics.promptTokens ?? 0) < MIN_CACHE_RATIO_PROMPT_TOKENS
    ) {
      throw new AnalysisValidationError(
        `Call ${current.index} has an ineligible cache-ratio change`,
      );
    }
  }
}

function assertEconomicsSummary(summary: EconomicsSummary, calls: ModelCall[]): void {
  if (!summary || !KNOWN_ECONOMICS_COST_BASES.has(summary.costBasis)) {
    throw new AnalysisValidationError('Analysis has an unsupported economics cost basis');
  }
  if (!Array.isArray(summary.supportedPolicyIds)) {
    throw new AnalysisValidationError('Analysis has invalid supported economics policies');
  }
  assertUnique(summary.supportedPolicyIds, 'economics policy ID');
  for (const id of summary.supportedPolicyIds) {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ECONOMICS_POLICIES, id)) {
      throw new AnalysisValidationError(
        `Analysis has an unsupported economics policy ${String(id)}`,
      );
    }
  }
  for (const [name, counts] of [
    ['usage', summary.usageCompleteness],
    ['cost', summary.costCompleteness],
  ] as const) {
    if (!counts || typeof counts !== 'object') {
      throw new AnalysisValidationError(`Analysis has invalid ${name} economics coverage`);
    }
    for (const status of ['complete', 'partial', 'missing', 'unsupported'] as const) {
      if (!Number.isSafeInteger(counts[status]) || counts[status] < 0) {
        throw new AnalysisValidationError(`Analysis has invalid ${name} economics ${status} count`);
      }
    }
  }
  if (
    !Number.isSafeInteger(summary.cacheReadEligibleCalls) ||
    summary.cacheReadEligibleCalls < 0 ||
    summary.cacheReadEligibleCalls > calls.length
  ) {
    throw new AnalysisValidationError('Analysis has invalid cache-read coverage count');
  }
  assertSafeToken(summary.cacheReadPromptTokens, 'Analysis cache-read prompt token total');
  assertSafeToken(summary.cacheReadTokens, 'Analysis cache-read token total');
  assertRatio(summary.cacheReadRatio, 'Analysis cache-read ratio');
  if (
    !Array.isArray(summary.explanationCodes) ||
    summary.explanationCodes.some((code) => typeof code !== 'string')
  ) {
    throw new AnalysisValidationError('Analysis has invalid economics explanations');
  }
  for (const call of calls) {
    assertCallEconomics(call);
    if (
      call.economics.policyId !== null &&
      !summary.supportedPolicyIds.includes(call.economics.policyId)
    ) {
      throw new AnalysisValidationError(
        `Call ${call.index} economics policy is missing from the summary`,
      );
    }
  }
  assertAdjacentDiscontinuities(calls);
  if ((summary.cacheReadPromptTokens === null) !== (summary.cacheReadTokens === null)) {
    throw new AnalysisValidationError('Analysis has incomplete cache-read token totals');
  }
  if (summary.cacheReadPromptTokens !== null && summary.cacheReadTokens !== null) {
    if (summary.cacheReadRatio === null && summary.cacheReadPromptTokens > 0) {
      throw new AnalysisValidationError(
        'Analysis is missing a cache-read ratio for covered tokens',
      );
    }
    assertRatioMatches(
      summary.cacheReadRatio,
      summary.cacheReadTokens,
      summary.cacheReadPromptTokens,
      'Analysis cache-read ratio',
    );
  } else if (summary.cacheReadRatio !== null) {
    throw new AnalysisValidationError('Analysis has a cache-read ratio without covered tokens');
  }
}

export function indexAnalysis(input: SessionAnalysis): IndexedAnalysis {
  if (import.meta.env.DEV && typeof performance !== 'undefined')
    performance.mark('tokenplume-index-start');
  if (input.schemaVersion !== 7) {
    throw new AnalysisValidationError(`Unsupported analysis schema ${String(input.schemaVersion)}`);
  }
  if (input.displayWeightUnit !== input.tokenAnalysis.chartUnit) {
    throw new AnalysisValidationError('Chart unit disagrees with token-analysis metadata');
  }
  if (!['calculatedTokens', 'estimatedTokens', 'unavailable'].includes(input.displayWeightUnit)) {
    throw new AnalysisValidationError(`Unsupported chart unit ${String(input.displayWeightUnit)}`);
  }
  assertEconomicsSummary(input.economics, input.modelCalls);
  if (
    input.session.reportedCostTotal !== null &&
    (!Number.isFinite(input.session.reportedCostTotal) || input.session.reportedCostTotal < 0)
  ) {
    throw new AnalysisValidationError('Analysis has an invalid calculated session cost total');
  }
  const analysis: SessionAnalysis = {
    ...input,
    modelCalls: [...input.modelCalls].sort((a, b) => a.index - b.index),
    contextItems: input.contextItems.map((item) => ({
      ...item,
      kind: normalizedKind(item.kind),
      presence: [...item.presence],
      metadata: { ...item.metadata },
    })),
    compactions: [...input.compactions].sort(
      (a, b) => a.beforeModelCall - b.beforeModelCall || a.id.localeCompare(b.id),
    ),
    lineage: [...input.lineage].sort(
      (a, b) =>
        a.to.localeCompare(b.to) || a.from.localeCompare(b.from) || a.kind.localeCompare(b.kind),
    ),
  };

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
      if (!isTerminalSummary || item.firstModelCall !== 0 || item.lastModelCall !== 0) {
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
  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('tokenplume-index-end');
    performance.measure(
      'tokenplume-index-analysis',
      'tokenplume-index-start',
      'tokenplume-index-end',
    );
  }
  return indexed;
}
