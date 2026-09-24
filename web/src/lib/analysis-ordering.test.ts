import { describe, expect, it } from 'vitest';
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

describe('production context-item ordering', () => {
  it('is deterministic when API item and compaction arrays are shuffled', () => {
    const original = testAnalysis();
    const shuffled = testAnalysis();
    shuffled.contextItems.reverse();
    shuffled.compactions.reverse();
    shuffled.modelCalls.reverse();

    const orderedByCall = (value: ReturnType<typeof indexAnalysis>) => [
      ...value.orderedItemIdsByCall.entries(),
    ];
    expect(orderedByCall(indexAnalysis(shuffled))).toEqual(orderedByCall(indexAnalysis(original)));
  });

  it('keeps retained relative order and places a summary near its source in production indexes', () => {
    const indexed = indexAnalysis(testAnalysis());
    expect(indexed.orderedItemIdsByCall.get(1)).toEqual(['a', 'gap']);
    expect(indexed.orderedItemIdsByCall.get(3)).toEqual(['summary', 'retained']);
    expect(indexed.orderedItemIdsByCall.get(4)).toEqual(['summary', 'gap', 'retained']);
  });

  it('propagates repeated-compaction ranks and uses ID order for deterministic ties', () => {
    const analysis = withRepeatedCompactions();
    const tiedSummariesReversed = withRepeatedCompactions();
    tiedSummariesReversed.contextItems.reverse();
    tiedSummariesReversed.compactions.reverse();
    const indexed = indexAnalysis(analysis);
    const reversed = indexAnalysis(tiedSummariesReversed);

    expect(indexed.orderedItemIdsByCall.get(3)).toEqual(['summary', 'summary-alt', 'retained']);
    expect(indexed.orderedItemIdsByCall.get(5)).toEqual(['summary2', 'retained']);
    expect([...indexed.orderedItemIdsByCall.entries()]).toEqual([
      ...reversed.orderedItemIdsByCall.entries(),
    ]);
  });
});
