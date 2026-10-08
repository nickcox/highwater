export type ContextItemKind =
  | 'system'
  | 'toolDefinition'
  | 'userMessage'
  | 'assistantMessage'
  | 'toolResult'
  | 'compactionSummary'
  | 'customMessage'
  | 'branchSummary'
  | 'other';

export type ChartUnit = 'calculatedTokens' | 'estimatedTokens' | 'unavailable';
export type TokenizationMethod =
  'modelTokenizer' | 'apiSerializationEstimate' | 'characterHeuristic' | 'unavailable';
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

export interface Usage {
  input: number | null;
  output: number | null;
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
  age: CallAgeMetrics;
}

export interface CallTiming {
  startedAtMs: number | null;
  recordedAtMs: number | null;
  durationMs: number | null;
  effectiveOutputTokensPerSecond: number | null;
  basis: 'pi-message-timestamps' | null;
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
  tokenizationProfileId: string | null;
  tokenAnalysis: CallTokenAnalysis;
  economics: CallEconomics;
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

export interface SessionSummary {
  id: string;
  source: string;
  title: string | null;
  workingDirectory: string | null;
  reportedPromptTokens: number | null;
  reportedCompletionTokens: number | null;
  reportedReasoningTokens: number | null;
  reportedCostTotal: number | null;
  reportedUsageCompleteness: UsageCompleteness;
  calculatedTokenTurns: number | null;
  calculatedTokenTurnsCoverage: CoverageSummary;
  peakCalculatedVisibleTokens: number | null;
  reconciliationCompleteCalls: number;
  reconciliationComparableCalls: number;
  medianAbsoluteResidualPercent: number | null;
  maximumAbsoluteResidualPercent: number | null;
  negativeResidualCalls: number;
  missingProviderUsageCalls: number;
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
}

export interface InteractionState {
  hoveredCallIndex: number | null;
  pinnedCallIndex: number | null;
  hoveredItemId: string | null;
  selectedItemId: string | null;
}
