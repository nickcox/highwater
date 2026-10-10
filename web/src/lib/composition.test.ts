import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from './testing/wire-analysis';
import {
  COMPOSITION_KIND_ORDER,
  createCompositionProjectionCache,
  fitCompositionLabel,
  layoutCompositionTreemap,
  projectCallComposition,
  projectCumulativeComposition,
  rankCompositionItems,
} from './composition';
import { compositionScenario } from './testing/composition-scenarios';
import { liveAppendReplacementScenario, sessionScenario } from './testing/session-scenarios';

function denseIndexed(allZero = false) {
  return indexTestAnalysis(compositionScenario(220, allZero));
}

function scopedCumulativeAnalysis() {
  const analysis = compositionScenario(6);
  const [persistent, oneCall, disjoint, missing, source, summary] = analysis.contextItems;
  const items = [persistent, oneCall, disjoint, missing, source, summary];
  const memberships = [
    [persistent.id, disjoint.id, missing.id, source.id],
    [persistent.id, oneCall.id, missing.id, summary.id],
    [persistent.id, disjoint.id, missing.id],
    [persistent.id, missing.id],
  ];
  const estimates = [
    [3, 5],
    [7, 11],
    [13, 17],
    [null, 2],
    [19, 23],
    [29, 31],
  ];
  for (const [itemIndex, item] of items.entries()) {
    item.presence = memberships
      .flatMap((ids, callIndex) =>
        ids.includes(item.id) ? [{ startCall: callIndex + 1, endCall: callIndex + 1 }] : [],
      )
      .reduce<{ startCall: number; endCall: number }[]>((ranges, range) => {
        const previous = ranges[ranges.length - 1];
        if (previous && previous.endCall + 1 === range.startCall) previous.endCall = range.endCall;
        else ranges.push(range);
        return ranges;
      }, []);
    item.firstModelCall = item.presence[0]?.startCall ?? 0;
    item.lastModelCall = item.presence[item.presence.length - 1]?.endCall ?? 0;
    item.presenceCallCount = item.presence.reduce(
      (count, range) => count + range.endCall - range.startCall + 1,
      0,
    );
    item.tokenEstimates = item.tokenEstimates.map((estimate) => {
      const profilePosition = estimate.profileId === 'profile-1' ? 0 : 1;
      const tokens = estimates[itemIndex][profilePosition];
      return {
        ...estimate,
        tokens,
        method: tokens === null ? 'unavailable' : 'modelTokenizer',
        coverage:
          itemIndex === 0 && profilePosition === 1
            ? 'partial'
            : tokens === null
              ? 'unavailable'
              : 'complete',
      };
    });
  }
  analysis.contextItems = items;
  analysis.modelCalls.forEach((call, position) => {
    call.contextItemIds = memberships[position];
    const previousIds = new Set(analysis.modelCalls[position - 1]?.contextItemIds ?? []);
    const currentIds = new Set(call.contextItemIds);
    call.addedItemIds = call.contextItemIds.filter((id) => !previousIds.has(id));
    call.droppedItemIds = [...previousIds].filter((id) => !currentIds.has(id));
    call.transitionItemCounts = {
      added: call.addedItemIds.length,
      retained: call.contextItemIds.length - call.addedItemIds.length,
      dropped: call.droppedItemIds.length,
    };
  });
  summary.kind = 'compactionSummary';
  analysis.compactions = [
    {
      id: 'synthetic-compaction',
      beforeModelCall: 2,
      sourceItemIds: [source.id],
      retainedItemIds: [],
      summaryItemId: summary.id,
      tokensBefore: null,
    },
  ];
  analysis.lineage = [{ from: source.id, to: summary.id, kind: 'frameworkCompaction' }];
  return analysis;
}

describe('call-specific Composition projection and treemap', () => {
  it('keeps unavailable call estimates unknown rather than reporting a zero total', () => {
    const indexed = indexTestAnalysis(sessionScenario('unavailableGeometry'));
    const callIndex = indexed.analysis.modelCalls[0].index;
    const atCall = projectCallComposition(indexed, callIndex)!;
    const cumulative = projectCumulativeComposition(indexed, callIndex)!;

    for (const projection of [atCall, cumulative]) {
      expect(projection.numericItemCallCount).toBe(0);
      expect(projection.measuredTokenTotal).toBeNull();
      expect(projection.allMeasuredZero).toBe(false);
      expect(projection.items.every((item) => item.share === null)).toBe(true);
    }
  });

  it('uses the inspected call profile, actual ordered-call age, and measured-subset shares', () => {
    const indexed = denseIndexed();
    const projection = projectCallComposition(indexed, 2)!;
    const dominant = projection.items.find((item) => item.id === 'composition-item-001')!;
    const previousProfileDominant = projection.items.find(
      (item) => item.id === 'composition-item-000',
    )!;
    const zero = projection.items.find((item) => item.id === 'composition-item-002')!;
    const unavailable = projection.items.find((item) => item.id === 'composition-item-003')!;

    expect(projection.profileId).toBe('profile-2');
    expect(dominant.tokens).toBe(8_000);
    expect(dominant.ageAtCall).toBe(1);
    expect(previousProfileDominant.tokens).toBe(75);
    expect(zero.tokens).toBe(0);
    expect(zero.share).toBe(0);
    expect(unavailable.tokens).toBeNull();
    expect(unavailable.share).toBeNull();
    expect(projection.measuredItemCount).toBe(219);
    expect(projection.unmeasuredItemCount).toBe(1);
    expect(projection.measuredTokenTotal).toBeGreaterThan(8_000);
    expect(projection.groups.map((group) => group.kind)).toEqual(
      [...projection.groups]
        .map(({ kind }) => kind)
        .sort(
          (left, right) =>
            COMPOSITION_KIND_ORDER.indexOf(left) - COMPOSITION_KIND_ORDER.indexOf(right),
        ),
    );
    expect(rankCompositionItems(projection.items)[0]?.id).toBe('composition-item-001');
    expect(projectCallComposition(indexed, 99)).toBeNull();
  });

  it('lays out a deterministic nonoverlapping treemap without dropping zero/tiny/unavailable list items', () => {
    const indexed = denseIndexed();
    const original = JSON.stringify(indexed.analysis);
    const projection = projectCallComposition(indexed, 2)!;
    const first = layoutCompositionTreemap(projection, 800, 360);
    const second = layoutCompositionTreemap(projection, 800, 360);

    expect(first).toEqual(second);
    expect(first.rectangles.some(({ item }) => item.id === 'composition-item-002')).toBe(false);
    expect(first.rectangles.some(({ item }) => item.id === 'composition-item-003')).toBe(false);
    expect(first.rectangles.find(({ item }) => item.id === 'composition-item-001')?.labelFits).toBe(
      true,
    );
    expect(first.rectangles.find(({ item }) => item.id === 'composition-item-004')?.labelFits).toBe(
      false,
    );
    for (const rectangle of first.rectangles) {
      expect(rectangle.x).toBeGreaterThanOrEqual(0);
      expect(rectangle.y).toBeGreaterThanOrEqual(0);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(800 + 1e-6);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(360 + 1e-6);
      expect(Number.isFinite(rectangle.width + rectangle.height)).toBe(true);
    }
    for (let leftIndex = 0; leftIndex < first.rectangles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < first.rectangles.length; rightIndex += 1) {
        const left = first.rectangles[leftIndex];
        const right = first.rectangles[rightIndex];
        const separated =
          left.x + left.width <= right.x + 1e-6 ||
          right.x + right.width <= left.x + 1e-6 ||
          left.y + left.height <= right.y + 1e-6 ||
          right.y + right.height <= left.y + 1e-6;
        expect(separated).toBe(true);
      }
    }
    expect(JSON.stringify(indexed.analysis)).toBe(original);
    expect(projection.items).toHaveLength(220);
  });

  it('keeps an unchanged inspected-call projection and layout stable after a later append', () => {
    const { initial, replacement } = liveAppendReplacementScenario();
    const before = projectCallComposition(indexTestAnalysis(initial), 4)!;
    const after = projectCallComposition(indexTestAnalysis(replacement), 4)!;

    expect(after).toEqual(before);
    expect(layoutCompositionTreemap(after, 800, 360)).toEqual(
      layoutCompositionTreemap(before, 800, 360),
    );
  });

  it('keeps unavailable semantic coverage distinct from numeric contribution availability', () => {
    const analysis = scopedCumulativeAnalysis();
    const estimate = analysis.contextItems[0].tokenEstimates.find(
      (candidate) => candidate.profileId === 'profile-1',
    )!;
    estimate.coverage = 'unavailable';
    const projection = projectCumulativeComposition(indexTestAnalysis(analysis), 2)!;
    const persistent = projection.items.find((item) => item.id === 'composition-item-000')!;

    expect(persistent.tokens).toBe(8);
    expect(persistent.knownContributionCount).toBe(2);
    expect(persistent.unavailableCoverageContributionCount).toBe(1);
    expect(persistent.estimateCoverage).toBe('partial');
    expect(projection.unavailableCoverageItemCallCount).toBe(2);
  });

  it('aggregates the inclusive call prefix from presence and each call profile, not lifetime age', () => {
    const analysis = scopedCumulativeAnalysis();
    const original = JSON.stringify(analysis);
    const indexed = indexTestAnalysis(analysis);
    const firstCall = projectCumulativeComposition(indexed, 1)!;
    const prefix = projectCumulativeComposition(indexed, 2)!;
    const whole = projectCumulativeComposition(indexed, null)!;
    expect(firstCall.scopeCallCount).toBe(1);
    expect(firstCall.scopeStartCallIndex).toBe(1);
    expect(firstCall.scopeEndCallIndex).toBe(1);
    const persistent = prefix.items.find((item) => item.id === 'composition-item-000')!;
    const oneCall = prefix.items.find((item) => item.id === 'composition-item-001')!;
    const disjoint = prefix.items.find((item) => item.id === 'composition-item-002')!;
    const partial = prefix.items.find((item) => item.id === 'composition-item-003')!;
    const source = prefix.items.find((item) => item.id === 'composition-item-004')!;
    const summary = prefix.items.find((item) => item.id === 'composition-item-005')!;

    expect(prefix.scope).toBe('cumulative');
    expect(prefix.scopeStartCallIndex).toBe(1);
    expect(prefix.scopeEndCallIndex).toBe(2);
    expect(prefix.scopeCallCount).toBe(2);
    expect(prefix.profileIds).toEqual(['profile-1', 'profile-2']);
    expect(prefix.profileId).toBeNull();
    expect(persistent.tokens).toBe(8);
    expect(persistent.partialEstimateContributionCount).toBe(1);
    expect(persistent.knownContributionCount).toBe(2);
    expect(oneCall.tokens).toBe(11);
    expect(oneCall.scopePresenceCount).toBe(1);
    expect(disjoint.tokens).toBe(13);
    expect(disjoint.scopePresenceCount).toBe(1);
    expect(partial.tokens).toBe(2);
    expect(partial.missingContributionCount).toBe(1);
    expect(source.tokens).toBe(19);
    expect(summary.tokens).toBe(31);
    expect(prefix.measuredTokenTotal).toBe(84);
    expect(prefix.numericItemCallCount).toBe(7);
    expect(prefix.totalItemCallCount).toBe(8);
    expect(whole.measuredTokenTotal).toBe(107);
    expect(projectCumulativeComposition(indexed, 99)).toBeNull();
    expect(JSON.stringify(analysis)).toBe(original);

    const finalEndpoint = projectCumulativeComposition(indexed, 4)!;
    expect(finalEndpoint.measuredTokenTotal).toBe(whole.measuredTokenTotal);
    expect(finalEndpoint.items).toEqual(whole.items);
  });

  it('withholds cumulative item subtotals and areas on per-item safe-integer overflow', () => {
    const analysis = scopedCumulativeAnalysis();
    const persistent = analysis.contextItems[0];
    persistent.tokenEstimates.find((estimate) => estimate.profileId === 'profile-1')!.tokens =
      Number.MAX_SAFE_INTEGER;
    persistent.tokenEstimates.find((estimate) => estimate.profileId === 'profile-2')!.tokens = 1;
    const indexed = indexTestAnalysis(analysis);
    const projection = projectCumulativeComposition(indexed, 2)!;
    const item = projection.items.find((candidate) => candidate.id === persistent.id)!;

    expect(item.overflowed).toBe(true);
    expect(item.tokens).toBeNull();
    expect(item.knownContributionCount).toBe(2);
    expect(item.share).toBeNull();
    expect(projection.totalOverflow).toBe(true);
    expect(layoutCompositionTreemap(projection, 800, 360).rectangles).toEqual([]);
  });

  it('leaves a no-call session without synthetic cumulative areas', () => {
    const indexed = indexTestAnalysis(sessionScenario('terminalSummaryOnly'));
    const projection = projectCumulativeComposition(indexed, null)!;

    expect(projection.scopeCallCount).toBe(0);
    expect(projection.scopeStartCallIndex).toBeNull();
    expect(projection.scopeEndCallIndex).toBeNull();
    expect(projection.items).toEqual([]);
    expect(projection.measuredTokenTotal).toBeNull();
    expect(projection.numericItemCallCount).toBe(0);
    expect(projection.hasPositiveWeights).toBe(false);
    expect(projectCumulativeComposition(indexed, 1)).toBeNull();
  });

  it('caches cumulative work by accepted analysis and endpoint, not UI presentation', () => {
    const indexed = indexTestAnalysis(scopedCumulativeAnalysis());
    const cache = createCompositionProjectionCache();
    const first = cache.get(indexed, 'cumulative', 2);
    const repeated = cache.get(indexed, 'cumulative', 2);
    const differentEndpoint = cache.get(indexed, 'cumulative', 3);
    expect(repeated).toBe(first);
    expect(differentEndpoint).not.toBe(first);
    expect(cache.get(indexed, 'cumulative', null)?.scopeEndCallIndex).toBe(4);
  });

  it('retains only the latest endpoint per scope and releases replaced analysis entries', () => {
    const indexed = indexTestAnalysis(scopedCumulativeAnalysis());
    const cache = createCompositionProjectionCache();
    const atCall = cache.get(indexed, 'atCall', 2);
    let previous = cache.get(indexed, 'cumulative', 1);
    for (let visit = 0; visit < 300; visit += 1) {
      const endpoint = (visit % 4) + 1;
      const next = cache.get(indexed, 'cumulative', endpoint);
      expect(next).toEqual(projectCumulativeComposition(indexed, endpoint));
      expect(cache.get(indexed, 'cumulative', endpoint)).toBe(next);
      if (visit > 0) expect(next).not.toBe(previous);
      previous = next;
    }
    expect(cache.get(indexed, 'atCall', 2)).toBe(atCall);
    const old = cache.get(indexed, 'cumulative', 1);
    cache.get(indexed, 'cumulative', 2);
    expect(cache.get(indexed, 'cumulative', 1)).not.toBe(old);
    const replacement = indexTestAnalysis(scopedCumulativeAnalysis());
    cache.get(replacement, 'atCall', 2);
    expect(cache.get(indexed, 'atCall', 2)).not.toBe(atCall);
  });

  it('bounds retained entries while visiting a long history in both scopes', () => {
    const indexed = indexTestAnalysis(sessionScenario('longSession'));
    const calls = indexed.analysis.modelCalls;
    const cache = createCompositionProjectionCache();
    expect(cache.retainedEntryCount).toBe(0);
    for (let visit = 0; visit < 400; visit += 1) {
      const endpoint = calls[visit % calls.length].index;
      expect(cache.get(indexed, 'cumulative', endpoint)).toEqual(
        projectCumulativeComposition(indexed, endpoint),
      );
      cache.get(indexed, 'atCall', endpoint);
      expect(cache.retainedEntryCount).toBe(2);
    }
    cache.get(indexTestAnalysis(compositionScenario(20)), 'cumulative', null);
    expect(cache.retainedEntryCount).toBe(1);
  });

  it('preserves unavailable estimate evidence in both scopes', () => {
    const analysis = scopedCumulativeAnalysis();
    const item = analysis.contextItems[3];
    item.tokenEstimates[0].noteCodes = ['unsupportedTokenizer'];
    const indexed = indexTestAnalysis(analysis);
    const atCall = projectCallComposition(indexed, 1)!.items.find((entry) => entry.id === item.id)!;
    const cumulative = projectCumulativeComposition(indexed, 1)!.items.find(
      (entry) => entry.id === item.id,
    )!;
    expect(cumulative.tokens).toBeNull();
    expect(cumulative.explanations).toEqual(atCall.explanations);
    expect(cumulative.estimateMethods).toEqual(atCall.estimateMethods);
  });

  it('fits long tile and group labels within their measured bounds', () => {
    expect(fitCompositionLabel('Assistant messages', 75, 9).length).toBeLessThan(
      'Assistant messages'.length,
    );
    expect(fitCompositionLabel('Assistant messages', 30, 9)).toBe('');
    expect(fitCompositionLabel('Read · /a/very/long/path/to/config.ts', 140, 10)).toContain(
      'config.ts',
    );
    const unicode = fitCompositionLabel('界面項目界面項目界面項目', 80, 10);
    expect(unicode).toContain('…');
    expect(unicode.length).toBeLessThan('界面項目界面項目界面項目'.length);
  });

  it('returns finite empty extents for non-layout dimensions', () => {
    const projection = projectCallComposition(denseIndexed(), 2)!;
    expect(layoutCompositionTreemap(projection, Infinity, 360)).toEqual({
      width: 0,
      height: 360,
      rectangles: [],
      groups: [],
    });
    expect(layoutCompositionTreemap(projection, 800, Number.NaN)).toEqual({
      width: 800,
      height: 0,
      rectangles: [],
      groups: [],
    });
  });

  it('uses an explanatory list for all-zero estimates and withholds overflowing shares', () => {
    const zeroProjection = projectCallComposition(denseIndexed(true), 2)!;
    expect(zeroProjection.allMeasuredZero).toBe(true);
    expect(zeroProjection.measuredTokenTotal).toBe(0);
    const cumulativeZero = projectCumulativeComposition(denseIndexed(true), 2)!;
    expect(cumulativeZero.numericItemCallCount).toBeGreaterThan(0);
    expect(cumulativeZero.measuredTokenTotal).toBe(0);
    expect(cumulativeZero.allMeasuredZero).toBe(true);
    expect(layoutCompositionTreemap(zeroProjection, 800, 360).rectangles).toEqual([]);

    const overflowing = compositionScenario(220);
    overflowing.contextItems[0].tokenEstimates[1].tokens = Number.MAX_SAFE_INTEGER;
    overflowing.contextItems[1].tokenEstimates[1].tokens = Number.MAX_SAFE_INTEGER;
    const overflowProjection = projectCallComposition(indexTestAnalysis(overflowing), 2)!;
    expect(overflowProjection.totalOverflow).toBe(true);
    expect(overflowProjection.measuredTokenTotal).toBeNull();
    expect(overflowProjection.items.every((item) => item.share === null)).toBe(true);
    expect(layoutCompositionTreemap(overflowProjection, 800, 360).rectangles).toEqual([]);
  });
});
