import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from './testing/wire-analysis';
import { indexAnalysis } from './analysis';
import { testAnalysis } from './context-river/test-data';

function withRepeatedCompactions() {
  const analysis = testAnalysis();
  const summary = analysis.contextItems.find((item) => item.id === 'summary')!;
  const retained = analysis.contextItems.find((item) => item.id === 'retained')!;
  const summaryAlt = {
    ...summary,
    id: 'summary-alt',
    sourceRecordId: 'summary-alt-entry',
    label: 'Another compaction summary',
  };
  const summary2 = {
    ...summary,
    id: 'summary2',
    sourceRecordId: 'summary2-entry',
    firstModelCall: 5,
    lastModelCall: 5,
    presence: [{ startCall: 5, endCall: 5 }],
    presenceCallCount: 1,
  };
  analysis.contextItems.push(summaryAlt, summary2);

  const thirdCall = analysis.modelCalls[2];
  thirdCall.contextItemIds = ['summary', 'summary-alt', 'retained'];
  thirdCall.addedItemIds = ['summary', 'summary-alt'];
  thirdCall.transitionItemCounts = { added: 2, retained: 1, dropped: 1 };

  const fourthCall = analysis.modelCalls[3];
  fourthCall.contextItemIds = ['summary', 'summary-alt', 'retained', 'gap'];
  fourthCall.addedItemIds = ['gap'];
  fourthCall.droppedItemIds = [];
  fourthCall.transitionItemCounts = { added: 1, retained: 3, dropped: 0 };

  retained.lastModelCall = 5;
  retained.presence = [{ startCall: 2, endCall: 5 }];
  retained.presenceCallCount = 4;
  analysis.modelCalls.push({
    ...fourthCall,
    index: 5,
    sourceRecordId: 'call5',
    contextItemIds: ['summary2', 'retained'],
    addedItemIds: ['summary2'],
    droppedItemIds: ['summary', 'summary-alt', 'gap'],
    transitionItemCounts: { added: 1, retained: 1, dropped: 3 },
    compactionBefore: 'compact-2',
  });
  analysis.compactions.push(
    {
      id: 'compact-1b',
      beforeModelCall: 3,
      sourceItemIds: ['a'],
      retainedItemIds: ['retained'],
      summaryItemId: 'summary-alt',
      tokensBefore: 100,
    },
    {
      id: 'compact-2',
      beforeModelCall: 5,
      sourceItemIds: ['summary', 'summary-alt', 'gap'],
      retainedItemIds: ['retained'],
      summaryItemId: 'summary2',
      tokensBefore: 40,
    },
  );
  return analysis;
}

/**
 * Unrecorded request context and an Environment attachment in calls 1–2, removed by the
 * compaction and sent again from call 3, as Claude Code does.
 */
function withHarnessItemsResent({ sentTwice = false } = {}) {
  const analysis = testAnalysis();
  const gap = analysis.contextItems.find((item) => item.id === 'gap')!;
  const harnessItem = (
    id: string,
    kind: 'unrecordedContext' | 'customMessage',
    label: string,
    first: number,
    last = first + 1,
  ) => ({
    ...gap,
    id,
    kind,
    label,
    sourceRecordId: `${id}-entry`,
    firstModelCall: first,
    lastModelCall: last,
    presence: [{ startCall: first, endCall: last }],
    presenceCallCount: last - first + 1,
  });
  analysis.contextItems.push(
    harnessItem('context-1', 'unrecordedContext', 'Unrecorded request context · 100 tokens', 1),
    harnessItem('env-1', 'customMessage', 'Environment', 1),
    harnessItem('context-2', 'unrecordedContext', 'Unrecorded request context · 90 tokens', 3),
    harnessItem('env-2', 'customMessage', 'Environment', 3),
  );
  const [first, second, third, fourth] = analysis.modelCalls;
  first!.contextItemIds = ['context-1', 'a', 'gap', 'env-1'];
  second!.contextItemIds = ['context-1', 'a', 'retained', 'env-1'];
  third!.contextItemIds = ['context-2', 'summary', 'retained', 'env-2'];
  fourth!.contextItemIds = ['context-2', 'summary', 'retained', 'env-2', 'gap'];
  analysis.compactions[0]!.sourceItemIds = ['context-1', 'a', 'env-1'];
  if (sentTwice) {
    analysis.contextItems.push(harnessItem('env-1b', 'customMessage', 'Environment', 2, 2));
    second!.contextItemIds.push('env-1b');
    analysis.compactions[0]!.sourceItemIds.push('env-1b');
  }
  let previous: string[] = [];
  for (const call of analysis.modelCalls) {
    call.addedItemIds = call.contextItemIds.filter((id) => !previous.includes(id));
    call.droppedItemIds = previous.filter((id) => !call.contextItemIds.includes(id));
    call.transitionItemCounts = {
      added: call.addedItemIds.length,
      retained: call.contextItemIds.length - call.addedItemIds.length,
      dropped: call.droppedItemIds.length,
    };
    previous = call.contextItemIds;
  }
  return analysis;
}

describe('production context-item ordering', () => {
  it('keeps unrecorded request context and resent attachments in place across a compaction', () => {
    const indexed = indexTestAnalysis(withHarnessItemsResent());

    expect(indexed.orderedItemIdsByCall.get(1)).toEqual(['context-1', 'a', 'gap', 'env-1']);
    expect(indexed.orderedItemIdsByCall.get(3)).toEqual([
      'context-2',
      'summary',
      'env-2',
      'retained',
    ]);
  });

  it('places a resent attachment where the earliest removed copy of it was', () => {
    const indexed = indexTestAnalysis(withHarnessItemsResent({ sentTwice: true }));

    expect(indexed.orderedItemIdsByCall.get(2)).toEqual([
      'context-1',
      'a',
      'env-1',
      'retained',
      'env-1b',
    ]);
    expect(indexed.orderedItemIdsByCall.get(3)).toEqual([
      'context-2',
      'summary',
      'env-2',
      'retained',
    ]);
  });

  it('is deterministic when API item and compaction arrays are shuffled', () => {
    const original = testAnalysis();
    const shuffled = testAnalysis();
    shuffled.contextItems.reverse();
    shuffled.compactions.reverse();
    shuffled.modelCalls.reverse();

    const orderedByCall = (value: ReturnType<typeof indexAnalysis>) => [
      ...value.orderedItemIdsByCall.entries(),
    ];
    expect(orderedByCall(indexTestAnalysis(shuffled))).toEqual(
      orderedByCall(indexTestAnalysis(original)),
    );
  });

  it('keeps retained relative order and places a summary near its source in production indexes', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    expect(indexed.orderedItemIdsByCall.get(1)).toEqual(['a', 'gap']);
    expect(indexed.orderedItemIdsByCall.get(3)).toEqual(['summary', 'retained']);
    expect(indexed.orderedItemIdsByCall.get(4)).toEqual(['summary', 'gap', 'retained']);
  });

  it('propagates repeated-compaction ranks and uses ID order for deterministic ties', () => {
    const analysis = withRepeatedCompactions();
    const tiedSummariesReversed = withRepeatedCompactions();
    tiedSummariesReversed.contextItems.reverse();
    tiedSummariesReversed.compactions.reverse();
    const indexed = indexTestAnalysis(analysis);
    const reversed = indexTestAnalysis(tiedSummariesReversed);

    expect(indexed.orderedItemIdsByCall.get(3)).toEqual(['summary', 'summary-alt', 'retained']);
    expect(indexed.orderedItemIdsByCall.get(5)).toEqual(['summary2', 'retained']);
    expect([...indexed.orderedItemIdsByCall.entries()]).toEqual([
      ...reversed.orderedItemIdsByCall.entries(),
    ]);
  });
});
