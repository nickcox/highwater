import { describe, expect, it } from 'vitest';
import { AnalysisValidationError } from './analysis-validation';
import { assertCompactionDetails, emptyCompactionDetails } from './compaction-details';
import type { CompactionDetails, CompactionEvent } from './types';

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
