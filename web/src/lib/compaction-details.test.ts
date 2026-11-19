import { describe, expect, it } from 'vitest';
import { AnalysisValidationError } from './analysis-validation';
import {
  assertCompactionDetails,
  compactionPanel,
  compactionRuleSentence,
  emptyCompactionDetails,
} from './compaction-details';
import type { CompactionDetails, CompactionEvent, ModelCall } from './types';

function compaction(details: Partial<CompactionDetails>): CompactionEvent {
  return {
    id: 'c1',
    beforeModelCall: 4,
    sourceItemIds: [],
    retainedItemIds: [],
    summaryItemId: 'summary',
    tokensBefore: null,
    details: { ...emptyCompactionDetails(), ...details },
  };
}

const calls = new Set([1, 2, 3, 4]);

describe('assertCompactionDetails', () => {
  it('accepts empty details and every recorded field', () => {
    expect(() => assertCompactionDetails(compaction({}), calls)).not.toThrow();
    expect(() =>
      assertCompactionDetails(
        compaction({
          trigger: 'manual',
          instructions: 'Keep the plan',
          rule: 'keptLastMessages',
          startedBeforeModelCall: 2,
          summaryCall: 3,
          durationMs: 56_808,
          messagesBefore: 163,
          messagesRemoved: 157,
          tokensAfter: 56_958,
        }),
        calls,
      ),
    ).not.toThrow();
  });

  it.each([
    ['an unknown trigger', { trigger: 'scheduled' as CompactionDetails['trigger'] }],
    ['an unknown rule', { rule: 'guess' as CompactionDetails['rule'] }],
    ['a start after it is applied', { startedBeforeModelCall: 5 }],
    ['an unknown summary call', { summaryCall: 9 }],
    ['an invalid messagesRemoved', { messagesRemoved: -1 }],
    ['an invalid tokensAfter', { tokensAfter: 1.5 }],
  ])('rejects %s', (what, details) => {
    expect(() => assertCompactionDetails(compaction(details), calls)).toThrow(
      new AnalysisValidationError(`Compaction c1 has ${what}`),
    );
  });

  it('rejects a compaction without details', () => {
    const missing = { ...compaction({}), details: undefined } as unknown as CompactionEvent;
    expect(() => assertCompactionDetails(missing, calls)).toThrow(AnalysisValidationError);
  });
});

describe('compactionRuleSentence', () => {
  it.each([
    [
      'copilot',
      { rule: 'keptLastMessages', messagesKept: 6, messagesAddedWhileRunning: 4 },
      'Copilot kept the last 6 messages from when the compaction started, and the 4 messages added while it ran.',
    ],
    [
      'copilot',
      { rule: 'keptLastMessages', messagesKept: 1 },
      'Copilot kept the last 1 message from when the compaction started.',
    ],
    [
      'pi',
      { rule: 'keptFromEntry' },
      'Pi kept everything from the first entry it marked to keep: 0 items.',
    ],
    [
      'claude-code',
      { rule: 'preservedSegment', messagesKept: 4 },
      'Claude Code kept the recent messages it recorded as preserved: 4 messages.',
    ],
    ['claude-code', { rule: 'summaryOnly' }, 'Claude Code kept only its summary.'],
    [
      'vscode-copilot',
      { rule: 'inferredFromInput' },
      "VS Code Copilot does not record what it kept, so this was worked out from the next call's input.",
    ],
    ['codex', {}, null],
  ] as const)('describes %s with %o', (source, details, expected) => {
    expect(compactionRuleSentence(compaction(details as Partial<CompactionDetails>), source)).toBe(
      expected,
    );
  });
});

describe('compactionPanel', () => {
  it('lists what the harness recorded and its own call', () => {
    const call = {
      index: 3,
      reportedPromptTokens: 216_978,
      costAssessment: { amount: 1.95 },
    } as unknown as ModelCall;
    const panel = compactionPanel(
      compaction({
        trigger: 'automatic',
        rule: 'keptLastMessages',
        startedBeforeModelCall: 2,
        summaryCall: 3,
        durationMs: 56_808,
        messagesBefore: 163,
        messagesRemoved: 157,
        messagesKept: 6,
        tokensAfter: 56_958,
        conversationTokensAfter: 6_592,
      }),
      'copilot',
      new Map([[3, call]]),
    );
    expect(panel.summaryCall).toBe(call);
    expect(Object.fromEntries(panel.rows.map((row) => [row.label, row.value]))).toMatchObject({
      Started: 'Automatically by Copilot',
      When: 'Started before call 2 and ran in the background; applied before call 4',
      'Messages, as Copilot counts them': '163 before · 157 removed · 6 kept',
      'Tokens, as Copilot counts them': '56,958 after',
      'After it, in tokens': '6,592 conversation',
      'Its own call': 'Call 3 · 217K input · $1.95',
    });
  });

  it('says what is not recorded, and names a manual focus', () => {
    const panel = compactionPanel(
      compaction({ trigger: 'manual', instructions: 'Keep the plan' }),
      'claude-code',
      new Map(),
    );
    const rows = Object.fromEntries(panel.rows.map((row) => [row.label, row.value]));
    expect(rows.Started).toBe('By the user, with the focus “Keep the plan”');
    expect(rows.When).toBe('Before call 4');
    expect(rows['Its own call']).toBe('Not recorded by Claude Code');
    expect(rows).not.toHaveProperty('Took');
  });
});
