import { describe, expect, it } from 'vitest';
import { AnalysisValidationError, indexAnalysis } from './analysis';
import { testAnalysis } from './context-river/test-data';

describe('indexAnalysis', () => {
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe recorded output %s independently of normalized output',
    (value) => {
      const analysis = testAnalysis();
      analysis.modelCalls[0].usage.recordedOutput = value;
      expect(() => indexAnalysis(analysis)).toThrow(/recordedOutput/);
    },
  );

  it('rejects missing recorded-output fields and unsupported accounting relationships', () => {
    const missing = testAnalysis();
    delete (missing.modelCalls[0].usage as Partial<(typeof missing.modelCalls)[0]['usage']>)
      .recordedOutput;
    expect(() => indexAnalysis(missing)).toThrow(/recordedOutput/);
    const invalid = testAnalysis();
    invalid.modelCalls[0].usage.outputReasoningRelationship =
      'guessed' as (typeof invalid.modelCalls)[0]['usage']['outputReasoningRelationship'];
    expect(() => indexAnalysis(invalid)).toThrow(/output\/reasoning relationship/);
  });

  it('retains absent recorded counters without repairing them from normalized totals', () => {
    const analysis = testAnalysis();
    analysis.modelCalls[0].usage.recordedOutput = null;
    analysis.modelCalls[0].usage.outputReasoningRelationship = 'unknown';
    const usage = indexAnalysis(analysis).analysis.modelCalls[0].usage;
    expect(usage.output).toBe(2);
    expect(usage.recordedOutput).toBeNull();
    expect(usage.reasoning).toBeNull();
  });

  it('rejects the previous schema instead of silently displaying normalized output as recorded output', () => {
    const old = testAnalysis();
    old.schemaVersion = 9;
    expect(() => indexAnalysis(old)).toThrow(/Unsupported analysis schema 9/);
  });
  function analysisWithAuditedAnthropicCall() {
    const analysis = testAnalysis();
    const call = analysis.modelCalls[0];
    call.provider = 'anthropic';
    call.api = 'anthropic-messages';
    call.usage = { ...call.usage, input: 10, cacheRead: 20, cacheWrite: 30 };
    call.economics = {
      policyId: 'anthropic-messages-cache-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'missing',
      cacheWriteStatus: 'reported',
      promptTokens: 60,
      cacheReadRatio: 20 / 60,
      cacheWriteRatio: 30 / 60,
      freshRatio: 10 / 60,
      piPromptCost: null,
      cacheRatioDiscontinuity: null,
      explanationCodes: [],
    };
    analysis.economics.supportedPolicyIds = ['anthropic-messages-cache-v1'];
    analysis.economics.usageCompleteness = {
      complete: 1,
      partial: 0,
      missing: 0,
      unsupported: 3,
    };
    analysis.economics.costCompleteness = {
      complete: 0,
      partial: 0,
      missing: 1,
      unsupported: 3,
    };
    analysis.economics.cacheReadEligibleCalls = 1;
    analysis.economics.cacheReadPromptTokens = 60;
    analysis.economics.cacheReadTokens = 20;
    analysis.economics.cacheReadRatio = 20 / 60;
    return analysis;
  }

  function analysisWithAdjacentCacheRatioChange() {
    const analysis = testAnalysis();
    const previous = analysis.modelCalls[0];
    const current = analysis.modelCalls[1];
    for (const [call, input, cacheRead] of [
      [previous, 750, 250],
      [current, 1000, 0],
    ] as const) {
      call.provider = 'anthropic';
      call.api = 'anthropic-messages';
      call.usage = { ...call.usage, input, cacheRead, cacheWrite: 0 };
      const promptTokens = input + cacheRead;
      call.economics = {
        ...call.economics,
        policyId: 'anthropic-messages-cache-v1',
        usageCompleteness: 'complete',
        costCompleteness: call.index === 1 ? 'missing' : 'partial',
        cacheWriteStatus: 'reported',
        promptTokens,
        cacheReadRatio: cacheRead / promptTokens,
        cacheWriteRatio: 0,
        freshRatio: input / promptTokens,
        piPromptCost: null,
        cacheRatioDiscontinuity: null,
        explanationCodes: [],
      };
    }
    current.economics.cacheRatioDiscontinuity = {
      previousCallIndex: previous.index,
      direction: 'drop',
      previousRatio: 0.25,
      currentRatio: 0,
      delta: 0.25,
      magnitude: 'notable',
      method: 'adjacent-cache-read-share-v1',
      previousPromptTokens: 1000,
      currentPromptTokens: 1000,
      compactionBefore: current.compactionBefore,
    };
    analysis.economics.supportedPolicyIds = ['anthropic-messages-cache-v1'];
    analysis.economics.usageCompleteness = {
      complete: 2,
      partial: 0,
      missing: 0,
      unsupported: 2,
    };
    analysis.economics.costCompleteness = {
      complete: 0,
      partial: 1,
      missing: 1,
      unsupported: 2,
    };
    analysis.economics.cacheReadEligibleCalls = 2;
    analysis.economics.cacheReadPromptTokens = 2000;
    analysis.economics.cacheReadTokens = 250;
    analysis.economics.cacheReadRatio = 0.125;
    return analysis;
  }

  it('accepts only the audited Copilot API and requires all three prompt buckets', () => {
    const a = analysisWithAuditedAnthropicCall();
    const c = a.modelCalls[0];
    c.provider = 'github-copilot';
    c.api = 'openai-responses';
    c.economics.policyId = 'github-copilot-responses-cache-v1';
    a.economics.supportedPolicyIds = ['github-copilot-responses-cache-v1'];
    expect(() => indexAnalysis(a)).not.toThrow();
    c.api = 'openai-completions';
    expect(() => indexAnalysis(a)).toThrow(/unsupported economics policy/);
    c.api = 'openai-responses';
    c.usage.cacheWrite = null;
    expect(() => indexAnalysis(a)).toThrow(/incomplete normalized prompt buckets/);
  });

  it('accepts only eligible adjacent cache-ratio changes and validates their provenance', () => {
    const analysis = analysisWithAdjacentCacheRatioChange();
    expect(() => indexAnalysis(analysis)).not.toThrow();

    analysis.modelCalls[1].economics.cacheRatioDiscontinuity!.previousCallIndex = 0;
    expect(() => indexAnalysis(analysis)).toThrow(/ineligible cache-ratio change/);
  });

  it('preserves a complete zero prompt without a ratio and rejects unsafe totals', () => {
    const zero = analysisWithAuditedAnthropicCall();
    zero.modelCalls[0].usage = {
      ...zero.modelCalls[0].usage,
      input: 0,
      cacheRead: 0,
      cacheWrite: 0,
    };
    zero.modelCalls[0].economics.promptTokens = 0;
    zero.modelCalls[0].economics.cacheReadRatio = null;
    zero.modelCalls[0].economics.cacheWriteRatio = null;
    zero.modelCalls[0].economics.freshRatio = null;
    zero.economics.cacheReadPromptTokens = 0;
    zero.economics.cacheReadTokens = 0;
    zero.economics.cacheReadRatio = null;
    expect(() => indexAnalysis(zero)).not.toThrow();

    const unsafe = analysisWithAuditedAnthropicCall();
    unsafe.modelCalls[0].economics.promptTokens = Number.MAX_SAFE_INTEGER + 1;
    expect(() => indexAnalysis(unsafe)).toThrow(/safe non-negative integer/);
  });

  it('accepts cache ratios only when supported normalized buckets agree', () => {
    expect(() => indexAnalysis(analysisWithAuditedAnthropicCall())).not.toThrow();

    const inconsistent = analysisWithAuditedAnthropicCall();
    inconsistent.modelCalls[0].economics.cacheReadRatio = 0.5;
    expect(() => indexAnalysis(inconsistent)).toThrow(/cacheReadRatio disagrees/);

    const malformedSummary = analysisWithAuditedAnthropicCall();
    malformedSummary.economics.cacheReadRatio = 0.5;
    expect(() => indexAnalysis(malformedSummary)).toThrow(/Analysis cache-read ratio disagrees/);
  });

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
