import type { ContextItemKind, IndexedAnalysis, SessionAnalysis } from './types';
import { AnalysisValidationError } from './analysis-validation';
import { assertEconomicsSummary } from './economics-validation';
import { assertCallTiming } from './timing-validation';
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

function validateEnvelope(input: SessionAnalysis): void {
  if (input.schemaVersion !== 8) {
    throw new AnalysisValidationError(`Unsupported analysis schema ${String(input.schemaVersion)}`);
  }
  if (input.displayWeightUnit !== input.tokenAnalysis.chartUnit) {
    throw new AnalysisValidationError('Chart unit disagrees with token-analysis metadata');
  }
  if (!['calculatedTokens', 'estimatedTokens', 'unavailable'].includes(input.displayWeightUnit)) {
    throw new AnalysisValidationError(`Unsupported chart unit ${String(input.displayWeightUnit)}`);
  }
  assertEconomicsSummary(input.economics, input.modelCalls);
  input.modelCalls.forEach((call) => assertCallTiming(call, input.session.source === 'pi'));
  if (
    input.session.reportedCostTotal !== null &&
    (!Number.isFinite(input.session.reportedCostTotal) || input.session.reportedCostTotal < 0)
  ) {
    throw new AnalysisValidationError('Analysis has an invalid calculated session cost total');
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
export function indexAnalysis(input: SessionAnalysis): IndexedAnalysis {
  if (import.meta.env.DEV && typeof performance !== 'undefined')
    performance.mark('tokenplume-index-start');
  validateEnvelope(input);
  const analysis = normalizeAnalysis(input);
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
