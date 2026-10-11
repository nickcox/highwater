import type {
  ContextItemKind,
  IndexedAnalysis,
  ModelCall,
  RecordedCallCoverage,
  SessionAnalysis,
  WireSessionAnalysis,
} from './types';
import { AnalysisValidationError } from './analysis-validation';
import { assertEconomicsSummary } from './economics-validation';
import { assertCallTiming } from './timing-validation';
import { assertCostAssessment, assertCostSummary } from './cost-validation';
import { assertReconstruction } from './reconstruction';
import { validateAndIndexAnalysis } from './analysis-structure';
export { AnalysisValidationError } from './analysis-validation';

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

function normalizedKind(kind: string): ContextItemKind {
  return KNOWN_KINDS.has(kind as ContextItemKind) ? (kind as ContextItemKind) : 'other';
}

export const ANALYSIS_SCHEMA_VERSION = 13;

/** Replace per-call item positions with the IDs they refer to. The arrays
 * reference the existing `item.id` strings, so this adds no string copies. */
function resolveItemPositions(input: WireSessionAnalysis): SessionAnalysis {
  const ids = input.contextItems.map((item) => item.id);
  const resolve = (indexes: unknown, callIndex: number, field: string): string[] => {
    if (!Array.isArray(indexes)) {
      throw new AnalysisValidationError(`Model call ${callIndex} has no ${field} list`);
    }
    return indexes.map((position: unknown) => {
      if (
        typeof position !== 'number' ||
        !Number.isSafeInteger(position) ||
        position < 0 ||
        position >= ids.length
      ) {
        throw new AnalysisValidationError(
          `Model call ${callIndex} ${field} references an unknown item position`,
        );
      }
      return ids[position];
    });
  };
  const resolvedFields: Record<string, string> = {
    contextItemIndexes: 'contextItemIds',
    addedItemIndexes: 'addedItemIds',
    droppedItemIndexes: 'droppedItemIds',
  };
  return {
    ...input,
    // Keep each field in its original position so the resolved call has the
    // same shape as before positions were introduced.
    modelCalls: input.modelCalls.map(
      (call) =>
        Object.fromEntries(
          Object.entries(call).map(([key, value]) =>
            key in resolvedFields
              ? [resolvedFields[key], resolve(value, call.index, key)]
              : [key, value],
          ),
        ) as unknown as ModelCall,
    ),
  };
}

function validateEnvelope(input: SessionAnalysis): void {
  if (input.displayWeightUnit !== input.tokenAnalysis.chartUnit) {
    throw new AnalysisValidationError('Chart unit disagrees with token-analysis metadata');
  }
  if (!['calculatedTokens', 'estimatedTokens', 'unavailable'].includes(input.displayWeightUnit)) {
    throw new AnalysisValidationError(`Unsupported chart unit ${String(input.displayWeightUnit)}`);
  }
  assertReconstruction(input);
  for (const call of input.modelCalls) {
    if (typeof call.tokenAnalysis.metricsIncludePartialEstimates !== 'boolean') {
      throw new AnalysisValidationError(
        `Model call ${call.index} does not say whether its metrics include partial estimates`,
      );
    }
  }
  assertEconomicsSummary(input.economics, input.modelCalls);
  input.modelCalls.forEach((call) => assertCallTiming(call, input.session.source === 'pi'));
  input.modelCalls.forEach(assertCostAssessment);
  assertCostSummary(input.session.costSummary);
  if (
    input.session.reportedCostTotal !== null &&
    (!Number.isFinite(input.session.reportedCostTotal) || input.session.reportedCostTotal < 0)
  ) {
    throw new AnalysisValidationError('Analysis has an invalid calculated session cost total');
  }
  assertRecordedCallCoverage(input.session.reportedCostCoverage, 'Session cost');
  assertRecordedCallCoverage(input.session.reportedUsageCoverage, 'Session usage');
  if (
    input.session.reportedCostCoverage.recordedCalls === 0 &&
    input.session.reportedCostTotal !== null
  ) {
    throw new AnalysisValidationError('Session cost subtotal has no recorded calls');
  }
  if (
    input.session.reportedUsageCoverage.recordedCalls === 0 &&
    input.session.reportedPromptTokens !== null
  ) {
    throw new AnalysisValidationError('Session prompt subtotal has no recorded calls');
  }
}

function assertRecordedCallCoverage(
  coverage: RecordedCallCoverage | undefined,
  description: string,
): void {
  const counts = coverage
    ? [coverage.recordedCalls, coverage.failedAttemptCalls, coverage.missingCalls]
    : [];
  if (counts.length !== 3 || !counts.every((count) => Number.isSafeInteger(count) && count >= 0)) {
    throw new AnalysisValidationError(`${description} coverage is not a set of call counts`);
  }
}

function normalizeAnalysis(input: SessionAnalysis): SessionAnalysis {
  return {
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
}

/** Types describe the supported envelope, not proof of a fully validated JSON shape.
 * Preserve the existing scalar and relationship checks; broader boundary validation
 * is a separate semantic change, not a consequence of this extraction.
 */
export function indexAnalysis(input: WireSessionAnalysis): IndexedAnalysis {
  if (import.meta.env.DEV && typeof performance !== 'undefined')
    performance.mark('tokenplume-index-start');
  if (input.schemaVersion !== ANALYSIS_SCHEMA_VERSION) {
    throw new AnalysisValidationError(`Unsupported analysis schema ${String(input.schemaVersion)}`);
  }
  const resolved = resolveItemPositions(input);
  validateEnvelope(resolved);
  const analysis = normalizeAnalysis(resolved);
  const indexed = validateAndIndexAnalysis(analysis);
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
