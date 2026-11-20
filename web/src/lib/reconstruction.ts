import type { SessionAnalysis } from './types';
import { AnalysisValidationError } from './analysis-validation';

const chatFileOnly =
  'Showing what the chat session file recorded. Per-call timing and detailed token usage are unavailable; system prompt and tool definition details may be incomplete.';
const copilotTraceNotes = {
  traceRecordsUnavailable: { title: 'No matching call traces', detail: chatFileOnly },
  traceRecordsIncomplete: {
    title: 'Some calls have no matching trace',
    detail:
      'For those calls, the chat session file supplies what it recorded. Timing and detailed token usage are unavailable, and system prompt and tool definition details may be incomplete.',
  },
  traceRecordsUnreadable: {
    title: 'Could not read the Copilot trace database',
    detail: chatFileOnly,
  },
} as const;

export function copilotTraceNotice(analysis: SessionAnalysis) {
  if (analysis.session.source !== 'vscode-copilot') return null;
  const codes = analysis.reconstruction?.explanationCodes ?? [];
  for (const code of [
    'traceRecordsUnreadable',
    'traceRecordsUnavailable',
    'traceRecordsIncomplete',
  ] as const) {
    if (codes.includes(code))
      return { ...copilotTraceNotes[code], unreadable: code === 'traceRecordsUnreadable' };
  }
  return null;
}

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
    copilotTraceNotes.traceRecordsIncomplete.title +
    '. ' +
    copilotTraceNotes.traceRecordsIncomplete.detail,
  traceRecordsUnavailable: copilotTraceNotes.traceRecordsUnavailable.title + '. ' + chatFileOnly,
  traceRecordsUnreadable: copilotTraceNotes.traceRecordsUnreadable.title + '. ' + chatFileOnly,
  subagentCallsNotShown:
    "Subagents' model calls are recorded in the session's file but are not shown.",
  repairedCompactionLink:
    'A compaction marker named a later or missing record as its predecessor; the conversation was continued from the record before the marker.',
};

/** Sources whose analyses must always carry a reconstruction coverage notice. */
const PARTIAL_SOURCES = new Set(['opencode', 'claude-code', 'codex', 'copilot', 'vscode-copilot']);

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
