<script lang="ts">
  import { afterUpdate, beforeUpdate, onMount } from 'svelte';
  import type { IndexedAnalysis, InteractionState } from '../types';
  import { displayItemLabel } from '../item-label';
  import { itemColor } from './colors';
  import { clientXToViewBox, nearestCallIndex } from './hit-testing';
  import { nonOverlappingCallLabelPositions } from './axis-labels';
  import { chartUnitLabel } from './format';
  import { layoutCallColumns, layoutContextRiver } from './layout';
  import { formatVerticalTick, verticalScaleTicks, visibleStackSample } from './vertical-scale';
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
  export let onViewportChange: (status: RiverViewportStatus) => void = () => {};
  export let onHoverCall: (index: number | null) => void;
  export let onPinCall: (index: number) => void;
  export let onHoverItem: (id: string | null, event?: PointerEvent) => void;
  export let onSelectItem: (id: string) => void;
  export let onEmptyClick: (index: number) => void;
  export let onEscape: () => void;

  type RequestedRange = { startCallIndex: number; endCallIndex: number };
  type VerticalScaleMode = 'session' | 'visible';

  let host: HTMLDivElement;
  let svg: SVGSVGElement;
  let observedWidth = 960;
  let hasObservedWidth = false;
  let viewportScrollLeft = 0;
  let measuredChartOffsetX = 0;
  let verticalScaleMode: VerticalScaleMode = 'session';
  /** Null means Fit all; otherwise this is the CSS-pixel distance between adjacent calls. */
  let callSpacing: number | null = null;
  // Keep an explicit range fitted through responsive reflow; other navigation clears it.
  let requestedRange: RequestedRange | null = null;
  let pendingRangeResize: RequestedRange | null = null;
  let lastPositionSignature = '';
  let lastObservedWidth = observedWidth;
  let lastCommandId: number | null = null;
  let lastPublishedStatus = '';
  let lastColumns: ViewportCallPosition[] = [];
  let pendingAdjustment: 'fit' | { kind: 'anchor'; anchor: ViewportAnchor } | null = null;
  let dragSelection: { startClientX: number; currentClientX: number } | null = null;
  let gestureState = emptyGestureState();
  let clickSuppressionTimer: number | null = null;
  let spaceHeld = false;

  const height = 500;
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
    },
    scaleColumns,
  );
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
      lastCommandId = navigationCommand.id;
      applyNavigationCommand(navigationCommand);
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
  });

  onMount(() => {
    const onScroll = () => {
      syncScaleViewportMetrics();
      publishViewport();
    };
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
      }
    };
    measure();
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

  function chartContentOffsetX(): number {
    if (!host || !svg) return 0;
    const hostRect = host.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (!Number.isFinite(hostRect.left) || !Number.isFinite(svgRect.left)) return 0;
    return svgRect.left - hostRect.left + host.scrollLeft - host.clientLeft;
  }

  function syncScaleViewportMetrics(): void {
    if (!host) return;
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

  function applyNavigationCommand(command: RiverNavigationCommand): void {
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
  <p class="scale-description">
    <span>Y-axis: {verticalAxisUnit}; max {formatVerticalTick(verticalAxisMaximum)}.</span>
    <span>{verticalAxisDescription}</span>
    {#if indexed.analysis.displayWeightUnit === 'unavailable'}
      <span>Ribbon heights are structural placeholders, not token measurements.</span>
    {/if}
    {#if verticalScaleMode === 'visible' && visibleScaleSample.visibleCallCount === 0}
      <span>No call markers are in view; the interpolated viewport edges set the scale.</span>
    {/if}
  </p>
</div>
<div class="chart-frame">
  <div class="vertical-axis-overlay" role="img" aria-label={verticalAxisAccessibleLabel}>
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
      >Context items flow horizontally through model calls. Drag across the chart to zoom into a
      call range; use the Go to disclosure for keyboard-accessible call and range navigation. Use
      Fit all to restore the overview. Scroll horizontally or Shift-drag to pan; pinch and
      modifier-wheel zoom around the pointer. Hover, select, and inspect items at every scale.
      Dashed vertical markers indicate compaction. Vertical scale uses {verticalScaleMode ===
      'session'
        ? 'the full session'
        : 'visible calls'}; the Y-axis shows {verticalAxisUnit}. {indexed.analysis
        .displayWeightUnit === 'unavailable'
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
        <line
          class="column-guide"
          x1={column.x}
          x2={column.x}
          y1={margin.top}
          y2={height - margin.bottom}
        />
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
        <g
          class="ribbon-group"
          class:selected={interaction.selectedItemId === ribbon.itemId}
          class:hovered={interaction.hoveredItemId === ribbon.itemId}
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
            aria-label={itemAccessibleLabel(ribbon.itemId)}
            aria-pressed={interaction.selectedItemId === ribbon.itemId}
            onpointerenter={(event) => onHoverItem(ribbon.itemId, event)}
            onpointermove={(event) => onHoverItem(ribbon.itemId, event)}
            onpointerleave={() => onHoverItem(null)}
            onclick={(event) => selectRibbon(event, ribbon.itemId)}
            onkeydown={(event) => selectFromKeyboard(event, ribbon.itemId)}
          >
            <title>{itemAccessibleLabel(ribbon.itemId)}</title>
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
  </div>
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
  .scale-description {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    margin: 0;
    color: #9eabc2;
    line-height: 1.4;
  }
  .chart-frame {
    position: relative;
    max-width: 100%;
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
    .scale-description {
      margin-top: 6px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ribbon-group {
      transition: none;
    }
  }
</style>
