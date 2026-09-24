import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { layoutContextRiver } from './layout';
import { testAnalysis } from './test-data';

const options = {
  width: 800,
  height: 400,
  margin: { top: 20, right: 20, bottom: 40, left: 40 },
  minimumVisibleThickness: 1,
};

describe('layoutContextRiver', () => {
  it('builds deterministic, non-overlapping stacks and separate gap segments', () => {
    const indexed = indexAnalysis(testAnalysis());
    const first = layoutContextRiver(indexed, options);
    const second = layoutContextRiver(indexed, options);
    expect(first).toEqual(second);
    expect(first.maxTotalDisplayWeight).toBe(95);
    const bottomRibbon = first.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    expect(bottomRibbon.points[0].y1).toBe(options.height - options.margin.bottom);
    expect(bottomRibbon.points[0].y1).toBeGreaterThan(bottomRibbon.points[0].y0);
    expect(first.ribbons.filter((ribbon) => ribbon.itemId === 'gap')).toHaveLength(2);
    for (const column of first.columns) {
      const intervals = first.ribbons
        .flatMap((ribbon) => ribbon.points)
        .filter((point) => point.x === column.x && point.y1 > point.y0)
        .map((point) => [point.y0, point.y1])
        .sort((a, b) => a[0] - b[0]);
      for (let index = 1; index < intervals.length; index += 1) {
        expect(intervals[index][0]).toBeGreaterThanOrEqual(intervals[index - 1][1]);
      }
    }
  });

  it('allows a presentation-only Y domain while preserving session totals and columns', () => {
    const indexed = indexAnalysis(testAnalysis());
    const sessionScale = layoutContextRiver(indexed, options);
    const localScale = layoutContextRiver(
      indexed,
      { ...options, verticalDomainMax: 45 },
      sessionScale.columns,
    );

    expect(sessionScale.maxTotalDisplayWeight).toBe(95);
    expect(localScale.maxTotalDisplayWeight).toBe(95);
    expect(localScale.columns).toEqual(sessionScale.columns);
    const sessionPoint = sessionScale.ribbons
      .find((ribbon) => ribbon.itemId === 'retained')!
      .points.find((point) => point.callIndex === 4)!;
    const localPoint = localScale.ribbons
      .find((ribbon) => ribbon.itemId === 'retained')!
      .points.find((point) => point.callIndex === 4)!;
    expect(localPoint.y0).not.toBe(sessionPoint.y0);
    expect(localPoint.y1).not.toBe(sessionPoint.y1);
  });

  it('gives one-call ranges visible geometry', () => {
    const layout = layoutContextRiver(indexAnalysis(testAnalysis()), options);
    const segment = layout.ribbons.find(
      (ribbon) => ribbon.itemId === 'gap' && ribbon.startCall === 1,
    )!;
    expect(segment.points).toHaveLength(2);
    expect(segment.points[1].x).toBeGreaterThan(segment.points[0].x);
    expect(segment.path).not.toBe('');
  });

  it('places honest compaction geometry at the midpoint', () => {
    const layout = layoutContextRiver(indexAnalysis(testAnalysis()), options);
    const boundary = layout.compactions[0];
    expect(boundary.x).toBe((layout.columns[1].x + layout.columns[2].x) / 2);
    const source = layout.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    const sourceEnd = source.points[source.points.length - 1];
    expect(sourceEnd.x).toBe(boundary.x);
    expect(sourceEnd.y0).toBe(sourceEnd.y1);
    const summary = layout.ribbons.find((ribbon) => ribbon.itemId === 'summary')!;
    expect(summary.points[0].x).toBe(boundary.x);
    const retained = layout.ribbons.find((ribbon) => ribbon.itemId === 'retained')!;
    expect(retained.points.some((point) => point.x < boundary.x)).toBe(true);
    expect(retained.points.some((point) => point.x > boundary.x)).toBe(true);
    expect(layout.lineageConnectors).toHaveLength(1);
    expect(layout.lineageConnectors[0]).not.toHaveProperty('strokeWidth');
  });

  it('matches repeated source and summary compactions to their exact range boundaries', () => {
    const analysis = testAnalysis();
    analysis.compactions.push({
      id: 'compact-2',
      beforeModelCall: 4,
      sourceItemIds: ['a'],
      retainedItemIds: ['retained'],
      summaryItemId: 'summary',
      tokensBefore: 90,
    });
    const indexed = indexAnalysis(analysis);
    const layout = layoutContextRiver(indexed, options);
    const firstBoundary = layout.compactions.find((boundary) => boundary.beforeModelCall === 3)!;
    const source = layout.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    const summary = layout.ribbons.find((ribbon) => ribbon.itemId === 'summary')!;

    expect(indexed.compactionBySourceId.get('a')?.map((event) => event.beforeModelCall)).toEqual([
      3, 4,
    ]);
    expect(
      indexed.compactionsBySummaryId.get('summary')?.map((event) => event.beforeModelCall),
    ).toEqual([3, 4]);
    expect(source.points[source.points.length - 1]?.x).toBe(firstBoundary.x);
    expect(summary.points[0].x).toBe(firstBoundary.x);
    expect(layout.lineageConnectors.map((connector) => connector.compactionId)).toEqual([
      'compact-1',
    ]);
  });

  it('places terminal compaction at the right edge without a summary ribbon', () => {
    const analysis = testAnalysis();
    analysis.modelCalls = analysis.modelCalls.slice(0, 2).map((call, index) => ({
      ...call,
      contextItemIds: ['a'],
      addedItemIds: index === 0 ? ['a'] : [],
      droppedItemIds: [],
      transitionItemCounts:
        index === 0 ? { added: 1, retained: 0, dropped: 0 } : { added: 0, retained: 1, dropped: 0 },
      compactionBefore: null,
    }));
    analysis.contextItems = [
      {
        ...analysis.contextItems[0],
        presence: [{ startCall: 1, endCall: 2 }],
        firstModelCall: 1,
        lastModelCall: 2,
      },
      {
        id: 'terminal-summary',
        kind: 'compactionSummary',
        label: 'Terminal summary',
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
      },
    ];
    analysis.compactions = [
      {
        id: 'terminal-compaction',
        beforeModelCall: 3,
        sourceItemIds: ['a'],
        retainedItemIds: [],
        summaryItemId: 'terminal-summary',
        tokensBefore: 100,
      },
    ];
    analysis.lineage = [{ from: 'a', to: 'terminal-summary', kind: 'frameworkCompaction' }];

    const layout = layoutContextRiver(indexAnalysis(analysis), options);
    expect(layout.compactions[0].x).toBe(options.width - options.margin.right);
    const source = layout.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    expect(source.points[source.points.length - 1].x).toBe(layout.compactions[0].x);
    expect(source.points[source.points.length - 1].y0).toBe(
      source.points[source.points.length - 1].y1,
    );
    expect(layout.ribbons.some((ribbon) => ribbon.itemId === 'terminal-summary')).toBe(false);
  });

  it('returns a safe empty layout', () => {
    const analysis = testAnalysis();
    analysis.modelCalls = [];
    analysis.contextItems = [];
    analysis.compactions = [];
    analysis.lineage = [];
    const layout = layoutContextRiver(indexAnalysis(analysis), options);
    expect(layout.columns).toEqual([]);
    expect(layout.ribbons).toEqual([]);
  });
});
