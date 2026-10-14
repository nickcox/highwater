import type { ItemVersion } from './item-versions';
export type ContextItemKind =
  | 'system'
  | 'toolDefinition'
  | 'userMessage'
  | 'assistantMessage'
  | 'toolResult'
  | 'compactionSummary'
  | 'customMessage'
  | 'branchSummary'
  | 'thinking'
  | 'unrecordedContext'
  | 'other';

export type ChartUnit = 'calculatedTokens' | 'estimatedTokens' | 'unavailable';
export type TokenizationMethod =
  | 'modelTokenizer'
  | 'apiSerializationEstimate'
  | 'characterHeuristic'
  | 'reportedUsage'
  | 'unavailable';
export type TokenCoverage = 'complete' | 'partial' | 'unavailable';
export type UsageCompleteness = 'complete' | 'partial' | 'missing';
export type EconomicsCompleteness = 'complete' | 'partial' | 'missing' | 'unsupported';
export type EconomicsCostBasis =
  'piModelRates' | 'sourceModelRates' | 'providerReported' | 'unknown';
export type CacheWriteStatus = 'reported' | 'notReported' | 'notRetainedByPi' | 'unsupported';

export interface CacheRatioDiscontinuity {
  previousCallIndex: number;
  direction: 'drop' | 'rise';
  previousRatio: number;
  currentRatio: number;
  delta: number;
  magnitude: 'notable' | 'large';
  method: 'adjacent-cache-read-share-v1';
  previousPromptTokens: number;
  currentPromptTokens: number;
  compactionBefore: string | null;
}

export interface CallEconomics {
  policyId: string | null;
  usageCompleteness: EconomicsCompleteness;
  costCompleteness: EconomicsCompleteness;
  cacheWriteStatus: CacheWriteStatus;
  promptTokens: number | null;
  cacheReadRatio: number | null;
  cacheWriteRatio: number | null;
  freshRatio: number | null;
  piPromptCost: number | null;
  cacheRatioDiscontinuity: CacheRatioDiscontinuity | null;
  explanationCodes: string[];
}

export interface EconomicsStatusCounts {
  complete: number;
  partial: number;
  missing: number;
  unsupported: number;
}

export interface EconomicsSummary {
  costBasis: EconomicsCostBasis;
  supportedPolicyIds: string[];
  usageCompleteness: EconomicsStatusCounts;
  costCompleteness: EconomicsStatusCounts;
  cacheReadEligibleCalls: number;
  cacheReadPromptTokens: number | null;
  cacheReadTokens: number | null;
  cacheReadRatio: number | null;
  explanationCodes: string[];
}

export interface PresenceRange {
  startCall: number;
  endCall: number;
}

export interface CoverageSummary {
  completeItems: number;
  partialItems: number;
  unavailableItems: number;
  totalItems: number;
  coveredCalls: number;
  totalCalls: number;
}

export type OutputReasoningRelationship = 'includesReasoning' | 'excludesReasoning' | 'unknown';

export interface RecordedUsagePlaceholder {
  reason: 'failedAttempt';
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number | null;
  reasoning: number | null;
  totalTokens: number;
  cost: Cost | null;
}

export interface Usage {
  /** Raw default counters, excluded from accounting and comparison. */
  placeholder: RecordedUsagePlaceholder | null;
  input: number | null;
  /** Normalized completion total, including reasoning exactly once when known. */
  output: number | null;
  /** Source counter, never a sum inferred from reasoning or a tokenizer. */
  recordedOutput: number | null;
  outputReasoningRelationship: OutputReasoningRelationship;
  cacheRead: number | null;
  cacheWrite: number | null;
  cacheWrite1h: number | null;
  reasoning: number | null;
  totalTokens: number | null;
}

export interface Cost {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  total: number | null;
}

export interface CallAgeMetrics {
  oldestLiveItemAgeCalls: number | null;
  medianLiveItemAgeCalls: number | null;
  tokenWeightedMeanAgeCalls: number | null;
  tokensAtLeast5CallsOld: number | null;
  tokensAtLeast10CallsOld: number | null;
  tokensAtLeast20CallsOld: number | null;
  itemsAtLeast5CallsOld: number;
  itemsAtLeast10CallsOld: number;
  itemsAtLeast20CallsOld: number;
}

export interface CallTokenAnalysis {
  reportedPromptTokens: number | null;
  reportedCompletionTokens: number | null;
  reportedTotalTokens: number | null;
  reportedUsageCompleteness: UsageCompleteness;
  calculatedVisibleTokens: number | null;
  knownFramingOverheadTokens: number | null;
  calculatedRequestTokens: number | null;
  residualTokens: number | null;
  residualPercent: number | null;
  status: 'unavailable' | 'partial' | 'close' | 'notable' | 'large' | string;
  explanationCodes: string[];
  estimateCoverage: CoverageSummary;
  addedTokens: number | null;
  retainedTokens: number | null;
  droppedTokens: number | null;
  churn: number | null;
  reuse: number | null;
  additionShare: number | null;
  removalShare: number | null;
  /** Token-based transition and age metrics include partial item estimates. */
  metricsIncludePartialEstimates: boolean;
  age: CallAgeMetrics;
}

export interface CallTiming {
  startedAtMs: number | null;
  recordedAtMs: number | null;
  durationMs: number | null;
  effectiveOutputTokensPerSecond: number | null;
  basis: 'pi-message-timestamps' | 'vscode-copilot-trace-spans' | null;
}

export interface ModelCall {
  index: number;
  sourceRecordId: string;
  provider: string | null;
  model: string | null;
  api: string | null;
  usage: Usage;
  reportedPromptTokens: number | null;
  reportedCompletionTokens: number | null;
  reportedTotalTokens: number | null;
  reportedUsageCompleteness: UsageCompleteness;
  cumulativeReportedPromptTokens: number | null;
  cumulativeReportedCompletionTokens: number | null;
  cumulativeReportedReasoningTokens: number | null;
  cumulativeReportedUsageCompleteness: UsageCompleteness;
  cost: Cost | null;
  stopReason: string | null;
  timing: CallTiming;
  contextItemIds: string[];
  addedItemIds: string[];
  droppedItemIds: string[];
  transitionItemCounts: {
    added: number;
    retained: number;
    dropped: number;
  };
  toolCallsAfter: Array<{ id: string; name: string; failed: boolean }>;
  compactionBefore: string | null;
  /** Present when the harness recorded the call as a retry after an error (VS Code Copilot). */
  retried?: boolean;
  tokenizationProfileId: string | null;
  tokenAnalysis: CallTokenAnalysis;
  economics: CallEconomics;
  costAssessment: CostAssessment;
}

/** How a call's cost was found. `apiEquivalent` is what a subscription call would
 * have cost at the lab's API rate: it is not a charge and is never added to billed cost. */
export type CostKind = 'recorded' | 'estimated' | 'apiEquivalent' | 'free' | 'unknown';

export type CostClassificationRule =
  | 'recordedCost'
  | 'billingModeTable'
  | 'opencodeZeroWithListedPrice'
  | 'perTokenDefault'
  | 'failedAttempt'
  | 'missingTime'
  | 'noPrice'
  | 'missingUsage';

export interface CostRate {
  provider: string;
  model: string;
  /** A lab's API rate used for a call on another provider (subscriptions only). */
  labEquivalent: boolean;
  /** When this rate started; null for a model's first listed rate. */
  validFrom: string | null;
  startBasis: 'documented' | 'firstObserved' | 'modelsDevCommit';
  source: string;
}

export interface CostAssessment {
  kind: CostKind;
  /** The low end when the amount is a range. */
  amount: number | null;
  /** Set only when the amount is a range. */
  amountHigh: number | null;
  recordedByHarness: number | null;
  billingMode: 'perToken' | 'subscription' | null;
  classificationRule: CostClassificationRule;
  rate: CostRate | null;
}

export interface CostSubtotal {
  low: number | null;
  high: number | null;
  calls: number;
}

export interface CostSummary {
  /** Recorded, estimated and free calls. */
  billed: CostSubtotal;
  apiEquivalent: CostSubtotal;
  unknownCalls: number;
  failedAttemptCalls: number;
  priceData: {
    modelsDevCommit: string;
    modelsDevCommittedAt: string;
    amendmentsImportedFrom: string | null;
  };
}

export interface ContextItemPreview {
  text: string;
  kind: 'text' | 'toolCall' | 'toolResult' | 'summary' | 'image' | 'unavailable';
  truncated: boolean;
  expandedText: string;
  expandedTruncated: boolean;
}

export interface ContextItemTokenEstimate {
  profileId: string;
  tokens: number | null;
  method: TokenizationMethod;
  coverage: TokenCoverage;
  noteCodes: string[];
}

export interface ContextItem {
  id: string;
  kind: ContextItemKind;
  label: string;
  preview: ContextItemPreview | null;
  sourceRecordId: string | null;
  sourceToolCallId: string | null;
  firstModelCall: number;
  lastModelCall: number;
  ageAtFinalModelCall: number | null;
  displayWeight: number;
  presence: PresenceRange[];
  presenceCallCount: number;
  metadata: Record<string, string>;
  tokenEstimates: ContextItemTokenEstimate[];
  tokenTurns: number | null;
  tokenTurnsCoverage: CoverageSummary;
}

export interface TokenizationProfileSummary {
  id: string;
  provider: string;
  model: string;
  api: string | null;
  tokenizerFamily: string;
  method: TokenizationMethod;
  version: number;
  rule: string;
}

export interface TokenAnalysisSummary {
  policy: 'auto' | 'strict' | 'heuristic' | 'off' | string;
  chartUnit: ChartUnit;
  fallbackReason: string | null;
  profiles: TokenizationProfileSummary[];
  itemEstimateCoverage: CoverageSummary;
  callsWithCompleteReconciliation: number;
  callsWithComparableReconciliation: number;
  tokenizerMethods: Record<string, number>;
  medianAbsoluteResidualPercent: number | null;
  maximumAbsoluteResidualPercent: number | null;
  negativeResidualCalls: number;
  callsMissingProviderUsage: number;
  totalCalculatedTokenTurns: number | null;
  totalTokenTurnsCoverage: CoverageSummary;
}

export interface CompactionEvent {
  id: string;
  beforeModelCall: number;
  sourceItemIds: string[];
  retainedItemIds: string[];
  summaryItemId: string;
  tokensBefore: number | null;
}

export interface LineageEdge {
  from: string;
  to: string;
  kind: 'frameworkCompaction';
}

/** Calls included in a session subtotal. Failed attempts are counted
 * separately because their default-zero counters are not measurements. */
export interface RecordedCallCoverage {
  recordedCalls: number;
  failedAttemptCalls: number;
  missingCalls: number;
}

export interface SessionSummary {
  id: string;
  source: string;
  title: string | null;
  workingDirectory: string | null;
  reportedPromptTokens: number | null;
  reportedCompletionTokens: number | null;
  reportedReasoningTokens: number | null;
  /** Subtotal over calls with a recorded cost; see `reportedCostCoverage`. */
  reportedCostTotal: number | null;
  reportedCostCoverage: RecordedCallCoverage;
  reportedUsageCompleteness: UsageCompleteness;
  /** Prompt-token coverage of the session usage subtotals. */
  reportedUsageCoverage: RecordedCallCoverage;
  calculatedTokenTurns: number | null;
  calculatedTokenTurnsCoverage: CoverageSummary;
  peakCalculatedVisibleTokens: number | null;
  reconciliationCompleteCalls: number;
  reconciliationComparableCalls: number;
  medianAbsoluteResidualPercent: number | null;
  maximumAbsoluteResidualPercent: number | null;
  negativeResidualCalls: number;
  missingProviderUsageCalls: number;
  costSummary: CostSummary;
  /** The harness's own running session total (Claude Code), or null. It can include
   * calls that are not in the transcript and is never added to other costs. */
  harnessSessionCost: HarnessSessionCost | null;
}

export interface HarnessSessionCost {
  totalUsd: number;
  /** UTC epoch milliseconds when the running total started, or null. */
  sinceMs: number | null;
}

export interface ReconstructionCoverage {
  status: 'partial';
  explanationCodes: string[];
}

export interface SessionAnalysis {
  schemaVersion: number;
  reconstruction?: ReconstructionCoverage;
  tokenAnalysis: TokenAnalysisSummary;
  economics: EconomicsSummary;
  session: SessionSummary;
  displayWeightUnit: ChartUnit;
  modelCalls: ModelCall[];
  contextItems: ContextItem[];
  compactions: CompactionEvent[];
  lineage: LineageEdge[];
}

type CallItemIdFields = 'contextItemIds' | 'addedItemIds' | 'droppedItemIds';

/** A model call as sent by the server: item references are positions in
 * `contextItems`, which keeps the response proportional to the source. */
export interface WireModelCall extends Omit<ModelCall, CallItemIdFields> {
  contextItemIndexes: number[];
  addedItemIndexes: number[];
  droppedItemIndexes: number[];
}

/** The analysis response as sent by the server; `indexAnalysis` resolves it. */
export interface WireSessionAnalysis extends Omit<SessionAnalysis, 'modelCalls'> {
  modelCalls: WireModelCall[];
}

export interface IndexedAnalysis {
  analysis: SessionAnalysis;
  itemById: Map<string, ContextItem>;
  itemEstimateByProfile: Map<string, Map<string, ContextItemTokenEstimate>>;
  contextSetByCall: Map<number, Set<string>>;
  orderedItemIdsByCall: Map<number, string[]>;
  callByIndex: Map<number, ModelCall>;
  outgoingLineage: Map<string, LineageEdge[]>;
  incomingLineage: Map<string, LineageEdge[]>;
  compactionById: Map<string, CompactionEvent>;
  compactionBySummaryId: Map<string, CompactionEvent>;
  compactionsBySummaryId: Map<string, CompactionEvent[]>;
  compactionBySourceId: Map<string, CompactionEvent[]>;
  compactionsByRetainedId: Map<string, CompactionEvent[]>;
  /** System prompts and tool definitions that replaced, or were replaced by, another version. */
  versionByItemId: Map<string, ItemVersion>;
}

export interface InteractionState {
  hoveredCallIndex: number | null;
  pinnedCallIndex: number | null;
  hoveredItemId: string | null;
  selectedItemId: string | null;
}
