import { scaleLinear } from 'd3-scale';
import { compactionMergePaths } from './compaction-merge';
import { area, curveLinear, curveMonotoneX } from 'd3-shape';
import type { ContextItemKind, IndexedAnalysis } from '../types';
import type {
  CallColumn,
  ContextRiverLayout,
  RibbonPoint,
  RibbonSegment,
  RiverLayoutOptions,
} from './types';

export function pathFor(points: readonly RibbonPoint[], linear: boolean): string {
  return (
    area<RibbonPoint>()
      .x((point) => point.x)
      .y0((point) => point.y0)
      .y1((point) => point.y1)
      .curve(linear ? curveLinear : curveMonotoneX)(withoutFlatInteriors(points)) ?? ''
  );
}

/**
 * Drops each point whose neighbours on both sides have the same edges as it, so a long-lived
 * item does not add a path command for every call. The drawn shape is unchanged: both curves
 * draw a flat segment as a straight line, and the monotone curve gives a point next to a flat
 * segment a horizontal tangent whether or not the flat run's interior points are present.
 */
export function withoutFlatInteriors(points: readonly RibbonPoint[]): readonly RibbonPoint[] {
  if (points.length < 3) return points;
  const kept = [points[0]!];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!,
      point = points[index]!,
      next = points[index + 1]!;
    const flat =
      previous.y0 === point.y0 &&
      point.y0 === next.y0 &&
      previous.y1 === point.y1 &&
      point.y1 === next.y1;
    if (!flat) kept.push(point);
  }
  kept.push(points[points.length - 1]!);
  return kept;
}

function midpoint(point: RibbonPoint): number {
  return (point.y0 + point.y1) / 2;
}

function contiguousRanges(indices: readonly number[]): number[][] {
  const sorted = [...new Set(indices)].sort((left, right) => left - right);
  const ranges: number[][] = [];
  for (const index of sorted) {
    const current = ranges[ranges.length - 1];
    if (current && index === current[current.length - 1]! + 1) current.push(index);
    else ranges.push([index]);
  }
  return ranges;
}

function padSingleton(
  points: RibbonPoint[],
  step: number,
  options: RiverLayoutOptions,
): RibbonPoint[] {
  if (points.length !== 1) return points;
  const only = points[0]!;
  const halfWidth = Math.max(5, Math.min(step * 0.28, 18));
  return [
    {
      ...only,
      x: Math.max(options.margin.left, only.x - halfWidth),
      xBasis: { kind: 'singleton', callIndex: only.callIndex, side: -1 },
    },
    {
      ...only,
      x: Math.min(options.width - options.margin.right, only.x + halfWidth),
      xBasis: { kind: 'singleton', callIndex: only.callIndex, side: 1 },
    },
  ];
}

function displayWeightFor(
  indexed: IndexedAnalysis,
  call: IndexedAnalysis['analysis']['modelCalls'][number],
  itemId: string,
): number {
  if (!indexed.itemById.has(itemId)) return 0;
  if (
    indexed.analysis.displayWeightUnit === 'calculatedTokens' ||
    indexed.analysis.displayWeightUnit === 'estimatedTokens'
  ) {
    return (
      indexed.itemEstimateByProfile.get(itemId)?.get(call.tokenizationProfileId ?? '')?.tokens ?? 0
    );
  }
  return 1;
}

export function layoutCallColumns(
  indexed: IndexedAnalysis,
  width: number,
  margin: RiverLayoutOptions['margin'],
): CallColumn[] {
  const calls = indexed.analysis.modelCalls;
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  if (calls.length === 0 || innerWidth === 0) return [];
  const step = calls.length > 1 ? innerWidth / (calls.length - 1) : innerWidth;
  return calls.map((call, position) => ({
    callIndex: call.index,
    x: calls.length > 1 ? margin.left + position * step : margin.left + innerWidth / 2,
    totalDisplayWeight: call.contextItemIds.reduce(
      (total, itemId) => total + displayWeightFor(indexed, call, itemId),
      0,
    ),
  }));
}

export function layoutContextRiver(
  indexed: IndexedAnalysis,
  options: RiverLayoutOptions,
  precomputedColumns?: readonly CallColumn[],
): ContextRiverLayout {
  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('tokenplume-layout-start');
  }
  const { analysis, itemById } = indexed;
  const innerWidth = Math.max(0, options.width - options.margin.left - options.margin.right);
  const innerHeight = Math.max(0, options.height - options.margin.top - options.margin.bottom);
  if (innerWidth === 0 || innerHeight === 0) {
    return {
      chartUnit: analysis.displayWeightUnit,
      columns: [],
      ribbons: [],
      compactions: [],
      lineageConnectors: [],
      innerWidth,
      innerHeight,
      maxTotalDisplayWeight: 0,
    };
  }
  if (analysis.modelCalls.length === 0) {
    return {
      chartUnit: analysis.displayWeightUnit,
      columns: [],
      ribbons: [],
      compactions: analysis.compactions.map((compaction) => ({
        compactionId: compaction.id,
        beforeModelCall: compaction.beforeModelCall,
        x: options.margin.left + innerWidth,
      })),
      lineageConnectors: [],
      innerWidth,
      innerHeight,
      maxTotalDisplayWeight: 0,
    };
  }

  const callCount = analysis.modelCalls.length;
  const groupByKind = options.groupByKind === true;
  const groupMembers = new Map<ContextItemKind, string[]>();
  if (groupByKind) {
    for (const item of analysis.contextItems) {
      const members = groupMembers.get(item.kind) ?? [];
      members.push(item.id);
      groupMembers.set(item.kind, members);
    }
  }
  const columns = precomputedColumns
    ? [...precomputedColumns]
    : layoutCallColumns(indexed, options.width, options.margin);
  const step = callCount > 1 ? innerWidth / (callCount - 1) : innerWidth;
  const xByCall = new Map(columns.map((column) => [column.callIndex, column.x]));
  const maxTotalDisplayWeight = Math.max(0, ...columns.map((column) => column.totalDisplayWeight));
  const requestedDomainMax = options.verticalDomainMax ?? maxTotalDisplayWeight;
  const verticalDomainMax =
    Number.isFinite(requestedDomainMax) && requestedDomainMax >= 0
      ? requestedDomainMax
      : maxTotalDisplayWeight;
  const y = scaleLinear()
    .domain([0, Math.max(1, verticalDomainMax)])
    .range([options.margin.top + innerHeight, options.margin.top]);
  const geometry = new Map<string, Map<number, RibbonPoint>>();
  const valueByCall = new Map<string, Map<number, number>>();

  for (const call of analysis.modelCalls) {
    let cumulative = 0;
    const entries = groupByKind
      ? [...groupMembers.entries()].map(([kind, memberItemIds]) => ({
          key: `kind:${kind}`,
          memberItemIds,
        }))
      : (indexed.orderedItemIdsByCall.get(call.index) ?? []).map((itemId) => ({
          key: itemId,
          memberItemIds: [itemId],
        }));
    for (const entry of entries) {
      const weight = entry.memberItemIds.reduce(
        (total, itemId) =>
          total +
          (indexed.contextSetByCall.get(call.index)?.has(itemId)
            ? displayWeightFor(indexed, call, itemId)
            : 0),
        0,
      );
      if (
        weight <= 0 &&
        !entry.memberItemIds.some((itemId) => indexed.contextSetByCall.get(call.index)?.has(itemId))
      )
        continue;
      const before = y(cumulative);
      cumulative += weight;
      const after = y(cumulative);
      const point: RibbonPoint = {
        callIndex: call.index,
        x: xByCall.get(call.index) ?? options.margin.left,
        y0: Math.min(before, after),
        y1: Math.max(before, after),
      };
      const itemGeometry = geometry.get(entry.key) ?? new Map<number, RibbonPoint>();
      itemGeometry.set(call.index, point);
      geometry.set(entry.key, itemGeometry);
      const values = valueByCall.get(entry.key) ?? new Map<number, number>();
      values.set(call.index, weight);
      valueByCall.set(entry.key, values);
    }
  }

  const boundaryX = (beforeModelCall: number): number => {
    const current = xByCall.get(beforeModelCall);
    const previous = xByCall.get(beforeModelCall - 1);
    if (current !== undefined && previous !== undefined) return (previous + current) / 2;
    if (current !== undefined) return current - Math.min(step / 2, 16);
    return options.margin.left + innerWidth;
  };

  const compactions = analysis.compactions.map((compaction) => ({
    compactionId: compaction.id,
    beforeModelCall: compaction.beforeModelCall,
    x: boundaryX(compaction.beforeModelCall),
  }));

  const ribbons: RibbonSegment[] = [];
  if (groupByKind) {
    for (const [kind, memberItemIds] of groupMembers) {
      const presentCalls = analysis.modelCalls
        .filter((call) =>
          memberItemIds.some((itemId) => indexed.contextSetByCall.get(call.index)?.has(itemId)),
        )
        .map((call) => call.index);
      const ranges = contiguousRanges(presentCalls);
      for (const [rangeIndex, range] of ranges.entries()) {
        const points = range.flatMap((callIndex) => {
          const point = geometry.get(`kind:${kind}`)?.get(callIndex);
          return point ? [point] : [];
        });
        if (points.length === 0) continue;
        const paddedPoints = padSingleton(points, step, options);
        const isSubpixel = paddedPoints.some(
          (point) => point.y1 > point.y0 && point.y1 - point.y0 < options.minimumVisibleThickness,
        );
        const path = pathFor(paddedPoints, false);
        ribbons.push({
          key: `kind:${kind}:${rangeIndex}`,
          itemId: `kind:${kind}`,
          groupKind: kind,
          memberItemIds: [...memberItemIds],
          valueByCall: valueByCall.get(`kind:${kind}`),
          rangeIndex,
          startCall: range[0]!,
          endCall: range[range.length - 1]!,
          points: paddedPoints,
          path,
          hitPath: path,
          isSubpixel,
        });
      }
    }
  } else {
    for (const item of analysis.contextItems) {
      for (const [rangeIndex, range] of item.presence.entries()) {
        let points: RibbonPoint[] = [];
        for (let callIndex = range.startCall; callIndex <= range.endCall; callIndex += 1) {
          const point = geometry.get(item.id)?.get(callIndex);
          if (point) points.push(point);
        }
        if (points.length === 0) continue;
        let touchesCompaction = false;
        const sourceCompaction = (indexed.compactionBySourceId.get(item.id) ?? []).find(
          (compaction) => compaction.beforeModelCall === range.endCall + 1,
        );
        const mergeTarget =
          sourceCompaction &&
          geometry.get(sourceCompaction.summaryItemId)?.get(sourceCompaction.beforeModelCall);
        // Preserve existing historical interpolation; only replace the end cap.
        if (mergeTarget) touchesCompaction = true;
        if (sourceCompaction && !mergeTarget) {
          const last = points[points.length - 1];
          const middle = midpoint(last);
          points = [
            ...points,
            {
              callIndex: sourceCompaction.beforeModelCall,
              x: boundaryX(sourceCompaction.beforeModelCall),
              xBasis: { kind: 'boundary', beforeModelCall: sourceCompaction.beforeModelCall },
              y0: middle,
              y1: middle,
            },
          ];
          touchesCompaction = true;
        }
        const summaryCompaction = (indexed.compactionsBySummaryId.get(item.id) ?? []).find(
          (compaction) => compaction.beforeModelCall === range.startCall,
        );
        if (summaryCompaction) {
          const first = points[0];
          points = [
            {
              ...first,
              x: boundaryX(summaryCompaction.beforeModelCall),
              xBasis: { kind: 'boundary', beforeModelCall: summaryCompaction.beforeModelCall },
            },
            ...points,
          ];
          touchesCompaction = true;
        }
        // A merged singleton is padded only on the left; its right edge stays
        // at the last actual call so the decorative flow owns the transition.
        points =
          points.length === 1 && mergeTarget
            ? [padSingleton(points, step, options)[0], points[0]]
            : padSingleton(points, step, options);
        const isSubpixel = points.some(
          (point) => point.y1 > point.y0 && point.y1 - point.y0 < options.minimumVisibleThickness,
        );
        const path = pathFor(points, touchesCompaction);
        ribbons.push({
          key: `${item.id}:${rangeIndex}`,
          itemId: item.id,
          rangeIndex,
          startCall: range.startCall,
          endCall: range.endCall,
          points,
          path,
          hitPath: path,
          isSubpixel,
          linear: touchesCompaction,
        });
      }
    }
  }

  const lineageConnectors = groupByKind
    ? []
    : analysis.compactions.flatMap((compaction) => {
        const summaryPoint = geometry
          .get(compaction.summaryItemId)
          ?.get(compaction.beforeModelCall);
        if (!summaryPoint) return [];
        const summaryY = midpoint(summaryPoint);
        const boundary = boundaryX(compaction.beforeModelCall);
        return (indexed.incomingLineage.get(compaction.summaryItemId) ?? [])
          .filter(
            (edge) =>
              edge.kind === 'frameworkCompaction' && compaction.sourceItemIds.includes(edge.from),
          )
          .flatMap((edge) => {
            const sourcePoint = geometry.get(edge.from)?.get(compaction.beforeModelCall - 1);
            if (!sourcePoint) return [];
            const sourceY = midpoint(sourcePoint);
            const control = Math.max(8, Math.min(step * 0.25, 24));
            return [
              {
                key: `${compaction.id}:${edge.from}:${edge.to}`,
                fromItemId: edge.from,
                toItemId: edge.to,
                compactionId: compaction.id,
                sourceX: sourcePoint.x,
                sourceY,
                sourceY0: sourcePoint.y0,
                sourceY1: sourcePoint.y1,
                targetX: boundary,
                summaryY,
                summaryY0: summaryPoint.y0,
                summaryY1: summaryPoint.y1,
                ...compactionMergePaths(
                  sourcePoint.x,
                  sourcePoint.y0,
                  sourcePoint.y1,
                  boundary,
                  summaryPoint.y0,
                  summaryPoint.y1,
                  control,
                ),
              },
            ];
          });
      });

  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('tokenplume-layout-end');
    performance.measure(
      'tokenplume-layout-river',
      'tokenplume-layout-start',
      'tokenplume-layout-end',
    );
  }
  return {
    chartUnit: analysis.displayWeightUnit,
    columns,
    ribbons,
    compactions,
    lineageConnectors,
    innerWidth,
    innerHeight,
    maxTotalDisplayWeight,
  };
}
