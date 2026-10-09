import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from './test-data';
import { layoutCallColumns, layoutContextRiver } from './layout';
import { inputComparisons, inputScaleColumns, layoutInputReferences } from './reported-input';
import { visibleStackSample } from './vertical-scale';

const options = {
  width: 960,
  height: 500,
  margin: { left: 42, right: 24, top: 36, bottom: 54 },
  minimumVisibleThickness: 1,
};
function fixture() {
  const input = structuredClone(testAnalysis());
  for (const call of input.modelCalls) {
    call.reportedUsageCompleteness = 'complete';
    call.reportedPromptTokens = call.tokenAnalysis.calculatedVisibleTokens! + 100;
  }
  const indexed = indexAnalysis(input);
  const columns = layoutCallColumns(indexed, options.width, options.margin);
  return { indexed, columns };
}

describe('reported input comparison', () => {
  it('fills the per-call difference, not a carried-forward initialization estimate', () => {
    const { indexed, columns } = fixture();
    const second = indexed.analysis.modelCalls[1];
    second.reportedPromptTokens = second.tokenAnalysis.calculatedVisibleTokens! + 250;
    const comparisons = inputComparisons(indexed, columns);
    expect(comparisons.get(1)?.gap).toBe(100);
    expect(comparisons.get(2)?.gap).toBe(250);
    expect(comparisons.size).toBe(4);
    expect(indexed.analysis.contextItems).toHaveLength(4);
  });

  it('matches call 33 arithmetic without inventing an item or assigning costs', () => {
    const { indexed, columns } = fixture();
    const call = indexed.analysis.modelCalls[0];
    call.reportedPromptTokens = 113465;
    call.tokenAnalysis.calculatedVisibleTokens = 100978;
    columns[0].totalDisplayWeight = 100978;
    const before = JSON.stringify(indexed.analysis);
    const comparison = inputComparisons(indexed, columns).get(1)!;
    expect(comparison).toEqual({
      callIndex: 1,
      reconstructed: 100978,
      reported: 113465,
      gap: 12487,
    });
    expect(inputScaleColumns(columns, new Map([[1, comparison]]))[0].totalDisplayWeight).toBe(
      113465,
    );
    expect(columns[0].totalDisplayWeight).toBe(100978);
    expect(JSON.stringify(indexed.analysis)).toBe(before);
  });

  it('does not shrink an overestimated stack or create a negative fill', () => {
    const { indexed, columns } = fixture();
    for (const call of indexed.analysis.modelCalls) call.reportedPromptTokens = 0;
    const comparisons = inputComparisons(indexed, columns);
    expect([...comparisons.values()].every((comparison) => comparison.gap === 0)).toBe(true);
    expect(inputScaleColumns(columns, comparisons)).toEqual(columns);
    const refs = layoutInputReferences(columns, comparisons, options, 100);
    expect(refs).toHaveLength(1);
    expect(refs[0].line).toContain('446');
    expect(refs[0].fill).toBe('');
  });

  it.each(['missing', 'partial', 'aggregate', 'no-profile', 'no-visible', 'mismatched-stack'])(
    'breaks the reference at an incomparable %s call instead of interpolating across it',
    (mode) => {
      const { indexed, columns } = fixture();
      const call = indexed.analysis.modelCalls[1];
      if (mode === 'missing') call.reportedPromptTokens = null;
      if (mode === 'partial') call.reportedUsageCompleteness = 'partial';
      if (mode === 'aggregate') call.stopReason = 'compaction-aggregate';
      if (mode === 'no-profile') call.tokenizationProfileId = null;
      if (mode === 'no-visible') call.tokenAnalysis.calculatedVisibleTokens = null;
      if (mode === 'mismatched-stack') columns[1].totalDisplayWeight += 1;
      const comparisons = inputComparisons(indexed, columns);
      expect(comparisons.has(call.index)).toBe(false);
      expect(layoutInputReferences(columns, comparisons, options, 500)).toHaveLength(2);
      expect(inputScaleColumns(columns, comparisons)[1].totalDisplayWeight).toBe(
        columns[1].totalDisplayWeight,
      );
    },
  );

  it('does not paint isolated references across missing neighbours in a dense fit', () => {
    const { indexed, columns } = fixture();
    columns.forEach((column, position) => {
      column.x = options.margin.left + position;
    });
    indexed.analysis.modelCalls[1].reportedPromptTokens = null;
    indexed.analysis.modelCalls[2].reportedPromptTokens = null;
    const refs = layoutInputReferences(columns, inputComparisons(indexed, columns), options, 500);
    expect(refs).toHaveLength(2);
    expect(refs[0].line).toMatch(/^M42,[0-9.]+L42\.5,[0-9.]+$/);
    expect(refs[1].line).toMatch(/^M44\.5,[0-9.]+L45\.5,[0-9.]+$/);
  });

  it('does not mix structural placeholders or unsafe values with token usage', () => {
    const { indexed, columns } = fixture();
    indexed.analysis.displayWeightUnit = 'unavailable';
    expect(inputComparisons(indexed, columns).size).toBe(0);
    indexed.analysis.displayWeightUnit = 'estimatedTokens';
    for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      indexed.analysis.modelCalls[0].reportedPromptTokens = bad;
      expect(inputComparisons(indexed, columns).has(1)).toBe(false);
    }
  });

  it('includes reported input in visible-call scaling, including interpolated edges', () => {
    const { indexed, columns } = fixture();
    indexed.analysis.modelCalls[1].reportedPromptTokens = 1000;
    const comparisons = inputComparisons(indexed, columns);
    const scale = inputScaleColumns(columns, comparisons);
    const sample = visibleStackSample(scale, columns[1].x, columns[2].x);
    expect(sample.maxWeight).toBe(1000);
    const edge = visibleStackSample(scale, columns[0].x + 1, columns[1].x - 1);
    expect(edge.usesInterpolatedEdge).toBe(true);
    expect(edge.maxWeight).toBeGreaterThan(columns[1].totalDisplayWeight);
  });

  it('preserves items, group totals and ordering in both display modes', () => {
    const { indexed, columns } = fixture();
    const before = JSON.stringify(indexed.analysis);
    const comparisons = inputComparisons(indexed, columns);
    const domain = Math.max(
      ...inputScaleColumns(columns, comparisons).map((column) => column.totalDisplayWeight),
    );
    for (const groupByKind of [false, true]) {
      const layout = layoutContextRiver(
        indexed,
        { ...options, verticalDomainMax: domain, groupByKind },
        columns,
      );
      expect(layout.columns).toEqual(columns);
      expect(layout.maxTotalDisplayWeight).toBe(
        Math.max(...columns.map((column) => column.totalDisplayWeight)),
      );
      expect(layoutInputReferences(layout.columns, comparisons, options, domain)[0].fill).not.toBe(
        '',
      );
    }
    expect(JSON.stringify(indexed.analysis)).toBe(before);
  });
});
