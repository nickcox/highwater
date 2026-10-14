import type { IndexedAnalysis, SessionAnalysis } from './types';
import { describeTokenDiagnostic } from './diagnostics';
import { summarizeInputComparisons } from './context-river/reported-input';
import { reconstructionLimitLabels } from './reconstruction';
import { formatInteger, formatMetric, formatPercent } from './context-river/format';

export type EstimateLevel = 'good' | 'partial' | 'rough' | 'unavailable';

/** How far the River's token estimates can be trusted, for one indicator and its "Why?" note. */
export interface EstimateSummary {
  level: EstimateLevel;
  /** For example "Estimates: good". */
  label: string;
  /** The main evidence for the level. */
  lead: string;
  /** Everything else that affects the estimates in this session, in plain language. */
  reasons: string[];
}

/** Median gap between the River's totals and the reported input, as a share of the input. */
const GOOD_GAP = 0.02;
const PARTIAL_GAP = 0.1;

const METHOD_REASONS: Record<string, string> = {
  modelTokenizer: "Tokens are counted with the model's own tokenizer.",
  apiSerializationEstimate:
    "Tokens are counted with a reconstruction of the model's tokenizer, and the request format around them is estimated.",
  characterHeuristic: 'Some tokens are estimated from character counts, which is rough.',
};

const UNAVAILABLE_REASONS: Record<string, string> = {
  tokenizationDisabled: 'Token counting is turned off for this server.',
  'one-or-more-context-items-unavailable': 'Some context items have no content to count.',
};

function gapEvidence(indexed: IndexedAnalysis): { share: number; lead: string } | null {
  const { session } = indexed.analysis;
  if (session.reconciliationComparableCalls > 0 && session.medianAbsoluteResidualPercent !== null) {
    const share = session.medianAbsoluteResidualPercent;
    return {
      share,
      lead: `On median, the River's totals differ from the input the provider reported by ${formatPercent(share)}, across ${formatInteger(session.reconciliationComparableCalls)} calls.`,
    };
  }
  const comparison = summarizeInputComparisons(indexed);
  if (comparison.medianGapShare === null) return null;
  const largest =
    comparison.maximumGap === null
      ? ''
      : ` The largest gap is ${formatMetric(comparison.maximumGap)} tokens.`;
  return {
    share: comparison.medianGapShare,
    lead: `On median, the River's totals differ from the input the provider reported by ${formatPercent(comparison.medianGapShare)}, across ${formatInteger(comparison.comparedCalls)} calls.${largest}`,
  };
}

/** Call explanations that apply to every call: they describe the session, so the estimate-quality
 * note gives them once and each call's inspector leaves them out. */
export function sessionWideExplanationCodes(analysis: SessionAnalysis): Set<string> {
  const [first, ...rest] = analysis.modelCalls;
  if (!first || rest.length === 0) return new Set();
  return new Set(
    first.tokenAnalysis.explanationCodes.filter((code) =>
      rest.every((call) => call.tokenAnalysis.explanationCodes.includes(code)),
    ),
  );
}

/** Session-wide explanations another reason in the note already covers. */
function coveredElsewhere(code: string, analysis: SessionAnalysis): boolean {
  if (code === 'heuristicTokenizer' || code === 'estimatedProviderSerialization') return true;
  if (code === 'knownFramingOverheadAvailable') return true;
  if (code === 'missingSystemPrompt' || code === 'missingToolDefinitions') {
    return (
      analysis.contextItems.some((item) => item.kind === 'unrecordedContext') ||
      (analysis.reconstruction?.explanationCodes ?? []).some((limit) =>
        limit.startsWith('missingHistorical'),
      )
    );
  }
  return false;
}

export function estimateSummary(indexed: IndexedAnalysis): EstimateSummary {
  const { analysis } = indexed;
  const { tokenAnalysis } = analysis;
  const reasons = (analysis.reconstruction?.explanationCodes ?? [])
    .map((code) => reconstructionLimitLabels[code])
    .filter((reason): reason is string => Boolean(reason));

  if (analysis.displayWeightUnit === 'unavailable') {
    const fallback = UNAVAILABLE_REASONS[tokenAnalysis.fallbackReason ?? ''];
    return {
      level: 'unavailable',
      label: 'Estimates: unavailable',
      lead: "Token sizes aren't available for this session, so the River shows every item at the same placeholder size.",
      reasons: fallback ? [fallback, ...reasons] : reasons,
    };
  }

  if (analysis.contextItems.some((item) => item.kind === 'unrecordedContext')) {
    reasons.push(
      'Content the source does not record, such as the system prompt and tool definitions, is measured from reported usage as "Unrecorded request context".',
    );
  }
  const coverage = tokenAnalysis.itemEstimateCoverage;
  if (coverage.partialItems > 0) {
    reasons.push(
      `${formatInteger(coverage.partialItems)} of ${formatInteger(coverage.totalItems)} items have only part of their content counted.`,
    );
  }
  if (coverage.unavailableItems > 0) {
    reasons.push(
      `${formatInteger(coverage.unavailableItems)} of ${formatInteger(coverage.totalItems)} items could not be counted.`,
    );
  }
  const methods = Object.keys(tokenAnalysis.tokenizerMethods);
  for (const method of methods) {
    const reason = METHOD_REASONS[method];
    if (reason) reasons.push(reason);
  }
  for (const code of sessionWideExplanationCodes(analysis)) {
    const description = describeTokenDiagnostic(code);
    if (description && !coveredElsewhere(code, analysis)) {
      reasons.push(`${description.title}. ${description.impact}`);
    }
  }

  const evidence = gapEvidence(indexed);
  let level: EstimateLevel;
  let lead: string;
  if (evidence) {
    level =
      evidence.share <= GOOD_GAP ? 'good' : evidence.share <= PARTIAL_GAP ? 'partial' : 'rough';
    lead = evidence.lead;
  } else {
    const complete = coverage.partialItems === 0 && coverage.unavailableItems === 0;
    level = methods.includes('characterHeuristic')
      ? 'rough'
      : complete && methods.every((method) => method === 'modelTokenizer')
        ? 'good'
        : 'partial';
    lead =
      'No call has reported input to compare against, so this is based on how the tokens were counted.';
  }
  return { level, label: `Estimates: ${level}`, lead, reasons };
}
