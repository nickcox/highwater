import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { testAnalysis } from './test-data';
import { sessionScenario } from '../testing/session-scenarios';
import { layoutContextRiver } from './layout';
import { projectRiverHorizontally } from './horizontal-projection';
import type { RiverLayoutOptions } from './types';

const options: RiverLayoutOptions = {
  width: 960,
  height: 500,
  margin: { left: 42, right: 24, top: 36, bottom: 54 },
  minimumVisibleThickness: 1,
};

describe('canonical horizontal River projection', () => {
  it('matches native call, ribbon, singleton, compaction and lineage coordinates at every width', () => {
    for (const groupByKind of [false, true]) {
      const analysis = testAnalysis();
      // Includes a capped first boundary in addition to the existing interior compaction.
      analysis.compactions.push({
        ...analysis.compactions[0],
        id: 'first',
        beforeModelCall: 1,
        summaryItemId: 'gap',
      });
      const indexed = indexTestAnalysis(analysis);
      const source = layoutContextRiver(indexed, { ...options, groupByKind });
      for (const width of [70, 100, 200, 390, 750, 960, 1300, 32000]) {
        const projected = projectRiverHorizontally(source, options.width, width, options.margin);
        const native = layoutContextRiver(indexed, { ...options, width, groupByKind });
        expect(projected.layout.maxTotalDisplayWeight).toBe(native.maxTotalDisplayWeight);
        expect(projected.layout.innerWidth).toBe(native.innerWidth);
        for (let i = 0; i < native.columns.length; i++) {
          expect(projected.layout.columns[i].x).toBeCloseTo(native.columns[i].x, 8);
          expect(projected.layout.columns[i].totalDisplayWeight).toBe(
            native.columns[i].totalDisplayWeight,
          );
        }
        native.ribbons.forEach((ribbon, i) => {
          const actual = projected.layout.ribbons[i];
          expect(actual.key).toBe(ribbon.key);
          expect(actual.isSubpixel).toBe(ribbon.isSubpixel);
          expect(actual.memberItemIds).toEqual(ribbon.memberItemIds);
          expect(actual.points).toHaveLength(ribbon.points.length);
          actual.points.forEach((point, j) => {
            expect(point.x * projected.scale + projected.offset).toBeCloseTo(ribbon.points[j].x, 8);
            expect(point.y0).toBe(ribbon.points[j].y0);
            expect(point.y1).toBe(ribbon.points[j].y1);
          });
        });
        native.compactions.forEach((event, i) =>
          expect(projected.layout.compactions[i].x).toBeCloseTo(event.x, 8),
        );
        native.lineageConnectors.forEach((connector, i) => {
          for (const field of ['path', 'mergePath'] as const) {
            const actual = projected.layout.lineageConnectors[i][field]
              .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!
              .map(Number);
            const expected = connector[field].match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
            actual.forEach((number, j) =>
              expect(
                j % 2 === 0 ? number * projected.scale + projected.offset : number,
              ).toBeCloseTo(expected[j], 8),
            );
          }
          expect(
            projected.layout.lineageConnectors[i].targetX * projected.scale + projected.offset,
          ).toBeCloseTo(connector.targetX, 8);
        });
      }
    }
  });
  it('shares long ordinary paths and point arrays instead of rewriting every appearance', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const source = layoutContextRiver(indexed, options);
    const before = structuredClone(source);
    for (const width of [300, 1400, 2000]) {
      const projected = projectRiverHorizontally(source, options.width, width, options.margin);
      for (const ribbon of source.ribbons.filter(
        (r) => !r.points[0].xBasis && !r.points[r.points.length - 1].xBasis,
      )) {
        const actual = projected.layout.ribbons.find((r) => r.key === ribbon.key)!;
        expect(actual).toBe(ribbon);
        expect(actual.points).toBe(ribbon.points);
        expect(actual.path).toBe(ribbon.path);
      }
    }
    expect(source).toEqual(before);
  });
  it('handles single calls, empty calls and collapsed width without fabricating geometry', () => {
    for (const scenario of ['terminalSummaryOnly', 'singleCall'] as const) {
      const analysis = sessionScenario(scenario);
      const source = layoutContextRiver(indexTestAnalysis(analysis), options);
      const projected = projectRiverHorizontally(source, options.width, 390, options.margin);
      const native = layoutContextRiver(indexTestAnalysis(analysis), { ...options, width: 390 });
      expect(projected.layout.columns).toEqual(native.columns);
      expect(projected.layout.compactions).toEqual(native.compactions);
      expect(
        projectRiverHorizontally(source, options.width, 20, options.margin).layout.ribbons,
      ).toEqual([]);
    }
  });
});
