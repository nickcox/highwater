import type { SessionAnalysis } from './types';
import { AnalysisValidationError } from './analysis-validation';

export const reconstructionLimitLabels: Record<string, string> = {
  missingHistoricalSystemPrompt: 'Historical system instructions are not recorded completely.',
  missingHistoricalToolDefinitions: 'Historical tool declarations are not recorded completely.',
  unrecordedRequestTransforms: 'Plugins and provider request transformations may not be recorded.',
  unknownOutputAccounting:
    'Output/reasoning overlap is unverified; recorded counters are kept separate.',
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
  unrecordedHarnessCalls:
    "The harness's own model calls, such as title generation and compaction, are not recorded.",
  inferredUnsentHistory:
    "A forked or spawned thread's first call reported far less input than its parent's history, so the oldest inherited items are shown as not sent. Where that history ends was inferred from usage.",
  inferredContextReset:
    'At the start of a turn the reported input fell far below the calculated context with no compaction recorded, so the earlier conversation is shown as reset. This was inferred from usage.',
  unverifiedCompactionRetention:
    'A compaction does not record which recent messages it kept; only its summary is carried forward.',
  unrenderedAttachments:
    'Some context the harness added was recorded without its text, so its size is unknown.',
  unrecordedRounds:
    "A request that was stopped or interrupted recorded its model calls as one, so its calls' context and output are not split.",
  traceRecordsIncomplete:
    'Some calls have no Copilot trace record (Copilot keeps them for a few days), so they show only what the session file records: no per-call usage, timing, system prompt or tools.',
  traceRecordsUnreadable:
    "Copilot's trace database could not be read, so calls show only what the session file records.",
  repairedCompactionLink:
    'A compaction marker named a later record as its predecessor; the conversation was continued from the record before the marker.',
};

/** Sources whose analyses must always carry a reconstruction coverage notice. */
const PARTIAL_SOURCES = new Set(['opencode', 'claude-code', 'codex', 'vscode-copilot']);

export function assertReconstruction(analysis: SessionAnalysis): void {
  const coverage = analysis.reconstruction;
  if (coverage === undefined && !PARTIAL_SOURCES.has(analysis.session.source)) return;
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
