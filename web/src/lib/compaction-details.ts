import { AnalysisValidationError } from './analysis-validation';
import { responseDuration } from './components/call-timing';
import { formatCost, formatInteger, formatMetric } from './context-river/format';
import { harnessName } from './cost-assessment';
import type { CompactionDetails, CompactionEvent, ModelCall } from './types';

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

/** One row of the compaction panel. */
export interface CompactionRow {
  label: string;
  value: string;
}

/** What the compaction panel shows: one sentence on how the harness decided what to keep,
 * rows of what it recorded, and its own call, if recorded. */
export interface CompactionPanel {
  rule: string | null;
  rows: CompactionRow[];
  summaryCall: ModelCall | null;
}

const plural = (count: number, one: string, many: string) =>
  `${formatInteger(count)} ${count === 1 ? one : many}`;

/** The rule as a sentence, with the numbers filled in. `retained` is how many of Highwater's
 * items the compaction kept. */
export function compactionRuleSentence(compaction: CompactionEvent, source: string): string | null {
  const harness = harnessName(source);
  const details = compaction.details;
  const retained = compaction.retainedItemIds.length;
  switch (details.rule) {
    case 'keptLastMessages': {
      const kept = details.messagesKept ?? 0;
      const added = details.messagesAddedWhileRunning;
      return (
        `${harness} kept the last ${plural(kept, 'message', 'messages')} from when the compaction started` +
        (added ? `, and the ${plural(added, 'message', 'messages')} added while it ran.` : '.')
      );
    }
    case 'keptFromEntry':
      return `${harness} kept everything from the first entry it marked to keep: ${plural(retained, 'item', 'items')}.`;
    case 'preservedSegment':
      return `${harness} kept the recent messages it recorded as preserved: ${plural(details.messagesKept ?? retained, 'message', 'messages')}.`;
    case 'recentExchange':
      return `${harness} kept its summary and the recent exchange it saved with it, as one item.`;
    case 'replacementHistory':
      return `${harness} recorded the conversation that replaced the old one; ${plural(retained, 'item', 'items')} in it were already in context.`;
    case 'summaryOnly':
      return `${harness} kept only its summary.`;
    case 'inferredFromInput':
      return `${harness} does not record what it kept, so this was worked out from the next call's input.`;
    default:
      return null;
  }
}

/** The panel for a compaction, from its details and the session's calls. */
export function compactionPanel(
  compaction: CompactionEvent,
  source: string,
  callByIndex: ReadonlyMap<number, ModelCall>,
): CompactionPanel {
  const details = compaction.details;
  const harness = harnessName(source);
  const rows: CompactionRow[] = [];
  if (details.trigger)
    rows.push({
      label: 'Started',
      value:
        details.trigger === 'manual'
          ? details.instructions
            ? `By the user, with the focus “${details.instructions}”`
            : 'By the user'
          : `Automatically by ${harness}`,
    });
  rows.push({
    label: 'When',
    value:
      details.startedBeforeModelCall !== null &&
      details.startedBeforeModelCall < compaction.beforeModelCall
        ? `Started before call ${details.startedBeforeModelCall} and ran in the background; applied before call ${compaction.beforeModelCall}`
        : `Before call ${compaction.beforeModelCall}`,
  });
  if (details.durationMs !== null)
    rows.push({ label: 'Took', value: responseDuration(details.durationMs) });
  rows.push({
    label: 'Items',
    value: `${formatInteger(compaction.sourceItemIds.length)} removed · ${formatInteger(compaction.retainedItemIds.length)} kept`,
  });
  if (details.messagesBefore !== null || details.messagesRemoved !== null) {
    const parts = [
      details.messagesBefore !== null && `${formatInteger(details.messagesBefore)} before`,
      details.messagesRemoved !== null && `${formatInteger(details.messagesRemoved)} removed`,
      details.messagesKept !== null && `${formatInteger(details.messagesKept)} kept`,
    ].filter(Boolean);
    rows.push({ label: `Messages, as ${harness} counts them`, value: parts.join(' · ') });
  } else if (details.messagesKept !== null) {
    rows.push({
      label: `Messages, as ${harness} counts them`,
      value: `${formatInteger(details.messagesKept)} kept`,
    });
  }
  if (compaction.tokensBefore !== null || details.tokensAfter !== null)
    rows.push({
      label: `Tokens, as ${harness} counts them`,
      value: [
        compaction.tokensBefore !== null && `${formatInteger(compaction.tokensBefore)} before`,
        details.tokensAfter !== null && `${formatInteger(details.tokensAfter)} after`,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  const after = [
    details.systemTokensAfter !== null &&
      `${formatInteger(details.systemTokensAfter)} system prompt`,
    details.toolDefinitionTokensAfter !== null &&
      `${formatInteger(details.toolDefinitionTokensAfter)} tool definitions`,
    details.conversationTokensAfter !== null &&
      `${formatInteger(details.conversationTokensAfter)} conversation`,
  ].filter(Boolean);
  if (after.length > 0) rows.push({ label: 'After it, in tokens', value: after.join(' · ') });
  const summaryCall =
    details.summaryCall !== null ? (callByIndex.get(details.summaryCall) ?? null) : null;
  rows.push({
    label: 'Its own call',
    value: summaryCall
      ? `Call ${summaryCall.index} · ${formatMetric(summaryCall.reportedPromptTokens)} input · ${formatCost(summaryCall.costAssessment.amount)}`
      : `Not recorded by ${harness}`,
  });
  return { rule: compactionRuleSentence(compaction, source), rows, summaryCall };
}
