import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../../src/lib/analysis';
import type { SessionAnalysis } from '../../src/lib/types';

const directory = process.env.TOKENPLUME_CONTRACT_DIR;
if (!directory) throw new Error('Run scripts/check-contract.sh: fresh Rust exports are required.');
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as {
  schemaVersion: number;
  outputVersion: number;
  cases: { name: string; file: string }[];
  rejections: { name: string; category: string }[];
};
if (manifest.cases.length !== 100) throw new Error('Incomplete live Rust contract export.');

function output(name: string): SessionAnalysis {
  const entry = manifest.cases.find((entry) => entry.name === name);
  if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file))
    throw new Error(`Missing contract case: ${name}`);
  const raw: SessionAnalysis = JSON.parse(readFileSync(join(directory!, entry.file), 'utf8'));
  const before = JSON.stringify(raw);
  const analysis = indexAnalysis(raw).analysis;
  expect(JSON.stringify(analysis)).toBe(before);
  return analysis;
}

describe('live production Rust -> indexAnalysis contract', () => {
  it.each([
    ['inclusive', 'includesReasoning', 30, 30],
    ['disjoint', 'excludesReasoning', 20, 30],
    ['unknown', 'unknown', 20, null],
  ] as const)(
    'preserves source-neutral recorded counters with %s overlap',
    (name, relationship, recorded, normalized) => {
      const analysis = output(`usage-recorded-${name}`);
      expect(analysis.session.source).toBe('future-harness');
      const call = analysis.modelCalls[0];
      expect(call.usage.recordedOutput).toBe(recorded);
      expect(call.usage.reasoning).toBe(10);
      expect(call.usage.outputReasoningRelationship).toBe(relationship);
      expect(call.usage.output).toBe(normalized);
      expect(call.reportedCompletionTokens).toBe(normalized);
      expect(call.cumulativeReportedCompletionTokens).toBe(normalized);
      expect(analysis.session.reportedCompletionTokens).toBe(normalized);
      expect(call.timing.effectiveOutputTokensPerSecond).toBeNull();
    },
  );

  it('copies Pi recorded output without double-counting optional reasoning', () => {
    for (const name of ['fixture-simple-auto', 'fixture-copilot-economics-auto']) {
      const analysis = output(name);
      for (const call of analysis.modelCalls) {
        expect(call.usage.recordedOutput).toBe(call.usage.output);
        if (call.usage.recordedOutput !== null)
          expect(call.usage.outputReasoningRelationship).toBe('includesReasoning');
      }
    }
  });
  it('indexes SQLite OpenCode replay with explicit coverage and independent source cost', () => {
    const analysis = output('opencode-sqlite-auto');
    expect(analysis.session.source).toBe('opencode');
    expect(analysis.reconstruction?.status).toBe('partial');
    expect(analysis.reconstruction?.explanationCodes).toContain('unknownOutputAccounting');
    expect(analysis.economics.costBasis).toBe('sourceModelRates');
    expect(analysis.modelCalls).toHaveLength(2);
    expect(analysis.modelCalls[0].usage.output).toBeNull();
    expect(analysis.modelCalls[0].usage.recordedOutput).toBe(20);
    expect(analysis.modelCalls[0].usage.outputReasoningRelationship).toBe('unknown');
    expect(analysis.modelCalls[0].usage.reasoning).toBe(5);
    expect(analysis.modelCalls[0].timing.durationMs).toBeNull();
    expect(analysis.modelCalls[0].economics.piPromptCost).toBeNull();
    expect(analysis.contextItems.length).toBeGreaterThan(0);
  });
  it('indexes modern checkpoints without losing usage-only calls or duplicating recent context', () => {
    const analysis = output('opencode-modern-auto');
    const indexed = indexAnalysis(analysis);
    expect(analysis.modelCalls).toHaveLength(3);
    expect(analysis.modelCalls[0].usage.recordedOutput).toBe(20);
    expect(analysis.modelCalls[0].usage.reasoning).toBe(5);
    expect(analysis.modelCalls[0].usage.output).toBeNull();
    expect(analysis.modelCalls[0].usage.outputReasoningRelationship).toBe('unknown');
    expect(analysis.modelCalls[1].sourceRecordId).toBe('msg_empty');
    expect(analysis.reconstruction?.explanationCodes).toContain('missingCompactionUsage');
    const checkpoint = analysis.compactions[0];
    expect(checkpoint.beforeModelCall).toBe(3);
    expect(checkpoint.retainedItemIds).toEqual([]);
    expect(analysis.modelCalls[2].contextItemIds).toEqual([checkpoint.summaryItemId]);
    expect(indexed.itemById.get(checkpoint.summaryItemId)?.preview?.expandedText).toContain(
      'Synthetic serialized recent exchange',
    );
    expect(indexed.incomingLineage.get(checkpoint.summaryItemId)?.length).toBeGreaterThan(0);
    const aggregate = output('opencode-modern-aggregate-auto');
    expect(aggregate.modelCalls).toHaveLength(4);
    expect(aggregate.reconstruction?.explanationCodes).toContain('aggregatedCompactionUsage');
    expect(aggregate.modelCalls[2].stopReason).toBe('compaction-aggregate');
    const terminal = output('opencode-modern-terminal-auto');
    const terminalIndexed = indexAnalysis(terminal);
    const summary = terminalIndexed.itemById.get(terminal.compactions[1].summaryItemId)!;
    expect(summary.presence).toEqual([]);
    expect(summary.ageAtFinalModelCall).toBeNull();
    const adjacent = output('opencode-modern-adjacent-auto');
    const replaced = adjacent.contextItems.find(
      (item) => item.sourceRecordId === 'msg_checkpoint' && item.kind === 'compactionSummary',
    )!;
    expect(replaced.presence).toEqual([]);
    expect(replaced.firstModelCall).toBe(0);
    expect(replaced.ageAtFinalModelCall).toBeNull();
  });

  it('indexes OpenCode compaction lineage and retains summary reasoning', () => {
    const analysis = output('opencode-compaction-auto');
    const indexed = indexAnalysis(analysis);
    expect(analysis.compactions).toHaveLength(1);
    const compaction = analysis.compactions[0];
    expect(compaction.sourceItemIds).toHaveLength(2);
    expect(analysis.lineage).toHaveLength(2);
    expect(analysis.lineage).toEqual(
      [...compaction.sourceItemIds].sort().map((from) => ({
        from,
        to: compaction.summaryItemId,
        kind: 'frameworkCompaction',
      })),
    );
    expect(indexed.incomingLineage.get(compaction.summaryItemId)).toHaveLength(2);
    const summary = indexed.itemById.get(compaction.summaryItemId)!;
    expect(summary.kind).toBe('compactionSummary');
    expect(summary.preview?.expandedText).toContain('Synthetic summary reasoning');
    expect(summary.tokenTurns).toBeGreaterThan(0);
    expect(analysis.modelCalls[3].contextItemIds).toContain(summary.id);
    expect(analysis.modelCalls[3].compactionBefore).toBe(compaction.id);
  });
  it('indexes Copilot Responses three-bucket economics without inventing missing writes', () => {
    const a = output('fixture-copilot-economics-auto');
    expect(
      JSON.parse(
        readFileSync(join(process.cwd(), '../fixtures/analysis/copilot-economics.json'), 'utf8'),
      ),
    ).toEqual(a);
    const indexed = indexAnalysis(a);
    expect(indexed.analysis.modelCalls[1].economics).toMatchObject({
      policyId: 'github-copilot-responses-cache-v1',
      cacheWriteStatus: 'reported',
      promptTokens: 55485,
      cacheWriteRatio: 55482 / 55485,
      freshRatio: 3 / 55485,
      costCompleteness: 'complete',
      cacheRatioDiscontinuity: null,
    });
    expect(a.modelCalls[2].economics.cacheReadRatio).toBe(55482 / 55893);
    expect(a.modelCalls[3].economics.piPromptCost).toBe(0);
    expect(a.modelCalls[4].economics.usageCompleteness).toBe('partial');
    expect(a.modelCalls[5].economics.usageCompleteness).toBe('missing');
    expect(a.modelCalls[6].economics.usageCompleteness).toBe('unsupported');
    expect(a.economics.cacheReadPromptTokens).toBe(113378);
  });
  it('keeps the browser system-context fixture equal to the production Rust response', () => {
    const captured = JSON.parse(
      readFileSync(join(process.cwd(), '../fixtures/analysis/system-context.json'), 'utf8'),
    );
    expect(captured).toEqual(output('fixture-system-context-auto'));
  });
  it.each(manifest.cases)('accepts and indexes $name without repairs', ({ name }) => {
    const analysis = output(name);
    const indexed = indexAnalysis(analysis);
    expect(analysis.schemaVersion).toBe(10);
    expect(indexed.callByIndex.size).toBe(analysis.modelCalls.length);
    expect(indexed.itemById.size).toBe(analysis.contextItems.length);
    for (const profile of analysis.tokenAnalysis.profiles)
      expect(profile.id).toMatch(/^profile-v4-[a-f0-9]{64}$/);
    for (const item of analysis.contextItems) {
      expect(item).not.toHaveProperty('payload');
      expect(item).not.toHaveProperty('raw');
      expect(item.displayWeight).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(item.displayWeight)).toBe(true);
    }
  });

  it('retains wall-clock instants and distinguishes derived, missing and unsuccessful rates', () => {
    const timing = output('timing-openai-responses').modelCalls[0].timing;
    expect(timing).toEqual({
      startedAtMs: 1700000000000,
      recordedAtMs: 1700000002000,
      durationMs: 2000,
      effectiveOutputTokensPerSecond: 50,
      basis: 'pi-message-timestamps',
    });
    for (const name of [
      'timing-missing',
      'timing-zero-interval',
      'timing-reversed',
      'timing-unknown-api',
      'timing-unsafe',
    ]) {
      expect(output(name).modelCalls[0].timing.durationMs).toBeNull();
      expect(output(name).modelCalls[0].timing.effectiveOutputTokensPerSecond).toBeNull();
    }
    for (const name of ['timing-error', 'timing-aborted', 'timing-unknown-output']) {
      expect(output(name).modelCalls[0].timing.durationMs).toBe(2000);
      expect(output(name).modelCalls[0].timing.effectiveOutputTokensPerSecond).toBeNull();
    }
    expect(output('timing-zero-output').modelCalls[0].timing.effectiveOutputTokensPerSecond).toBe(
      0,
    );
    expect(output('timing-unknown-api').modelCalls[0].timing.startedAtMs).toBe(10);
  });

  it('preserves optional and delimiter-safe profile identities', () => {
    const ids = [
      'identity-absent',
      'identity-literal-unknown',
      'identity-delimiter-left',
      'identity-delimiter-right',
    ].map((name) => output(name).modelCalls[0].tokenizationProfileId);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id !== null)).toBe(true);
  });

  it('distinguishes no eligible cache measurements, partial measurements, and measured zero', () => {
    for (const name of ['economics-missing', 'economics-partial']) {
      const analysis = output(name);
      expect(analysis.economics.cacheReadEligibleCalls).toBe(0);
      expect(analysis.economics.cacheReadPromptTokens).toBeNull();
      expect(analysis.economics.cacheReadTokens).toBeNull();
    }
    expect(output('economics-missing').modelCalls[0].economics.usageCompleteness).toBe('missing');
    expect(output('economics-partial').modelCalls[0].economics.usageCompleteness).toBe('partial');
    const zero = output('economics-zero');
    expect(zero.economics.cacheReadEligibleCalls).toBe(1);
    expect(zero.economics.cacheReadPromptTokens).toBe(0);
    expect(zero.economics.cacheReadTokens).toBe(0);
    expect(zero.economics.cacheReadRatio).toBeNull();
    expect(zero.modelCalls[0].economics.piPromptCost).toBe(0);
    const nonPi = output('economics-non-pi');
    expect(nonPi.economics.costBasis).toBe('sourceModelRates');
    expect(nonPi.modelCalls[0].economics.piPromptCost).toBeNull();
    expect(nonPi.modelCalls[0].economics.explanationCodes).not.toContain('piModelRateCostBasis');
  });

  it('keeps partial covered zero numeric and unavailable exposure null', () => {
    const zero = output('partial-covered-zero');
    expect(zero.contextItems[0].tokenTurns).toBe(0);
    expect(zero.contextItems[0].tokenTurnsCoverage.partialItems).toBe(1);
    expect(zero.session.calculatedTokenTurns).toBe(0);
    const unavailable = output('unavailable-payload');
    expect(unavailable.contextItems[0].tokenTurns).toBeNull();
    expect(unavailable.contextItems[0].tokenTurnsCoverage.unavailableItems).toBe(1);
    expect(unavailable.session.calculatedTokenTurns).toBeNull();
    const mixed = output('mixed-estimate-coverage').contextItems[0];
    expect(mixed.tokenTurnsCoverage).toMatchObject({
      completeItems: 0,
      partialItems: 1,
      unavailableItems: 0,
      coveredCalls: 1,
      totalCalls: 2,
    });
    expect(mixed.tokenTurns).toBeGreaterThan(0);
  });

  it('preserves terminal structural summaries without fabricated lifetime or exposure', () => {
    const terminal = output('terminal-zero-call');
    expect(terminal.modelCalls).toHaveLength(0);
    expect(terminal.contextItems[0]).toMatchObject({
      firstModelCall: 0,
      lastModelCall: 0,
      ageAtFinalModelCall: null,
      presenceCallCount: 0,
      presence: [],
      tokenTurns: null,
    });
    expect(terminal.tokenAnalysis.itemEstimateCoverage.totalItems).toBe(0);
    expect(terminal.session.calculatedTokenTurns).toBeNull();
    for (const policy of ['auto', 'strict', 'heuristic', 'off']) {
      const analysis = output(`fixture-terminal-compaction-${policy}`);
      const summary = analysis.contextItems.find(
        (item) => item.kind === 'compactionSummary' && item.presence.length === 0,
      );
      expect(summary).toBeDefined();
      expect(summary?.tokenTurns).toBeNull();
    }
  });

  it('accepts exact safe boundaries and preserves qualified null after aggregate exhaustion', () => {
    const raw = output('raw-safe-boundary');
    expect(raw.modelCalls[0].usage.input).toBe(Number.MAX_SAFE_INTEGER);
    expect(raw.modelCalls[0].economics.promptTokens).toBe(Number.MAX_SAFE_INTEGER);
    const boundary = output('derived-safe-boundary');
    expect(boundary.session.calculatedTokenTurns).toBe(Number.MAX_SAFE_INTEGER);
    for (const name of ['session-exposure-exhaustion', 'item-exposure-exhaustion']) {
      const analysis = output(name);
      expect(analysis.session.calculatedTokenTurns).toBeNull();
      expect(analysis.tokenAnalysis.totalCalculatedTokenTurns).toBeNull();
      expect(analysis.session.calculatedTokenTurnsCoverage).toMatchObject({
        completeItems: 0,
        partialItems: 0,
        unavailableItems: 2,
        totalItems: 2,
        coveredCalls: 0,
      });
    }
    const session = output('session-exposure-exhaustion');
    expect(session.contextItems.map((item) => item.tokenTurns)).toEqual([
      Number.MAX_SAFE_INTEGER - 1,
      2,
    ]);
    const sticky = output('item-exposure-exhaustion');
    expect(sticky.contextItems[0].tokenTurns).toBeNull();
    expect(sticky.contextItems[0].tokenTurnsCoverage.coveredCalls).toBe(3);
    expect(sticky.contextItems[1].tokenTurns).toBe(4);
  });

  it('reports encoded image size without a decoded-size or complete-token claim', () => {
    const image = output('encoded-image').contextItems[0];
    expect(image.preview?.text).toBe('[image: image/png, 8.0 B encoded]');
    expect(image.tokenEstimates[0].coverage).toBe('partial');
  });

  it('records Rust-side rejection and current versions instead of sending bad successes to TS', () => {
    expect(manifest.schemaVersion).toBe(10);
    expect(manifest.outputVersion).toBe(20);
    expect(manifest.rejections).toEqual([
      { name: 'dangling-normalized-reference', category: 'invalid-session' },
      { name: 'unsafe-normalized-usage', category: 'invalid-session' },
      { name: 'unsafe-serialized-diagnostic', category: 'invalid-session' },
      { name: 'unsafe-source-usage', category: 'source-unsafe-integer' },
      { name: 'malformed-source-parent', category: 'source-structure' },
    ]);
  });
});
