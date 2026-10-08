import type { SessionAnalysis } from './types';
import { AnalysisValidationError } from './analysis-validation';

export const reconstructionLimitLabels: Record<string, string> = {
  missingHistoricalSystemPrompt: 'Historical system instructions are not recorded completely.',
  missingHistoricalToolDefinitions: 'Historical tool declarations are not recorded completely.',
  unrecordedRequestTransforms: 'Plugins and provider request transformations may not be recorded.',
  unknownOutputAccounting:
    'Output/reasoning overlap is unverified; ambiguous output totals are unavailable.',
  unknownCompactionPrompt:
    'The exact prompt used to generate a compaction summary is not recorded.',
  unpairedCompactionSummary:
    'A summary has no matching compaction marker; no history reset was inferred.',
  ambiguousPruningBoundary:
    'A tool-result pruning boundary cannot be ordered precisely against a call.',
  unsupportedContent:
    'Some recorded content or attachments cannot be projected into model context.',
  storageGenerationSelection:
    'One storage generation was selected using recorded recency and projection availability.',
  aggregatedCompactionUsage:
    'A compaction billing record may aggregate multiple requests; request count and input exposure are unknown.',
  missingCompactionUsage:
    'Some compaction records have no request usage; session usage totals may be incomplete.',
  projectedRequestBoundaries:
    'Migrated assistant records may omit original request boundaries or include synthetic attempts.',
};

export function assertReconstruction(analysis: SessionAnalysis): void {
  const coverage = analysis.reconstruction;
  if (coverage === undefined && analysis.session.source !== 'opencode') return;
  if (
    !coverage ||
    coverage.status !== 'partial' ||
    !Array.isArray(coverage.explanationCodes) ||
    coverage.explanationCodes.length === 0 ||
    coverage.explanationCodes.length > 32 ||
    coverage.explanationCodes.some(
      (code) =>
        typeof code !== 'string' ||
        !Object.prototype.hasOwnProperty.call(reconstructionLimitLabels, code),
    ) ||
    new Set(coverage.explanationCodes).size !== coverage.explanationCodes.length
  )
    throw new AnalysisValidationError(
      'Analysis has invalid or missing source reconstruction coverage',
    );
}
