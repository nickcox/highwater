<script module lang="ts">
  let nextMergeId = 0;
</script>

<script lang="ts">
  const mergeId = `compaction-merge-${nextMergeId++}`;
  import { onMount, untrack } from 'svelte';
  import type { IndexedAnalysis, ContextItemKind } from '../types';
  import { displayItemLabel } from '../item-label';
  import { kindGroupLabel } from '../kind-labels';
  import InfoPopover from '../components/InfoPopover.svelte';
  import {
    anchorForCall as callAnchor,
    anchorForCallRange as rangeAnchor,
    anchorAtPlotX,
    requestedRangeSpacing,
    resolveSpacing,
    type RequestedRange,
    type ViewportAdjustment,
  } from './navigation';
  import { itemColor, itemTypeColor } from './colors';
  import { installRiverDom, pointerInput, capturePointer, releasePointer } from './dom-interaction';
  import EconomicsTrack from './EconomicsTrack.svelte';
  import EconomicsBreakdown from './EconomicsBreakdown.svelte';
  import GroupBreakdown from './GroupBreakdown.svelte';
  import { createOverlayFocus } from './overlay-focus';
  import {
    economicsAnchorVisible,
    positionEconomicsBreakdown as positionOverlay,
  } from './overlay-position';
  import EconomicsControls from './EconomicsControls.svelte';
  import {
    projectCachePresentation,
    type CacheViewMode,
    type EconomicsEventBreakdown,
    type EconomicsTrackMode,
  } from './economics-track';
  import { clientXToViewBox, nearestCallIndex } from './hit-testing';
  import { nonOverlappingCallLabelPositions } from './axis-labels';
  import { chartUnitLabel } from './format';
  import { describeCostBasis } from '../cost-basis';
  import { layoutCallColumns, layoutContextRiver } from './layout';
  import { inputComparisons, inputScaleColumns, layoutInputReferences } from './reported-input';
  import { projectCallColumns, projectRiverHorizontally } from './horizontal-projection';
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
  } from './gestures';
  import {
    captureViewportAnchor,
    clampScrollLeft,
    comfortableCallScroll,
    latestScrollTarget,
    scrollTargetForAnchor,
    visibleCallRange,
    type RiverNavigationCommand,
    type RiverViewportStatus,
    type ViewportAnchor,
    type ViewportCallPosition,
  } from './viewport';

  let lastSettledCommandId = 0;
  import {
    defaultPresentationPreferences,
    type PresentationPreferences,
  } from '../state/presentation-preferences';

  let {
    indexed,
    pinnedCallIndex = null,
    hoveredCallIndex = null,
    selectedItemId = null,
    hoveredItemId = null,
    navigationCommand = null,
    isVisible = true,
    onViewportChange = () => {},
    onNavigationSettled = () => {},
    onSelectionVisibility = () => {},
    onHoverCall,
    onPinCall,
    onHoverItem,
    onSelectItem,
    onEmptyClick,
    onEscape,
    preferences = defaultPresentationPreferences(),
    onPreferencesChange = () => {},
  }: {
    indexed: IndexedAnalysis;
    pinnedCallIndex?: number | null;
    hoveredCallIndex?: number | null;
    selectedItemId?: string | null;
    hoveredItemId?: string | null;
    navigationCommand?: RiverNavigationCommand | null;
    isVisible?: boolean;
    onViewportChange?: (status: RiverViewportStatus) => void;
    onNavigationSettled?: (id: number) => void;
    onSelectionVisibility?: (status: { itemId: string; visible: boolean } | null) => void;
    onHoverCall: (index: number | null) => void;
    onPinCall: (index: number) => void;
    onHoverItem: (id: string | null, event?: PointerEvent) => void;
    onSelectItem: (id: string) => void;
    onEmptyClick: (index: number) => void;
    onEscape: () => void;
    preferences?: PresentationPreferences;
    onPreferencesChange?: (value: PresentationPreferences) => void;
  } = $props();
  let appliedPreferences: PresentationPreferences | null = null;
  let economicsTrigger = $state<HTMLButtonElement | undefined>();
  let economicsHeader = $state<HTMLDivElement | undefined>();

  function changePreferences(next: PresentationPreferences): void {
    preferences = next;
    onPreferencesChange(next);
  }
  function applyPreferences(next: PresentationPreferences): void {
    setVerticalScaleMode(next.river.verticalScale);
    if (riverDisplayMode !== next.river.display) closeGroupBreakdown(false);
    riverDisplayMode = next.river.display;
    const mode = next.economics.expanded ? next.economics.lastMode : 'off';
    if (mode === 'off' && economicsTrackMode !== 'off') {
      const focus = document.activeElement;
      const inside =
        focus instanceof Node &&
        (economicsHeader?.contains(focus) ||
          host?.querySelector('.economics-track-svg')?.contains(focus) ||
          economicsBreakdownElement?.contains(focus));
      closeEconomicsBreakdown(false);
      economicsInspectFocus.cancel();
      economicsReadout = '';
      economicsEventBreakdown = null;
      economicsBreakdownStyle = '';
      if (inside) economicsTrigger?.focus();
    }
    cacheViewMode = next.economics.cacheView;
    economicsTrackMode = mode;
  }
  function setDisplay(mode: RiverDisplayMode): void {
    changePreferences({ ...preferences, river: { ...preferences.river, display: mode } });
  }
  function setScale(mode: VerticalScaleMode): void {
    changePreferences({ ...preferences, river: { ...preferences.river, verticalScale: mode } });
  }
  function setCacheView(mode: CacheViewMode): void {
    changePreferences({ ...preferences, economics: { ...preferences.economics, cacheView: mode } });
  }

  type VerticalScaleMode = 'session' | 'visible';
  type RiverDisplayMode = 'items' | 'itemTypes';

  let host: HTMLDivElement;
  let svg: SVGSVGElement;
  let canvas: HTMLDivElement | undefined;
  const initialWidth = 960;
  let observedWidth = $state(initialWidth);
  let hasObservedWidth = $state(false);
  let viewportScrollLeft = $state(0);
  let selectionViewportScrollLeft = $state(0);
  let measuredChartOffsetX = $state(0);
  let verticalScaleMode = $state<VerticalScaleMode>('session');
  let riverDisplayMode = $state<RiverDisplayMode>('items');
  let cacheViewMode = $state<CacheViewMode>('tokens');
  let economicsTrackMode = $state<EconomicsTrackMode>('off');
  let economicsReadout = $state('');
  let economicsEventBreakdown = $state<EconomicsEventBreakdown | null>(null);
  let groupBreakdown = $state.raw<{
    kind: ContextItemKind;
    memberIds: string[];
    callIndex: number | null;
    anchor: { x: number; y: number };
  } | null>(null);
  let groupBreakdownReturnElement: HTMLElement | SVGElement | null = null;
  const groupFocus = createOverlayFocus();
  const economicsInspectFocus = createOverlayFocus();
  /** The item type under the pointer, shown in a card beside it. `x` and `y` are relative to
   * the chart; `flip` puts the card on the pointer's left near the right edge. */
  let hoveredGroup = $state.raw<{
    kind: ContextItemKind;
    total: number;
    callIndex: number | null;
    itemCount: number;
    x: number;
    y: number;
    flip: boolean;
  } | null>(null);
  let chartPlot: HTMLDivElement;
  let economicsBreakdownStyle = $state('');
  let economicsBreakdownElement = $state<HTMLDivElement | null>(null);
  let economicsTrackComponent = $state<{
    closeEventBreakdown: (returnFocus?: boolean) => void;
  } | null>(null);
  /** Null means Fit all; otherwise this is the CSS-pixel distance between adjacent calls. */
  let callSpacing = $state<number | null>(null);
  // Keep an explicit range fitted through responsive reflow; other navigation clears it.
  let requestedRange = $state<RequestedRange | null>(null);
  let pendingRangeResize = $state<RequestedRange | null>(null);
  let lastPositionSignature = '';
  let lastObservedWidth = initialWidth;
  let lastCommandId: number | null = null;
  let lastPublishedStatus = '';
  let lastSelectionVisibilityKey = '';
  let lastColumns: ViewportCallPosition[] = [];
  let pendingAdjustment = $state<ViewportAdjustment | null>(null);
  let dragSelection = $state.raw<{ startClientX: number; currentClientX: number } | null>(null);
  let gestureState = emptyGestureState();
  let clickSuppressionTimer: number | null = null;
  let spaceHeld = false;
  let lastVisibility = true;

  const height = 500;
  const margin = { top: 36, right: 24, bottom: 54, left: 42 };
  // Width is a presentation transform, not a reason to rebuild item-call stacks/paths.
  const geometryWidth = 960;
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

  function visibilityChanged(): void {
    if (!isVisible) {
      groupFocus.cancel();
      economicsInspectFocus.cancel();
      cancelAllGestureState();
      onHoverCall(null);
      onHoverItem(null);
      if (economicsEventBreakdown) closeEconomicsBreakdown(false);
    } else if (host && host.clientWidth > 0) {
      observedWidth = host.clientWidth;
      hasObservedWidth = true;
      syncScaleViewportMetrics();
    }
  }
  // One ribbon and one call label are in the Tab order; arrow keys move within
  // them. Other ribbons and labels stay focusable by pointer and script.
  let rovingRibbonKey = $state<string | null>(null);
  let costCopy = $derived(
    describeCostBasis(indexed.analysis.economics.costBasis, indexed.analysis.session.source),
  );
  let groupMemberLabels = $derived(
    groupBreakdown
      ? groupBreakdown.memberIds
          .slice(0, 12)
          .map((id) => displayItemLabel(indexed.itemById.get(id), id))
      : [],
  );
  let positionSignature = $derived(
    JSON.stringify(indexed.analysis.modelCalls.map((call) => [call.index, call.sourceRecordId])),
  );
  let callCount = $derived(indexed.analysis.modelCalls.length);
  let fitInnerWidth = $derived(Math.max(1, observedWidth - margin.left - margin.right));
  let fitCallSpacing = $derived(callCount > 1 ? fitInnerWidth / (callCount - 1) : 0);
  let effectiveCallSpacing = $derived(Math.max(callSpacing ?? fitCallSpacing, fitCallSpacing));
  let width = $derived(
    callCount > 1 && callSpacing !== null
      ? Math.max(observedWidth, margin.left + margin.right + (callCount - 1) * callSpacing)
      : Math.max(1, observedWidth),
  );
  let canonicalColumns = $derived(layoutCallColumns(indexed, geometryWidth, margin));
  let inputComparison = $derived(inputComparisons(indexed, canonicalColumns));
  let inputColumns = $derived(inputScaleColumns(canonicalColumns, inputComparison));
  let sessionVerticalMaximum = $derived(
    Math.max(0, ...inputColumns.map((column) => column.totalDisplayWeight)),
  );
  let scaleColumns = $derived(projectCallColumns(inputColumns, geometryWidth, width, margin));
  let visiblePlotLeft = $derived(Math.max(margin.left, viewportScrollLeft - measuredChartOffsetX));
  let visiblePlotRight = $derived(
    Math.min(width - margin.right, viewportScrollLeft - measuredChartOffsetX + observedWidth),
  );
  let selectionPlotLeft = $derived(
    Math.max(margin.left, selectionViewportScrollLeft - measuredChartOffsetX),
  );
  let selectionPlotRight = $derived(
    Math.min(
      width - margin.right,
      selectionViewportScrollLeft - measuredChartOffsetX + observedWidth,
    ),
  );
  // The ribbons are always laid out at the session scale, so panning never rebuilds them.
  // "Visible calls" stretches the drawing vertically about the plot's bottom edge instead.
  let canonicalRiver = $derived(
    layoutContextRiver(
      indexed,
      {
        width: geometryWidth,
        height,
        margin,
        minimumVisibleThickness: 1,
        verticalDomainMax: inputComparison.size > 0 ? sessionVerticalMaximum : undefined,
        groupByKind: riverDisplayMode === 'itemTypes',
      },
      canonicalColumns,
    ),
  );
  let horizontalProjection = $derived(
    projectRiverHorizontally(canonicalRiver, geometryWidth, width, margin),
  );
  let river = $derived(horizontalProjection.layout);
  let selectionVisibility = $derived(
    selectedItemId === null || !hasObservedWidth || !isVisible
      ? null
      : {
          itemId: selectedItemId,
          visible: selectedItemVisibleInRiver(selectedItemId, riverDisplayMode, river.ribbons, {
            left:
              (selectionPlotLeft - horizontalProjection.offset) / (horizontalProjection.scale || 1),
            right:
              (selectionPlotRight - horizontalProjection.offset) /
              (horizontalProjection.scale || 1),
          }),
        },
  );
  let selectionVisibilityKey = $derived(JSON.stringify(selectionVisibility));
  let visibleScaleSample = $derived(
    verticalScaleMode === 'visible'
      ? visibleStackSample(scaleColumns, visiblePlotLeft, visiblePlotRight)
      : emptyVisibleScaleSample,
  );
  let layoutVerticalDomain = $derived(
    Math.max(
      1,
      inputComparison.size > 0 ? sessionVerticalMaximum : canonicalRiver.maxTotalDisplayWeight,
    ),
  );
  let verticalStretch = $derived(
    verticalScaleMode === 'visible'
      ? layoutVerticalDomain / Math.max(1, visibleScaleSample.maxWeight)
      : 1,
  );
  let verticalOffset = $derived((height - margin.bottom) * (1 - verticalStretch));
  let ribbonTransform = $derived(
    verticalStretch === 1
      ? horizontalProjection.transform
      : `${horizontalProjection.transform} matrix(1 0 0 ${verticalStretch} 0 ${verticalOffset})`,
  );
  let cachePresentation = $derived(projectCachePresentation(indexed.analysis));
  let verticalAxisMaximum = $derived(
    verticalScaleMode === 'visible' ? visibleScaleSample.maxWeight : sessionVerticalMaximum,
  );
  let verticalAxisDomain = $derived(Math.max(1, verticalAxisMaximum));
  let inputReferences = $derived(
    layoutInputReferences(
      river.columns,
      inputComparison,
      { width, height, margin, minimumVisibleThickness: 1 },
      verticalAxisDomain,
    ),
  );
  let hasInputGap = $derived(
    [...inputComparison.values()].some((comparison) => comparison.gap > 0),
  );
  let activeInputComparison = $derived(
    inputComparison.get(pinnedCallIndex ?? hoveredCallIndex ?? -1),
  );
  let verticalAxisTicks = $derived(verticalScaleTicks(verticalAxisMaximum));
  let verticalAxisTickData = $derived(
    verticalAxisTicks.map((value, position) => ({
      value,
      position,
      y: margin.top + river.innerHeight * (1 - value / verticalAxisDomain),
      percent: Math.max(0, Math.min(100, 100 * (1 - value / verticalAxisDomain))),
    })),
  );
  let verticalAxisUnit = $derived(
    indexed.analysis.displayWeightUnit === 'unavailable'
      ? 'structural placeholder stack weight (token geometry unavailable)'
      : chartUnitLabel(indexed.analysis.displayWeightUnit),
  );
  let verticalAxisDescription = $derived(
    verticalScaleMode === 'session'
      ? `Session-wide scale in ${verticalAxisUnit}. Ribbon heights remain comparable across the session.`
      : `${visibleScaleSample.visibleCallCount} visible call markers in ${verticalAxisUnit}. Viewport edges are interpolated where needed; ribbon heights change as you pan or zoom.`,
  );
  let verticalAxisAccessibleLabel = $derived(
    `Vertical axis. ${verticalAxisDescription} Tick values: ${verticalAxisTicks.map(formatVerticalTick).join(', ')}.`,
  );
  let columnByCall = $derived(new Map(river.columns.map((column) => [column.callIndex, column])));
  // Individual-item ribbons only; grouped Item types bands have no item emphasis.
  let ribbonByItemId = $derived(
    new Map(
      river.ribbons
        .filter((ribbon) => ribbon.groupKind === undefined)
        .map((ribbon) => [ribbon.itemId, ribbon]),
    ),
  );
  let hoveredRibbon = $derived(
    hoveredItemId === null ? null : (ribbonByItemId.get(hoveredItemId) ?? null),
  );
  let selectedRibbon = $derived(
    selectedItemId === null ? null : (ribbonByItemId.get(selectedItemId) ?? null),
  );
  let focusedItemId = $derived(selectedItemId ?? hoveredItemId);
  let ribbonByKey = $derived(new Map(river.ribbons.map((ribbon) => [ribbon.key, ribbon])));
  let segmentsByItemId = $derived(
    river.ribbons.reduce((map, ribbon) => {
      const segments = map.get(ribbon.itemId);
      if (segments) segments.push(ribbon);
      else map.set(ribbon.itemId, [ribbon]);
      return map;
    }, new Map<string, ContextRiverLayout['ribbons']>()),
  );
  let tabStopRibbonKey = $derived(
    rovingRibbonKey !== null && ribbonByKey.has(rovingRibbonKey)
      ? rovingRibbonKey
      : (selectedRibbon?.key ?? river.ribbons[0]?.key ?? null),
  );
  let callLabelPositions = $derived(
    nonOverlappingCallLabelPositions(river.columns, condensedTargetSpacing, pinnedCallIndex),
  );
  let labelledCallIndexes = $derived(
    [...callLabelPositions].map((position) => river.columns[position]?.callIndex),
  );
  let tabStopCallIndex = $derived(
    pinnedCallIndex !== null && labelledCallIndexes.includes(pinnedCallIndex)
      ? pinnedCallIndex
      : (labelledCallIndexes[0] ?? null),
  );
  let focusedConnectors = $derived(
    focusedItemId === null
      ? []
      : river.lineageConnectors
          .map((connector, index) => ({ connector, index }))
          .filter(
            ({ connector }) =>
              connector.fromItemId === focusedItemId || connector.toItemId === focusedItemId,
          ),
  );
  let viewportColumns = $derived(
    river.columns.map((column) => ({
      callIndex: column.callIndex,
      x: column.x,
      sourceRecordId: indexed.callByIndex.get(column.callIndex)?.sourceRecordId ?? null,
    })),
  );
  let minimumColumnSpacing = $derived(
    viewportColumns.length < 2
      ? Number.POSITIVE_INFINITY
      : viewportColumns.reduce(
          (minimum, column, position) =>
            position === 0
              ? minimum
              : Math.min(minimum, column.x - viewportColumns[position - 1].x),
          Number.POSITIVE_INFINITY,
        ),
  );
  let callTargetStride = $derived(
    minimumColumnSpacing < condensedTargetSpacing
      ? Math.ceil(condensedTargetSpacing / Math.max(1, minimumColumnSpacing))
      : 1,
  );
  // Guides do not follow the pin, so pinning never repaints the ribbon layer.
  let guidePositions = $derived(
    nonOverlappingCallLabelPositions(river.columns, condensedTargetSpacing, null),
  );
  let zoomFactor = $derived(
    fitCallSpacing > 0 ? Math.max(1, effectiveCallSpacing / fitCallSpacing) : 1,
  );
  let isFitAll = $derived(callSpacing === null || width <= observedWidth + 1);
  let maximumCallSpacing = $derived(
    fitCallSpacing * Math.min(maxZoomFactor, Math.max(1, callCount - 1)),
  );
  let canZoomIn = $derived(callCount > 1 && effectiveCallSpacing < maximumCallSpacing - 0.5);
  let canZoomOut = $derived(callCount > 1 && !isFitAll && zoomFactor > 1.01);
  let selectionRect = $derived(
    dragSelection
      ? {
          x: Math.min(viewBoxX(dragSelection.startClientX), viewBoxX(dragSelection.currentClientX)),
          width: Math.abs(
            viewBoxX(dragSelection.currentClientX) - viewBoxX(dragSelection.startClientX),
          ),
        }
      : null,
  );
  // Effects come after every state and derived declaration: a pre-update effect runs as soon
  // as it is declared.
  $effect.pre(() => {
    const next = preferences;
    if (next === appliedPreferences) return;
    appliedPreferences = next;
    untrack(() => applyPreferences(next));
  });
  $effect.pre(() => groupFocus.observeIdentity(indexed));
  $effect.pre(() => economicsInspectFocus.observeIdentity(indexed));
  $effect.pre(() => {
    if (selectionVisibilityKey === lastSelectionVisibilityKey) return;
    lastSelectionVisibilityKey = selectionVisibilityKey;
    const status = selectionVisibility;
    untrack(() => onSelectionVisibility(status));
  });
  $effect.pre(() => {
    if (lastVisibility === isVisible) return;
    lastVisibility = isVisible;
    untrack(visibilityChanged);
  });

  // Before the DOM takes new call positions or a new width, remember which call is in view so
  // the view can be moved back to it afterwards. The values read first are the ones that move
  // the columns; the rest is read without tracking.
  $effect.pre(() => {
    void [positionSignature, observedWidth, callSpacing, requestedRange];
    untrack(captureAnchorBeforeUpdate);
  });

  // After the DOM update: apply pending scroll adjustments and navigation, then publish the
  // viewport. The values read first are everything that can move the chart or is waiting for it.
  $effect(() => {
    void [
      navigationCommand,
      isVisible,
      width,
      river,
      positionSignature,
      observedWidth,
      hasObservedWidth,
      callSpacing,
      pendingAdjustment,
      pendingRangeResize,
      economicsEventBreakdown,
      economicsBreakdownElement,
    ];
    untrack(settleAfterUpdate);
  });

  function captureAnchorBeforeUpdate(): void {
    if (!host) return;
    if (requestedRange && callSpacing !== null && observedWidth !== lastObservedWidth) {
      // Defer until after the update so the new anchor is applied against the resized SVG geometry.
      pendingRangeResize = requestedRange;
      return;
    }
    if (pendingAdjustment) return;
    if (
      callSpacing !== null &&
      (positionSignature !== lastPositionSignature || observedWidth !== lastObservedWidth)
    ) {
      const anchor =
        observedWidth !== lastObservedWidth
          ? anchorAtPlotX(
              lastColumns,
              host.scrollLeft + lastObservedWidth / 2 - measuredChartOffsetX,
              observedWidth / 2,
            )
          : captureViewportAnchor(
              lastColumns,
              host.scrollLeft,
              measuredClientWidth(),
              chartContentOffsetX(),
            );
      if (anchor) pendingAdjustment = { kind: 'anchor', anchor };
    }
  }

  function settleAfterUpdate(): void {
    if (!host) return;
    if (groupBreakdownReturnElement && !groupBreakdownReturnElement.isConnected)
      groupBreakdownReturnElement = null;
    applyPendingAdjustment();
    if (navigationCommand && navigationCommand.id !== lastCommandId) {
      if (canExecuteNavigation()) {
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
          const targetSpacing = requestedRangeSpacing(
            range.intervalCount,
            fitInnerWidth,
            callCount,
          );
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
      const nextStyle = positionEconomicsBreakdown();
      if (nextStyle !== economicsBreakdownStyle) economicsBreakdownStyle = nextStyle;
    }
  }

  // Scroll events can arrive several times a frame; their work reads layout, so it runs at most
  // once per frame.
  let scrollFrame: number | null = null;
  function scheduleScrollWork(): void {
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      syncScaleViewportMetrics();
      publishViewport();
      refreshEconomicsOverlay();
    });
  }

  onMount(() => {
    const disposeDom = installRiverDom(host, {
      onScroll: scheduleScrollWork,
      onDocumentScroll: refreshEconomicsOverlay,
      onWheel: (event) => {
        if (!(event.metaKey || event.ctrlKey) || callCount < 2) return;
        event.preventDefault();
        const deltaPixels =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? event.deltaY * 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? event.deltaY * Math.max(1, host.clientHeight)
              : event.deltaY;
        zoomAt(event.clientX, Math.exp(-deltaPixels * wheelZoomSensitivity));
      },
      onPointerMove: handleGesturePointerMove,
      onPointerUp: handleGesturePointerUp,
      onPointerCancel: handleGesturePointerCancel,
      onKeyUp: (event) => {
        if (event.code === 'Space') spaceHeld = false;
      },
      onBlur: () => {
        spaceHeld = false;
        cancelAllGestureState();
      },
      onResize: (nextWidth, source) => {
        if (observedWidth !== nextWidth) {
          const interruptedGesture = gestureState.pointers.length > 0;
          cancelAllGestureState();
          if (interruptedGesture) gestureState = { ...gestureState, suppressClick: true };
          observedWidth = nextWidth;
        }
        hasObservedWidth = true;
        syncScaleViewportMetrics();
        if (source === 'element') {
          publishViewport();
          refreshEconomicsOverlay();
        }
      },
    });
    return () => {
      groupFocus.dispose();
      economicsInspectFocus.dispose();
      cancelAllGestureState();
      if (clickSuppressionTimer !== null) window.clearTimeout(clickSuppressionTimer);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      disposeDom();
    };
  });

  function measuredClientWidth(): number {
    return host?.clientWidth > 0 ? host.clientWidth : hasObservedWidth ? observedWidth : 0;
  }

  function measuredScrollWidth(): number {
    return Math.max(host?.scrollWidth ?? 0, width);
  }

  function canExecuteNavigation(): boolean {
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
    // Every caller has just measured the offset in syncScaleViewportMetrics.
    const contentOffsetX = measuredChartOffsetX;
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
      centerCallIndex: ready
        ? nearestCallIndex(host.scrollLeft + clientWidth / 2 - contentOffsetX, river.columns)
        : null,
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
    if (
      status.ready &&
      lastCommandId !== null &&
      !pendingAdjustment &&
      !pendingRangeResize &&
      lastCommandId !== lastSettledCommandId
    ) {
      lastSettledCommandId = lastCommandId;
      onNavigationSettled(lastCommandId);
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

  function anchorForCall(callIndex: number, offset: number): ViewportAnchor | null {
    return callAnchor(viewportColumns, callIndex, offset);
  }

  function anchorForCallRange(startCallIndex: number, endCallIndex: number, offset: number) {
    return rangeAnchor(viewportColumns, startCallIndex, endCallIndex, offset);
  }

  function anchorAtClientX(clientX: number): ViewportAnchor | null {
    const x = Math.min(width - margin.right, Math.max(margin.left, viewBoxX(clientX)));
    const rect = host.getBoundingClientRect();
    return anchorAtPlotX(viewportColumns, x, clientX - rect.left - host.clientLeft);
  }

  function setCallSpacing(nextSpacing: number | null, anchor: ViewportAnchor | null = null): void {
    const previousSpacing = callSpacing;
    const decision = resolveSpacing(
      callSpacing,
      nextSpacing,
      fitCallSpacing,
      maximumCallSpacing,
      anchor,
    );
    callSpacing = decision.spacing;
    if (decision.adjustment) {
      pendingAdjustment = decision.adjustment;
      // A no-op Fit all does not trigger another geometry update. Apply its
      // scroll reset now rather than leaving navigation acknowledgement pending.
      if (callSpacing === previousSpacing) applyPendingAdjustment();
    }
    if (decision.immediateAnchor) {
      const target = scrollTargetForAnchor(
        decision.immediateAnchor,
        viewportColumns,
        measuredClientWidth(),
        measuredScrollWidth(),
        chartContentOffsetX(),
      );
      if (target !== null) setScrollLeft(target);
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
    setDisplay('items');
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
      pinnedCallIndex,
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
    if (command.kind === 'ensure-call') {
      const column = viewportColumns.find((value) => value.callIndex === command.callIndex);
      if (!column) return;
      const target = comfortableCallScroll(
        column.x + chartContentOffsetX(),
        host.scrollLeft,
        measuredClientWidth(),
        measuredScrollWidth(),
      );
      if (Math.abs(target - host.scrollLeft) > 0.5) requestedRange = null;
      setScrollLeft(target);
      return;
    }
    if (command.kind === 'range') {
      zoomToCallRange(command.startCallIndex, command.endCallIndex);
      return;
    }
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
          effect.pointerIds.forEach((id) => capturePointer(host, id));
          break;
        case 'release':
          effect.pointerIds.forEach((id) => releasePointer(host, id));
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

  /** Hovering a call, clicking empty space and dragging belong to the chart itself. The legends,
   * the Cache & cost controls and the economics track below it handle their own pointer input. */
  function inChart(event: Event): boolean {
    return event.target instanceof Node && canvas !== undefined && canvas.contains(event.target);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!inChart(event)) return;
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
    if (!gestureState.pointers.some((pointer) => pointer.pointerId === event.pointerId)) return;
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
    if (inChart(event)) onHoverCall(pointerCall(event));
  }

  function setEconomicsTrackMode(mode: EconomicsTrackMode): void {
    changePreferences({
      ...preferences,
      economics: {
        ...preferences.economics,
        expanded: mode !== 'off',
        lastMode: mode === 'off' ? preferences.economics.lastMode : mode,
      },
    });
  }

  /** Consume one Escape stage without clearing the shared investigation: an open event
   * breakdown closes first, then the economics track. */
  export function dismissEconomics(): boolean {
    if (!isVisible || economicsTrackMode === 'off') return false;
    if (economicsEventBreakdown) {
      closeEconomicsBreakdown();
      return true;
    }
    setEconomicsTrackMode('off');
    economicsTrigger?.focus({ preventScroll: true });
    return true;
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

  function showGroupBreakdown(
    kind: ContextItemKind,
    memberIds: string[],
    callIndex: number | null,
    returnElement: HTMLElement | SVGElement | null = null,
    pointer?: { x: number; y: number },
  ): void {
    if (groupBreakdown === null) {
      groupBreakdownReturnElement =
        returnElement ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    const bounds = returnElement?.getBoundingClientRect();
    // Keyboard activation anchors to the visible part of the originating ribbon;
    // pointer activation uses the actual hit, not its potentially huge SVG bounds.
    const anchor = pointer ?? {
      x: bounds
        ? (Math.max(8, bounds.left) + Math.min(window.innerWidth - 8, bounds.right)) / 2
        : 8,
      y: bounds
        ? (Math.max(8, bounds.top) + Math.min(window.innerHeight - 8, bounds.bottom)) / 2
        : 8,
    };
    const next = { kind, memberIds, callIndex, anchor };
    groupBreakdown = next;
    groupFocus.focusAfterUpdate(
      () => document.getElementById('group-breakdown-close'),
      () => groupBreakdown !== null && isVisible,
      { preventScroll: true },
    );
  }

  function closeGroupBreakdown(returnFocus = true): void {
    const returnElement = groupBreakdownReturnElement;
    groupBreakdown = null;
    groupBreakdownReturnElement = null;
    groupFocus.cancel();
    if (returnFocus && returnElement?.isConnected) {
      groupFocus.focusAfterUpdate(
        () => returnElement,
        () => groupBreakdown === null && isVisible,
        { preventScroll: true },
      );
    }
  }

  function showGroupHover(
    kind: ContextItemKind,
    values: Map<number, number> | undefined,
    itemCount: number,
    event: PointerEvent,
  ): void {
    const callIndex = pointerCallAtX(event.clientX, true);
    const bounds = chartPlot.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    hoveredGroup = {
      kind,
      total: callIndex === null ? 0 : (values?.get(callIndex) ?? 0),
      callIndex,
      itemCount,
      x,
      y: event.clientY - bounds.top,
      flip: x > bounds.width - 260,
    };
  }

  function revealGroupMembers(): void {
    setDisplay('items');
    closeGroupBreakdown(false);
  }

  function refreshEconomicsOverlay(): void {
    // Only an open breakdown is positioned against the page, so other scrolls need no update.
    if (!economicsEventBreakdown) return;
    economicsBreakdownStyle = positionEconomicsBreakdown();
    if (host && !economicsAnchorVisible(host, economicsEventBreakdown))
      closeEconomicsBreakdown(false);
  }

  function positionEconomicsBreakdown(): string {
    return host ? positionOverlay(host, economicsBreakdownElement, economicsEventBreakdown) : '';
  }

  function closeEconomicsBreakdown(returnFocus = true): void {
    economicsTrackComponent?.closeEventBreakdown(returnFocus);
  }

  function inspectEconomicsEvent(callIndex: number): void {
    closeEconomicsBreakdown(false);
    onPinCall(callIndex);
    economicsInspectFocus.focusAfterUpdate(
      () => document.getElementById(`economics-call-${callIndex}`),
      () => isVisible && indexed.callByIndex.has(callIndex),
    );
  }

  function economicsMarkClick(event: MouseEvent, index: number): void {
    if (consumeSuppressedClick(event)) return;
    event.stopPropagation();
    onPinCall(index);
  }

  function backgroundClick(event: MouseEvent): void {
    if (consumeSuppressedClick(event)) return;
    if (!inChart(event)) return;
    const callIndex = pointerCall(event as PointerEvent);
    if (callIndex !== null) onEmptyClick(callIndex);
  }

  function selectRibbon(event: MouseEvent, itemId: string): void {
    if (consumeSuppressedClick(event)) return;
    event.stopPropagation();
    selectRibbonItem(itemId);
  }

  function selectRibbonItem(itemId: string): void {
    onSelectItem(itemId);
    const firstCall = indexed.itemById.get(itemId)?.presence[0]?.startCall;
    if (firstCall !== undefined && indexed.callByIndex.has(firstCall)) onPinCall(firstCall);
  }

  function activateGroup(event: MouseEvent, kind: ContextItemKind, memberIds: string[]): void {
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
      { x: event.clientX, y: event.clientY },
    );
  }

  function activateGroupFromKeyboard(
    event: KeyboardEvent,
    kind: ContextItemKind,
    memberIds: string[],
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const callIndex = pinnedCallIndex;
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

  /** Up/Down move to the item above or below at the pinned call (or the ribbon's
   * first call); Home/End move to the bottom and top of that call's stack. */
  function moveRibbonFocus(
    event: KeyboardEvent,
    ribbon: ContextRiverLayout['ribbons'][number],
  ): boolean {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return false;
    event.preventDefault();
    let stack: ContextRiverLayout['ribbons'];
    if (ribbon.groupKind !== undefined) {
      stack = river.ribbons;
    } else {
      const call =
        pinnedCallIndex !== null &&
        pinnedCallIndex >= ribbon.startCall &&
        pinnedCallIndex <= ribbon.endCall
          ? pinnedCallIndex
          : ribbon.startCall;
      stack = (indexed.orderedItemIdsByCall.get(call) ?? []).flatMap(
        (itemId) =>
          segmentsByItemId
            .get(itemId)
            ?.filter((segment) => segment.startCall <= call && call <= segment.endCall) ?? [],
      );
    }
    const position = stack.findIndex((candidate) => candidate.key === ribbon.key);
    const target =
      event.key === 'Home'
        ? stack[0]
        : event.key === 'End'
          ? stack[stack.length - 1]
          : stack[position + (event.key === 'ArrowUp' ? 1 : -1)];
    if (!target) return true;
    rovingRibbonKey = target.key;
    host
      ?.querySelector<SVGElement>(`[data-ribbon-key="${CSS.escape(target.key)}"]`)
      ?.focus({ preventScroll: true });
    return true;
  }

  function selectFromKeyboard(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectRibbonItem(id);
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

  /** Thinner than a pixel as drawn, after the "Visible calls" stretch. */
  function isSubpixel(ribbon: ContextRiverLayout['ribbons'][number]): boolean {
    return ribbon.thinnest * verticalStretch < 1;
  }

  /** Versions of a system prompt or tool definition share the first version's colour. */
  function ribbonItemColor(id: string): string {
    return itemColor(indexed.versionByItemId.get(id)?.firstId ?? id);
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
</script>

<div class="vertical-scale-controls">
  <div class="toggle-group" role="group" aria-label="Vertical scale">
    <span class="toggle-label">Vertical scale</span>
    <button
      type="button"
      aria-pressed={verticalScaleMode === 'session'}
      onclick={() => setScale('session')}>Session scale</button
    >
    <button
      type="button"
      aria-pressed={verticalScaleMode === 'visible'}
      onclick={() => setScale('visible')}>Visible calls</button
    >
  </div>
  <div class="toggle-group" role="group" aria-label="River display">
    <span class="toggle-label">Display</span>
    <button
      type="button"
      aria-pressed={riverDisplayMode === 'items'}
      onclick={() => setDisplay('items')}>Items</button
    >
    <button
      type="button"
      aria-pressed={riverDisplayMode === 'itemTypes'}
      onclick={() => setDisplay('itemTypes')}>Item types</button
    >
  </div>
</div>
<div class="chart-frame" style:--plot-left={`${margin.left}px`}>
  <div class="chart-plot" bind:this={chartPlot}>
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
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events, a11y_no_noninteractive_tabindex -->
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
        >Context items flow horizontally through model calls. Tab reaches one context item and one
        call label; Up and Down arrows move between items in the stack, Home and End move to its
        bottom and top, Left and Right arrows move between calls, and Enter selects. Dashed vertical
        markers indicate compaction. In individual-item view, colour-blended connections show lossy
        summarization, not conserved tokens or source contributions to the summary. {verticalAxisDescription}.
        {inputComparison.size > 0
          ? 'The dashed reported-input reference is recorded after each call. Hatched unreconciled input is its approximate excess over reconstructed content, not recovered items or cost attribution. Where a session does not record its system prompt or tools, an Unrecorded request context item is measured from the reported input at the first call and after each compaction or model change, so the hatching shows change since then. Scaling includes the reference. Missing comparisons break the line.'
          : ''}
        {indexed.analysis.displayWeightUnit === 'unavailable'
          ? 'Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths.'
          : ''}</span
      >
      <!-- Leaving the chart only clears the hover crosshair; keyboard users work with the River
           container above. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="river-canvas"
        bind:this={canvas}
        style:width={`${width}px`}
        onpointerleave={() => onHoverCall(null)}
      >
        <svg bind:this={svg} class="river-plot" viewBox={`0 0 ${width} ${height}`} {width} {height}>
          <defs>
            {#if hasInputGap}
              <pattern
                id={`${mergeId}-input-hatch`}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <rect width="8" height="8" fill="#8793aa" opacity=".08" />
                <path
                  d="M-2 2L2-2M0 8L8 0M6 10L10 6"
                  stroke="#aab4c7"
                  stroke-width="1"
                  opacity=".45"
                />
              </pattern>
              <mask
                id={`${mergeId}-input-mask`}
                maskUnits="userSpaceOnUse"
                x={margin.left}
                y={margin.top}
                width={river.innerWidth}
                height={river.innerHeight}
                style="mask-type:luminance"
              >
                <rect
                  x={margin.left}
                  y={margin.top}
                  width={river.innerWidth}
                  height={river.innerHeight}
                  fill="white"
                />
                <g transform={ribbonTransform}>
                  {#each river.ribbons as ribbon (ribbon.key)}
                    <path
                      d={ribbon.path}
                      fill="black"
                      stroke={isSubpixel(ribbon) ? 'black' : 'none'}
                      stroke-width={isSubpixel(ribbon) ? 1.25 : 0}
                      vector-effect="non-scaling-stroke"
                    />
                  {/each}
                  {#each river.lineageConnectors as connector (connector.key)}
                    <path d={connector.mergePath} fill="black" />
                  {/each}
                </g>
              </mask>
            {/if}
            {#each river.lineageConnectors as connector, i (connector.key)}
              <linearGradient
                id={`${mergeId}-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={connector.sourceX}
                y1={connector.sourceY}
                x2={connector.targetX}
                y2={connector.sourceY}
              >
                <stop offset="0%" stop-color={ribbonItemColor(connector.fromItemId)} />
                <stop offset="100%" stop-color={ribbonItemColor(connector.toItemId)} />
              </linearGradient>
            {/each}
            <pattern
              id="unknown-geometry"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform={`matrix(${1 / (horizontalProjection.scale || 1)} 0 0 ${1 / verticalStretch} ${-horizontalProjection.offset / (horizontalProjection.scale || 1)} ${-verticalOffset / verticalStretch}) rotate(35)`}
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

          <g transform={ribbonTransform} data-testid="river-ribbon-geometry">
            {#each river.lineageConnectors as connector, i (connector.key)}
              <path
                class="compaction-merge"
                aria-hidden="true"
                d={connector.mergePath}
                fill={`url(#${mergeId}-${i})`}
              />
            {/each}

            {#each river.ribbons as ribbon (ribbon.key)}
              {@const isGroup = ribbon.groupKind !== undefined}
              {@const ribbonColor = ribbon.groupKind
                ? itemTypeColor(ribbon.groupKind)
                : ribbonItemColor(ribbon.itemId)}
              {@const ribbonLabel = isGroup
                ? `Item type ${kindGroupLabel(ribbon.groupKind!)} · ${ribbon.memberItemIds?.length ?? 0} items`
                : itemAccessibleLabel(ribbon.itemId)}
              <g
                class="ribbon-group"
                class:group-ribbon={isGroup}
                class:selected={!isGroup && selectedItemId === ribbon.itemId}
                class:unknown={indexed.analysis.displayWeightUnit === 'unavailable'}
              >
                <path
                  class="ribbon"
                  vector-effect="non-scaling-stroke"
                  class:subpixel={isSubpixel(ribbon)}
                  d={ribbon.path}
                  fill={indexed.analysis.displayWeightUnit === 'unavailable'
                    ? 'url(#unknown-geometry)'
                    : ribbonColor}
                  stroke={isSubpixel(ribbon) ? ribbonColor : 'none'}
                  stroke-width={isSubpixel(ribbon) ? 1.25 : 0}
                />
                <path
                  class="ribbon-hit"
                  vector-effect="non-scaling-stroke"
                  pointer-events="fill"
                  d={ribbon.hitPath}
                  role="button"
                  tabindex={ribbon.key === tabStopRibbonKey ? 0 : -1}
                  data-ribbon-key={ribbon.key}
                  aria-label={ribbonLabel}
                  aria-pressed={!isGroup && selectedItemId === ribbon.itemId}
                  onpointerenter={(event) =>
                    isGroup
                      ? showGroupHover(
                          ribbon.groupKind!,
                          ribbon.valueByCall,
                          ribbon.memberItemIds?.length ?? 0,
                          event,
                        )
                      : onHoverItem(ribbon.itemId, event)}
                  onpointermove={(event) =>
                    isGroup
                      ? showGroupHover(
                          ribbon.groupKind!,
                          ribbon.valueByCall,
                          ribbon.memberItemIds?.length ?? 0,
                          event,
                        )
                      : onHoverItem(ribbon.itemId, event)}
                  onpointerleave={() => {
                    if (isGroup) hoveredGroup = null;
                    else onHoverItem(null);
                  }}
                  onmousedown={(event) => {
                    // The breakdown owns focus after activation. Avoid the browser's
                    // intermediate SVG/host focus ring without suppressing pointer gestures.
                    if (isGroup) event.preventDefault();
                  }}
                  onclick={(event) =>
                    isGroup
                      ? activateGroup(event, ribbon.groupKind!, ribbon.memberItemIds ?? [])
                      : selectRibbon(event, ribbon.itemId)}
                  onfocus={() => (rovingRibbonKey = ribbon.key)}
                  onkeydown={(event) => {
                    if (moveRibbonFocus(event, ribbon)) return;
                    if (isGroup)
                      activateGroupFromKeyboard(
                        event,
                        ribbon.groupKind!,
                        ribbon.memberItemIds ?? [],
                      );
                    else selectFromKeyboard(event, ribbon.itemId);
                  }}
                >
                  <!-- An item type's details follow the pointer in a card instead. -->
                  {#if !isGroup}<title>{ribbonLabel}</title>{/if}
                </path>
              </g>
            {/each}
          </g>
          {#if inputComparison.size > 0}
            <g
              class="reported-input-overlay"
              aria-hidden="true"
              data-testid="reported-input-overlay"
            >
              {#each inputReferences as reference}
                {#if hasInputGap && reference.fill}
                  <path
                    class="unreconciled-input"
                    d={reference.fill}
                    fill={`url(#${mergeId}-input-hatch)`}
                    mask={`url(#${mergeId}-input-mask)`}
                  />
                {/if}
                <path class="reported-input-line" d={reference.line} />
              {/each}
            </g>
          {/if}
        </svg>
        <!-- Marks that change on hover, pin or selection live in a separate layer so
           the ribbon SVG above is rasterised once instead of on every pointer move. -->
        <svg class="river-overlay" viewBox={`0 0 ${width} ${height}`} {width} {height}>
          <!-- Call labels move with the pin, so they are drawn here and stay clickable. -->
          {#each river.columns as column, position (column.callIndex)}
            {#if callLabelPositions.has(position)}
              <g
                class="call-target"
                class:condensed={callTargetStride > 1}
                class:pinned={pinnedCallIndex === column.callIndex}
                role="button"
                tabindex={column.callIndex === tabStopCallIndex ? 0 : -1}
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
          <g aria-hidden="true" transform={ribbonTransform}>
            {#each focusedConnectors as { connector, index } (connector.key)}
              <path
                class="compaction-merge-emphasis"
                class:emphasized={connector.fromItemId === focusedItemId}
                d={connector.mergePath}
                fill={`url(#${mergeId}-${index})`}
              />
              {#if connector.fromItemId === focusedItemId}
                <path
                  class="lineage-connector visible"
                  vector-effect="non-scaling-stroke"
                  d={connector.path}
                />
              {/if}
            {/each}
            {#if hoveredRibbon && hoveredRibbon !== selectedRibbon}
              <path
                class="ribbon-emphasis hovered"
                vector-effect="non-scaling-stroke"
                d={hoveredRibbon.path}
                fill={ribbonItemColor(hoveredRibbon.itemId)}
              />
            {/if}
            {#if selectedRibbon}
              <path
                class="ribbon-emphasis selected"
                vector-effect="non-scaling-stroke"
                d={selectedRibbon.path}
                fill={ribbonItemColor(selectedRibbon.itemId)}
              />
            {/if}
            {#each river.versionMarks as mark (mark.key)}
              <line
                class="version-mark"
                vector-effect="non-scaling-stroke"
                x1={mark.x}
                x2={mark.x}
                y1={mark.y0}
                y2={mark.y1}
              />
            {/each}
          </g>
          {#if selectionRect && selectionRect.width > 0}
            <rect
              class="zoom-selection"
              x={selectionRect.x}
              y={margin.top}
              width={selectionRect.width}
              height={river.innerHeight}
            />
          {/if}
          {#if hoveredCallIndex !== null}
            {@const column = columnByCall.get(hoveredCallIndex)}
            {#if column}<line
                class="crosshair"
                x1={column.x}
                x2={column.x}
                y1={margin.top}
                y2={height - margin.bottom}
              />{/if}
          {/if}
          {#if pinnedCallIndex !== null}
            {@const column = columnByCall.get(pinnedCallIndex)}
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
      {#if hoveredGroup}
        <div
          class="group-hover-card"
          class:flip={hoveredGroup.flip}
          role="status"
          style:left={`${hoveredGroup.x}px`}
          style:top={`${hoveredGroup.y}px`}
          style:--group-color={itemTypeColor(hoveredGroup.kind)}
        >
          <strong>{kindGroupLabel(hoveredGroup.kind)}</strong>
          <span
            >{formatVerticalTick(hoveredGroup.total)}
            {verticalAxisUnit} at call {hoveredGroup.callIndex ?? '—'}</span
          >
          <span>{hoveredGroup.itemCount.toLocaleString()} items</span>
        </div>
      {/if}
      {#if riverDisplayMode === 'itemTypes'}
        <div class="group-type-legend" role="group" aria-label="Item type legend">
          <strong>Item types</strong>
          {#each [...new Set(river.ribbons
                .map((ribbon) => ribbon.groupKind)
                .filter(Boolean))] as kind}
            <span><i style={`background:${itemTypeColor(kind!)}`}></i>{kindGroupLabel(kind!)}</span>
          {/each}
        </div>
      {/if}
      {#if inputComparison.size > 0}
        <div class="input-reference-legend" role="group" aria-label="Input reference legend">
          <span><i class="input-reference-key"></i>Reported input</span>
          {#if hasInputGap}<span
              ><i class="input-gap-key"></i>Unreconciled input<InfoPopover
                id="unreconciled-input-note"
                label="About unreconciled input"
                >The reported input minus the content estimated in the River. It can include request
                framing and estimation differences. It is not lost content, and it is not attributed
                to cost.</InfoPopover
              ></span
            >{/if}
          {#if activeInputComparison}
            <span class="input-comparison-readout"
              >Call {activeInputComparison.callIndex}: reconstructed {formatVerticalTick(
                activeInputComparison.reconstructed,
              )} · reported {formatVerticalTick(activeInputComparison.reported)} · {#if activeInputComparison.reconstructed > activeInputComparison.reported}estimate
                exceeds reported by ~{formatVerticalTick(
                  activeInputComparison.reconstructed - activeInputComparison.reported,
                )}{:else}unreconciled ~{formatVerticalTick(activeInputComparison.gap)}{/if} tokens</span
            >
          {:else if pinnedCallIndex !== null || hoveredCallIndex !== null}
            <span class="input-comparison-readout"
              >Call {pinnedCallIndex ?? hoveredCallIndex}: input comparison unavailable</span
            >
          {/if}
        </div>
      {/if}
      <EconomicsControls
        bind:headerElement={economicsHeader}
        bind:triggerElement={economicsTrigger}
        mode={economicsTrackMode}
        lastMode={preferences.economics.lastMode}
        cacheView={cacheViewMode}
        {cachePresentation}
        {costCopy}
        hasApiEquivalentCost={indexed.analysis.session.costSummary.apiEquivalent.calls > 0}
        onModeChange={setEconomicsTrackMode}
        onCacheViewChange={setCacheView}
      />
      {#if economicsTrackMode !== 'off'}
        <EconomicsTrack
          bind:this={economicsTrackComponent}
          {indexed}
          columns={river.columns}
          {width}
          mode={economicsTrackMode}
          cacheView={cacheViewMode}
          {pinnedCallIndex}
          {hoveredCallIndex}
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
    <GroupBreakdown
      label={kindGroupLabel(groupBreakdown.kind)}
      anchor={groupBreakdown.anchor}
      memberLabels={groupMemberLabels}
      memberCount={groupBreakdown.memberIds.length}
      callIndex={groupBreakdown.callIndex}
      onClose={() => closeGroupBreakdown()}
      onShowItems={revealGroupMembers}
    />
  {/if}
  {#if economicsEventBreakdown}
    <EconomicsBreakdown
      breakdown={economicsEventBreakdown}
      bind:element={economicsBreakdownElement}
      positionStyle={economicsBreakdownStyle}
      {canZoomIn}
      onClose={() => closeEconomicsBreakdown()}
      onZoom={zoomEconomicsEvents}
      onInspect={inspectEconomicsEvent}
    />
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
    margin: 6px 0 10px;
    color: var(--secondary);
    font-size: var(--text-md);
  }
  .chart-frame {
    position: relative;
    max-width: 100%;
  }
  .group-type-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 12px;
    /* Legends start where the plot does, under the first call. */
    margin: 6px 0 0 var(--plot-left);
    color: var(--text);
    font-size: var(--text-sm);
  }
  .group-type-legend strong {
    color: var(--text-strong);
  }
  .group-type-legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .group-type-legend i {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-small);
    border: 1px solid rgb(255 255 255 / 45%);
  }
  .group-hover-card {
    position: absolute;
    z-index: 4;
    display: grid;
    gap: 2px;
    width: max-content;
    max-width: 240px;
    padding: 6px 9px;
    border: 1px solid var(--separator);
    border-left: 3px solid var(--group-color);
    border-radius: var(--control-radius);
    background: var(--plot);
    color: var(--text);
    font-size: var(--text-sm);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.4);
    pointer-events: none;
    transform: translate(14px, 14px);
  }
  .group-hover-card.flip {
    transform: translate(calc(-100% - 14px), 14px);
  }
  .group-hover-card strong {
    color: var(--text-strong);
  }
  .chart-plot {
    position: relative;
    min-width: 0;
    max-width: 100%;
  }
  .economics-readout {
    min-height: 28px;
    padding: 0.45rem 0 0 var(--plot-left);
    color: var(--secondary);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .vertical-axis-overlay {
    position: absolute;
    z-index: 2;
    left: 0;
    width: var(--plot-left);
    border-right: 1px solid var(--control-border);
    background: var(--plot);
    pointer-events: none;
  }
  .vertical-axis-tick {
    position: absolute;
    right: 5px;
    color: var(--text);
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
    scrollbar-color: var(--control-border) var(--plot);
    scrollbar-width: thin;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .river-scroll:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .river-scroll::-webkit-scrollbar {
    height: 9px;
  }
  .river-scroll::-webkit-scrollbar-track {
    background: var(--plot);
    border-radius: var(--control-radius);
  }
  .river-scroll::-webkit-scrollbar-thumb {
    background: var(--control-border);
    border: 2px solid var(--plot);
    border-radius: var(--control-radius);
  }
  svg {
    display: block;
    background: var(--plot);
    border-radius: var(--radius);
    touch-action: pan-y;
  }
  .plot-background {
    fill: var(--plot);
  }
  .weight-gridline {
    stroke: var(--separator);
    stroke-width: 0.75;
    opacity: 0.72;
    pointer-events: none;
  }
  .column-guide {
    stroke: var(--chart-guide);
    stroke-width: 1;
    pointer-events: none;
  }
  .river-overlay .call-target {
    pointer-events: all;
  }
  .call-target {
    cursor: pointer;
    color: var(--secondary);
  }
  .call-target rect {
    fill: transparent;
  }
  .call-target text {
    fill: currentColor;
    font-size: var(--text-sm);
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
    stroke: var(--compaction);
    stroke-width: 1.5;
    stroke-dasharray: 6 5;
  }
  .compaction-marker text {
    fill: var(--compaction-text);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .reported-input-overlay {
    pointer-events: none;
  }
  .reported-input-line {
    fill: none;
    stroke: var(--secondary);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
    pointer-events: none;
  }
  .input-reference-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 1rem;
    padding: 0.45rem 0 0.45rem var(--plot-left);
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .input-reference-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .input-reference-legend i {
    display: inline-block;
    width: 18px;
    height: 10px;
    flex-shrink: 0;
  }
  .input-reference-key {
    border-top: 2px dashed var(--secondary);
    margin-top: 8px;
  }
  .input-gap-key {
    background: repeating-linear-gradient(135deg, transparent 0 4px, #aab4c775 4px 5px);
    border: 1px solid #8793aa55;
  }
  .input-comparison-readout {
    flex-basis: 100%;
  }

  /* Hover and selection never restyle ribbons: that would re-rasterise every
     ribbon. Emphasis is drawn in .river-overlay instead. */
  .river-canvas {
    position: relative;
  }
  /* Composite the overlay, not the ribbon SVG: promoting the ribbon SVG changes
     how Chrome hit-tests sub-pixel ribbons. */
  .river-overlay {
    position: absolute;
    top: 0;
    left: 0;
    background: none;
    pointer-events: none;
    will-change: transform;
  }
  .ribbon {
    pointer-events: none;
    fill-opacity: 0.88;
    stroke-opacity: 0.88;
  }
  .ribbon-group.unknown .ribbon {
    fill-opacity: 0.92;
  }
  .ribbon-emphasis {
    fill-opacity: 1;
  }
  .ribbon-emphasis.hovered {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.5;
  }
  .ribbon-emphasis.selected {
    stroke: #fff;
    stroke-width: 2.5;
  }
  .ribbon.subpixel {
    paint-order: stroke;
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
  .compaction-merge {
    opacity: 0.4;
    pointer-events: none;
  }
  /* Drawn over the 0.4 base merge: about 0.5 combined when the summary is
     focused, about 0.8 when the focused item is one of its sources. */
  .compaction-merge-emphasis {
    opacity: 0.15;
  }
  .compaction-merge-emphasis.emphasized {
    opacity: 0.65;
  }
  .version-mark {
    stroke: #fff;
    stroke-width: 1.5;
    opacity: 0.8;
  }
  .lineage-connector {
    fill: none;
    stroke: #fff;
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
    opacity: 0.88;
  }
  .crosshair {
    stroke: var(--secondary);
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
    fill: color-mix(in srgb, var(--accent) 20%, transparent);
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }
  @media (max-width: 620px) {
    .vertical-scale-controls {
      display: block;
    }
  }
</style>
