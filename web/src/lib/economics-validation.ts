import type { CallEconomics, EconomicsSummary, ModelCall } from './types';
import { AnalysisValidationError, assertUnique, assertSafeToken } from './analysis-validation';
import { ECONOMICS_POLICIES } from './economics-policy';

const KNOWN_ECONOMICS_COST_BASES = new Set([
  'piModelRates',
  'sourceModelRates',
  'providerReported',
  'unknown',
]);

const ECONOMICS_COMPLETENESS = new Set(['complete', 'partial', 'missing', 'unsupported']);
const CACHE_WRITE_STATUSES = new Set(['reported', 'notReported', 'notRetainedByPi', 'unsupported']);
const CACHE_RATIO_CHANGE_THRESHOLD = 0.25;
const CACHE_RATIO_LARGE_THRESHOLD = 0.5;
const CACHE_RATIO_CHANGE_METHOD = 'adjacent-cache-read-share-v1';
const MIN_CACHE_RATIO_PROMPT_TOKENS = 1000;

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

export function assertEconomicsSummary(summary: EconomicsSummary, calls: ModelCall[]): void {
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
