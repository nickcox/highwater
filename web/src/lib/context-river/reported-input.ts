import { area, line, curveLinear } from 'd3-shape';
import type { IndexedAnalysis } from '../types';
import type { CallColumn, RiverLayoutOptions } from './types';

export interface InputComparison {
  callIndex: number;
  reconstructed: number;
  reported: number;
  gap: number;
}

/** Compare only numeric token geometry with a complete recorded prompt bucket sum.
 * This is a presentation difference, not proof of missing instructions or items.
 */
export function inputComparisons(
  indexed: IndexedAnalysis,
  columns: readonly CallColumn[],
): Map<number, InputComparison> {
  const result = new Map<number, InputComparison>();
  if (indexed.analysis.displayWeightUnit === 'unavailable') return result;
  for (const column of columns) {
    const call = indexed.callByIndex.get(column.callIndex);
    if (
      !call ||
      call.stopReason === 'compaction-aggregate' ||
      call.reportedUsageCompleteness !== 'complete'
    )
      continue;
    const reported = call.reportedPromptTokens;
    const visible = call.tokenAnalysis.calculatedVisibleTokens;
    if (
      reported === null ||
      visible === null ||
      !call.tokenizationProfileId ||
      !Number.isSafeInteger(reported) ||
      reported < 0 ||
      !Number.isSafeInteger(visible) ||
      visible < 0 ||
      !Number.isSafeInteger(column.totalDisplayWeight) ||
      column.totalDisplayWeight < 0 ||
      column.totalDisplayWeight !== visible
    )
      continue;
    result.set(call.index, {
      callIndex: call.index,
      reconstructed: visible,
      reported,
      gap: Math.max(0, reported - visible),
    });
  }
  return result;
}

/** Separate scale samples: never replace the item stack's recorded weights. */
export function inputScaleColumns(
  columns: readonly CallColumn[],
  comparisons: ReadonlyMap<number, InputComparison>,
): CallColumn[] {
  return columns.map((column) => ({
    ...column,
    totalDisplayWeight: Math.max(
      column.totalDisplayWeight,
      comparisons.get(column.callIndex)?.reported ?? 0,
    ),
  }));
}

interface Sample {
  x: number;
  halfWidth: number;
  reported: number;
  gap: number;
}
export interface InputReferenceRun {
  line: string;
  fill: string;
}

/** Linear interpolation only between adjacent comparable calls. Missing values
 * break runs; an isolated call gets a small, pixel-capped reference segment.
 * Fill is masked against the actual ribbons by the renderer, not added to them.
 */
export function layoutInputReferences(
  columns: readonly CallColumn[],
  comparisons: ReadonlyMap<number, InputComparison>,
  options: RiverLayoutOptions,
  domain: number,
): InputReferenceRun[] {
  const runs: Sample[][] = [];
  let current: Sample[] | null = null;
  for (const [position, column] of columns.entries()) {
    const comparison = comparisons.get(column.callIndex);
    if (!comparison) {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      runs.push(current);
    }
    const previous = columns[position - 1];
    const next = columns[position + 1];
    // An isolated reference must not reach an unavailable neighbour, even
    // when thousands of markers are fitted into a few screen pixels.
    const halfWidth = Math.max(
      0,
      Math.min(
        6,
        previous ? (column.x - previous.x) / 2 : Infinity,
        next ? (next.x - column.x) / 2 : Infinity,
      ),
    );
    current.push({ x: column.x, halfWidth, reported: comparison.reported, gap: comparison.gap });
  }
  const bottom = options.height - options.margin.bottom;
  const innerHeight = Math.max(0, bottom - options.margin.top);
  const y = (value: number) => bottom - (innerHeight * value) / Math.max(1, domain);
  const reference = line<Sample>()
    .x((sample) => sample.x)
    .y((sample) => y(sample.reported))
    .curve(curveLinear);
  const fill = area<Sample>()
    .x((sample) => sample.x)
    .y0(bottom)
    .y1((sample) => y(sample.reported))
    .curve(curveLinear);
  return runs.map((run) => {
    const samples =
      run.length === 1
        ? [
            { ...run[0], x: Math.max(options.margin.left, run[0].x - run[0].halfWidth) },
            {
              ...run[0],
              x: Math.min(options.width - options.margin.right, run[0].x + run[0].halfWidth),
            },
          ]
        : run;
    return {
      line: reference(samples) ?? '',
      fill: run.some((sample) => sample.gap > 0) ? (fill(samples) ?? '') : '',
    };
  });
}
