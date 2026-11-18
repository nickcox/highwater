import { AnalysisValidationError } from './analysis-validation';
import type { CompactionDetails, CompactionEvent } from './types';

const TRIGGERS = new Set(['automatic', 'manual']);
const RULES = new Set([
  'keptFromEntry',
  'recentExchange',
  'preservedSegment',
  'summaryOnly',
  'replacementHistory',
  'keptLastMessages',
  'inferredFromInput',
]);
const COUNTS = [
  'durationMs',
  'messagesBefore',
  'messagesRemoved',
  'messagesKept',
  'messagesAddedWhileRunning',
  'tokensAfter',
  'systemTokensAfter',
  'toolDefinitionTokensAfter',
  'conversationTokensAfter',
] as const;

/** Details for a compaction the harness recorded nothing more about. */
export function emptyCompactionDetails(): CompactionDetails {
  return {
    trigger: null,
    instructions: null,
    rule: null,
    startedBeforeModelCall: null,
    summaryCall: null,
    durationMs: null,
    messagesBefore: null,
    messagesRemoved: null,
    messagesKept: null,
    messagesAddedWhileRunning: null,
    tokensAfter: null,
    systemTokensAfter: null,
    toolDefinitionTokensAfter: null,
    conversationTokensAfter: null,
  };
}

/** Checks the details the server sends with a compaction: known codes, safe counts, a start
 * no later than the call the compaction is applied before, and a summary call that exists. */
export function assertCompactionDetails(
  compaction: CompactionEvent,
  callIndexes: ReadonlySet<number>,
): void {
  const details = compaction.details;
  const fail = (what: string) => {
    throw new AnalysisValidationError(`Compaction ${compaction.id} has ${what}`);
  };
  if (!details || typeof details !== 'object') return fail('no details');
  if (details.trigger !== null && !TRIGGERS.has(details.trigger)) fail('an unknown trigger');
  if (details.rule !== null && !RULES.has(details.rule)) fail('an unknown rule');
  if (details.instructions !== null && typeof details.instructions !== 'string')
    fail('invalid instructions');
  for (const key of COUNTS) {
    const value = details[key];
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) fail(`an invalid ${key}`);
  }
  const start = details.startedBeforeModelCall;
  if (
    start !== null &&
    (!Number.isSafeInteger(start) || start < 1 || start > compaction.beforeModelCall)
  )
    fail('a start after it is applied');
  if (details.summaryCall !== null && !callIndexes.has(details.summaryCall))
    fail('an unknown summary call');
}
