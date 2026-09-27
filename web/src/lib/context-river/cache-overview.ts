import type { CacheShareSegment, CacheTrackPoint } from './economics-track';

export interface CacheOverviewBin {
  startCallIndex: number;
  endCallIndex: number;
  memberCallIndices: number[];
  tokenTotals: CacheShareSegment[];
  promptTokenTotal: number;
  completeCallCount: number;
  memberCount: number;
  coverageLabel: string;
  semanticCategoriesCompatible: boolean;
  shareComplete: boolean;
}

/**
 * Build weighted overview bins only when there are more calls than usable bars.
 * Percentages are calculated from summed buckets, never by averaging call ratios.
 */
export function binCachePoints(
  points: readonly CacheTrackPoint[],
  maximumBins: number,
): CacheOverviewBin[] {
  if (points.length === 0 || maximumBins < 1 || points.length <= maximumBins) return [];
  const bins: CacheOverviewBin[] = [];
  const binSize = Math.ceil(points.length / maximumBins);
  for (let start = 0; start < points.length; start += binSize) {
    const members = points.slice(start, start + binSize);
    const totals = new Map<CacheShareSegment['kind'], CacheShareSegment>();
    let promptTokenTotal = 0;
    let completeCallCount = 0;
    for (const point of members) {
      if (point.shareStatus !== 'complete' || point.shareDenominator === null) continue;
      completeCallCount += 1;
      promptTokenTotal += point.shareDenominator;
      for (const segment of point.shareSegments) {
        const previous = totals.get(segment.kind);
        totals.set(segment.kind, {
          ...segment,
          value: (previous?.value ?? 0) + segment.value,
          percentage: 0,
        });
      }
    }
    const signatures = new Set(
      members
        .filter((point) => point.shareStatus === 'complete')
        .map((point) =>
          point.shareSegments
            .map((segment) => segment.kind)
            .sort()
            .join('|'),
        ),
    );
    const semanticCategoriesCompatible = signatures.size <= 1;
    const tokenTotals = [...totals.values()].map((segment) => ({
      ...segment,
      percentage: promptTokenTotal > 0 ? (segment.value / promptTokenTotal) * 100 : 0,
    }));
    const memberCallIndices = members.map((point) => point.callIndex);
    bins.push({
      startCallIndex: memberCallIndices[0]!,
      endCallIndex: memberCallIndices[memberCallIndices.length - 1]!,
      memberCallIndices,
      tokenTotals,
      promptTokenTotal,
      completeCallCount,
      memberCount: members.length,
      coverageLabel: semanticCategoriesCompatible
        ? `${completeCallCount} of ${members.length} calls complete`
        : `${completeCallCount} of ${members.length} calls complete; categories vary by API`,
      semanticCategoriesCompatible,
      shareComplete:
        completeCallCount === members.length &&
        promptTokenTotal > 0 &&
        semanticCategoriesCompatible,
    });
  }
  return bins;
}
