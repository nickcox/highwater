<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { domRoot } from '../dom-root';
  import type { SessionListItem } from '../api/client';
  import type { SessionViewSnapshot } from '../state/session-view';
  import type { ItemContentLoader } from '../api/client';
  import { inspectorSections } from '../state/inspector-sections';
  import {
    defaultPresentationPreferences,
    type PresentationPreferences,
  } from '../state/presentation-preferences';
  import { escapeInteraction, reconcileInteraction, resetInteraction } from '../state/interaction';
  import type { IndexedAnalysis, InteractionState } from '../types';
  import type { RiverNavigationCommand, RiverViewportStatus } from '../context-river/viewport';
  import { stepCallTarget } from '../context-river/viewport';
  import { viewLinkRange, type ViewLinkState } from '../state/view-link';
  import CallComposition from './CallComposition.svelte';
  import ContextRiverNavigation from './ContextRiverNavigation.svelte';
  import ContextLifespans from './ContextLifespans.svelte';
  import Inspector from './Inspector.svelte';
  import ItemHoverCard from './ItemHoverCard.svelte';
  import SessionSummary from './SessionSummary.svelte';
  import ChartHelp from './ChartHelp.svelte';
  import ContextRiver from '../context-river/ContextRiver.svelte';
  import CallOverview from './CallOverview.svelte';
  import {
    normaliseSections,
    STANDARD_SECTIONS,
    wideSectionPlacement,
    type SectionId,
  } from '../state/session-sections';

  let {
    indexed,
    sessions = [],
    sessionReference = null,
    loadItemContent,
    presentation = $bindable(defaultPresentationPreferences()),
    viewState = $bindable<SessionViewSnapshot | null>(null),
    riverSessionId = $bindable<string | null>(null),
    onPreferencesChange = () => {},
    onCopyViewLink,
    copyDisabled = false,
    keyboardScope = 'window',
    keyboardOwner,
    onPin = () => {},
    sections = STANDARD_SECTIONS,
    following = false,
  }: {
    indexed: IndexedAnalysis;
    sessions?: SessionListItem[];
    sessionReference?: string | null;
    loadItemContent?: ItemContentLoader;
    presentation?: PresentationPreferences;
    viewState?: SessionViewSnapshot | null;
    riverSessionId?: string | null;
    onPreferencesChange?: (next: PresentationPreferences) => void;
    onCopyViewLink?: () => void;
    copyDisabled?: boolean;
    keyboardScope?: 'window' | 'root';
    keyboardOwner?: HTMLElement;
    /** Called when the user changes the pinned call, including clearing it. */
    onPin?: () => void;
    /** The order of the view's sections; the order is fixed for the life of the view. */
    sections?: readonly SectionId[];
    /** Whether the host is following the latest call, which the call section names. */
    following?: boolean;
  } = $props();
  const orderedSections = normaliseSections(untrack(() => sections));
  const wide = wideSectionPlacement(orderedSections);
  // While following with a call section, the newest call stays pinned: clearing affects the item.
  let keepPin = $derived(following && orderedSections.includes('call'));
  function sectionStyle(id: SectionId): string {
    const place = wide.get(id)!;
    return `--wide-column:${place.column};--wide-row:${place.row}`;
  }
  let sessionId = $derived(sessionReference ?? indexed.analysis.session.id);
  let itemSections = $state.raw(inspectorSections());
  let callSections = $state.raw(inspectorSections());
  let previousFocus: Element | null = null;
  let previousAnalysis: IndexedAnalysis | null = null;
  let settledUrlCommandId = $state(0);
  let urlNavigationRevision = $state(0);
  let urlViewportOverride = $state.raw<{ range: ViewLinkState['range'] } | null>(null);
  function updatePresentation(next: PresentationPreferences): void {
    presentation = next;
    onPreferencesChange(next);
  }
  let interaction = $state.raw<InteractionState>(resetInteraction());
  let appRoot: HTMLElement;
  let visualizationView = $state<'river' | 'composition'>('river');
  let compositionScope = $state<'atCall' | 'cumulative'>('cumulative');
  let compositionEndpointNotice = $state('');
  let navigationCommand = $state.raw<RiverNavigationCommand | null>(null);
  let riverComponent = $state<{ dismissEconomics: () => boolean } | null>(null);
  let navigationCommandId = 0;
  let viewDetailsRequestId = 0;
  let findInLifespansRequest = $state.raw<{ requestId: number; itemId: string } | null>(null);
  let findRequestId = 0;
  const initialViewportStatus = (): RiverViewportStatus => ({
    ready: false,
    isFitAll: true,
    zoomFactor: 1,
    canZoomIn: false,
    canZoomOut: false,
    totalCallCount: 0,
    firstVisibleCallIndex: null,
    lastVisibleCallIndex: null,
    hasOverflow: false,
  });
  let viewportStatus = $state.raw(initialViewportStatus());
  let hoveredItemPoint = $state.raw<{ x: number; y: number } | null>(null);
  let riverSelectionVisibility = $state.raw<{ itemId: string; visible: boolean } | null>(null);
  let hoverCardHost = $state<HTMLDivElement | null>(null);
  let hoverCardPosition = $state.raw<{ left: number; top: number } | null>(null);
  // A view that has not been measured keeps the full controls. Each layout takes 20px
  // more to leave than to enter so a scrollbar cannot switch it back.
  let compact = $state(false);
  let compactNavigation = $state(false);
  let compactSummary = $state(false);
  function measureWidth(width: number): void {
    const next = width > 0 && (compact ? width <= 540 : width <= 520);
    if (next !== compact) compact = next;
    compactNavigation = width > 0 && (compactNavigation ? width <= 480 : width <= 460);
    const summary = width > 0 && (compactSummary ? width <= 780 : width <= 760);
    if (summary !== compactSummary) compactSummary = summary;
  }

  function deferRiver(sessionId: string | null): void {
    if (sessionId === riverSessionId) return;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if ((sessionReference ?? indexed.analysis.session.id) !== sessionId || disposed) return;
        riverSessionId = sessionId;
      }),
    );
  }
  let pinnedCall = $derived(
    interaction.pinnedCallIndex === null
      ? null
      : (indexed?.callByIndex.get(interaction.pinnedCallIndex) ?? null),
  );
  let selectedItem = $derived(
    interaction.selectedItemId ? (indexed?.itemById.get(interaction.selectedItemId) ?? null) : null,
  );
  let selectedItemOutsideRiver = $derived(
    selectedItem !== null &&
      selectedItem.presence.length > 0 &&
      riverSelectionVisibility?.itemId === selectedItem.id &&
      !riverSelectionVisibility.visible,
  );
  let hoveredItem = $derived(
    interaction.hoveredItemId ? (indexed?.itemById.get(interaction.hoveredItemId) ?? null) : null,
  );
  let callIndices = $derived(indexed?.analysis.modelCalls.map((call) => call.index) ?? []);
  let explorationTitle = $derived(visualizationView === 'river' ? 'Context River' : 'Composition');

  $effect.pre(() => {
    const next = indexed;
    const reference = sessionId;
    untrack(() => {
      const previous = previousAnalysis;
      if (previous === next) {
        deferRiver(reference);
        return;
      }
      if (previous && previous.analysis.session.id === next.analysis.session.id) {
        const previousPinnedCallIndex = interaction.pinnedCallIndex;
        interaction = reconcileInteraction(interaction, previous, next);
        if (
          previousPinnedCallIndex !== null &&
          interaction.pinnedCallIndex === null &&
          compositionScope === 'cumulative'
        ) {
          compositionEndpointNotice =
            'The pinned call is no longer available; cumulative scope now covers the whole session.';
        }
        if (findInLifespansRequest && !next.itemById.has(findInLifespansRequest.itemId)) {
          findInLifespansRequest = null;
        }
        if (navigationCommand?.kind === 'reveal-item') {
          if (
            !next.itemById.has(navigationCommand.itemId) ||
            interaction.selectedItemId !== navigationCommand.itemId
          ) {
            navigationCommand = null;
          } else {
            navigationCommand = {
              ...navigationCommand,
              referenceCallIndex: interaction.pinnedCallIndex,
            };
          }
        }
      } else if (previous) {
        interaction = resetInteraction();
        itemSections = inspectorSections();
        callSections = inspectorSections();
        visualizationView = 'river';
        compositionScope = 'cumulative';
        compositionEndpointNotice = '';
        navigationCommand = null;
        findInLifespansRequest = null;
        riverSelectionVisibility = null;
        resetViewportStatus();
        urlViewportOverride = null;
        settledUrlCommandId = 0;
        urlNavigationRevision = 0;
      }
      previousAnalysis = next;
      deferRiver(reference);
    });
  });

  $effect.pre(() => {
    viewState = {
      linkedView: {
        session: sessionId,
        view: visualizationView,
        display: presentation.river.display,
        scope: compositionScope,
        pin: interaction.pinnedCallIndex,
        item: interaction.selectedItemId,
        range: urlViewportOverride
          ? urlViewportOverride.range
          : viewLinkRange(viewportStatus, callIndices),
      },
      navigationRevision: urlNavigationRevision,
      riverReady: riverSessionId === sessionId,
      settled:
        visualizationView === 'composition' ||
        callIndices.length === 0 ||
        (viewportStatus.ready &&
          (!navigationCommand || settledUrlCommandId === navigationCommand.id)),
    };
  });
  // A session without model calls has no River to navigate.
  $effect.pre(() => {
    if (
      indexed?.analysis.modelCalls.length === 0 &&
      (navigationCommand !== null ||
        viewportStatus.ready ||
        !viewportStatus.isFitAll ||
        viewportStatus.totalCallCount !== 0)
    ) {
      navigationCommand = null;
      resetViewportStatus();
    }
  });
  // When an update removes the focused element (for example a closed inspector panel), focus
  // moves to the nearest summary heading or the view tab, not the page. The values read first are
  // the state that can remove focused content.
  $effect.pre(() => {
    void [interaction, visualizationView, indexed, pinnedCall, selectedItem, riverSessionId];
    previousFocus = domRoot(appRoot).activeElement;
  });
  $effect(() => {
    void [interaction, visualizationView, indexed, pinnedCall, selectedItem, riverSessionId];
    untrack(restoreLostFocus);
  });
  function restoreLostFocus(): void {
    if (
      previousFocus &&
      !previousFocus.isConnected &&
      (domRoot(appRoot).activeElement === document.body ||
        domRoot(appRoot).activeElement === null ||
        !domRoot(appRoot).activeElement?.isConnected)
    ) {
      const target =
        domRoot(appRoot).getElementById('selected-item-summary') ??
        domRoot(appRoot).getElementById('pinned-call-summary') ??
        domRoot(appRoot).getElementById(
          visualizationView === 'river' ? 'river-tab' : 'composition-tab',
        );
      target?.focus({ preventScroll: true });
    }
  }
  // The hover card is placed after it renders, when it can be measured.
  $effect(() => {
    void [hoveredItemPoint, hoveredItem, hoverCardHost];
    untrack(placeHoverCard);
  });

  let disposed = false;
  onMount(() => {
    if (keyboardScope === 'window') window.addEventListener('keydown', handleWindowKey);
    const widthObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) => {
            // Change the layout after this observation, not during it.
            const width = entry.contentRect.width;
            requestAnimationFrame(() => {
              if (!disposed) measureWidth(width);
            });
          });
    widthObserver?.observe(appRoot);
    return () => {
      disposed = true;
      widthObserver?.disconnect();
      if (keyboardScope === 'window') window.removeEventListener('keydown', handleWindowKey);
    };
  });

  export function restoreView(state: ViewLinkState): boolean {
    if (state.session !== sessionId || riverSessionId !== sessionId) return false;
    interaction = { ...resetInteraction(), selectedItemId: state.item, pinnedCallIndex: state.pin };
    visualizationView = state.view;
    presentation = { ...presentation, river: { ...presentation.river, display: state.display } };
    compositionScope = state.scope;
    compositionEndpointNotice = '';
    urlViewportOverride = { range: state.range };
    navigationCommand = indexed.analysis.modelCalls.length
      ? state.range
        ? {
            id: ++navigationCommandId,
            kind: 'range',
            startCallIndex: state.range[0],
            endCallIndex: state.range[1],
          }
        : { id: ++navigationCommandId, kind: 'fit' }
      : null;
    if (!navigationCommand) urlViewportOverride = null;

    return true;
  }

  /** Show the latest call, and pin it when the view has a call section to show it in. */
  export function followLatest(): void {
    const latest = callIndices[callIndices.length - 1] as number | undefined;
    if (latest !== undefined && orderedSections.includes('call')) {
      interaction = { ...interaction, pinnedCallIndex: latest };
      compositionEndpointNotice = '';
      // Beside a live thread, recent calls matter most: show those at a readable width.
      urlNavigationRevision += 1;
      navigationCommand = { id: ++navigationCommandId, kind: 'recent', minCallSpacing: 4 };
      return;
    }
    navigate('latest');
  }

  function unpinCall(): void {
    onPin();
    interaction = { ...interaction, pinnedCallIndex: null };
  }

  function viewCallDetails(): void {
    void tick().then(() => {
      const heading = domRoot(appRoot).getElementById('pinned-call-summary');
      heading?.scrollIntoView({ block: 'start' });
      heading?.focus({ preventScroll: true });
    });
  }

  function showComposition(): void {
    visualizationView = 'composition';
    compositionScope = 'atCall';
    void tick().then(() => {
      const tab = domRoot(appRoot).getElementById('composition-tab');
      tab?.scrollIntoView({ block: 'start' });
      tab?.focus({ preventScroll: true });
    });
  }

  function navigationSettled(id: number): void {
    settledUrlCommandId = id;
    if (id === navigationCommand?.id) urlViewportOverride = null;
  }
  function resetViewportStatus(): void {
    viewportStatus = initialViewportStatus();
  }

  function hoverCall(index: number | null): void {
    if (interaction.hoveredCallIndex !== index)
      interaction = { ...interaction, hoveredCallIndex: index };
  }

  function pinCall(index: number): void {
    onPin();
    interaction = { ...interaction, pinnedCallIndex: index };
    compositionEndpointNotice = '';
  }

  function setCompositionScope(scope: 'atCall' | 'cumulative'): void {
    compositionScope = scope;
  }

  function updateViewport(status: RiverViewportStatus): void {
    if (visualizationView === 'river') viewportStatus = status;
  }

  function updateSelectionVisibility(status: { itemId: string; visible: boolean } | null): void {
    if (
      status?.itemId !== riverSelectionVisibility?.itemId ||
      status?.visible !== riverSelectionVisibility?.visible
    ) {
      riverSelectionVisibility = status;
    }
  }

  function revealItemInRiver(itemId: string): void {
    if (!indexed?.itemById.has(itemId) || callIndices.length === 0) return;
    urlNavigationRevision += 1;
    visualizationView = 'river';
    navigationCommand = {
      id: ++navigationCommandId,
      kind: 'reveal-item',
      itemId,
      referenceCallIndex: interaction.pinnedCallIndex,
    };
  }

  function findItemInLifespans(itemId: string): void {
    if (!indexed?.itemById.has(itemId)) return;
    findInLifespansRequest = { requestId: ++findRequestId, itemId };
  }

  function viewSelectedItemDetails(): void {
    const requestedSessionId = sessionId;
    const requestedItemId = selectedItem?.id ?? null;
    const requestId = ++viewDetailsRequestId;
    if (requestedItemId === null) {
      const inspector = domRoot(appRoot).getElementById('inspector');
      if (!inspector) return;
      inspector.scrollIntoView({ block: 'start' });
      inspector.focus({ preventScroll: true });
      return;
    }

    void tick().then(() => {
      if (
        requestId !== viewDetailsRequestId ||
        requestedSessionId !== sessionId ||
        interaction.selectedItemId !== requestedItemId ||
        !indexed?.itemById.has(requestedItemId)
      ) {
        return;
      }

      const inspector = domRoot(appRoot).getElementById('inspector');
      const summary = domRoot(appRoot).getElementById('selected-item-summary');
      if (!inspector || !summary) return;

      const inspectorStyle = getComputedStyle(inspector);
      const isScrollable =
        inspectorStyle.overflowY !== 'visible' && inspector.scrollHeight > inspector.clientHeight;
      if (isScrollable) {
        const inspectorBounds = inspector.getBoundingClientRect();
        const summaryBounds = summary.getBoundingClientRect();
        const padding = 12;
        if (summaryBounds.top < inspectorBounds.top + padding) {
          inspector.scrollTop -= inspectorBounds.top + padding - summaryBounds.top;
        } else if (summaryBounds.bottom > inspectorBounds.bottom - padding) {
          inspector.scrollTop += summaryBounds.bottom - (inspectorBounds.bottom - padding);
        }
        summary.focus({ preventScroll: true });
      } else {
        summary.scrollIntoView({ block: 'start' });
        summary.focus({ preventScroll: true });
      }
    });
  }

  function inspectCall(index: number): void {
    if (!indexed?.callByIndex.has(index)) return;
    const requestedSessionId = sessionId;
    const sourceId = indexed.callByIndex.get(index)?.sourceRecordId;
    const itemId = interaction.selectedItemId;
    const requestId = ++viewDetailsRequestId;
    pinCall(index);
    void tick().then(() => {
      if (
        requestId !== viewDetailsRequestId ||
        requestedSessionId !== sessionId ||
        interaction.selectedItemId !== itemId ||
        pinnedCall?.sourceRecordId !== sourceId
      )
        return;
      const heading = domRoot(appRoot).getElementById('pinned-call-summary');
      heading?.scrollIntoView({ block: 'nearest' });
      heading?.focus({ preventScroll: true });
    });
  }

  function clearSelection(): void {
    if (keepPin) {
      selectItem(null);
      return;
    }
    onPin();
    interaction = resetInteraction();
    compositionEndpointNotice = '';
    navigationCommand = null;
  }

  function navigate(kind: 'fit' | 'zoom-in' | 'zoom-out' | 'latest'): void {
    if (kind === 'fit' || kind === 'latest') urlNavigationRevision += 1;
    navigationCommand = { id: ++navigationCommandId, kind };
  }

  function stepToCall(callIndex: number): void {
    pinCall(callIndex);
    navigationCommand = { id: ++navigationCommandId, kind: 'ensure-call', callIndex };
  }

  function handleVisualizationTabKeydown(event: KeyboardEvent): void {
    let nextView: 'river' | 'composition';
    if (event.key === 'Home') nextView = 'river';
    else if (event.key === 'End') nextView = 'composition';
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      nextView = visualizationView === 'river' ? 'composition' : 'river';
    } else return;

    event.preventDefault();
    visualizationView = nextView;
    const tabId = nextView === 'river' ? 'river-tab' : 'composition-tab';
    domRoot(appRoot).getElementById(tabId)?.focus();
  }

  function hoverItem(id: string | null, event?: PointerEvent): void {
    if (id === null) {
      hoveredItemPoint = null;
      hoverCardPosition = null;
    } else if (event) {
      hoveredItemPoint = { x: event.clientX, y: event.clientY };
    }
    if (interaction.hoveredItemId !== id) interaction = { ...interaction, hoveredItemId: id };
  }

  function placeHoverCard(): void {
    if (!hoverCardHost || !hoveredItemPoint) return;
    const bounds = hoverCardHost.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    const margin = 12;
    const gap = 14;
    const { x, y } = hoveredItemPoint;
    const right = x + gap;
    const below = y + gap;
    const preferredLeft =
      right + bounds.width <= window.innerWidth - margin ? right : x - gap - bounds.width;
    const preferredTop =
      below + bounds.height <= window.innerHeight - margin ? below : y - gap - bounds.height;
    const next = {
      left: Math.round(
        Math.min(
          Math.max(margin, preferredLeft),
          Math.max(margin, window.innerWidth - bounds.width - margin),
        ),
      ),
      top: Math.round(
        Math.min(
          Math.max(margin, preferredTop),
          Math.max(margin, window.innerHeight - bounds.height - margin),
        ),
      ),
    };
    if (next.left !== hoverCardPosition?.left || next.top !== hoverCardPosition?.top) {
      hoverCardPosition = next;
    }
  }

  function selectItem(id: string | null): void {
    if (navigationCommand?.kind === 'reveal-item' && navigationCommand.itemId !== id) {
      navigationCommand = null;
    }
    if (findInLifespansRequest && findInLifespansRequest.itemId !== id) {
      findInLifespansRequest = null;
    }
    interaction = { ...interaction, selectedItemId: id };
  }

  function selectLifespanItem(id: string, callIndex?: number): void {
    selectItem(id);
    if (callIndex !== undefined) pinCall(callIndex);
  }

  function emptyClick(index: number): void {
    if (navigationCommand?.kind === 'reveal-item') navigationCommand = null;
    onPin();
    interaction = { ...interaction, pinnedCallIndex: index };
  }

  function handleEscape(): boolean {
    const disclosure =
      domRoot(appRoot).activeElement?.closest('details[open]') ??
      domRoot(appRoot).querySelector('.view-options[open]');
    if (disclosure instanceof HTMLDetailsElement) {
      disclosure.open = false;
      disclosure.querySelector('summary')?.focus();
      return true;
    }
    if (riverComponent?.dismissEconomics()) return true;
    if (interaction.selectedItemId !== null || (interaction.pinnedCallIndex !== null && !keepPin)) {
      const pinned = interaction.pinnedCallIndex;
      interaction = escapeInteraction(interaction);
      if (interaction.pinnedCallIndex !== pinned) onPin();
      if (
        navigationCommand?.kind === 'reveal-item' &&
        interaction.selectedItemId !== navigationCommand.itemId
      ) {
        navigationCommand = null;
      }
      return true;
    } else if (!viewportStatus.isFitAll) {
      navigate('fit');
      return true;
    }
    return false;
  }

  function handleWindowKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      const handled = handleEscape();
      if (handled || keyboardScope === 'window') event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      visualizationView !== 'river'
    )
      return;
    const direction =
      event.key === 'ArrowLeft' || event.key === 'h'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'l'
          ? 1
          : null;
    if (direction === null) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const bodyTarget =
      keyboardScope === 'window' &&
      target === document.body &&
      document.querySelectorAll('main').length === 1;
    const owner = keyboardOwner ?? appRoot;
    if (!bodyTarget && !owner?.contains(target)) return;
    // Single-letter shortcuts are active only while the workspace has focus.
    if ((event.key === 'h' || event.key === 'l') && bodyTarget) return;
    if (
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tab"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"], [role="radio"]',
      )
    )
      return;
    const focusedCallIndex =
      keyboardScope === 'root'
        ? target.closest('[data-call-index]')?.getAttribute('data-call-index')
        : null;
    const callIndex = stepCallTarget(
      callIndices,
      focusedCallIndex ? Number(focusedCallIndex) : interaction.pinnedCallIndex,
      viewportStatus,
      direction,
    );
    // Consume even at boundaries so an arrow cannot unexpectedly pan the chart.
    event.preventDefault();
    if (callIndex !== null) {
      if (bodyTarget)
        appRoot.querySelector<HTMLElement>('.river-scroll')?.focus({ preventScroll: true });
      stepToCall(callIndex);
      if (keyboardScope === 'root' && target.closest('.call-target')) {
        void tick().then(() =>
          appRoot
            .querySelector<SVGElement>(`.call-target[aria-label="Pin model call ${callIndex}"]`)
            ?.focus({ preventScroll: true }),
        );
      }
    }
  }
</script>

<svelte:window onresize={placeHoverCard} />

<!-- Delegated root keys run after child controls, so a popover can consume Escape first. -->
<div
  class="session-view"
  bind:this={appRoot}
  role="presentation"
  onkeydown={keyboardScope === 'root' ? handleWindowKey : undefined}
>
  <div class="exploration-grid" class:occupied={selectedItem !== null || pinnedCall !== null}>
    {#each orderedSections as id (id)}
      {#if id === 'summary'}
        <div class="summary-section" style={sectionStyle(id)}>
          {#key sessionId}<SessionSummary
              {indexed}
              {sessionId}
              {sessions}
              compact={compactSummary}
            />{/key}
        </div>
      {:else if id === 'call'}
        <div class="call-section" style={sectionStyle(id)}>
          <CallOverview
            {indexed}
            call={pinnedCall}
            {following}
            twoColumns={!compactSummary}
            onSelectItem={(id) => {
              selectItem(id);
              viewSelectedItemDetails();
            }}
            onViewDetails={viewCallDetails}
            onShowComposition={showComposition}
          />
        </div>
      {:else if id === 'chart'}
        <section class="panel river-panel" style={sectionStyle(id)}>
          <div class="panel-head">
            <div>
              <h2>{explorationTitle}</h2>
              {#if visualizationView === 'river'}
                <ChartHelp
                  isVisible={visualizationView === 'river'}
                  source={indexed.analysis.session.source}
                  {compact}
                />
              {/if}
            </div>
            <div class="panel-actions">
              {#if onCopyViewLink}
                <button
                  type="button"
                  aria-label="Copy view link"
                  onclick={onCopyViewLink}
                  disabled={copyDisabled}>{compact ? 'Copy link' : 'Copy view link'}</button
                >
              {/if}
              <a
                class="mobile-view-details"
                href="#selected-item-summary"
                aria-label="View details"
                onclick={(event) => {
                  event.preventDefault();
                  viewSelectedItemDetails();
                }}>{compact ? 'Details' : 'View details'}</a
              >
              <button
                type="button"
                aria-label={keepPin ? 'Clear selected item' : 'Clear selected item and pinned call'}
                title={keepPin
                  ? 'Clears the selected item. The latest call stays pinned while following.'
                  : 'Clears the selected item and pinned call'}
                disabled={interaction.selectedItemId === null &&
                  (keepPin || interaction.pinnedCallIndex === null)}
                onclick={clearSelection}>{compact ? 'Clear' : 'Clear selection'}</button
              >
            </div>
          </div>

          <div class="visualization-tabs" role="tablist" aria-label="Context visualization">
            <button
              id="river-tab"
              type="button"
              role="tab"
              aria-selected={visualizationView === 'river'}
              aria-controls="river-panel"
              tabindex={visualizationView === 'river' ? 0 : -1}
              onclick={() => (visualizationView = 'river')}
              onkeydown={handleVisualizationTabKeydown}>River</button
            >
            <button
              id="composition-tab"
              type="button"
              role="tab"
              aria-selected={visualizationView === 'composition'}
              aria-controls="composition-panel"
              tabindex={visualizationView === 'composition' ? 0 : -1}
              onclick={() => (visualizationView = 'composition')}
              onkeydown={handleVisualizationTabKeydown}>Composition</button
            >
          </div>

          <div
            id="river-panel"
            class="visualization-panel"
            role="tabpanel"
            aria-labelledby="river-tab"
            tabindex="0"
            hidden={visualizationView !== 'river'}
          >
            {#if indexed.analysis.modelCalls.length > 0}
              {#key sessionId}
                <ContextRiverNavigation
                  compact={compactNavigation}
                  isVisible={visualizationView === 'river'}
                  viewport={viewportStatus}
                  {callIndices}
                  pinnedCallIndex={interaction.pinnedCallIndex}
                  onSelectCall={stepToCall}
                  onLatest={() => navigate('latest')}
                  onFitAll={() => navigate('fit')}
                  onZoomIn={() => navigate('zoom-in')}
                  onZoomOut={() => navigate('zoom-out')}
                />
              {/key}
              <div class="chart-area">
                {#if riverSessionId !== sessionId}
                  <p class="river-pending" role="status">Drawing the River…</p>
                {:else}
                  {#key sessionId}
                    <ContextRiver
                      bind:this={riverComponent}
                      {indexed}
                      preferences={presentation}
                      onPreferencesChange={updatePresentation}
                      pinnedCallIndex={interaction.pinnedCallIndex}
                      hoveredCallIndex={interaction.hoveredCallIndex}
                      selectedItemId={interaction.selectedItemId}
                      hoveredItemId={interaction.hoveredItemId}
                      {navigationCommand}
                      isVisible={visualizationView === 'river'}
                      onViewportChange={updateViewport}
                      onNavigationSettled={navigationSettled}
                      onSelectionVisibility={updateSelectionVisibility}
                      onHoverCall={hoverCall}
                      onPinCall={pinCall}
                      onHoverItem={hoverItem}
                      onSelectItem={selectItem}
                      onEmptyClick={emptyClick}
                      onEscape={handleEscape}
                      consumeUnhandledEscape={keyboardScope === 'window'}
                    />
                  {/key}
                {/if}
                {#if selectedItemOutsideRiver && selectedItem}
                  <div class="selection-location-note" role="status">
                    <span>The selected item has no presence in the current River view.</span>
                    <button type="button" onclick={() => revealItemInRiver(selectedItem.id)}>
                      Reveal in River
                    </button>
                    <button type="button" onclick={() => selectItem(null)}>Clear item</button>
                  </div>
                {/if}
                {#if hoveredItem && interaction.selectedItemId !== interaction.hoveredItemId}
                  <div
                    class="item-hover-position"
                    bind:this={hoverCardHost}
                    style={`left:${hoverCardPosition?.left ?? 12}px;top:${hoverCardPosition?.top ?? 12}px`}
                  >
                    <ItemHoverCard item={hoveredItem} {indexed} />
                  </div>
                {/if}
              </div>
            {:else}
              <div class="no-model-calls">
                <h3>No model calls</h3>
                <p>
                  This session has no completed assistant model responses on its current branch.
                </p>
                <p>
                  Terminal compaction summaries, if present, remain available in Context lifespans.
                </p>
              </div>
            {/if}
          </div>

          <div
            id="composition-panel"
            class="visualization-panel"
            role="tabpanel"
            aria-labelledby="composition-tab"
            tabindex="0"
            hidden={visualizationView !== 'composition'}
          >
            {#key sessionId}
              <CallComposition
                {indexed}
                pinnedCallIndex={interaction.pinnedCallIndex}
                selectedItemId={interaction.selectedItemId}
                isVisible={visualizationView === 'composition'}
                scope={compositionScope}
                endpointNotice={compositionEndpointNotice}
                onScopeChange={setCompositionScope}
                onPinCall={pinCall}
                onUnpinCall={unpinCall}
                onSelectItem={selectItem}
                onRevealInRiver={revealItemInRiver}
                onViewDetails={viewSelectedItemDetails}
                onFindInLifespans={findItemInLifespans}
                {compact}
              />
            {/key}
          </div>
        </section>
      {:else if id === 'details'}
        <aside
          id="inspector"
          class="inspector-column"
          style={sectionStyle(id)}
          class:beside={wide.get('details')?.column === '2'}
          class:empty={!pinnedCall && !selectedItem}
          aria-label="Inspector"
          tabindex="-1"
        >
          <Inspector
            {indexed}
            {sessionId}
            {loadItemContent}
            {sessions}
            {pinnedCall}
            {selectedItem}
            {callSections}
            {itemSections}
            pinnedCallIndex={interaction.pinnedCallIndex}
            hoveredCallIndex={interaction.hoveredCallIndex}
            hasCalls={callIndices.length > 0}
            onClosePinnedCall={unpinCall}
            onCloseItem={() => selectItem(null)}
            onSelectItem={selectItem}
            onPinCall={pinCall}
            onInspectCall={inspectCall}
            onRevealInRiver={revealItemInRiver}
          />
        </aside>
      {:else if id === 'lifespans'}
        <section class="panel lifespan-panel" style={sectionStyle(id)}>
          {#key sessionId}
            <ContextLifespans
              {indexed}
              selectedItemId={interaction.selectedItemId}
              pinnedCallIndex={interaction.pinnedCallIndex}
              onSelectItem={selectLifespanItem}
              onHoverItem={hoverItem}
              findRequest={findInLifespansRequest}
              {compact}
            />
          {/key}
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .panel {
    background: var(--surface);
    border: 0;
    border-radius: var(--radius);
    padding: var(--panel-padding);
    margin-top: 14px;
    min-width: 0;
  }
  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin-bottom: 10px;
    min-width: 0;
  }
  .panel-head > * {
    min-width: 0;
  }
  .river-panel > .panel-head > div:first-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  h2 {
    font-size: var(--text-lg);
    margin: 0;
  }
  .panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mobile-view-details {
    display: none;
    padding: var(--control-padding);
    border: 1px solid var(--separator);
    border-radius: var(--control-radius);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    white-space: nowrap;
  }
  .mobile-view-details:hover {
    background: var(--surface-raised);
  }
  #inspector {
    scroll-margin-top: 16px;
  }
  :global(.selected-item-summary) {
    scroll-margin: 16px;
  }
  /* Sections follow their order in one column. A wide view with a selection places them with the
     positions from wideSectionPlacement, which put the details in a second column. */
  .exploration-grid {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: var(--panel-gap);
  }
  .exploration-grid > * {
    grid-column: 1;
    min-width: 0;
    margin-top: 0;
  }
  @container highwater (min-width: 1051px) {
    .exploration-grid.occupied {
      grid-template-columns: minmax(0, 1fr) 320px;
    }
    .exploration-grid.occupied > * {
      grid-column: var(--wide-column);
      grid-row: var(--wide-row);
    }
    .exploration-grid.occupied > .inspector-column.beside {
      position: sticky;
      top: 16px;
      max-height: calc(100vh - 32px);
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-color: var(--control-border) var(--plot);
      scrollbar-width: thin;
    }
  }
  .visualization-tabs {
    display: flex;
    gap: 6px;
    margin: 0 0 10px;
    border-bottom: 1px solid var(--separator);
  }
  .visualization-tabs button {
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
  }
  .visualization-tabs button[aria-selected='true'] {
    border-color: var(--accent);
    background: transparent;
    color: var(--accent);
  }
  .visualization-panel {
    min-width: 0;
  }
  .visualization-panel[hidden] {
    display: none;
  }
  .no-model-calls {
    padding: 12px;
    border: 1px solid var(--separator);
    border-radius: var(--radius);
    background: var(--plot);
  }
  .no-model-calls h3 {
    margin: 0;
    color: var(--text-strong);
    font-size: 14px;
  }
  .no-model-calls p {
    margin: 4px 0 0;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .inspector-column {
    display: grid;
    align-self: start;
    gap: var(--panel-gap);
    min-width: 0;
  }
  .chart-area {
    position: relative;
    min-width: 0;
  }
  .river-pending {
    min-height: 360px;
    margin: 0;
    padding: 24px;
    color: var(--text);
  }
  .selection-location-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--text);
    font-size: var(--text-sm);
  }
  .item-hover-position {
    position: fixed;
    z-index: 5;
    pointer-events: none;
  }
  @container highwater (max-width: 1050px) {
    .mobile-view-details {
      display: inline-flex;
      align-items: center;
    }
  }
  @container highwater (max-width: 850px) {
    .item-hover-position {
      display: none;
    }
  }
</style>
