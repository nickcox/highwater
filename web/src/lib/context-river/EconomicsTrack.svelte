<script lang="ts">
  import { afterUpdate, onDestroy } from 'svelte';
  import { createOverlayFocus } from './overlay-focus';
  import type { IndexedAnalysis } from '../types';
  import { formatCostTick, formatInteger, formatPercent, formatRatioPercent } from './format';
  import { describeCostBasis, usageNormalizationLabel } from '../cost-basis';
  import { costKindLabel, formatAssessedCost } from '../cost-assessment';
  import { formatVerticalTick, verticalScaleTicks } from './vertical-scale';
  import type { CallColumn } from './types';
  import EventGlyph from './EventGlyph.svelte';
  import { clusterEconomicsEvents, type EconomicsEventCluster } from './event-clustering';
  import {
    cacheShareChangeLabel,
    projectCacheTrack,
    projectCostTrack,
    type CacheShareSegment,
    type CacheTrackPoint,
    type CacheViewMode,
    type CostTrackPoint,
    type EconomicsTrackMode,
    type EconomicsTrackProjection,
    type EconomicsEventBreakdown,
  } from './economics-track';

  export let indexed: IndexedAnalysis;
  const eventFocus = createOverlayFocus();
  $: eventFocus.observeIdentity(indexed);
  onDestroy(() => eventFocus.dispose());
  export let columns: readonly CallColumn[];
  export let width: number;
  export let mode: Exclude<EconomicsTrackMode, 'off'>;
  export let cacheView: CacheViewMode = 'tokens';
  export let pinnedCallIndex: number | null;
  export let hoveredCallIndex: number | null;
  export let onPinCall: (index: number) => void;
  export let onHoverCall: (index: number | null) => void;
  export let onMarkClick: (event: MouseEvent, index: number) => void;
  export let onReadoutChange: (readout: string) => void = () => {};
  export let onEventBreakdownChange: (breakdown: EconomicsEventBreakdown | null) => void = () => {};

  interface CacheSegmentGeometry {
    kind: CacheTrackPoint['segments'][number]['kind'];
    label: string;
    value: number;
    displayValue: number;
    y: number;
    height: number;
  }

  interface CacheBar {
    point: CacheTrackPoint;
    x: number;
    segments: CacheSegmentGeometry[];
    /** The label after "Call N"; the template inserts " · pinned" when it applies. */
    labelDetail: string;
    /** Bars with usage data say when they are the pinned call. */
    showsPin: boolean;
  }

  interface CostMark {
    point: CostTrackPoint;
    x: number;
    y: number;
    /** The top of a range, when the cost is one. */
    yHigh: number | null;
    ariaLabel: string;
  }

  interface TrackBoundaryMarker {
    callIndex: number;
    x: number;
    label: string;
  }

  type TrackEventKind = 'compaction' | 'targetChange' | 'ratioChange';
  interface TrackEvent {
    id: string;
    kind: TrackEventKind;
    callIndex: number;
    x: number;
    label: string;
    direction?: 'rise' | 'drop';
    magnitude?: 'notable' | 'large';
  }
  type TrackEventCluster = EconomicsEventCluster<TrackEvent>;

  // The event lane below the bars is one marker row high (46px).
  $: trackHeight = mode === 'cost' ? 190 : 262;
  $: eventHeaderTop = mode === 'cost' ? 116 : 188;
  const eventHeaderHeight = 16;
  $: eventLaneTop = eventHeaderTop + eventHeaderHeight + 2;
  $: eventLaneHeight = Math.max(44, trackHeight - eventLaneTop - 10);
  $: eventMarkerY = eventLaneTop + eventLaneHeight / 2;
  const eventMarkerHeight = 22;
  const eventCollisionGap = 6;
  const margin = { top: 14, right: 24, bottom: 62, left: 42 };
  $: baseline = mode === 'cache' ? 180 : 108;
  $: innerHeight = baseline - margin.top;
  let activeCallIndex: number | null = null;
  let openEventClusterId: string | null = null;
  let lastPublishedReadout = '';
  let lastPublishedEventBreakdownSignature = '';

  $: costCopy = describeCostBasis(
    indexed.analysis.economics.costBasis,
    indexed.analysis.session.source,
  );
  $: usageMappingLabel = usageNormalizationLabel(indexed.analysis.session.source);
  $: cacheProjection = mode === 'cache' ? projectCacheTrack(indexed.analysis) : null;
  $: costProjection = mode === 'cost' ? projectCostTrack(indexed.analysis) : null;
  $: cachePointsByCall = new Map(
    cacheProjection?.points.map((point) => [point.callIndex, point]) ?? [],
  );
  $: costPointsByCall = new Map(
    costProjection?.points.map((point) => [point.callIndex, point]) ?? [],
  );
  $: maximum = cacheProjection?.maximum ?? costProjection?.maximum ?? 0;
  $: domainMaximum =
    mode === 'cost'
      ? maximum > 0
        ? maximum
        : 1
      : cacheView === 'share'
        ? 100
        : Math.max(1, maximum);
  $: columnsByCall = new Map(columns.map((column) => [column.callIndex, column]));
  $: compactionMarkers = layoutCompactionMarkers(indexed.analysis.compactions, columns, width);
  $: targetChanges = layoutTargetChanges(indexed.analysis.modelCalls, columns);
  $: targetChangesByCall = new Map(targetChanges.map((marker) => [marker.callIndex, marker]));
  $: minimumSpacing =
    columns.length < 2
      ? 14
      : columns.reduce(
          (minimum, column, position) =>
            position === 0 ? minimum : Math.min(minimum, column.x - columns[position - 1].x),
          Number.POSITIVE_INFINITY,
        );
  $: barWidth = Math.max(1.5, Math.min(12, minimumSpacing * 0.68));
  // The track is short, so round ticks need a larger gap from the maximum.
  $: ticks = verticalScaleTicks(mode === 'cache' && cacheView === 'share' ? 100 : maximum, 3, 0.25);
  $: tickData = ticks.map((value) => ({
    value,
    y: margin.top + innerHeight * (1 - value / domainMaximum),
  }));
  // Legacy `$:` statements re-run only when a variable named in them changes, so every value
  // the layout functions read is passed to them.
  $: cacheBars = cacheProjection
    ? layoutCacheBars(cacheProjection, columnsByCall, {
        cacheView,
        domainMaximum,
        baseline,
        innerHeight,
        targetChangesByCall,
        usageMappingLabel,
      })
    : [];
  $: costMarks = costProjection
    ? layoutCostMarks(costProjection, columnsByCall, {
        domainMaximum,
        baseline,
        innerHeight,
        targetChangesByCall,
      })
    : [];
  $: trackEvents = layoutTrackEvents(
    compactionMarkers,
    targetChanges,
    cacheProjection,
    columnsByCall,
  );
  $: eventClusters = clusterEconomicsEvents(trackEvents, {
    chartWidth: width,
    left: margin.left,
    right: margin.right,
    markerSize: eventMarkerHeight,
    collisionGap: eventCollisionGap,
  });
  $: openEventCluster = eventClusters.find((cluster) => cluster.id === openEventClusterId) ?? null;
  $: if (openEventCluster) {
    const signature = JSON.stringify({
      id: openEventCluster.id,
      x: openEventCluster.x,
      events: openEventCluster.events.map((event) => ({
        id: event.id,
        kind: event.kind,
        callIndex: event.callIndex,
        x: event.x,
        label: event.label,
        direction: event.direction,
        magnitude: event.magnitude,
      })),
    });
    if (signature !== lastPublishedEventBreakdownSignature) {
      lastPublishedEventBreakdownSignature = signature;
      onEventBreakdownChange({
        id: openEventCluster.id,
        events: openEventCluster.events,
        callIndices: [...new Set(openEventCluster.events.map((event) => event.callIndex))].sort(
          (a, b) => a - b,
        ),
        anchorX: openEventCluster.x,
        anchorY: eventMarkerY,
        laneTop: eventLaneTop,
        laneHeight: eventLaneHeight,
      });
    }
  } else if (lastPublishedEventBreakdownSignature !== '') {
    lastPublishedEventBreakdownSignature = '';
    onEventBreakdownChange(null);
  }
  $: readoutCallIndex = hoveredCallIndex ?? pinnedCallIndex;
  $: readout =
    readoutCallIndex === null
      ? ''
      : callReadout(readoutCallIndex, mode, cacheView, cacheProjection, costProjection);
  $: if (readout !== lastPublishedReadout) {
    lastPublishedReadout = readout;
    onReadoutChange(readout);
  }

  function layoutCompactionMarkers(
    compactions: IndexedAnalysis['analysis']['compactions'],
    callColumns: readonly CallColumn[],
    chartWidth: number,
  ): TrackBoundaryMarker[] {
    const byCall = new Map(callColumns.map((column) => [column.callIndex, column.x]));
    const spacings = callColumns
      .slice(1)
      .map((column, position) => column.x - callColumns[position].x);
    const step =
      spacings.length > 0
        ? spacings.reduce(
            (minimum, spacing) => Math.min(minimum, spacing),
            Number.POSITIVE_INFINITY,
          )
        : Math.max(0, chartWidth - margin.left - margin.right);
    const innerWidth = Math.max(0, chartWidth - margin.left - margin.right);
    return compactions.map((compaction) => {
      const current = byCall.get(compaction.beforeModelCall);
      const previous = byCall.get(compaction.beforeModelCall - 1);
      const x =
        current !== undefined && previous !== undefined
          ? (previous + current) / 2
          : current !== undefined
            ? current - Math.min(step / 2, 16)
            : margin.left + innerWidth;
      return {
        callIndex: compaction.beforeModelCall,
        x,
        label: `Compaction before call ${compaction.beforeModelCall}`,
      };
    });
  }

  function layoutTargetChanges(
    calls: IndexedAnalysis['analysis']['modelCalls'],
    callColumns: readonly CallColumn[],
  ): TrackBoundaryMarker[] {
    const byCall = new Map(callColumns.map((column) => [column.callIndex, column.x]));
    return calls.flatMap((call, position) => {
      const previous = calls[position - 1];
      const x = byCall.get(call.index);
      if (
        !previous ||
        x === undefined ||
        (previous.provider === call.provider &&
          previous.model === call.model &&
          previous.api === call.api)
      ) {
        return [];
      }
      const previousTarget = `${previous.provider ?? 'Unknown'} / ${previous.model ?? 'Unknown'} / ${previous.api ?? 'Unknown API'}`;
      const currentTarget = `${call.provider ?? 'Unknown'} / ${call.model ?? 'Unknown'} / ${call.api ?? 'Unknown API'}`;
      return [
        {
          callIndex: call.index,
          x,
          label: `Model / provider change (Target changes from ${previousTarget} to ${currentTarget})`,
        },
      ];
    });
  }

  function layoutTrackEvents(
    compactionMarkers: readonly TrackBoundaryMarker[],
    targetChanges: readonly TrackBoundaryMarker[],
    cacheProjection: EconomicsTrackProjection<CacheTrackPoint> | null,
    columnsByCall: ReadonlyMap<number, CallColumn>,
  ): TrackEvent[] {
    const events: TrackEvent[] = [];
    for (const marker of compactionMarkers) {
      events.push({
        id: `compaction-${marker.callIndex}`,
        kind: 'compaction',
        callIndex: marker.callIndex,
        x: marker.x,
        label: marker.label,
      });
    }
    for (const marker of targetChanges) {
      events.push({
        id: `target-${marker.callIndex}`,
        kind: 'targetChange',
        callIndex: marker.callIndex,
        x: marker.x,
        label: `${marker.label} at call ${marker.callIndex}`,
      });
    }
    if (cacheProjection) {
      for (const point of cacheProjection.points) {
        const change = point.discontinuity;
        const x = columnsByCall.get(point.callIndex)?.x;
        if (!change || x === undefined) continue;
        events.push({
          id: `ratio-${point.callIndex}`,
          kind: 'ratioChange',
          callIndex: point.callIndex,
          x,
          direction: change.direction,
          magnitude: change.magnitude,
          label: cacheShareChangeLabel(change, point.callIndex),
        });
      }
    }
    return events.sort((left, right) => left.x - right.x || left.id.localeCompare(right.id));
  }

  function eventCallLabel(event: TrackEvent): string {
    return `${event.label} · call ${event.callIndex}`;
  }

  afterUpdate(() => {
    if (
      openEventClusterId !== null &&
      !eventClusters.some((cluster) => cluster.id === openEventClusterId)
    ) {
      const staleTriggerId = openEventClusterId;
      openEventClusterId = null;
      eventFocus.focusAfterUpdate(
        () => eventTrigger(staleTriggerId),
        () => openEventClusterId === null,
      );
    }
  });

  function openEventBreakdown(cluster: TrackEventCluster): void {
    const id = cluster.id;
    openEventClusterId = id;
    eventFocus.focusAfterUpdate(
      () => document.getElementById(`${id}-close`),
      () => openEventClusterId === id,
    );
  }

  export function closeEventBreakdown(returnFocus = true): void {
    const clusterId = openEventClusterId;
    openEventClusterId = null;
    eventFocus.cancel();
    if (returnFocus && clusterId) {
      eventFocus.focusAfterUpdate(
        () => eventTrigger(clusterId),
        () => openEventClusterId === null,
      );
    }
  }

  function eventTrigger(triggerId: string): HTMLElement | null {
    return (
      document.getElementById(triggerId) ??
      document.querySelector<HTMLElement>('.economics-track-header button')
    );
  }

  function handleEventKeydown(event: KeyboardEvent, cluster: TrackEventCluster): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openEventBreakdown(cluster);
    }
  }

  function callReadout(
    callIndex: number,
    mode: Exclude<EconomicsTrackMode, 'off'>,
    cacheViewMode: CacheViewMode,
    cacheProjection: EconomicsTrackProjection<CacheTrackPoint> | null,
    costProjection: EconomicsTrackProjection<CostTrackPoint> | null,
  ): string {
    const call = indexed.callByIndex.get(callIndex);
    if (!call) return '';
    if (mode === 'cache') {
      const point = cachePointsByCall.get(callIndex);
      if (!point || (point.status !== 'complete' && point.status !== 'zero')) {
        return `Call ${callIndex} · ${point?.note ?? 'Cache data unavailable'}`;
      }
      const buckets = point.segments
        .map((segment) => `${segment.label} ${formatInteger(segment.value)}`)
        .join(' · ');
      const share =
        point.shareStatus === 'complete'
          ? `${cacheShareText(point)} · ${usageMappingLabel} denominator of ${formatInteger(point.shareDenominator ?? 0)} prompt tokens`
          : cacheShareText(point);
      const promptTokens = call.economics.promptTokens;
      const ratio = call.economics.cacheReadRatio;
      const ratioLabel =
        promptTokens === null || promptTokens <= 0
          ? 'cache-read share unavailable; prompt-token denominator is zero or unavailable'
          : ratio === null
            ? `cache-read share unavailable of ${formatInteger(promptTokens)} prompt tokens`
            : `cache-read share ${formatRatioPercent(ratio)} of ${formatInteger(promptTokens)} prompt tokens`;
      const costLabel =
        call.costAssessment.amount === null
          ? ''
          : ` · ${costKindLabel(call.costAssessment, indexed.analysis.session.source)} cost ${formatAssessedCost(call.costAssessment)} USD`;
      const pinnedLabel =
        pinnedCallIndex === callIndex && hoveredCallIndex !== callIndex ? ' · pinned' : '';
      return `Call ${callIndex}${pinnedLabel} · ${buckets} · ${mode === 'cache' && cacheViewMode === 'share' ? `${share} · ` : ''}${ratioLabel}${costLabel}`;
    }
    return call.costAssessment.amount === null
      ? `Call ${callIndex} · cost unavailable`
      : `Call ${callIndex} · ${costKindLabel(call.costAssessment, indexed.analysis.session.source)} cost ${formatAssessedCost(call.costAssessment)} USD`;
  }

  interface BarScale {
    domainMaximum: number;
    baseline: number;
    innerHeight: number;
    targetChangesByCall: ReadonlyMap<number, TrackBoundaryMarker>;
  }

  function layoutCacheBars(
    projection: EconomicsTrackProjection<CacheTrackPoint>,
    columnsByCall: ReadonlyMap<number, CallColumn>,
    options: BarScale & { cacheView: CacheViewMode; usageMappingLabel: string },
  ): CacheBar[] {
    return projection.points.flatMap((point) => {
      const x = columnsByCall.get(point.callIndex)?.x;
      return x === undefined ? [] : [layoutCacheBar(point, x, options)];
    });
  }

  function layoutCostMarks(
    projection: EconomicsTrackProjection<CostTrackPoint>,
    columnsByCall: ReadonlyMap<number, CallColumn>,
    scale: BarScale,
  ): CostMark[] {
    return projection.points.flatMap((point) => {
      const x = columnsByCall.get(point.callIndex)?.x;
      return x === undefined ? [] : [layoutCostMark(point, x, scale)];
    });
  }

  function layoutCacheBar(
    point: CacheTrackPoint,
    x: number,
    {
      cacheView,
      domainMaximum,
      baseline,
      innerHeight,
      targetChangesByCall,
      usageMappingLabel,
    }: BarScale & { cacheView: CacheViewMode; usageMappingLabel: string },
  ): CacheBar {
    let nextY = baseline;
    const sourceSegments: Array<CacheTrackPoint['segments'][number] | CacheShareSegment> =
      cacheView === 'share' ? point.shareSegments : point.segments;
    const segments = sourceSegments.map((segment) => {
      const displayValue =
        cacheView === 'share' && 'percentage' in segment
          ? (segment as CacheShareSegment).percentage
          : segment.value;
      const height = (displayValue / domainMaximum) * innerHeight;
      const y = nextY - height;
      nextY = y;
      return { ...segment, displayValue, y, height };
    });
    const call = indexed.callByIndex.get(point.callIndex);
    const buckets = point.segments
      .map((segment) => `${segment.label} ${formatInteger(segment.value)}`)
      .join(' · ');
    const share = cacheShareText(point);
    const ratio = call ? formatPercent(call.economics.cacheReadRatio) : 'Unknown';
    const denominator =
      call?.economics.promptTokens === null || call?.economics.promptTokens === undefined
        ? `${usageMappingLabel} prompt-token denominator unavailable`
        : `${usageMappingLabel} denominator of ${formatInteger(call.economics.promptTokens)} prompt tokens`;
    const change = point.discontinuity;
    const targetChange = targetChangesByCall.get(point.callIndex)?.label;
    const targetLabel = targetChange ? ` · ${targetChange}.` : '';
    const changeLabel = change
      ? ` · ${cacheShareChangeLabel(change, point.callIndex)} (${(change.delta * 100).toFixed(1)} percentage points, ${change.magnitude})`
      : '';
    const viewLabel = cacheView === 'share' ? ` · ${share} · ${denominator}` : '';
    const showsPin = point.status === 'complete' || point.status === 'zero';
    const labelDetail = showsPin
      ? ` · prompt ${formatInteger(point.promptTokens ?? 0)} tokens · ${buckets}${viewLabel} · cache-read share ${ratio} ${denominator}${point.note ? ` · ${point.note}` : ''}${targetLabel}${changeLabel}`
      : ` · ${point.note}`;
    return { point, x, segments, labelDetail, showsPin };
  }

  function cacheBarLabel(
    bar: CacheBar,
    pinnedCallIndex: number | null,
    hoveredCallIndex: number | null,
  ): string {
    const callIndex = bar.point.callIndex;
    const pinned = bar.showsPin && pinnedCallIndex === callIndex && hoveredCallIndex !== callIndex;
    return `Call ${callIndex}${pinned ? ' · pinned' : ''}${bar.labelDetail}`;
  }

  function layoutCostMark(
    point: CostTrackPoint,
    x: number,
    { domainMaximum, baseline, innerHeight, targetChangesByCall }: BarScale,
  ): CostMark {
    const yOf = (value: number | null) =>
      value === null ? baseline : baseline - (value / domainMaximum) * innerHeight;
    const y = yOf(point.total);
    const yHigh = point.high === null ? null : yOf(point.high);
    const targetChange = targetChangesByCall.get(point.callIndex)?.label;
    const targetLabel = targetChange ? ` · ${targetChange}.` : '';
    const assessed = indexed.callByIndex.get(point.callIndex)?.costAssessment;
    const components =
      point.kind === 'recorded' ? ` · cost components ${point.componentStatus}` : '';
    const ariaLabel =
      (point.status === 'known' || point.status === 'zero') && assessed
        ? `Call ${point.callIndex} · ${costKindLabel(assessed, indexed.analysis.session.source)} cost ${formatAssessedCost(assessed)} USD${components}${targetLabel}`
        : point.status === 'partial'
          ? `Call ${point.callIndex} · cost unavailable · some recorded cost components are present`
          : `Call ${point.callIndex} · cost unavailable`;
    return { point, x, y, yHigh, ariaLabel };
  }

  function cacheTick(value: number): string {
    return cacheView === 'share' ? `${value.toFixed(0)}%` : formatVerticalTick(value);
  }

  function costTick(value: number): string {
    return formatCostTick(value);
  }

  /** Each cache bucket's share of the prompt, or why the shares are unavailable. */
  function cacheShareText(point: CacheTrackPoint): string {
    if (point.shareStatus === 'complete') {
      return point.shareSegments
        .map((segment) => `${segment.label} ${formatRatioPercent(segment.percentage / 100)}`)
        .join(' · ');
    }
    return point.shareStatus === 'zeroPrompt'
      ? 'share undefined: zero prompt tokens'
      : 'share unavailable: incomplete or unsupported usage';
  }

  function focusCall(index: number): void {
    document.getElementById(`economics-call-${index}`)?.focus();
  }

  function handleMarkKeydown(event: KeyboardEvent, callIndex: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPinCall(callIndex);
      return;
    }
    const calls = indexed.analysis.modelCalls;
    const position = calls.findIndex((call) => call.index === callIndex);
    let targetPosition = position;
    if (event.key === 'ArrowLeft') targetPosition = Math.max(0, position - 1);
    else if (event.key === 'ArrowRight') targetPosition = Math.min(calls.length - 1, position + 1);
    else if (event.key === 'Home') targetPosition = 0;
    else if (event.key === 'End') targetPosition = calls.length - 1;
    else return;
    event.preventDefault();
    const target = calls[targetPosition];
    if (!target) return;
    activeCallIndex = target.index;
    onHoverCall(target.index);
    focusCall(target.index);
  }

  $: activeCallIndex = pinnedCallIndex ?? indexed.analysis.modelCalls[0]?.index ?? null;
</script>

<div
  class="track-shell"
  style={`width:${width}px`}
  role="presentation"
  onpointerleave={() => onHoverCall(null)}
>
  <svg
    class="economics-track-svg"
    viewBox={`0 0 ${width} ${trackHeight}`}
    {width}
    height={trackHeight}
    role="group"
    aria-label={mode === 'cache'
      ? 'Cache usage track. One keyboard stop; use left and right arrows to inspect calls.'
      : 'Cost track. One keyboard stop; use left and right arrows to inspect calls.'}
  >
    <defs>
      <pattern
        id="economics-write-pattern"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill="#9167c7" />
        <path d="M0 0V6" stroke="#e0c9ff" stroke-width="1.5" opacity=".7" />
      </pattern>
      <pattern id="economics-fresh-pattern" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#277d68" />
        <circle cx="2" cy="2" r="1" fill="#b5f6df" />
      </pattern>
      <pattern
        id="economics-nonread-pattern"
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="7" height="7" fill="#49536a" />
        <path d="M0 0V7" stroke="#aab5c9" stroke-width="1.5" opacity=".8" />
      </pattern>
    </defs>
    <rect class="track-background" x="0" y="0" {width} height={trackHeight} />
    <rect
      class="track-plot"
      x={margin.left}
      y={margin.top}
      width={Math.max(0, width - margin.left - margin.right)}
      height={innerHeight}
    />
    {#each tickData as tick, position (position)}
      <line
        class="track-gridline"
        x1={margin.left}
        x2={width - margin.right}
        y1={tick.y}
        y2={tick.y}
      />
      <text class="track-y-label" x={margin.left - 5} y={tick.y + 3} text-anchor="end">
        {mode === 'cache' ? cacheTick(tick.value) : costTick(tick.value)}
      </text>
    {/each}
    <g class="track-event-header" aria-label="Economics event annotations">
      <text x={margin.left + 4} y={eventHeaderTop + 12}>Events</text>
    </g>
    <g class="track-event-lane" aria-label="Economics event lane">
      <rect
        x={margin.left}
        y={eventLaneTop}
        width={Math.max(0, width - margin.left - margin.right)}
        height={eventLaneHeight}
      />
      {#each eventClusters as cluster (cluster.id)}
        {@const event = cluster.events[0]!}
        <g
          id={cluster.id}
          class={`track-event-trigger ${cluster.events.length === 1 ? 'track-event-singleton' : 'track-event-cluster'} track-${event?.kind ?? 'cluster'} ${event?.kind === 'compaction' ? 'track-compaction-marker' : event?.kind === 'targetChange' ? 'track-target-change' : event?.kind === 'ratioChange' ? 'track-ratioChange ratio-change-marker' : ''}`}
          class:rise={event?.direction === 'rise'}
          class:large={event?.magnitude === 'large'}
          role="button"
          tabindex="0"
          aria-label={cluster.events.length === 1
            ? `${eventCallLabel(event)}; activate for details`
            : `${cluster.compositionLabel} at calls ${cluster.callRanges}; activate for breakdown`}
          onclick={(clickEvent) => {
            clickEvent.stopPropagation();
            openEventBreakdown(cluster);
          }}
          onkeydown={(keyEvent) => handleEventKeydown(keyEvent, cluster)}
        >
          <title
            >{cluster.compositionLabel} at calls {cluster.callRanges} ·
            {cluster.events.map((member) => eventCallLabel(member)).join('; ')}</title
          >
          <rect
            class="event-hit"
            x={cluster.x - cluster.hitWidth / 2}
            y={eventLaneTop + 6}
            width={cluster.hitWidth}
            height={eventLaneHeight - 12}
            rx="5"
          />
          {#if cluster.events.length === 1}
            <EventGlyph
              svg
              kind={event.kind}
              direction={event.direction}
              size={eventMarkerHeight}
              x={cluster.x - eventMarkerHeight / 2}
              y={eventMarkerY - eventMarkerHeight / 2}
              label={event.kind === 'compaction'
                ? 'Compaction'
                : event.kind === 'targetChange'
                  ? 'Model / provider change'
                  : `Cache-share ${event.direction === 'drop' ? 'drop' : 'rise'}`}
            />
          {:else}<rect
              class="event-count-badge"
              x={cluster.x - cluster.badgeWidth / 2}
              y={eventMarkerY - eventMarkerHeight / 2}
              width={cluster.badgeWidth}
              height={eventMarkerHeight}
              rx="5"
            /><text class="event-count" x={cluster.x} y={eventMarkerY + 4} text-anchor="middle">
              {cluster.badgeLabel}
            </text>{/if}
        </g>
      {/each}
    </g>

    {#if mode === 'cache'}
      {#each cacheBars as bar (bar.point.callIndex)}
        <g
          id={`economics-call-${bar.point.callIndex}`}
          class="economics-mark cache-mark"
          class:partial={bar.point.status === 'partial'}
          class:missing={bar.point.status === 'missing'}
          class:unsupported={bar.point.status === 'unsupported'}
          class:zero={bar.point.status === 'zero'}
          class:pinned={pinnedCallIndex === bar.point.callIndex}
          class:hovered={hoveredCallIndex === bar.point.callIndex}
          role="button"
          tabindex={activeCallIndex === bar.point.callIndex ? 0 : -1}
          aria-label={cacheBarLabel(bar, pinnedCallIndex, hoveredCallIndex)}
          aria-current={pinnedCallIndex === bar.point.callIndex ? 'true' : undefined}
          onpointerenter={() => onHoverCall(bar.point.callIndex)}
          onpointerleave={() => onHoverCall(null)}
          onfocus={() => onHoverCall(bar.point.callIndex)}
          onkeydown={(event) => handleMarkKeydown(event, bar.point.callIndex)}
          onclick={(event) => onMarkClick(event, bar.point.callIndex)}
        >
          <title>{cacheBarLabel(bar, pinnedCallIndex, hoveredCallIndex)}</title>
          {#if bar.point.status === 'complete'}
            {#each bar.segments as segment, position (`${segment.kind}-${position}`)}
              {#if segment.height > 0}<rect
                  class={`cache-segment ${segment.kind}`}
                  x={bar.x - barWidth / 2}
                  y={segment.y}
                  width={barWidth}
                  height={segment.height}
                />{/if}
            {/each}
          {:else if bar.point.status === 'zero'}
            <circle class="zero-mark" cx={bar.x} cy={baseline - 2} r="3" />
          {:else if bar.point.status === 'missing'}
            <rect class="missing-mark" x={bar.x - 4} y={baseline - 7} width="8" height="8" />
          {:else}
            <path class="uncertain-mark" d={`M ${bar.x} ${baseline - 8} l 5 5 l -5 5 l -5 -5 Z`} />
          {/if}
          {#if pinnedCallIndex === bar.point.callIndex}<line
              class="track-pin"
              x1={bar.x}
              x2={bar.x}
              y1={margin.top}
              y2={baseline}
            />{/if}
          {#if hoveredCallIndex === bar.point.callIndex}<line
              class="track-hover"
              x1={bar.x}
              x2={bar.x}
              y1={margin.top}
              y2={baseline}
            />{/if}
        </g>
      {/each}
    {:else}
      {#each costMarks as mark (mark.point.callIndex)}
        <g
          id={`economics-call-${mark.point.callIndex}`}
          class="economics-mark cost-mark"
          class:partial={mark.point.status === 'partial' ||
            mark.point.componentStatus === 'partial'}
          class:missing={mark.point.status === 'missing'}
          class:zero={mark.point.status === 'zero'}
          class:api-equivalent={mark.point.kind === 'apiEquivalent'}
          class:pinned={pinnedCallIndex === mark.point.callIndex}
          class:hovered={hoveredCallIndex === mark.point.callIndex}
          role="button"
          tabindex={activeCallIndex === mark.point.callIndex ? 0 : -1}
          aria-label={mark.ariaLabel}
          aria-current={pinnedCallIndex === mark.point.callIndex ? 'true' : undefined}
          onpointerenter={() => onHoverCall(mark.point.callIndex)}
          onfocus={() => onHoverCall(mark.point.callIndex)}
          onkeydown={(event) => handleMarkKeydown(event, mark.point.callIndex)}
          onclick={(event) => onMarkClick(event, mark.point.callIndex)}
        >
          <title>{mark.ariaLabel}</title>
          {#if mark.point.status === 'known' && mark.yHigh !== null}<line
              class="cost-range"
              x1={mark.x}
              x2={mark.x}
              y1={mark.y}
              y2={mark.yHigh}
            />{/if}
          {#if mark.point.status === 'known'}<line
              class="cost-stem"
              class:partial={mark.point.componentStatus === 'partial'}
              x1={mark.x}
              x2={mark.x}
              y1={baseline}
              y2={mark.y}
            /><circle
              class="cost-dot"
              class:partial={mark.point.componentStatus === 'partial'}
              cx={mark.x}
              cy={mark.y}
              r="3.5"
            />
          {:else if mark.point.status === 'zero'}<circle
              class="cost-zero"
              class:partial={mark.point.componentStatus === 'partial'}
              cx={mark.x}
              cy={baseline - 2}
              r="3.5"
            />
          {:else if mark.point.status === 'partial'}<path
              class="uncertain-mark"
              d={`M ${mark.x} ${baseline - 8} l 5 5 l -5 5 l -5 -5 Z`}
            />{:else}<rect
              class="missing-mark"
              x={mark.x - 4}
              y={baseline - 7}
              width="8"
              height="8"
            />{/if}
          {#if pinnedCallIndex === mark.point.callIndex}<line
              class="track-pin"
              x1={mark.x}
              x2={mark.x}
              y1={margin.top}
              y2={baseline}
            />{/if}
          {#if hoveredCallIndex === mark.point.callIndex}<line
              class="track-hover"
              x1={mark.x}
              x2={mark.x}
              y1={margin.top}
              y2={baseline}
            />{/if}
        </g>
      {/each}
    {/if}
  </svg>
</div>

<style>
  .track-shell {
    position: relative;
    min-width: 0;
  }
  .economics-track-svg {
    display: block;
    max-width: none;
    background: var(--plot);
    touch-action: pan-y;
  }
  .track-background {
    fill: var(--plot);
    pointer-events: none;
  }
  .track-plot {
    fill: var(--plot);
    pointer-events: none;
  }
  .track-gridline {
    stroke: var(--separator);
    stroke-width: 0.75;
    opacity: 0.7;
    pointer-events: none;
  }
  .track-event-header {
    fill: var(--muted);
    font-size: var(--text-xs);
    pointer-events: none;
  }
  .track-event-header text:first-child {
    fill: var(--text);
    font-weight: 750;
  }
  .track-event-lane {
    pointer-events: all;
  }
  .track-event-lane > rect {
    fill: none;
    stroke: none;
    pointer-events: none;
  }
  .track-event-trigger {
    cursor: pointer;
    pointer-events: all;
    outline: none;
  }
  .event-hit {
    fill: transparent;
    stroke: transparent;
    stroke-width: 2;
    pointer-events: all;
  }
  .event-count-badge {
    stroke-width: 1.25;
    fill: var(--action);
    stroke: var(--text);
  }
  .event-count {
    fill: #fff;
    font-size: var(--text-xs);
    font-weight: 750;
    pointer-events: none;
  }
  .track-event-trigger:focus-visible .event-hit {
    fill: var(--action);
    fill-opacity: 0.35;
    stroke: #fff;
    stroke-width: 2.5;
  }
  .track-y-label {
    fill: var(--text);
    font-size: 9px;
    pointer-events: none;
  }
  .economics-mark {
    cursor: pointer;
    outline: none;
  }
  .cache-segment {
    stroke: var(--plot);
    stroke-width: 0.6;
  }
  .cache-segment.cacheRead {
    fill: #428fdc;
  }
  .cache-segment.cacheWrite {
    fill: url(#economics-write-pattern);
  }
  .cache-segment.fresh,
  .cache-segment.uncached {
    fill: url(#economics-fresh-pattern);
  }
  .cache-segment.nonRead {
    fill: url(#economics-nonread-pattern);
  }
  .economics-mark.zero .zero-mark {
    fill: var(--plot);
    stroke: var(--text);
    stroke-width: 1.5;
  }
  .uncertain-mark {
    fill: var(--surface-raised);
    stroke: var(--warning);
    stroke-width: 1.5;
  }
  .economics-mark.partial .uncertain-mark {
    fill: var(--surface-raised);
    stroke: var(--warning);
  }
  .economics-mark.unsupported .uncertain-mark {
    fill: var(--error-surface);
    stroke: var(--error);
    stroke-dasharray: 2 1;
  }
  .missing-mark {
    fill: none;
    stroke: #aab5c9;
    stroke-dasharray: 2 1;
    stroke-width: 1.5;
  }
  .cost-stem {
    stroke: #7ddbb7;
    stroke-width: 1.5;
  }
  .cost-stem.partial {
    stroke: var(--warning);
    stroke-dasharray: 3 2;
  }
  .cost-dot {
    fill: #7ddbb7;
    stroke: var(--plot);
    stroke-width: 1;
  }
  .cost-dot.partial {
    stroke: var(--warning);
    stroke-width: 2;
  }
  .cost-zero {
    fill: var(--plot);
    stroke: #7ddbb7;
    stroke-width: 1.5;
  }
  .cost-zero.partial {
    stroke: var(--warning);
    stroke-dasharray: 2 1;
  }
  /* API-equivalent costs are not charges: hollow marks in a separate colour. */
  .api-equivalent .cost-stem {
    stroke: #b9a8ff;
    stroke-dasharray: 3 2;
  }
  .api-equivalent .cost-dot {
    fill: var(--plot);
    stroke: #b9a8ff;
    stroke-width: 1.5;
  }
  .api-equivalent .cost-zero {
    stroke: #b9a8ff;
  }
  .cost-range {
    stroke: #7ddbb7;
    stroke-width: 4;
    stroke-linecap: round;
    opacity: 0.45;
  }
  .api-equivalent .cost-range {
    stroke: #b9a8ff;
  }
  .track-pin {
    stroke: #fff;
    stroke-width: 1.5;
    pointer-events: none;
  }
  .track-hover {
    stroke: var(--secondary);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    pointer-events: none;
  }
  .economics-mark:focus-visible .cache-segment,
  .economics-mark:focus-visible .cost-dot,
  .economics-mark:focus-visible .cost-zero,
  .economics-mark:focus-visible .zero-mark,
  .economics-mark:focus-visible .uncertain-mark {
    stroke: #fff;
    stroke-width: 2.5;
  }
</style>
