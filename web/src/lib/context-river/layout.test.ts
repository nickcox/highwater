import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { curveLinear, curveMonotoneX, line, type CurveFactory } from 'd3-shape';
import { layoutContextRiver, withoutFlatInteriors } from './layout';
import type { RibbonPoint } from './types';
import { testAnalysis } from './test-data';
import { versionScenario } from '../testing/version-scenario';

const options = {
  width: 800,
  height: 400,
  margin: { top: 20, right: 20, bottom: 40, left: 40 },
  minimumVisibleThickness: 1,
};

describe('layoutContextRiver', () => {
  it('builds deterministic, non-overlapping stacks and separate gap segments', () => {
    const indexed = indexTestAnalysis(testAnalysis());
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
    const indexed = indexTestAnalysis(testAnalysis());
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
    const layout = layoutContextRiver(indexTestAnalysis(testAnalysis()), options);
    const segment = layout.ribbons.find(
      (ribbon) => ribbon.itemId === 'gap' && ribbon.startCall === 1,
    )!;
    expect(segment.points).toHaveLength(2);
    expect(segment.points[1].x).toBeGreaterThan(segment.points[0].x);
    expect(segment.path).not.toBe('');
  });

  it('places honest compaction geometry at the midpoint', () => {
    const layout = layoutContextRiver(indexTestAnalysis(testAnalysis()), options);
    const boundary = layout.compactions[0];
    expect(boundary.x).toBe((layout.columns[1].x + layout.columns[2].x) / 2);
    const source = layout.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    const sourceEnd = source.points[source.points.length - 1];
    expect(sourceEnd.x).toBe(layout.columns[1].x);
    expect(sourceEnd.y1).toBeGreaterThan(sourceEnd.y0);
    const merge = layout.lineageConnectors[0];
    expect(merge.sourceX).toBe(sourceEnd.x);
    expect(merge.sourceY0).toBe(sourceEnd.y0);
    expect(merge.sourceY1).toBe(sourceEnd.y1);
    expect(merge.targetX).toBe(boundary.x);
    expect(merge.mergePath).toContain(' C ');
    const summary = layout.ribbons.find((ribbon) => ribbon.itemId === 'summary')!;
    expect(summary.points[0].x).toBe(boundary.x);
    expect(merge.summaryY0).toBe(summary.points[0].y0);
    expect(merge.summaryY1).toBe(summary.points[0].y1);
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
    const indexed = indexTestAnalysis(analysis);
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
    expect(source.points[source.points.length - 1]?.x).toBe(layout.columns[1].x);
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

    const layout = layoutContextRiver(indexTestAnalysis(analysis), options);
    expect(layout.compactions[0].x).toBe(options.width - options.margin.right);
    const source = layout.ribbons.find((ribbon) => ribbon.itemId === 'a')!;
    expect(source.points[source.points.length - 1].x).toBe(layout.compactions[0].x);
    expect(source.points[source.points.length - 1].y0).toBe(
      source.points[source.points.length - 1].y1,
    );
    expect(layout.ribbons.some((ribbon) => ribbon.itemId === 'terminal-summary')).toBe(false);
  });

  it('groups only visual geometry while preserving per-call totals and member identities', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const individual = layoutContextRiver(indexed, options);
    const grouped = layoutContextRiver(indexed, { ...options, groupByKind: true });
    expect(grouped.ribbons.every((ribbon) => ribbon.groupKind !== undefined)).toBe(true);
    expect(new Set(grouped.ribbons.flatMap((ribbon) => ribbon.memberItemIds ?? [])).size).toBe(
      indexed.analysis.contextItems.length,
    );
    expect(grouped.columns.map((column) => column.totalDisplayWeight)).toEqual(
      individual.columns.map((column) => column.totalDisplayWeight),
    );
    expect(grouped.maxTotalDisplayWeight).toBe(individual.maxTotalDisplayWeight);
    expect(grouped.compactions).toEqual(individual.compactions);
    expect(grouped.lineageConnectors).toEqual([]);
  });

  it('returns a safe empty layout', () => {
    const analysis = testAnalysis();
    analysis.modelCalls = [];
    analysis.contextItems = [];
    analysis.compactions = [];
    analysis.lineage = [];
    const layout = layoutContextRiver(indexTestAnalysis(analysis), options);
    expect(layout.columns).toEqual([]);
    expect(layout.ribbons).toEqual([]);
  });
});

describe('withoutFlatInteriors', () => {
  const at = (callIndex: number, y0: number, y1: number): RibbonPoint => ({
    callIndex,
    x: callIndex * 10,
    y0,
    y1,
  });
  // A ribbon that is flat, rises, is flat again, then moves only its lower edge.
  const points = [
    at(0, 50, 60),
    at(1, 50, 60),
    at(2, 50, 60),
    at(3, 50, 60),
    at(4, 40, 52),
    at(5, 40, 52),
    at(6, 40, 52),
    at(7, 38, 52),
    at(8, 38, 52),
  ];

  it('keeps the ends and every point where an edge changes', () => {
    expect(withoutFlatInteriors(points).map((point) => point.callIndex)).toEqual([
      0, 3, 4, 6, 7, 8,
    ]);
    expect(withoutFlatInteriors(points.slice(0, 2))).toHaveLength(2);
  });

  it('leaves both curves unchanged', () => {
    // Records each segment and evaluates the edge's y at an x, solving the Bézier for x.
    const edgeAt = (curve: CurveFactory, input: readonly RibbonPoint[], edge: 'y0' | 'y1') => {
      const segments: number[][] = [];
      let current = [0, 0];
      const context = {
        moveTo: (x: number, y: number) => (current = [x, y]),
        lineTo: (x: number, y: number) => {
          segments.push([...current, current[0]!, current[1]!, x, y, x, y]);
          current = [x, y];
        },
        bezierCurveTo: (...control: number[]) => {
          segments.push([...current, ...control]);
          current = control.slice(4);
        },
        closePath: () => undefined,
      };
      line<RibbonPoint>()
        .x((point) => point.x)
        .y((point) => point[edge])
        .curve(curve)
        .context(context as unknown as CanvasRenderingContext2D)(input);
      return (x: number): number => {
        const [x0, y0, x1, y1, x2, y2, x3, y3] = segments.find(
          (segment) => segment[0]! <= x && x <= segment[6]!,
        )!;
        const bezier = (t: number, a: number, b: number, c: number, d: number) =>
          (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
        let low = 0,
          high = 1;
        for (let step = 0; step < 60; step += 1) {
          const middle = (low + high) / 2;
          if (bezier(middle, x0!, x1!, x2!, x3!) < x) low = middle;
          else high = middle;
        }
        return bezier(low, y0!, y1!, y2!, y3!);
      };
    };
    for (const curve of [curveMonotoneX, curveLinear]) {
      for (const edge of ['y0', 'y1'] as const) {
        const full = edgeAt(curve, points, edge);
        const reduced = edgeAt(curve, withoutFlatInteriors(points), edge);
        for (let x = 0; x <= 80; x += 0.25) expect(reduced(x)).toBeCloseTo(full(x), 9);
      }
    }
  });
});

describe('versions in the River', () => {
  it('runs each version on to the next and marks only where the system prompt changes', () => {
    const river = layoutContextRiver(indexTestAnalysis(versionScenario()), options);
    const ribbon = (itemId: string) => river.ribbons.find((segment) => segment.itemId === itemId)!;
    expect(ribbon('s1').points.map((point) => point.callIndex)).toEqual([1, 2]);
    expect(ribbon('s2').points.map((point) => point.callIndex)).toEqual([2, 3, 4]);
    expect(ribbon('s3').points.map((point) => point.callIndex)).toEqual([4, 4]);
    expect(ribbon('web1').points.map((point) => point.callIndex)).toEqual([2, 3, 4]);
    expect(ribbon('fetch').points.map((point) => point.callIndex)).toEqual([2, 3]);
    expect(river.versionMarks.map((mark) => [mark.itemId, mark.callIndex])).toEqual([
      ['s2', 2],
      ['s3', 4],
    ]);
    const s3Start = ribbon('s3').points.find((point) => point.callIndex === 4)!;
    expect(river.versionMarks[1]).toMatchObject({ y0: s3Start.y0, y1: s3Start.y1 });
  });
});
