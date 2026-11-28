import { scaleLinear } from 'd3-scale';
import { compactionMergePaths } from './compaction-merge';
import { area, curveLinear, curveMonotoneX } from 'd3-shape';
import type { CompactionEvent, ContextItemKind, IndexedAnalysis } from '../types';
import type {
  CallColumn,
  ContextRiverLayout,
  LineageConnectorLayout,
  RibbonPoint,
  RibbonSegment,
  RiverLayoutOptions,
  VersionMarkLayout,
} from './types';

/**
 * The compaction's own call, when it is the call just before the compaction. Its marker is
 * drawn on that call; otherwise the marker is drawn between the calls either side of it.
 */
export function compactionMarkerCall(compaction: CompactionEvent): number | null {
  const own = compaction.details.summaryCall;
  return own !== null && own === compaction.beforeModelCall - 1 ? own : null;
}

/**
 * The compaction's own call, when it is the call just before the compaction and does not
 * contain the items the compaction removed. Pi records its compaction calls this way: the call
 * reads only the compaction's input. The removed and kept items' last call is then the one
 * before it.
 */
export function compactionCallOutsideContext(
  indexed: IndexedAnalysis,
  compaction: CompactionEvent,
): number | null {
  const own = compactionMarkerCall(compaction);
  const context = own === null ? undefined : indexed.contextSetByCall.get(own);
  if (own === null || !context || compaction.sourceItemIds.some((id) => context.has(id)))
    return null;
  return own;
}

/** How a compaction's flows run in the River. */
interface CompactionFlow {
  /** The last call with the items the compaction removed. */
  sourceCall: number;
  /**
   * The compaction's input, when the compaction's own call contains only that item. The
   * removed items flow into it at that call, and it flows into the summary. Otherwise the
   * removed items flow into the summary.
   */
  input: { itemId: string; callIndex: number } | null;
}

function compactionFlow(
  indexed: IndexedAnalysis,
  compaction: CompactionEvent,
  geometry: ReadonlyMap<string, ReadonlyMap<number, RibbonPoint>>,
): CompactionFlow {
  const own = compactionCallOutsideContext(indexed, compaction);
  if (own === null) return { sourceCall: compaction.beforeModelCall - 1, input: null };
  const [inputId, ...others] = indexed.callByIndex.get(own)?.contextItemIds ?? [];
  const presence = inputId === undefined ? undefined : indexed.itemById.get(inputId)?.presence;
  const point = inputId === undefined ? undefined : geometry.get(inputId)?.get(own);
  const usable =
    inputId !== undefined &&
    others.length === 0 &&
    presence?.length === 1 &&
    presence[0]!.startCall === own &&
    presence[0]!.endCall === own &&
    point !== undefined &&
    point.y1 > point.y0 &&
    geometry.get(compaction.summaryItemId)?.has(compaction.beforeModelCall) === true;
  return { sourceCall: own - 1, input: usable ? { itemId: inputId, callIndex: own } : null };
}

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

function thinnestThickness(points: readonly RibbonPoint[]): number {
  return points.reduce(
    (thinnest, point) => (point.y1 > point.y0 ? Math.min(thinnest, point.y1 - point.y0) : thinnest),
    Number.POSITIVE_INFINITY,
  );
}

export function layoutContextRiver(
  indexed: IndexedAnalysis,
  options: RiverLayoutOptions,
  precomputedColumns?: readonly CallColumn[],
): ContextRiverLayout {
  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('highwater-layout-start');
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
      versionMarks: [],
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
        ownCall: null,
        x: options.margin.left + innerWidth,
      })),
      lineageConnectors: [],
      versionMarks: [],
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

  const compactions = analysis.compactions.map((compaction) => {
    const own = compactionMarkerCall(compaction);
    const ownX = own === null ? undefined : xByCall.get(own);
    return {
      compactionId: compaction.id,
      beforeModelCall: compaction.beforeModelCall,
      ownCall: ownX === undefined ? null : own,
      x: ownX ?? boundaryX(compaction.beforeModelCall),
    };
  });
  const flows = new Map(
    groupByKind
      ? []
      : analysis.compactions.map((compaction) => [
          compaction.id,
          compactionFlow(indexed, compaction, geometry),
        ]),
  );
  const inputCallByItemId = new Map(
    [...flows.values()].flatMap((flow) =>
      flow.input ? [[flow.input.itemId, flow.input.callIndex] as const] : [],
    ),
  );
  // Kept items that the compaction's own call does not contain, such as Pi's recent messages,
  // system prompt and tools. Each flows across that call from its last call before it.
  const keptAcross = analysis.compactions.flatMap((compaction) => {
    const flow = flows.get(compaction.id);
    if (!flow || flow.sourceCall === compaction.beforeModelCall - 1) return [];
    return compaction.retainedItemIds.flatMap((itemId) => {
      const source = geometry.get(itemId)?.get(flow.sourceCall);
      const target = geometry.get(itemId)?.get(compaction.beforeModelCall);
      return source && target
        ? [{ compaction, itemId, sourceCall: flow.sourceCall, source, target }]
        : [];
    });
  });
  const keptAcrossByItemId = new Map<string, (typeof keptAcross)[number][]>();
  for (const kept of keptAcross)
    keptAcrossByItemId.set(kept.itemId, [...(keptAcrossByItemId.get(kept.itemId) ?? []), kept]);

  const ribbons: RibbonSegment[] = [];
  const versionMarks: VersionMarkLayout[] = [];
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
        const thinnest = thinnestThickness(paddedPoints);
        const isSubpixel = thinnest < options.minimumVisibleThickness;
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
          thinnest,
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
        const kept = keptAcrossByItemId.get(item.id) ?? [];
        const keptUntil = kept.some((across) => across.sourceCall === range.endCall);
        if (keptUntil) touchesCompaction = true;
        const sourceCompaction = (indexed.compactionBySourceId.get(item.id) ?? []).find(
          (compaction) => flows.get(compaction.id)?.sourceCall === range.endCall,
        );
        // A removed item flows into the compaction's input when it has one, otherwise into
        // the summary.
        const mergeInto = sourceCompaction
          ? (flows.get(sourceCompaction.id)?.input ?? {
              itemId: sourceCompaction.summaryItemId,
              callIndex: sourceCompaction.beforeModelCall,
            })
          : undefined;
        const mergeTarget = mergeInto && geometry.get(mergeInto.itemId)?.get(mergeInto.callIndex);
        // Preserve existing historical interpolation; only replace the end cap.
        if (mergeTarget) touchesCompaction = true;
        if (mergeInto && !mergeTarget) {
          const last = points[points.length - 1];
          const middle = midpoint(last);
          points = [
            ...points,
            {
              callIndex: mergeInto.callIndex,
              x: boundaryX(mergeInto.callIndex),
              xBasis: { kind: 'boundary', beforeModelCall: mergeInto.callIndex },
              y0: middle,
              y1: middle,
            },
          ];
          touchesCompaction = true;
        }
        const summaryCompaction = (indexed.compactionsBySummaryId.get(item.id) ?? []).find(
          (compaction) => compaction.beforeModelCall === range.startCall,
        );
        // A summary, a compaction's input, or a kept item after a compaction call that did not
        // contain it starts where the flows into it end.
        const flowsEndBefore =
          summaryCompaction?.beforeModelCall ??
          (inputCallByItemId.get(item.id) === range.startCall ||
          kept.some((across) => across.compaction.beforeModelCall === range.startCall)
            ? range.startCall
            : undefined);
        if (flowsEndBefore !== undefined) {
          const first = points[0];
          points = [
            {
              ...first,
              x: boundaryX(flowsEndBefore),
              xBasis: { kind: 'boundary', beforeModelCall: flowsEndBefore },
            },
            ...points,
          ];
          touchesCompaction = true;
        }
        // A version that is replaced at the next call runs on to the new version's first point,
        // so the two read as one ribbon that changes there. Only the system prompt is marked
        // where it changes: tool definitions are too thin for a mark to be told apart.
        const nextId = indexed.versionByItemId.get(item.id)?.nextId;
        const replacement =
          nextId &&
          rangeIndex === item.presence.length - 1 &&
          !sourceCompaction &&
          itemById.get(nextId)?.firstModelCall === range.endCall + 1
            ? geometry.get(nextId)?.get(range.endCall + 1)
            : undefined;
        if (replacement && nextId) {
          points = [...points, replacement];
          if (item.kind === 'system')
            versionMarks.push({
              key: `${nextId}:version`,
              itemId: nextId,
              callIndex: replacement.callIndex,
              x: replacement.x,
              y0: replacement.y0,
              y1: replacement.y1,
            });
        }
        // A merged singleton is padded only on the left; its right edge stays
        // at the last actual call so the decorative flow owns the transition.
        points =
          points.length === 1 && (mergeTarget || keptUntil)
            ? [padSingleton(points, step, options)[0], points[0]]
            : padSingleton(points, step, options);
        const thinnest = thinnestThickness(points);
        const isSubpixel = thinnest < options.minimumVisibleThickness;
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
          thinnest,
          linear: touchesCompaction,
        });
      }
    }
  }

  const control = Math.max(8, Math.min(step * 0.25, 24));
  const connector = (
    compaction: CompactionEvent,
    fromItemId: string,
    source: RibbonPoint,
    toItemId: string,
    target: RibbonPoint,
    targetBeforeModelCall: number,
    kind: LineageConnectorLayout['kind'] = 'removed',
  ): LineageConnectorLayout => {
    const targetX = boundaryX(targetBeforeModelCall);
    return {
      key: `${compaction.id}:${fromItemId}:${toItemId}`,
      fromItemId,
      toItemId,
      compactionId: compaction.id,
      summaryItemId: compaction.summaryItemId,
      kind,
      targetBeforeModelCall,
      sourceX: source.x,
      sourceY: midpoint(source),
      sourceY0: source.y0,
      sourceY1: source.y1,
      targetX,
      summaryY: midpoint(target),
      summaryY0: target.y0,
      summaryY1: target.y1,
      ...compactionMergePaths(
        source.x,
        source.y0,
        source.y1,
        targetX,
        target.y0,
        target.y1,
        control,
      ),
    };
  };
  const lineageConnectors = groupByKind
    ? []
    : analysis.compactions.flatMap((compaction) => {
        const summaryPoint = geometry
          .get(compaction.summaryItemId)
          ?.get(compaction.beforeModelCall);
        if (!summaryPoint) return [];
        const flow = flows.get(compaction.id)!;
        // The removed items flow into the compaction's input when it has one, and the input
        // flows into the summary. `compactionFlow` checked that the input has geometry.
        const input = flow.input && {
          ...flow.input,
          point: geometry.get(flow.input.itemId)!.get(flow.input.callIndex)!,
        };
        const removedTarget = input ?? {
          itemId: compaction.summaryItemId,
          callIndex: compaction.beforeModelCall,
          point: summaryPoint,
        };
        const removed = (indexed.incomingLineage.get(compaction.summaryItemId) ?? [])
          .filter(
            (edge) =>
              edge.kind === 'frameworkCompaction' && compaction.sourceItemIds.includes(edge.from),
          )
          .flatMap((edge) => {
            const sourcePoint = geometry.get(edge.from)?.get(flow.sourceCall);
            if (!sourcePoint) return [];
            return [
              connector(
                compaction,
                edge.from,
                sourcePoint,
                removedTarget.itemId,
                removedTarget.point,
                removedTarget.callIndex,
              ),
            ];
          });
        const fromInput = input
          ? [
              connector(
                compaction,
                input.itemId,
                input.point,
                compaction.summaryItemId,
                summaryPoint,
                compaction.beforeModelCall,
                'input',
              ),
            ]
          : [];
        const keptFlows = keptAcross
          .filter((across) => across.compaction === compaction)
          .map((across) =>
            connector(
              compaction,
              across.itemId,
              across.source,
              across.itemId,
              across.target,
              compaction.beforeModelCall,
              'kept',
            ),
          );
        return [...removed, ...fromInput, ...keptFlows];
      });

  if (import.meta.env.DEV && typeof performance !== 'undefined') {
    performance.mark('highwater-layout-end');
    performance.measure('highwater-layout-river', 'highwater-layout-start', 'highwater-layout-end');
  }
  return {
    chartUnit: analysis.displayWeightUnit,
    columns,
    ribbons,
    compactions,
    lineageConnectors,
    versionMarks,
    innerWidth,
    innerHeight,
    maxTotalDisplayWeight,
  };
}
