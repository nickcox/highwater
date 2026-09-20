import { scaleLinear } from 'd3-scale';
import { area, curveLinear, curveMonotoneX } from 'd3-shape';
import type { IndexedAnalysis } from '../types';
import type {
  CallColumn,
  ContextRiverLayout,
  RibbonPoint,
  RibbonSegment,
  RiverLayoutOptions,
} from './types';

function pathFor(points: readonly RibbonPoint[], linear: boolean): string {
  return (
    area<RibbonPoint>()
      .x((point) => point.x)
      .y0((point) => point.y0)
      .y1((point) => point.y1)
      .curve(linear ? curveLinear : curveMonotoneX)(points) ?? ''
  );
}

function midpoint(point: RibbonPoint): number {
  return (point.y0 + point.y1) / 2;
}

export function layoutContextRiver(
  indexed: IndexedAnalysis,
  options: RiverLayoutOptions,
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
  const step = callCount > 1 ? innerWidth / (callCount - 1) : innerWidth;
  const xByCall = new Map<number, number>();
  for (const [position, call] of analysis.modelCalls.entries()) {
    xByCall.set(
      call.index,
      callCount > 1 ? options.margin.left + position * step : options.margin.left + innerWidth / 2,
    );
  }

  const weightFor = (call: (typeof analysis.modelCalls)[number], itemId: string): number => {
    const item = itemById.get(itemId);
    if (!item) return 0;
    if (analysis.displayWeightUnit === 'calculatedTokens' || analysis.displayWeightUnit === 'estimatedTokens') {
      return indexed.itemEstimateByProfile.get(itemId)?.get(call.tokenizationProfileId ?? '')?.tokens ?? 0;
    }
    return 1;
  };

  const columns: CallColumn[] = analysis.modelCalls.map((call) => ({
    callIndex: call.index,
    x: xByCall.get(call.index) ?? options.margin.left,
    totalDisplayWeight: call.contextItemIds.reduce((total, id) => total + weightFor(call, id), 0),
  }));
  const maxTotalDisplayWeight = Math.max(0, ...columns.map((column) => column.totalDisplayWeight));
  const y = scaleLinear()
    .domain([0, Math.max(1, maxTotalDisplayWeight)])
    .range([options.margin.top + innerHeight, options.margin.top]);
  const geometry = new Map<string, Map<number, RibbonPoint>>();

  for (const call of analysis.modelCalls) {
    let cumulative = 0;
    for (const itemId of indexed.orderedItemIdsByCall.get(call.index) ?? []) {
      const item = itemById.get(itemId);
      if (!item) continue;
      const before = y(cumulative);
      cumulative += weightFor(call, item.id);
      const after = y(cumulative);
      const point: RibbonPoint = {
        callIndex: call.index,
        x: xByCall.get(call.index) ?? options.margin.left,
        y0: Math.min(before, after),
        y1: Math.max(before, after),
      };
      const itemGeometry = geometry.get(itemId) ?? new Map<number, RibbonPoint>();
      itemGeometry.set(call.index, point);
      geometry.set(itemId, itemGeometry);
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
  for (const item of analysis.contextItems) {
    for (const [rangeIndex, range] of item.presence.entries()) {
      let points: RibbonPoint[] = [];
      for (let callIndex = range.startCall; callIndex <= range.endCall; callIndex += 1) {
        const point = geometry.get(item.id)?.get(callIndex);
        if (point) points.push(point);
      }
      if (points.length === 0) continue;
      let touchesCompaction = false;
      const sourceCompaction = analysis.compactions.find(
        (compaction) =>
          compaction.beforeModelCall === range.endCall + 1 &&
          compaction.sourceItemIds.includes(item.id),
      );
      if (sourceCompaction) {
        const last = points[points.length - 1];
        const middle = midpoint(last);
        points = [
          ...points,
          {
            callIndex: sourceCompaction.beforeModelCall,
            x: boundaryX(sourceCompaction.beforeModelCall),
            y0: middle,
            y1: middle,
          },
        ];
        touchesCompaction = true;
      }
      const summaryCompaction = analysis.compactions.find(
        (compaction) =>
          compaction.beforeModelCall === range.startCall &&
          compaction.summaryItemId === item.id,
      );
      if (summaryCompaction) {
        const first = points[0];
        points = [
          {
            ...first,
            x: boundaryX(summaryCompaction.beforeModelCall),
          },
          ...points,
        ];
        touchesCompaction = true;
      }
      if (points.length === 1) {
        const only = points[0];
        const halfWidth = Math.max(5, Math.min(step * 0.28, 18));
        points = [
          { ...only, x: Math.max(options.margin.left, only.x - halfWidth) },
          { ...only, x: Math.min(options.width - options.margin.right, only.x + halfWidth) },
        ];
      }
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
      });
    }
  }

  const lineageConnectors = analysis.compactions.flatMap((compaction) => {
    const summaryPoint = geometry.get(compaction.summaryItemId)?.get(compaction.beforeModelCall);
    if (!summaryPoint) return [];
    const summaryY = midpoint(summaryPoint);
    const boundary = boundaryX(compaction.beforeModelCall);
    return analysis.lineage
      .filter(
        (edge) =>
          edge.kind === 'frameworkCompaction' &&
          edge.to === compaction.summaryItemId &&
          compaction.sourceItemIds.includes(edge.from),
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
            path: `M ${sourcePoint.x} ${sourceY} C ${boundary - control} ${sourceY}, ${boundary + control} ${summaryY}, ${boundary} ${summaryY}`,
          },
        ];
      });
  });

  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('tokenplume-layout-end');
    performance.measure('tokenplume-layout-river', 'tokenplume-layout-start', 'tokenplume-layout-end');
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
