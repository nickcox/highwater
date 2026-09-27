<script lang="ts">
  import { afterUpdate, beforeUpdate, onMount, tick } from 'svelte';
  import type { IndexedAnalysis, InteractionState } from '../types';
  import { displayItemLabel } from '../item-label';
  import { itemColor } from './colors';
  import EconomicsTrack from './EconomicsTrack.svelte';
  import EventGlyph from './EventGlyph.svelte';
  import {
    hasNumericCacheData,
    projectCachePresentation,
    type CacheViewMode,
    type EconomicsEventBreakdown,
    type EconomicsTrackMode,
  } from './economics-track';
  import { clientXToViewBox, nearestCallIndex } from './hit-testing';
  import { nonOverlappingCallLabelPositions } from './axis-labels';
  import { chartUnitLabel } from './format';
  import { describeCostBasis, usageNormalizationLabel } from '../cost-basis';
  import { layoutCallColumns, layoutContextRiver } from './layout';
  import type { ContextRiverLayout } from './types';
  import { formatVerticalTick, verticalScaleTicks, visibleStackSample } from './vertical-scale';
  import { hasVisibleItemPresence, itemPresentAtCall, nearestPresentCall } from './reveal';
  import {
    cancelAllPointers,
    cancelPointer,
    clearClickSuppression,
    consumeClickSuppression,
    emptyGestureState,
    pointerCenter,
    pointerDown,
    pointerMove as transitionPointerMove,
    pointerUp,
    pointersAfterDown,
    pointersAfterUp,
    type GestureEffect,
    type GesturePointer,
  } from './gestures';
  import {
    captureViewportAnchor,
    clampScrollLeft,
    latestScrollTarget,
    scrollTargetForAnchor,
    visibleCallRange,
    type RiverNavigationCommand,
    type RiverViewportStatus,
    type ViewportAnchor,
    type ViewportCallPosition,
  } from './viewport';

  export let indexed: IndexedAnalysis;
  export let interaction: InteractionState;
  export let selectedItemId: string | null = null;
  export let hoveredItemId: string | null = null;
  export let navigationCommand: RiverNavigationCommand | null = null;
  export let isVisible = true;
  export let onViewportChange: (status: RiverViewportStatus) => void = () => {};
  export let onSelectionVisibility: (
    status: { itemId: string; visible: boolean } | null,
  ) => void = () => {};
  export let onHoverCall: (index: number | null) => void;
  export let onPinCall: (index: number) => void;
  export let onHoverItem: (id: string | null, event?: PointerEvent) => void;
  export let onSelectItem: (id: string) => void;
  export let onEmptyClick: (index: number) => void;
  export let onEscape: () => void;

  type RequestedRange = { startCallIndex: number; endCallIndex: number };
  type VerticalScaleMode = 'session' | 'visible';
  type RiverLayoutMode = 'balanced' | 'compact';
  type RiverDisplayMode = 'items' | 'itemTypes';

  let host: HTMLDivElement;
  let svg: SVGSVGElement;
  let observedWidth = 960;
  let hasObservedWidth = false;
  let viewportScrollLeft = 0;
  let selectionViewportScrollLeft = 0;
  let measuredChartOffsetX = 0;
  let verticalScaleMode: VerticalScaleMode = 'session';
  let riverLayoutMode: RiverLayoutMode = 'balanced';
  let riverDisplayMode: RiverDisplayMode = 'items';
  let cacheViewMode: CacheViewMode = 'tokens';
  let economicsTrackMode: EconomicsTrackMode = 'off';
  $: costCopy = describeCostBasis(indexed.analysis.economics.costBasis);
  $: usageMappingLabel = usageNormalizationLabel(indexed.analysis.session.source);
  let economicsReadout = '';
  let economicsEventBreakdown: EconomicsEventBreakdown | null = null;
  let groupBreakdown: { kind: string; memberIds: string[]; callIndex: number | null } | null = null;
  let groupBreakdownElement: HTMLDivElement | null = null;
  let groupBreakdownReturnElement: HTMLElement | SVGElement | null = null;
  let hoveredGroup: { kind: string; total: number; callIndex: number | null } | null = null;
  let economicsBreakdownElement: HTMLDivElement | null = null;
  let economicsBreakdownStyle = '';
  let economicsOverlayRevision = 0;
  let economicsTrackComponent: { closeEventBreakdown: (returnFocus?: boolean) => void } | null =
    null;
  /** Null means Fit all; otherwise this is the CSS-pixel distance between adjacent calls. */
  let callSpacing: number | null = null;
  // Keep an explicit range fitted through responsive reflow; other navigation clears it.
  let requestedRange: RequestedRange | null = null;
  let pendingRangeResize: RequestedRange | null = null;
  let lastPositionSignature = '';
  let lastObservedWidth = observedWidth;
  let lastCommandId: number | null = null;
  let lastPublishedStatus = '';
  let lastSelectionVisibilityKey = '';
  let lastColumns: ViewportCallPosition[] = [];
  let pendingAdjustment: 'fit' | { kind: 'anchor'; anchor: ViewportAnchor } | null = null;
  let dragSelection: { startClientX: number; currentClientX: number } | null = null;
  let gestureState = emptyGestureState();
  let clickSuppressionTimer: number | null = null;
  let spaceHeld = false;
  let lastVisibility = true;

  $: height = riverLayoutMode === 'balanced' ? 500 : 420;
  const margin = { top: 36, right: 24, bottom: 54, left: 42 };
  const condensedTargetSpacing = 52;
  const dragThreshold = 7;
  const zoomMultiplier = 1.5;
  const wheelZoomSensitivity = 0.0035;
  const pinchZoomExponent = 1.7;
  const maxZoomFactor = 256;
  const emptyVisibleScaleSample = {
    maxWeight: 0,
    visibleCallCount: 0,
    usesInterpolatedEdge: false,
  };

  $: positionSignature = JSON.stringify(
    indexed.analysis.modelCalls.map((call) => [call.index, call.sourceRecordId]),
  );
  $: callCount = indexed.analysis.modelCalls.length;
  $: fitInnerWidth = Math.max(1, observedWidth - margin.left - margin.right);
  $: fitCallSpacing = callCount > 1 ? fitInnerWidth / (callCount - 1) : 0;
  $: effectiveCallSpacing = Math.max(callSpacing ?? fitCallSpacing, fitCallSpacing);
  $: width =
    callCount > 1 && callSpacing !== null
      ? Math.max(observedWidth, margin.left + margin.right + (callCount - 1) * callSpacing)
      : Math.max(1, observedWidth);
  $: scaleColumns = layoutCallColumns(indexed, width, margin);
  $: visiblePlotLeft = Math.max(margin.left, viewportScrollLeft - measuredChartOffsetX);
  $: visiblePlotRight = Math.min(
    width - margin.right,
    viewportScrollLeft - measuredChartOffsetX + observedWidth,
  );
  $: selectionPlotLeft = Math.max(margin.left, selectionViewportScrollLeft - measuredChartOffsetX);
  $: selectionPlotRight = Math.min(
    width - margin.right,
    selectionViewportScrollLeft - measuredChartOffsetX + observedWidth,
  );
  $: selectionVisibility =
    selectedItemId === null || !hasObservedWidth || !isVisible
      ? null
      : {
          itemId: selectedItemId,
          visible: selectedItemVisibleInRiver(selectedItemId, riverDisplayMode, river.ribbons, {
            left: selectionPlotLeft,
            right: selectionPlotRight,
          }),
        };
  $: selectionVisibilityKey = JSON.stringify(selectionVisibility);
  $: if (selectionVisibilityKey !== lastSelectionVisibilityKey) {
    lastSelectionVisibilityKey = selectionVisibilityKey;
    onSelectionVisibility(selectionVisibility);
  }
  $: if (lastVisibility !== isVisible) {
    lastVisibility = isVisible;
    if (!isVisible) {
      cancelAllGestureState();
      onHoverCall(null);
      onHoverItem(null);
      if (economicsEventBreakdown) closeEconomicsBreakdown(false);
    } else if (host?.clientWidth > 0) {
      observedWidth = host.clientWidth;
      hasObservedWidth = true;
      syncScaleViewportMetrics();
    }
  }
  $: visibleScaleSample =
    verticalScaleMode === 'visible'
      ? visibleStackSample(scaleColumns, visiblePlotLeft, visiblePlotRight)
      : emptyVisibleScaleSample;
  $: verticalDomainMax = verticalScaleMode === 'visible' ? visibleScaleSample.maxWeight : undefined;
  $: river = layoutContextRiver(
    indexed,
    {
      width,
      height,
      margin,
      minimumVisibleThickness: 1,
      verticalDomainMax,
      groupByKind: riverDisplayMode === 'itemTypes',
    },
    scaleColumns,
  );
  $: cachePresentation = projectCachePresentation(indexed.analysis);
  $: verticalAxisMaximum =
    verticalScaleMode === 'visible' ? visibleScaleSample.maxWeight : river.maxTotalDisplayWeight;
  $: verticalAxisDomain = Math.max(1, verticalAxisMaximum);
  $: verticalAxisTicks = verticalScaleTicks(verticalAxisMaximum);
  $: verticalAxisTickData = verticalAxisTicks.map((value, position) => ({
    value,
    position,
    y: margin.top + river.innerHeight * (1 - value / verticalAxisDomain),
    percent: Math.max(0, Math.min(100, 100 * (1 - value / verticalAxisDomain))),
  }));
  $: verticalAxisUnit =
    indexed.analysis.displayWeightUnit === 'unavailable'
      ? 'structural placeholder stack weight (token geometry unavailable)'
      : chartUnitLabel(indexed.analysis.displayWeightUnit);
  $: verticalAxisDescription =
    verticalScaleMode === 'session'
      ? `Session-wide scale in ${verticalAxisUnit}. Ribbon heights remain comparable across the session.`
      : `${visibleScaleSample.visibleCallCount} visible call markers in ${verticalAxisUnit}. Viewport edges are interpolated where needed; ribbon heights change as you pan or zoom.`;
  $: verticalAxisAccessibleLabel = `Vertical axis. ${verticalAxisDescription} Tick values: ${verticalAxisTicks.map(formatVerticalTick).join(', ')}.`;
  $: columnByCall = new Map(river.columns.map((column) => [column.callIndex, column]));
  $: viewportColumns = river.columns.map((column) => ({
    callIndex: column.callIndex,
    x: column.x,
    sourceRecordId: indexed.callByIndex.get(column.callIndex)?.sourceRecordId ?? null,
  }));
  $: minimumColumnSpacing =
    viewportColumns.length < 2
      ? Number.POSITIVE_INFINITY
      : viewportColumns.reduce(
          (minimum, column, position) =>
            position === 0
              ? minimum
              : Math.min(minimum, column.x - viewportColumns[position - 1].x),
          Number.POSITIVE_INFINITY,
        );
  $: callTargetStride =
    minimumColumnSpacing < condensedTargetSpacing
      ? Math.ceil(condensedTargetSpacing / Math.max(1, minimumColumnSpacing))
      : 1;
  $: callLabelPositions = nonOverlappingCallLabelPositions(
    river.columns,
    condensedTargetSpacing,
    interaction.pinnedCallIndex,
  );
  $: guidePositions = callLabelPositions;
  $: zoomFactor = fitCallSpacing > 0 ? Math.max(1, effectiveCallSpacing / fitCallSpacing) : 1;
  $: isFitAll = callSpacing === null || width <= observedWidth + 1;
  $: maximumCallSpacing = fitCallSpacing * Math.min(maxZoomFactor, Math.max(1, callCount - 1));
  $: canZoomIn = callCount > 1 && effectiveCallSpacing < maximumCallSpacing - 0.5;
  $: canZoomOut = callCount > 1 && !isFitAll && zoomFactor > 1.01;
  $: selectionRect = dragSelection
    ? {
        x: Math.min(viewBoxX(dragSelection.startClientX), viewBoxX(dragSelection.currentClientX)),
        width: Math.abs(
          viewBoxX(dragSelection.currentClientX) - viewBoxX(dragSelection.startClientX),
        ),
      }
    : null;
  $: economicsBreakdownStyle = positionEconomicsBreakdown(economicsOverlayRevision);

  beforeUpdate(() => {
    if (!host) return;
    if (requestedRange && callSpacing !== null && observedWidth !== lastObservedWidth) {
      // Defer until afterUpdate so the new anchor is applied against the resized SVG geometry.
      pendingRangeResize = requestedRange;
      return;
    }
    if (pendingAdjustment) return;
    if (
      callSpacing !== null &&
      (positionSignature !== lastPositionSignature || observedWidth !== lastObservedWidth)
    ) {
      const anchor = captureViewportAnchor(
        lastColumns,
        host.scrollLeft,
        measuredClientWidth(),
        chartContentOffsetX(),
      );
      if (anchor) pendingAdjustment = { kind: 'anchor', anchor };
    }
  });

  afterUpdate(() => {
    if (!host) return;
    applyPendingAdjustment();
    if (navigationCommand && navigationCommand.id !== lastCommandId) {
      if (navigationCommand.kind !== 'reveal-item' || canExecuteReveal()) {
        lastCommandId = navigationCommand.id;
        applyNavigationCommand(navigationCommand);
      }
    }
    if (pendingRangeResize) {
      const resizedRange = pendingRangeResize;
      pendingRangeResize = null;
      if (requestedRange === resizedRange && callSpacing !== null) {
        const range = anchorForCallRange(
          resizedRange.startCallIndex,
          resizedRange.endCallIndex,
          measuredClientWidth() / 2,
        );
        if (range) {
          const targetSpacing =
            range.intervalCount === 0
              ? fitInnerWidth / (Math.min(15, callCount) - 1)
              : fitInnerWidth / range.intervalCount;
          setCallSpacing(Math.min(maximumCallSpacing, targetSpacing), range.anchor);
        } else {
          requestedRange = null;
        }
      }
    }
    syncScaleViewportMetrics();
    lastPositionSignature = positionSignature;
    lastObservedWidth = observedWidth;
    lastColumns = viewportColumns;
    publishViewport();
    if (economicsEventBreakdown && economicsBreakdownElement) {
      const nextStyle = positionEconomicsBreakdown(economicsOverlayRevision);
      if (nextStyle !== economicsBreakdownStyle) economicsBreakdownStyle = nextStyle;
    }
  });

  onMount(() => {
    if (hasNumericCacheData(indexed.analysis)) economicsTrackMode = 'cache';

    const onScroll = () => {
      syncScaleViewportMetrics();
      publishViewport();
      refreshEconomicsOverlay();
    };
    const onDocumentScroll = () => refreshEconomicsOverlay();
    const onWheel = (event: WheelEvent) => {
      if (!(event.metaKey || event.ctrlKey) || callCount < 2) return;
      event.preventDefault();
      const deltaPixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * Math.max(1, host.clientHeight)
            : event.deltaY;
      zoomAt(event.clientX, Math.exp(-deltaPixels * wheelZoomSensitivity));
    };
    const onWindowPointerMove = (event: PointerEvent) => handleGesturePointerMove(event);
    const onWindowPointerUp = (event: PointerEvent) => handleGesturePointerUp(event);
    const onWindowPointerCancel = (event: PointerEvent) => handleGesturePointerCancel(event);
    const onWindowLostPointerCapture = (event: PointerEvent) => handleGesturePointerCancel(event);
    const onWindowKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld = false;
    };
    const onWindowBlur = () => {
      spaceHeld = false;
      cancelAllGestureState();
    };
    host.addEventListener('scroll', onScroll, { passive: true });
    host.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    window.addEventListener('lostpointercapture', onWindowLostPointerCapture);
    window.addEventListener('keyup', onWindowKeyUp);
    window.addEventListener('blur', onWindowBlur);

    const measure = () => {
      if (host.clientWidth > 0) {
        if (observedWidth !== host.clientWidth) observedWidth = host.clientWidth;
        hasObservedWidth = true;
        syncScaleViewportMetrics();
        publishViewport();
        refreshEconomicsOverlay();
      }
    };
    measure();
    document.addEventListener('scroll', onDocumentScroll, true);
    window.addEventListener('resize', measure);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const nextWidth = entries[0]?.contentRect.width;
        if (nextWidth && nextWidth > 0) {
          observedWidth = nextWidth;
          hasObservedWidth = true;
          syncScaleViewportMetrics();
        }
      });
      observer.observe(host);
    }
    return () => {
      cancelAllGestureState();
      if (clickSuppressionTimer !== null) window.clearTimeout(clickSuppressionTimer);
      observer?.disconnect();
      host.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onDocumentScroll, true);
      host.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
      window.removeEventListener('lostpointercapture', onWindowLostPointerCapture);
      window.removeEventListener('resize', measure);
      window.removeEventListener('keyup', onWindowKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  });

  function measuredClientWidth(): number {
    return host?.clientWidth > 0 ? host.clientWidth : hasObservedWidth ? observedWidth : 0;
  }

  function measuredScrollWidth(): number {
    return Math.max(host?.scrollWidth ?? 0, width);
  }

  function canExecuteReveal(): boolean {
    if (!isVisible || !host || host.clientWidth <= 0) return false;
    if (Math.abs(host.clientWidth - observedWidth) > 0.5) {
      observedWidth = host.clientWidth;
      hasObservedWidth = true;
      return false;
    }
    return true;
  }

  function chartContentOffsetX(): number {
    if (!host || !svg) return 0;
    const hostRect = host.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (!Number.isFinite(hostRect.left) || !Number.isFinite(svgRect.left)) return 0;
    return svgRect.left - hostRect.left + host.scrollLeft - host.clientLeft;
  }

  function syncScaleViewportMetrics(): void {
    if (!host) return;
    if (selectionViewportScrollLeft !== host.scrollLeft)
      selectionViewportScrollLeft = host.scrollLeft;
    const nextOffset = chartContentOffsetX();
    if (Math.abs(measuredChartOffsetX - nextOffset) > 0.01) {
      measuredChartOffsetX = nextOffset;
    }
    if (verticalScaleMode === 'visible' && viewportScrollLeft !== host.scrollLeft) {
      viewportScrollLeft = host.scrollLeft;
    }
  }

  function setVerticalScaleMode(mode: VerticalScaleMode): void {
    verticalScaleMode = mode;
    if (mode === 'visible' && host) {
      viewportScrollLeft = host.scrollLeft;
      measuredChartOffsetX = chartContentOffsetX();
    }
  }

  function currentStatus(): RiverViewportStatus {
    const clientWidth = measuredClientWidth();
    const scrollWidth = measuredScrollWidth();
    const ready = hasObservedWidth || clientWidth > 0;
    const contentOffsetX = chartContentOffsetX();
    const range = ready
      ? visibleCallRange(viewportColumns, host.scrollLeft, clientWidth, contentOffsetX)
      : { firstVisibleCallIndex: null, lastVisibleCallIndex: null };
    return {
      ready,
      isFitAll,
      zoomFactor,
      canZoomIn,
      canZoomOut,
      totalCallCount: callCount,
      hasOverflow: ready && scrollWidth > clientWidth + 1,
      ...range,
    };
  }

  function publishViewport(): void {
    if (!host) return;
    const status = currentStatus();
    const key = JSON.stringify(status);
    if (key !== lastPublishedStatus) {
      lastPublishedStatus = key;
      onViewportChange(status);
    }
  }

  function setScrollLeft(value: number): void {
    host.scrollLeft = clampScrollLeft(value, measuredScrollWidth(), measuredClientWidth());
    syncScaleViewportMetrics();
    publishViewport();
  }

  function applyPendingAdjustment(): void {
    if (!pendingAdjustment) return;
    const adjustment = pendingAdjustment;
    pendingAdjustment = null;
    if (adjustment === 'fit') {
      host.scrollLeft = 0;
      syncScaleViewportMetrics();
      return;
    }
    const target = scrollTargetForAnchor(
      adjustment.anchor,
      viewportColumns,
      measuredClientWidth(),
      measuredScrollWidth(),
      chartContentOffsetX(),
    );
    host.scrollLeft =
      target ?? clampScrollLeft(host.scrollLeft, measuredScrollWidth(), measuredClientWidth());
    syncScaleViewportMetrics();
  }

  function anchorForCall(callIndex: number, offsetFromViewportLeft: number): ViewportAnchor | null {
    const call = indexed.callByIndex.get(callIndex);
    if (!call) return null;
    return { callIndex, sourceRecordId: call.sourceRecordId ?? null, offsetFromViewportLeft };
  }

  function anchorForCallRange(
    startCallIndex: number,
    endCallIndex: number,
    offsetFromViewportLeft: number,
  ): { intervalCount: number; anchor: ViewportAnchor } | null {
    const startPosition = river.columns.findIndex((column) => column.callIndex === startCallIndex);
    const endPosition = river.columns.findIndex((column) => column.callIndex === endCallIndex);
    if (startPosition < 0 || endPosition < 0) return null;
    if (startPosition === endPosition) {
      const anchor = anchorForCall(startCallIndex, offsetFromViewportLeft);
      return anchor ? { intervalCount: 0, anchor } : null;
    }
    const firstColumn = river.columns[Math.min(startPosition, endPosition)];
    const lastColumn = river.columns[Math.max(startPosition, endPosition)];
    if (!firstColumn || !lastColumn) return null;
    const firstCall = indexed.callByIndex.get(firstColumn.callIndex);
    const lastCall = indexed.callByIndex.get(lastColumn.callIndex);
    if (!firstCall || !lastCall) return null;
    return {
      intervalCount: Math.abs(endPosition - startPosition),
      anchor: {
        callIndex: firstColumn.callIndex,
        sourceRecordId: firstCall.sourceRecordId ?? null,
        nextCallIndex: lastColumn.callIndex,
        nextSourceRecordId: lastCall.sourceRecordId ?? null,
        fractionToNext: 0.5,
        offsetFromViewportLeft,
      },
    };
  }

  function anchorAtClientX(clientX: number): ViewportAnchor | null {
    if (river.columns.length === 0) return null;
    const x = Math.min(width - margin.right, Math.max(margin.left, viewBoxX(clientX)));
    const rightPosition = river.columns.findIndex((column) => column.x >= x);
    const left =
      rightPosition < 0
        ? river.columns[river.columns.length - 1]
        : rightPosition === 0
          ? river.columns[0]
          : river.columns[rightPosition - 1];
    const right = rightPosition > 0 ? river.columns[rightPosition] : undefined;
    if (!left) return null;
    const leftCall = indexed.callByIndex.get(left.callIndex);
    const rightCall = right ? indexed.callByIndex.get(right.callIndex) : null;
    const rect = host.getBoundingClientRect();
    return {
      callIndex: left.callIndex,
      sourceRecordId: leftCall?.sourceRecordId ?? null,
      ...(right && rightCall
        ? {
            nextCallIndex: right.callIndex,
            nextSourceRecordId: rightCall.sourceRecordId ?? null,
            fractionToNext: Math.min(1, Math.max(0, (x - left.x) / (right.x - left.x))),
          }
        : {}),
      offsetFromViewportLeft: clientX - rect.left - host.clientLeft,
    };
  }

  function setCallSpacing(nextSpacing: number | null, anchor: ViewportAnchor | null = null): void {
    let resolvedSpacing: number | null;
    if (nextSpacing === null || fitCallSpacing <= 0 || nextSpacing <= fitCallSpacing * 1.005) {
      resolvedSpacing = null;
      pendingAdjustment = 'fit';
    } else {
      resolvedSpacing = Math.min(maximumCallSpacing, Math.max(fitCallSpacing, nextSpacing));
    }
    const scaleUnchanged = callSpacing === resolvedSpacing;
    callSpacing = resolvedSpacing;
    if (anchor) {
      if (scaleUnchanged && resolvedSpacing !== null) {
        const target = scrollTargetForAnchor(
          anchor,
          viewportColumns,
          measuredClientWidth(),
          measuredScrollWidth(),
          chartContentOffsetX(),
        );
        if (target !== null) setScrollLeft(target);
      } else if (resolvedSpacing !== null) {
        pendingAdjustment = { kind: 'anchor', anchor };
      }
    }
  }

  function zoomAt(clientX: number, factor: number): void {
    if (callCount < 2 || !Number.isFinite(factor) || factor <= 0) return;
    requestedRange = null;
    const anchor = anchorAtClientX(clientX);
    const nextSpacing = Math.min(
      maximumCallSpacing,
      Math.max(fitCallSpacing, effectiveCallSpacing * factor),
    );
    setCallSpacing(nextSpacing, anchor);
  }

  function zoomBy(direction: 'in' | 'out'): void {
    const rect = host.getBoundingClientRect();
    const centerX = rect.left + measuredClientWidth() / 2;
    zoomAt(centerX, direction === 'in' ? zoomMultiplier : 1 / zoomMultiplier);
  }

  function zoomToCall(callIndex: number, preserveRequestedRange = false): void {
    if (!preserveRequestedRange) requestedRange = null;
    if (callCount < 2) return;
    let nextSpacing = effectiveCallSpacing;
    if (callSpacing === null) {
      const visibleCallTarget = Math.min(15, callCount);
      if (visibleCallTarget > 1) nextSpacing = fitInnerWidth / (visibleCallTarget - 1);
    }
    const anchor = anchorForCall(callIndex, measuredClientWidth() / 2);
    setCallSpacing(nextSpacing, anchor);
  }

  function zoomToRange(startClientX: number, endClientX: number): void {
    const startCall = pointerCallAtX(startClientX, true);
    const endCall = pointerCallAtX(endClientX, true);
    if (startCall !== null && endCall !== null) zoomToCallRange(startCall, endCall);
  }

  function zoomToCallRange(startCallIndex: number, endCallIndex: number): void {
    const range = anchorForCallRange(startCallIndex, endCallIndex, measuredClientWidth() / 2);
    if (!range) return;
    requestedRange = { startCallIndex, endCallIndex };
    if (range.intervalCount === 0) {
      zoomToCall(startCallIndex, true);
      return;
    }
    setCallSpacing(Math.min(maximumCallSpacing, fitInnerWidth / range.intervalCount), range.anchor);
  }

  function revealItem(itemId: string, referenceCallIndex: number | null): void {
    const item = indexed.itemById.get(itemId);
    if (!item || item.presence.length === 0) return;
    // Explicit reveal is an item-level action; leave the aggregate presentation so
    // the requested item's own ribbon becomes visible and focusable.
    riverDisplayMode = 'items';
    const viewportCenter =
      selectionPlotRight > selectionPlotLeft
        ? (selectionPlotLeft + selectionPlotRight) / 2
        : Number.NaN;
    const fallbackX =
      referenceCallIndex === null
        ? Number.NaN
        : (columnByCall.get(referenceCallIndex)?.x ?? Number.NaN);
    const targetCall = nearestPresentCall(
      item.presence,
      river.columns,
      Number.isFinite(viewportCenter) ? viewportCenter : fallbackX,
      interaction.pinnedCallIndex,
    );
    if (targetCall === null) return;
    const anchor = anchorForCall(targetCall, measuredClientWidth() / 2);
    if (!anchor) return;
    const targetScroll = scrollTargetForAnchor(
      anchor,
      viewportColumns,
      measuredClientWidth(),
      measuredScrollWidth(),
      chartContentOffsetX(),
    );
    if (targetScroll !== null) setScrollLeft(targetScroll);
  }

  function applyNavigationCommand(command: RiverNavigationCommand): void {
    if (command.kind === 'reveal-item') {
      revealItem(command.itemId, command.referenceCallIndex);
      return;
    }
    if (command.kind === 'fit') {
      requestedRange = null;
      setCallSpacing(null);
      return;
    }
    if (command.kind === 'zoom-in' || command.kind === 'zoom-out') {
      zoomBy(command.kind === 'zoom-in' ? 'in' : 'out');
      return;
    }
    if (command.kind === 'latest') {
      requestedRange = null;
      setScrollLeft(latestScrollTarget(measuredScrollWidth(), measuredClientWidth()));
      return;
    }
    if (command.kind === 'range') {
      zoomToCallRange(command.startCallIndex, command.endCallIndex);
      return;
    }
    zoomToCall(command.callIndex);
  }

  function viewBoxX(clientX: number): number {
    const rect = svg.getBoundingClientRect();
    return clientXToViewBox(clientX, rect.left, rect.width, width);
  }

  function pointerCallAtX(clientX: number, clampToPlot = false): number | null {
    let x = viewBoxX(clientX);
    if (clampToPlot) x = Math.min(width - margin.right, Math.max(margin.left, x));
    else if (x < margin.left || x > width - margin.right) return null;
    return nearestCallIndex(x, river.columns);
  }

  function pointerCall(event: PointerEvent): number | null {
    return pointerCallAtX(event.clientX);
  }

  function consumeSuppressedClick(event: MouseEvent): boolean {
    const result = consumeClickSuppression(gestureState);
    gestureState = result.state;
    if (!result.suppressed) return false;
    if (clickSuppressionTimer !== null) window.clearTimeout(clickSuppressionTimer);
    clickSuppressionTimer = null;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function pointerInput(event: PointerEvent): GesturePointer & { shiftKey: boolean } {
    return {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      x: event.clientX,
      y: event.clientY,
      shiftKey: event.shiftKey,
    };
  }

  function capturePointer(pointerId: number): void {
    try {
      host.setPointerCapture(pointerId);
    } catch {
      /* jsdom and browsers without active-pointer capture support may reject this */
    }
  }

  function releasePointer(pointerId: number): void {
    try {
      if (host.hasPointerCapture?.(pointerId)) host.releasePointerCapture(pointerId);
    } catch {
      /* Capture may already have been released by the browser. */
    }
  }

  function scheduleClickSuppression(): void {
    if (clickSuppressionTimer !== null) window.clearTimeout(clickSuppressionTimer);
    clickSuppressionTimer = window.setTimeout(() => {
      gestureState = clearClickSuppression(gestureState);
      clickSuppressionTimer = null;
    }, 0);
  }

  function applyGestureEffects(effects: GestureEffect[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'capture':
          effect.pointerIds.forEach(capturePointer);
          break;
        case 'release':
          effect.pointerIds.forEach(releasePointer);
          break;
        case 'clear-selection':
          dragSelection = null;
          break;
        case 'clear-requested-range':
          requestedRange = null;
          break;
        case 'selection':
          dragSelection = { startClientX: effect.startX, currentClientX: effect.currentX };
          break;
        case 'scroll':
          setScrollLeft(effect.scrollLeft);
          break;
        case 'zoom-range':
          zoomToRange(effect.startX, effect.endX);
          break;
        case 'pinch-zoom': {
          const rect = host.getBoundingClientRect();
          const anchor = {
            ...effect.anchor,
            offsetFromViewportLeft: effect.centerX - rect.left - host.clientLeft,
          };
          const distanceRatio = effect.distance / effect.startDistance;
          const nextSpacing = effect.startSpacing * Math.pow(distanceRatio, pinchZoomExponent);
          setCallSpacing(nextSpacing, anchor);
          break;
        }
        case 'suppress-click':
          scheduleClickSuppression();
          break;
        case 'prevent-default':
          break;
      }
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    const input = pointerInput(event);
    const points = pointersAfterDown(gestureState.pointers, input);
    const center = pointerCenter(points);
    const pinchAnchor = center ? anchorAtClientX(center.x) : null;
    const transition = pointerDown(gestureState, input, {
      spaceHeld,
      scrollLeft: host.scrollLeft,
      callSpacing: effectiveCallSpacing,
      pinchAnchor,
    });
    gestureState = transition.state;
    if (transition.effects.some((effect) => effect.kind === 'prevent-default')) {
      event.preventDefault();
    }
    applyGestureEffects(transition.effects);
  }

  function handleGesturePointerMove(event: PointerEvent): void {
    const transition = transitionPointerMove(gestureState, pointerInput(event), {
      dragThreshold,
    });
    gestureState = transition.state;
    applyGestureEffects(transition.effects);
  }

  function handleGesturePointerUp(event: PointerEvent): void {
    const points = pointersAfterUp(gestureState.pointers, event.pointerId);
    const center = pointerCenter(points);
    const pinchAnchor = center ? anchorAtClientX(center.x) : null;
    const transition = pointerUp(gestureState, event.pointerId, {
      clientX: event.clientX,
      callSpacing: effectiveCallSpacing,
      pinchAnchor,
    });
    gestureState = transition.state;
    applyGestureEffects(transition.effects);
  }

  function handleGesturePointerCancel(event: PointerEvent): void {
    const transition = cancelPointer(gestureState, event.pointerId);
    gestureState = transition.state;
    applyGestureEffects(transition.effects);
  }

  function cancelAllGestureState(): void {
    const transition = cancelAllPointers(gestureState);
    gestureState = transition.state;
    applyGestureEffects(transition.effects);
    if (clickSuppressionTimer !== null) window.clearTimeout(clickSuppressionTimer);
    clickSuppressionTimer = null;
  }

  function pointerMove(event: PointerEvent): void {
    onHoverCall(pointerCall(event));
  }

  function setEconomicsTrackMode(mode: EconomicsTrackMode): void {
    economicsTrackMode = mode;
    if (mode === 'off') cacheViewMode = 'tokens';
    if (mode === 'off') {
      economicsReadout = '';
      economicsEventBreakdown = null;
      economicsBreakdownStyle = '';
    }
  }

  function updateEconomicsReadout(readout: string): void {
    economicsReadout = readout;
  }

  function updateEconomicsEventBreakdown(breakdown: EconomicsEventBreakdown | null): void {
    economicsEventBreakdown = breakdown;
    if (breakdown === null) economicsBreakdownStyle = '';
  }

  function zoomEconomicsEvents(): void {
    const calls = economicsEventBreakdown?.callIndices ?? [];
    if (calls.length === 0) return;
    const start = Math.min(...calls);
    const end = Math.max(...calls);
    if (start === end) zoomToCall(start);
    else zoomToCallRange(start, end);
  }

  function groupLabel(kind: string): string {
    return kind.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
  }

  function cacheAvailabilityLabel(category: (typeof cachePresentation.categories)[number]): string {
    switch (category.availability) {
      case 'available':
        return `available for ${category.completeCalls} of ${category.applicableCalls} applicable calls`;
      case 'measuredZero':
        return `0 in this session (${category.completeCalls} applicable calls covered)`;
      case 'partial':
        return `partial coverage (${category.completeCalls} of ${category.applicableCalls} calls complete)`;
      case 'missing':
        return 'missing; no numeric zero is inferred';
      case 'notReported':
        return 'not separately reported by this API';
      case 'notRetained':
        return 'not retained by the source';
      default:
        return 'unsupported policy';
    }
  }

  function showGroupBreakdown(
    kind: string,
    memberIds: string[],
    callIndex: number | null,
    returnElement: HTMLElement | SVGElement | null = null,
  ): void {
    if (groupBreakdown === null) {
      groupBreakdownReturnElement =
        returnElement ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    groupBreakdown = { kind, memberIds, callIndex };
    void tick().then(() => {
      if (groupBreakdownElement?.isConnected) {
        document.getElementById('group-breakdown-close')?.focus();
      }
    });
  }

  function closeGroupBreakdown(returnFocus = true): void {
    const returnElement = groupBreakdownReturnElement;
    groupBreakdown = null;
    groupBreakdownReturnElement = null;
    if (returnFocus && returnElement?.isConnected) void tick().then(() => returnElement.focus());
  }

  function handleGroupBreakdownKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeGroupBreakdown();
    }
  }

  function showGroupHover(
    kind: string,
    values: Map<number, number> | undefined,
    clientX: number,
  ): void {
    const callIndex = pointerCallAtX(clientX, true);
    hoveredGroup = {
      kind,
      total: callIndex === null ? 0 : (values?.get(callIndex) ?? 0),
      callIndex,
    };
  }

  function revealGroupMembers(): void {
    riverDisplayMode = 'items';
    closeGroupBreakdown(false);
  }

  function economicsAnchorPoint(): { x: number; y: number } | null {
    if (!economicsEventBreakdown || !host) return null;
    const track = host.querySelector<SVGSVGElement>('.economics-track-svg');
    if (!track) return null;
    const trackBounds = track.getBoundingClientRect();
    const trackWidth = Number(track.getAttribute('width')) || track.viewBox.baseVal.width;
    const scaleX = trackWidth > 0 ? trackBounds.width / trackWidth : 1;
    const scaleY =
      track.viewBox.baseVal.height > 0 ? trackBounds.height / track.viewBox.baseVal.height : 1;
    return {
      x: trackBounds.left + economicsEventBreakdown.anchorX * scaleX,
      y: trackBounds.top + economicsEventBreakdown.anchorY * scaleY,
    };
  }

  function economicsVisibleBounds(): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null {
    if (!host) return null;
    const hostBounds = host.getBoundingClientRect();
    const plotBounds = host.parentElement?.getBoundingClientRect();
    const left = Math.max(0, hostBounds.left, plotBounds?.left ?? -Infinity);
    const right = Math.min(
      window.innerWidth,
      hostBounds.right,
      plotBounds?.right ?? Number.POSITIVE_INFINITY,
    );
    const top = Math.max(0, hostBounds.top, plotBounds?.top ?? -Infinity);
    const bottom = Math.min(
      window.innerHeight,
      hostBounds.bottom,
      plotBounds?.bottom ?? Number.POSITIVE_INFINITY,
    );
    return right >= left && bottom >= top ? { left, right, top, bottom } : null;
  }

  function economicsAnchorVisible(): boolean {
    const point = economicsAnchorPoint();
    const bounds = economicsVisibleBounds();
    if (!point || !bounds) return false;
    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  }

  function refreshEconomicsOverlay(): void {
    economicsOverlayRevision += 1;
    if (economicsEventBreakdown && !economicsAnchorVisible()) closeEconomicsBreakdown(false);
  }

  function positionEconomicsBreakdown(_revision: number): string {
    if (!economicsEventBreakdown || !economicsBreakdownElement || window.innerWidth <= 620)
      return '';
    const point = economicsAnchorPoint();
    const track = host?.querySelector<SVGSVGElement>('.economics-track-svg');
    if (!point || !track) return '';
    const trackBounds = track.getBoundingClientRect();
    const elementBounds = economicsBreakdownElement.getBoundingClientRect();
    const hostBounds = host.getBoundingClientRect();
    const width = Math.min(300, Math.max(120, elementBounds.width || 300));
    const height = elementBounds.height || 160;
    const minLeft = Math.max(8, hostBounds.left + 8);
    const maxLeft = Math.max(
      minLeft,
      Math.min(window.innerWidth - width - 8, hostBounds.right - width - 8),
    );
    const left = Math.max(minLeft, Math.min(maxLeft, point.x - width / 2));
    const scaleY =
      track.viewBox.baseVal.height > 0 ? trackBounds.height / track.viewBox.baseVal.height : 1;
    const laneTop = trackBounds.top + economicsEventBreakdown.laneTop * scaleY;
    const laneBottom =
      trackBounds.top +
      (economicsEventBreakdown.laneTop + economicsEventBreakdown.laneHeight) * scaleY;
    const below = laneBottom + 8;
    const above = laneTop - height - 8;
    const top =
      below + height <= window.innerHeight - 8
        ? below
        : above >= 8
          ? above
          : Math.max(8, Math.min(window.innerHeight - height - 8, below));
    return `left:${left}px;top:${top}px;width:${width}px`;
  }

  function closeEconomicsBreakdown(returnFocus = true): void {
    economicsTrackComponent?.closeEventBreakdown(returnFocus);
  }

  function handleEconomicsBreakdownKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeEconomicsBreakdown();
    }
  }

  function inspectEconomicsEvent(callIndex: number): void {
    closeEconomicsBreakdown(false);
    onPinCall(callIndex);
    void tick().then(() => document.getElementById(`economics-call-${callIndex}`)?.focus());
  }

  function economicsMarkClick(event: MouseEvent, index: number): void {
    if (consumeSuppressedClick(event)) return;
    event.stopPropagation();
    onPinCall(index);
  }

  function backgroundClick(event: MouseEvent): void {
    if (consumeSuppressedClick(event)) return;
    const callIndex = pointerCall(event as PointerEvent);
    if (callIndex !== null) onEmptyClick(callIndex);
  }

  function selectRibbon(event: MouseEvent, itemId: string): void {
    if (consumeSuppressedClick(event)) return;
    event.stopPropagation();
    onSelectItem(itemId);
    const callIndex = pointerCallAtX(event.clientX);
    if (callIndex !== null) onPinCall(callIndex);
  }

  function activateGroup(event: MouseEvent, kind: string, memberIds: string[]): void {
    if (consumeSuppressedClick(event)) return;
    event.stopPropagation();
    const callIndex = pointerCallAtX(event.clientX, true);
    const membersAtCall =
      callIndex === null
        ? memberIds
        : memberIds.filter((memberId) => indexed.contextSetByCall.get(callIndex)?.has(memberId));
    showGroupBreakdown(
      kind,
      membersAtCall,
      callIndex,
      event.currentTarget instanceof SVGElement ? event.currentTarget : null,
    );
  }

  function activateGroupFromKeyboard(
    event: KeyboardEvent,
    kind: string,
    memberIds: string[],
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const callIndex = interaction.pinnedCallIndex;
      const membersAtCall =
        callIndex === null
          ? memberIds
          : memberIds.filter((memberId) => indexed.contextSetByCall.get(callIndex)?.has(memberId));
      showGroupBreakdown(
        kind,
        membersAtCall,
        callIndex,
        event.currentTarget instanceof SVGElement ? event.currentTarget : null,
      );
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  function handleHostKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    } else if (event.code === 'Space' && (event.target === host || event.target === svg)) {
      spaceHeld = true;
      event.preventDefault();
    }
  }

  function selectFromKeyboard(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectItem(id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  function pinFromKeyboard(event: KeyboardEvent, callIndex: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPinCall(callIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  function itemAccessibleLabel(id: string): string {
    return displayItemLabel(indexed.itemById.get(id), id);
  }

  function selectedItemVisibleInRiver(
    itemId: string,
    displayMode: RiverDisplayMode,
    ribbons: ContextRiverLayout['ribbons'],
    bounds: { left: number; right: number },
  ): boolean {
    if (displayMode === 'items') return hasVisibleItemPresence(itemId, ribbons, bounds);
    const item = indexed.itemById.get(itemId);
    if (!item) return false;
    return ribbons.some(
      (ribbon) =>
        ribbon.memberItemIds?.includes(itemId) &&
        ribbon.points.some(
          (point) =>
            itemPresentAtCall(item.presence, point.callIndex) &&
            point.x >= bounds.left &&
            point.x <= bounds.right,
        ),
    );
  }

  function connectorVisible(from: string): boolean {
    const focusedItemId = selectedItemId ?? hoveredItemId;
    return focusedItemId !== null && from === focusedItemId;
  }
</script>

<div class="vertical-scale-controls">
  <div class="scale-toggle" role="group" aria-label="Vertical scale">
    <span class="scale-label">Vertical scale</span>
    <button
      type="button"
      class:active={verticalScaleMode === 'session'}
      aria-pressed={verticalScaleMode === 'session'}
      onclick={() => setVerticalScaleMode('session')}>Session scale</button
    >
    <button
      type="button"
      class:active={verticalScaleMode === 'visible'}
      aria-pressed={verticalScaleMode === 'visible'}
      onclick={() => setVerticalScaleMode('visible')}>Visible calls</button
    >
  </div>
  <div class="scale-toggle" role="group" aria-label="River layout">
    <span class="scale-label">Layout</span>
    <button
      type="button"
      class:active={riverLayoutMode === 'balanced'}
      aria-pressed={riverLayoutMode === 'balanced'}
      onclick={() => (riverLayoutMode = 'balanced')}>Balanced</button
    >
    <button
      type="button"
      class:active={riverLayoutMode === 'compact'}
      aria-pressed={riverLayoutMode === 'compact'}
      onclick={() => (riverLayoutMode = 'compact')}>Compact River</button
    >
  </div>
  <div class="scale-toggle" role="group" aria-label="River display">
    <span class="scale-label">Display</span>
    <button
      type="button"
      class:active={riverDisplayMode === 'items'}
      aria-pressed={riverDisplayMode === 'items'}
      onclick={() => {
        riverDisplayMode = 'items';
        groupBreakdown = null;
      }}>Items</button
    >
    <button
      type="button"
      class:active={riverDisplayMode === 'itemTypes'}
      aria-pressed={riverDisplayMode === 'itemTypes'}
      onclick={() => (riverDisplayMode = 'itemTypes')}>Item types</button
    >
  </div>
</div>
<div class="chart-frame">
  <div class="chart-plot">
    <div
      class="vertical-axis-overlay"
      role="img"
      aria-label={verticalAxisAccessibleLabel}
      style={`top:${margin.top}px;height:${river.innerHeight}px`}
    >
      {#each verticalAxisTickData as tick (tick.value)}
        <span
          class="vertical-axis-tick"
          class:top={tick.position === verticalAxisTickData.length - 1}
          class:bottom={tick.position === 0}
          style:top={`${tick.percent}%`}>{formatVerticalTick(tick.value)}</span
        >
      {/each}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_tabindex -->
    <div
      class="river-scroll"
      bind:this={host}
      data-testid="river-host"
      role="application"
      tabindex="0"
      aria-label="Context River"
      aria-describedby="context-river-description"
      onpointerdown={handlePointerDown}
      onpointermove={pointerMove}
      onselectstart={(event) => event.preventDefault()}
      onpointerleave={() => {
        onHoverCall(null);
        onHoverItem(null);
      }}
      onkeydown={handleHostKeyDown}
      onclick={backgroundClick}
    >
      <span id="context-river-description" class="sr-only"
        >Context items flow horizontally through model calls. Dashed vertical markers indicate
        compaction. {verticalAxisDescription}. {indexed.analysis.displayWeightUnit === 'unavailable'
          ? 'Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths.'
          : ''}</span
      >
      <svg bind:this={svg} viewBox={`0 0 ${width} ${height}`} {width} {height}>
        <defs>
          <pattern
            id="unknown-geometry"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="8" height="8" fill="#46516a" />
            <path d="M0 0V8" stroke="#8793aa" stroke-width="2" opacity=".65" />
          </pattern>
        </defs>
        <rect
          class="plot-background"
          x={margin.left}
          y={margin.top}
          width={river.innerWidth}
          height={river.innerHeight}
        />

        {#each verticalAxisTickData as tick (tick.value)}
          <line
            class="weight-gridline"
            x1={margin.left}
            x2={width - margin.right}
            y1={tick.y}
            y2={tick.y}
          />
        {/each}

        {#each river.columns as column, position (column.callIndex)}
          {#if guidePositions.has(position)}<line
              class="column-guide"
              x1={column.x}
              x2={column.x}
              y1={margin.top}
              y2={height - margin.bottom}
            />{/if}
          {#if callLabelPositions.has(position)}
            <g
              class="call-target"
              class:condensed={callTargetStride > 1}
              class:pinned={interaction.pinnedCallIndex === column.callIndex}
              role="button"
              tabindex="0"
              aria-label={`Pin model call ${column.callIndex}`}
              onkeydown={(event) => pinFromKeyboard(event, column.callIndex)}
              onclick={(event) => {
                if (consumeSuppressedClick(event)) return;
                event.stopPropagation();
                onPinCall(column.callIndex);
              }}
            >
              <rect x={column.x - 22} y={height - margin.bottom + 5} width="44" height="38" />
              <text x={column.x} y={height - 17} text-anchor="middle">{column.callIndex}</text>
            </g>
          {/if}
        {/each}

        {#each river.compactions as compaction (compaction.compactionId)}
          <g
            class="compaction-marker"
            aria-label={`Compaction before call ${compaction.beforeModelCall}`}
          >
            <title>Compaction before call {compaction.beforeModelCall}</title>
            <line
              x1={compaction.x}
              x2={compaction.x}
              y1={margin.top - 8}
              y2={height - margin.bottom}
            />
            <text x={compaction.x + 5} y={margin.top - 13}
              >{minimumColumnSpacing < 64 ? 'C' : 'COMPACT'}</text
            >
          </g>
        {/each}

        {#each river.lineageConnectors as connector (connector.key)}
          <path
            class="lineage-connector"
            class:visible={connectorVisible(connector.fromItemId)}
            d={connector.path}
          />
        {/each}

        {#each river.ribbons as ribbon (ribbon.key)}
          {@const isGroup = ribbon.groupKind !== undefined}
          {@const ribbonLabel = isGroup
            ? `Item type ${groupLabel(ribbon.groupKind!)} · ${ribbon.memberItemIds?.length ?? 0} items`
            : itemAccessibleLabel(ribbon.itemId)}
          <g
            class="ribbon-group"
            class:group-ribbon={isGroup}
            class:selected={!isGroup && interaction.selectedItemId === ribbon.itemId}
            class:hovered={!isGroup && interaction.hoveredItemId === ribbon.itemId}
            class:unknown={indexed.analysis.displayWeightUnit === 'unavailable'}
          >
            <path
              class="ribbon"
              class:subpixel={ribbon.isSubpixel}
              d={ribbon.path}
              fill={indexed.analysis.displayWeightUnit === 'unavailable'
                ? 'url(#unknown-geometry)'
                : itemColor(ribbon.itemId)}
              stroke={ribbon.isSubpixel ? itemColor(ribbon.itemId) : 'none'}
              stroke-width={ribbon.isSubpixel ? 1.25 : 0}
            />
            <path
              class="ribbon-hit"
              pointer-events="fill"
              d={ribbon.hitPath}
              role="button"
              tabindex="0"
              aria-label={ribbonLabel}
              aria-pressed={!isGroup && interaction.selectedItemId === ribbon.itemId}
              onpointerenter={(event) =>
                isGroup
                  ? showGroupHover(ribbon.groupKind!, ribbon.valueByCall, event.clientX)
                  : onHoverItem(ribbon.itemId, event)}
              onpointermove={(event) =>
                isGroup
                  ? showGroupHover(ribbon.groupKind!, ribbon.valueByCall, event.clientX)
                  : onHoverItem(ribbon.itemId, event)}
              onpointerleave={() => {
                if (isGroup) hoveredGroup = null;
                else onHoverItem(null);
              }}
              onclick={(event) =>
                isGroup
                  ? activateGroup(event, ribbon.groupKind!, ribbon.memberItemIds ?? [])
                  : selectRibbon(event, ribbon.itemId)}
              onkeydown={(event) =>
                isGroup
                  ? activateGroupFromKeyboard(event, ribbon.groupKind!, ribbon.memberItemIds ?? [])
                  : selectFromKeyboard(event, ribbon.itemId)}
            >
              <title>{ribbonLabel}</title>
            </path>
          </g>
        {/each}

        {#if selectionRect && selectionRect.width > 0}
          <rect
            class="zoom-selection"
            x={selectionRect.x}
            y={margin.top}
            width={selectionRect.width}
            height={river.innerHeight}
          />
        {/if}
        {#if interaction.hoveredCallIndex !== null}
          {@const column = columnByCall.get(interaction.hoveredCallIndex)}
          {#if column}<line
              class="crosshair"
              x1={column.x}
              x2={column.x}
              y1={margin.top}
              y2={height - margin.bottom}
            />{/if}
        {/if}
        {#if interaction.pinnedCallIndex !== null}
          {@const column = columnByCall.get(interaction.pinnedCallIndex)}
          {#if column}<line
              class="pin-line"
              x1={column.x}
              x2={column.x}
              y1={margin.top}
              y2={height - margin.bottom}
            />{/if}
        {/if}
      </svg>
      {#if riverDisplayMode === 'itemTypes'}
        <div class="group-type-legend" role="group" aria-label="Item type legend">
          <strong>Item types</strong>
          {#each [...new Set(river.ribbons
                .map((ribbon) => ribbon.groupKind)
                .filter(Boolean))] as kind}
            <span><i style={`background:${itemColor(`kind:${kind}`)}`}></i>{groupLabel(kind!)}</span
            >
          {/each}
          <small>Colors identify content types, not cache status.</small>
        </div>
      {/if}
      {#if hoveredGroup}
        <div class="group-hover-readout" role="status">
          Item type {groupLabel(hoveredGroup.kind)} · {formatVerticalTick(hoveredGroup.total)}
          {verticalAxisUnit} at call {hoveredGroup.callIndex ?? '—'}
        </div>
      {/if}
      <div
        class="economics-track-header"
        role="group"
        aria-label="Economics track controls and legend"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
      >
        <div class="economics-track-controls">
          <div class="scale-toggle" role="group" aria-label="Economics track">
            <span class="scale-label">Economics</span>
            <button
              type="button"
              class:active={economicsTrackMode === 'cache'}
              aria-pressed={economicsTrackMode === 'cache'}
              onclick={() => setEconomicsTrackMode('cache')}>Cache</button
            >
            <button
              type="button"
              class:active={economicsTrackMode === 'cost'}
              aria-pressed={economicsTrackMode === 'cost'}
              onclick={() => setEconomicsTrackMode('cost')}>Cost</button
            >
            <button
              type="button"
              class:active={economicsTrackMode === 'off'}
              aria-pressed={economicsTrackMode === 'off'}
              onclick={() => setEconomicsTrackMode('off')}>Off</button
            >
          </div>
          {#if economicsTrackMode === 'cache'}
            <div class="scale-toggle cache-view-toggle" role="group" aria-label="Cache view">
              <span class="scale-label">Cache view</span>
              <button
                type="button"
                class:active={cacheViewMode === 'tokens'}
                aria-pressed={cacheViewMode === 'tokens'}
                onclick={() => (cacheViewMode = 'tokens')}>Tokens</button
              >
              <button
                type="button"
                class:active={cacheViewMode === 'share'}
                aria-pressed={cacheViewMode === 'share'}
                onclick={() => (cacheViewMode = 'share')}>Share (%)</button
              >
            </div>
          {/if}
          <span class="track-title">
            {economicsTrackMode === 'cache'
              ? cacheViewMode === 'share'
                ? `Cache share per call · ${usageMappingLabel} prompt-token denominator · fixed 0–100% axis`
                : `Prompt tokens per call · ${usageMappingLabel} · session-wide scale`
              : economicsTrackMode === 'cost'
                ? `${costCopy.label} per call · USD · session-wide scale · ${costCopy.trackCaveat}`
                : 'Economics off · details remain available in the inspector'}
          </span>
        </div>
        {#if economicsTrackMode !== 'off'}
          <div class="track-legend-groups essential-legend">
            {#if economicsTrackMode === 'cache'}
              <div class="track-legend-group" aria-label="Token categories">
                <span class="legend-group-title">Token categories</span>
                <div class="track-legend">
                  {#each cachePresentation.categories as category (category.kind)}
                    <span
                      ><i class={`swatch ${category.kind}`}
                      ></i>{category.label}{category.availability === 'measuredZero'
                        ? ' · 0 in this session'
                        : ''}</span
                    >
                  {:else}
                    <span class="legend-muted">No supported numeric cache categories</span>
                  {/each}
                </div>
              </div>
              {#if cachePresentation.notes.length > 0}
                <span class="inline-availability"
                  >{cachePresentation.notes[cachePresentation.mixedPolicy ? 1 : 0]}</span
                >
              {/if}
              <div class="track-legend-group" aria-label="Events">
                <span class="legend-group-title">Events</span>
                <div class="track-legend">
                  <span
                    ><EventGlyph kind="ratioChange" direction="rise" size={16} />Share rise/drop</span
                  >
                  <span><EventGlyph kind="compaction" size={16} />Compaction</span>
                  <span><EventGlyph kind="targetChange" size={16} />Model / provider change</span>
                </div>
              </div>
            {:else}
              <div class="track-legend-group" aria-label="Cost values">
                <span class="legend-group-title">Cost values</span>
                <div class="track-legend">
                  <span><i class="swatch cost"></i>{costCopy.totalLabel} · USD</span>
                </div>
              </div>
              <div class="track-legend-group" aria-label="Events">
                <span class="legend-group-title">Events</span>
                <div class="track-legend">
                  <span><EventGlyph kind="compaction" size={16} />Compaction</span>
                  <span><EventGlyph kind="targetChange" size={16} />Model / provider change</span>
                </div>
              </div>
            {/if}
            <div class="track-legend-group" aria-label="Data quality">
              <span class="legend-group-title">Data quality</span>
              <div class="track-legend">
                <span><i class="swatch uncertain"></i>Partial / unsupported</span>
                <span><i class="swatch missing"></i>Missing</span>
                <span><i class="swatch zero"></i>Measured zero</span>
              </div>
            </div>
          </div>
          {#if economicsTrackMode === 'cache'}
            <details class="economics-legend">
              <summary>Legend and data quality</summary>
              <p class="availability-summary">
                <b>Data availability.</b>
                {cachePresentation.summary}
              </p>
              <p class="availability-summary">
                Fresh / uncached input uses each policy's exact label below.
              </p>
              <ul class="availability-list">
                {#each cachePresentation.categories as category (category.kind)}
                  <li>
                    <b>{category.label}</b>: {cacheAvailabilityLabel(category)}{category.note
                      ? ` · ${category.note}`
                      : ''}
                  </li>
                {/each}
                {#each cachePresentation.notes as note (note)}<li>{note}</li>{/each}
              </ul>
              <p class="availability-summary">
                Share (%) divides each applicable bucket by that call's audited positive
                prompt-token denominator. Missing, partial, unsupported, and zero-prompt calls
                remain distinct.
              </p>
            </details>
          {:else}
            <details class="economics-legend">
              <summary>Legend and data quality</summary>
              <p class="availability-summary">
                <b>Data availability.</b>
                {costCopy.note} Unavailable values are not zero.
              </p>
            </details>
          {/if}
        {/if}
      </div>
      {#if economicsTrackMode !== 'off'}
        <EconomicsTrack
          bind:this={economicsTrackComponent}
          {indexed}
          columns={river.columns}
          {width}
          mode={economicsTrackMode}
          cacheView={cacheViewMode}
          compact={riverLayoutMode === 'compact'}
          pinnedCallIndex={interaction.pinnedCallIndex}
          hoveredCallIndex={interaction.hoveredCallIndex}
          {onPinCall}
          {onHoverCall}
          onMarkClick={economicsMarkClick}
          onReadoutChange={updateEconomicsReadout}
          onEventBreakdownChange={updateEconomicsEventBreakdown}
        />
      {/if}
    </div>
  </div>
  {#if groupBreakdown}
    <div
      bind:this={groupBreakdownElement}
      class="group-breakdown"
      role="dialog"
      tabindex="-1"
      aria-label={`Item type ${groupLabel(groupBreakdown.kind)} breakdown`}
      onkeydown={handleGroupBreakdownKeydown}
    >
      <div class="event-breakdown-header">
        <strong>Item type: {groupLabel(groupBreakdown.kind)}</strong>
        <button
          id="group-breakdown-close"
          type="button"
          aria-label="Close item type breakdown"
          onclick={() => closeGroupBreakdown()}>×</button
        >
      </div>
      <p>
        {groupBreakdown.memberIds.length} members{groupBreakdown.callIndex === null
          ? ''
          : ` at call ${groupBreakdown.callIndex}`}. Grouped geometry is presentation-only;
        individual item identities and totals are unchanged.
      </p>
      <ul>
        {#each groupBreakdown.memberIds.slice(0, 12) as memberId (memberId)}
          <li>{itemAccessibleLabel(memberId)}</li>
        {/each}
      </ul>
      {#if groupBreakdown.memberIds.length > 12}<p>Showing the first 12 members.</p>{/if}
      <button type="button" onclick={revealGroupMembers}>Show items here</button>
    </div>
  {/if}
  {#if economicsEventBreakdown}
    <div
      bind:this={economicsBreakdownElement}
      class="event-breakdown"
      role="dialog"
      tabindex="-1"
      aria-label="Economics event breakdown"
      style={economicsBreakdownStyle}
      onkeydown={handleEconomicsBreakdownKeydown}
    >
      <div class="event-breakdown-header">
        <strong
          >{economicsEventBreakdown.events.length}
          {economicsEventBreakdown.events.length === 1 ? 'event' : 'events'} · calls
          {economicsEventBreakdown.callIndices.join(', ')}</strong
        >
        <button
          id={`${economicsEventBreakdown.id}-close`}
          type="button"
          aria-label="Close event breakdown"
          onclick={() => closeEconomicsBreakdown()}>×</button
        >
      </div>
      <button
        type="button"
        class="zoom-events-button"
        disabled={!canZoomIn || economicsEventBreakdown.callIndices.length === 0}
        onclick={zoomEconomicsEvents}>Zoom to these calls</button
      >
      <ul>
        {#each economicsEventBreakdown.events as event (event.id)}
          <li>
            <span class="event-list-label">
              <EventGlyph kind={event.kind} direction={event.direction} size={18} />
              {event.label} · call {event.callIndex}
            </span>
            <button type="button" onclick={() => inspectEconomicsEvent(event.callIndex)}>
              Inspect call {event.callIndex}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if economicsTrackMode !== 'off'}
    <div class="economics-readout" aria-label="Economics call readout">
      {economicsReadout || 'Hover or focus a call for an exact readout.'}
    </div>
  {/if}
</div>

<style>
  .vertical-scale-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    margin: 0 0 8px;
    color: #b8c4d9;
    font-size: 0.8rem;
  }
  .scale-toggle {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .scale-label {
    margin-right: 3px;
    color: #e0e8f6;
    font-weight: 650;
  }
  .scale-toggle button {
    min-height: 30px;
    padding: 4px 9px;
    border: 1px solid #34435e;
    border-radius: 6px;
    background: #121d32;
    color: #c3cee1;
    font: inherit;
    cursor: pointer;
  }
  .scale-toggle button.active {
    border-color: #88a8e2;
    background: #223657;
    color: #fff;
  }
  .scale-toggle button:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .chart-frame {
    position: relative;
    max-width: 100%;
  }
  .economics-track-header {
    position: sticky;
    left: 0;
    z-index: 3;
    display: grid;
    width: 100%;
    gap: 6px;
    margin: 0 0 8px;
    padding: 8px 10px;
    border: 1px solid #293857;
    border-radius: 8px;
    background: #10192d;
  }
  .economics-track-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px 14px;
    color: #b8c4d9;
    font-size: 0.75rem;
  }
  .economics-legend {
    min-width: 0;
    color: #b8c4d9;
    font-size: 0.72rem;
  }
  .economics-legend[open] {
    padding-top: 2px;
  }
  .economics-legend summary {
    width: fit-content;
    color: #a9bbda;
    cursor: pointer;
  }
  .economics-legend summary:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .track-legend-groups {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 8px 18px;
    padding-top: 6px;
  }
  .essential-legend {
    padding: 2px 0 0;
  }
  .legend-muted,
  .availability-summary {
    color: #aebbd0;
  }
  .inline-availability {
    align-self: center;
    max-width: 38rem;
    color: #f0d08d;
    line-height: 1.35;
  }
  .availability-summary {
    margin: 6px 0;
    line-height: 1.4;
  }
  .availability-list {
    max-width: 100%;
    margin: 6px 0;
    padding-left: 18px;
    color: #cbd5e7;
    line-height: 1.4;
  }
  .group-type-legend,
  .group-hover-readout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 12px;
    margin: 6px 0 0 42px;
    color: #c4d0e4;
    font-size: 11px;
  }
  .group-type-legend strong {
    color: #edf2fb;
  }
  .group-type-legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .group-type-legend i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid rgb(255 255 255 / 45%);
  }
  .group-type-legend small {
    color: #91a4c4;
  }
  .group-hover-readout {
    padding: 4px 7px;
    border-left: 2px solid #9fc0ff;
    background: #10192d;
  }
  .chart-plot {
    position: relative;
    min-width: 0;
    max-width: 100%;
  }
  .event-breakdown,
  .group-breakdown {
    position: fixed;
    z-index: 6;
    width: min(300px, calc(100vw - 16px));
    max-height: min(220px, calc(100vh - 16px));
    overflow: auto;
    padding: 8px;
    color: #e8edf7;
    background: #17233c;
    border: 1px solid #6e86b2;
    border-radius: 7px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
  }
  .event-breakdown-header,
  .event-breakdown li {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
  }
  .event-breakdown-header {
    color: #fff;
    font-size: 12px;
  }
  .event-breakdown-header button {
    padding: 1px 6px;
    font-size: 15px;
    line-height: 1.1;
  }
  .group-breakdown {
    position: static;
    z-index: 6;
    width: min(340px, calc(100vw - 16px));
    margin-top: 8px;
    padding: 9px;
    color: #e8edf7;
    background: #17233c;
    border: 1px solid #6e86b2;
    border-radius: 7px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
  }
  .group-breakdown p {
    margin: 7px 0;
    color: #bac5d8;
    font-size: 11px;
  }
  .group-breakdown ul {
    max-height: 150px;
    overflow: auto;
    margin: 7px 0;
    padding-left: 18px;
    color: #d7e0ef;
    font-size: 11px;
  }
  .event-breakdown ul {
    display: grid;
    gap: 7px;
    margin: 7px 0 0;
    padding: 0;
    list-style: none;
    font-size: 11px;
  }
  .event-breakdown li > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .event-list-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .event-breakdown li button {
    flex: 0 0 auto;
    padding: 3px 6px;
    font-size: 10px;
    white-space: nowrap;
  }
  .economics-readout {
    min-height: 28px;
    margin-top: 8px;
    padding: 5px 8px;
    border-top: 1px solid #293752;
    background: #101a2d;
    color: #d6e0f2;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .track-title {
    min-width: 0;
    color: #dce6f7;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .track-legend-group {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .legend-group-title {
    color: #91a4c4;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .track-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 12px;
    align-items: center;
  }
  .track-legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .swatch {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1px solid #b8c4d9;
    border-radius: 2px;
    flex: 0 0 auto;
  }
  .swatch.read,
  .swatch.cacheRead {
    background: #428fdc;
  }
  .swatch.write,
  .swatch.cacheWrite {
    background: repeating-linear-gradient(135deg, #9167c7 0 3px, #e0c9ff 3px 4px);
  }
  .swatch.fresh {
    background: radial-gradient(circle, #b5f6df 1px, #277d68 1.5px);
  }
  .swatch.nonread,
  .swatch.nonRead {
    background: repeating-linear-gradient(135deg, #49536a 0 3px, #aab5c9 3px 4px);
  }
  .swatch.uncached {
    background: radial-gradient(circle, #b5f6df 1px, #277d68 1.5px);
  }
  .swatch.uncertain {
    background: transparent;
    border-color: #ffcb74;
    transform: rotate(45deg) scale(0.78);
  }
  .swatch.change-rise,
  .swatch.change-drop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    border: 0;
    color: #151d2e;
    background: #ffbd64;
    font-size: 10px;
    font-style: normal;
    font-weight: 800;
    line-height: 1;
  }
  .swatch.change-drop {
    margin-left: -4px;
  }
  .swatch.compaction,
  .swatch.target {
    display: inline-flex;
    width: 16px;
    justify-content: center;
    border-color: #83abc9;
    background: #273f56;
    color: #fff;
    font-size: 7px;
    font-style: normal;
    font-weight: 750;
  }
  .swatch.target {
    border-radius: 0;
    transform: rotate(45deg) scale(0.8);
  }
  .swatch.missing {
    background: transparent;
    border-style: dashed;
  }
  .swatch.zero {
    border-radius: 50%;
    background: transparent;
  }
  .swatch.cost {
    border-radius: 50%;
    background: #7ddbb7;
  }
  .vertical-axis-overlay {
    position: absolute;
    z-index: 2;
    top: 36px;
    left: 0;
    width: 42px;
    height: 410px;
    border-right: 1px solid #66748d;
    background: #0c1324;
    pointer-events: none;
  }
  .vertical-axis-tick {
    position: absolute;
    right: 5px;
    color: #c0cbe0;
    font-size: 10px;
    line-height: 1;
    white-space: nowrap;
    transform: translateY(-50%);
  }
  .vertical-axis-tick.top {
    transform: none;
  }
  .vertical-axis-tick.bottom {
    transform: translateY(-100%);
  }
  .river-scroll {
    overflow-x: auto;
    max-width: 100%;
    overscroll-behavior-x: contain;
    scrollbar-color: #506385 #10172a;
    scrollbar-width: thin;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .river-scroll:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .river-scroll::-webkit-scrollbar {
    height: 9px;
  }
  .river-scroll::-webkit-scrollbar-track {
    background: #10172a;
    border-radius: 6px;
  }
  .river-scroll::-webkit-scrollbar-thumb {
    background: #506385;
    border: 2px solid #10172a;
    border-radius: 6px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  svg {
    display: block;
    background: #0c1324;
    border-radius: 10px;
    touch-action: pan-y;
  }
  .plot-background {
    fill: #0c1324;
  }
  .weight-gridline {
    stroke: #35425b;
    stroke-width: 0.75;
    opacity: 0.72;
    pointer-events: none;
  }
  .column-guide {
    stroke: #202c45;
    stroke-width: 1;
    pointer-events: none;
  }
  .call-target {
    cursor: pointer;
    color: #95a2ba;
  }
  .call-target rect {
    fill: transparent;
  }
  .call-target text {
    fill: currentColor;
    font-size: 12px;
  }
  .call-target:hover,
  .call-target:focus-visible,
  .call-target.pinned {
    color: #fff;
    outline: none;
  }
  .call-target:focus-visible rect {
    stroke: #fff;
    stroke-width: 2;
  }
  .call-target.condensed {
    pointer-events: none;
  }
  .call-target.condensed:focus-visible {
    pointer-events: all;
  }
  .compaction-marker {
    pointer-events: none;
  }
  .compaction-marker line {
    stroke: #ffb14e;
    stroke-width: 1.5;
    stroke-dasharray: 6 5;
  }
  .compaction-marker text {
    fill: #ffca87;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .ribbon-group {
    opacity: 0.88;
    transition: opacity 120ms ease;
  }
  .ribbon-group.unknown {
    opacity: 0.92;
  }
  .ribbon-group.selected,
  .ribbon-group.hovered {
    opacity: 1;
  }
  .ribbon-group.hovered:not(.selected) {
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.45));
  }
  .ribbon {
    pointer-events: none;
  }
  .ribbon.subpixel {
    paint-order: stroke;
  }
  .ribbon-group.selected .ribbon {
    stroke: #fff;
    stroke-width: 2.5;
  }
  .ribbon-hit {
    fill: transparent;
    stroke: transparent;
    stroke-width: 0;
    cursor: pointer;
    pointer-events: fill;
  }
  .ribbon-hit:focus-visible {
    stroke: rgba(255, 255, 255, 0.75);
    stroke-width: 3;
    outline: none;
  }
  .lineage-connector {
    fill: none;
    stroke: #fff;
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
    opacity: 0;
    pointer-events: none;
  }
  .lineage-connector.visible {
    opacity: 0.88;
  }
  .crosshair {
    stroke: #a8bde8;
    stroke-width: 1;
    stroke-dasharray: 4 4;
    pointer-events: none;
  }
  .pin-line {
    stroke: #fff;
    stroke-width: 2;
    pointer-events: none;
  }
  .zoom-selection {
    fill: rgba(137, 177, 255, 0.2);
    stroke: #a9c9ff;
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }
  @media (max-width: 620px) {
    .vertical-scale-controls {
      display: block;
    }
    .event-breakdown {
      position: static;
      width: 100%;
      max-height: 180px;
      margin: 8px 0 0;
    }
    .economics-track-controls {
      align-items: start;
    }
    .track-legend {
      gap: 5px 9px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ribbon-group {
      transition: none;
    }
  }
</style>
