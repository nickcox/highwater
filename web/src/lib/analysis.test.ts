import { describe, expect, it } from 'vitest';
import { AnalysisValidationError, indexAnalysis } from './analysis';
import { testAnalysis } from './context-river/test-data';

describe('indexAnalysis', () => {
  it('builds all lookup indices and normalizes unknown kinds', () => {
    const analysis = testAnalysis();
    analysis.contextItems[0].preview = {
      text: 'first line',
      kind: 'text',
      truncated: true,
      expandedText: 'first line\nsecond line',
      expandedTruncated: false,
    };
    (analysis.contextItems[0] as { kind: string }).kind = 'futureKind';
    const indexed = indexAnalysis(analysis);
    expect(indexed.itemById.get('a')?.kind).toBe('other');
    expect(indexed.itemById.get('a')?.preview?.expandedText).toBe('first line\nsecond line');
    expect(indexed.compactionBySummaryId.get('summary')?.id).toBe('compact-1');
    expect(indexed.compactionBySourceId.get('a')).toHaveLength(1);
  });

  it('accepts estimated and explicitly unavailable chart geometry', () => {
    const estimated = testAnalysis();
    estimated.displayWeightUnit = 'estimatedTokens';
    estimated.tokenAnalysis.chartUnit = 'estimatedTokens';
    expect(indexAnalysis(estimated).analysis.displayWeightUnit).toBe('estimatedTokens');

    const unavailable = testAnalysis();
    unavailable.displayWeightUnit = 'unavailable';
    unavailable.tokenAnalysis.chartUnit = 'unavailable';
    unavailable.contextItems = unavailable.contextItems.map((item) => ({
      ...item,
      tokenEstimates: item.tokenEstimates.map((estimate) => ({ ...estimate, tokens: null })),
    }));
    expect(indexAnalysis(unavailable).analysis.displayWeightUnit).toBe('unavailable');
  });

  it('rejects malformed references and ranges with actionable errors', () => {
    const unknown = testAnalysis();
    unknown.modelCalls[0].contextItemIds.push('missing');
    expect(() => indexAnalysis(unknown)).toThrow(/unknown item missing/);

    const oversizedPreview = testAnalysis();
    oversizedPreview.contextItems[0].preview = {
      text: 'x'.repeat(161),
      kind: 'text',
      truncated: true,
      expandedText: 'x'.repeat(161),
      expandedTruncated: false,
    };
    expect(() => indexAnalysis(oversizedPreview)).toThrow(/invalid preview/);

    const reversed = testAnalysis();
    reversed.contextItems[0].presence[0] = { startCall: 2, endCall: 1 };
    expect(() => indexAnalysis(reversed)).toThrow(AnalysisValidationError);
  });

  it('rejects presence ranges that include an item missing from a model call', () => {
    const analysis = testAnalysis();
    analysis.contextItems[0].presence = [{ startCall: 2, endCall: 2 }];
    analysis.contextItems[0].presenceCallCount = 1;
    analysis.contextItems[0].firstModelCall = 2;
    analysis.contextItems[0].lastModelCall = 2;
    expect(() => indexAnalysis(analysis)).toThrow(
      /Model call 1 references item a outside its presence ranges/,
    );
  });

  it('accepts a terminal compaction boundary and its presence-less summary', () => {
    const analysis = testAnalysis();
    analysis.modelCalls = analysis.modelCalls.slice(0, 2).map((call) => ({
      ...call,
    }));
    analysis.modelCalls[1].contextItemIds = ['a'];
    analysis.modelCalls[1].addedItemIds = [];
    analysis.modelCalls[1].droppedItemIds = ['gap'];
    analysis.modelCalls[1].transitionItemCounts = { added: 0, retained: 1, dropped: 1 };
    analysis.contextItems = analysis.contextItems
      .filter((item) => item.id !== 'summary' && item.id !== 'retained')
      .map((item) =>
        item.id === 'gap'
          ? {
              ...item,
              presence: [{ startCall: 1, endCall: 1 }],
              presenceCallCount: 1,
              lastModelCall: 1,
            }
          : item,
      );
    analysis.compactions = [
      {
        id: 'compact-1',
        beforeModelCall: 3,
        sourceItemIds: ['a'],
        retainedItemIds: [],
        summaryItemId: 'terminal-summary',
        tokensBefore: 100,
      },
    ];
    analysis.contextItems.push({
      id: 'terminal-summary',
      kind: 'compactionSummary',
      label: 'Terminal compaction summary',
      preview: null,
      sourceRecordId: 'compaction-entry',
      sourceToolCallId: null,
      firstModelCall: 0,
      lastModelCall: 0,
      ageAtFinalModelCall: null,
      displayWeight: 25,
      presence: [],
      presenceCallCount: 0,
      metadata: {},
      tokenEstimates: [],
      tokenTurns: null,
      tokenTurnsCoverage: {
        completeItems: 0,
        partialItems: 0,
        unavailableItems: 1,
        totalItems: 1,
        coveredCalls: 0,
        totalCalls: 0,
      },
    });
    analysis.lineage = [{ from: 'a', to: 'terminal-summary', kind: 'frameworkCompaction' }];

    const indexed = indexAnalysis(analysis);
    expect(indexed.compactionById.get('compact-1')?.beforeModelCall).toBe(3);
    expect(indexed.itemById.get('terminal-summary')?.presence).toEqual([]);
  });
});
