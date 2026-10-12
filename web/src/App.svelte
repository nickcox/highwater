<script lang="ts">
  import { afterUpdate, beforeUpdate, onMount, tick } from 'svelte';
  import {
    readPresentationPreferences,
    writePresentationPreferences,
    type PresentationPreferences,
  } from './lib/state/presentation-preferences';
  import { inspectorSections } from './lib/state/inspector-sections';
  let presentation = readPresentationPreferences();
  let itemSections = inspectorSections();
  let callSections = inspectorSections();
  function updatePresentation(next: PresentationPreferences): void {
    presentation = next;
    writePresentationPreferences(next);
  }
  let previousFocus: Element | null = null;
  beforeUpdate(() => {
    previousFocus = document.activeElement;
  });
  afterUpdate(() => {
    if (
      previousFocus &&
      !previousFocus.isConnected &&
      (document.activeElement === document.body || !document.activeElement?.isConnected)
    ) {
      const target =
        document.getElementById('selected-item-summary') ??
        document.getElementById('pinned-call-summary') ??
        document.getElementById(visualizationView === 'river' ? 'river-tab' : 'composition-tab');
      target?.focus({ preventScroll: true });
    }
  });
  import CallComposition from './lib/components/CallComposition.svelte';
  import ContextRiverNavigation from './lib/components/ContextRiverNavigation.svelte';
  import ContextLifespans from './lib/components/ContextLifespans.svelte';
  import Inspector from './lib/components/Inspector.svelte';
  import ItemHoverCard from './lib/components/ItemHoverCard.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import SessionSummary from './lib/components/SessionSummary.svelte';
  import ContextRiver from './lib/context-river/ContextRiver.svelte';
  import ChartHelp from './lib/components/ChartHelp.svelte';
  import { sessionDetailLine } from './lib/session-label';
  import {
    escapeInteraction,
    reconcileInteraction,
    resetInteraction,
  } from './lib/state/interaction';
  import type { IndexedAnalysis, InteractionState } from './lib/types';
  import { estimateQuality } from './lib/estimate-quality';
  import type { RiverNavigationCommand, RiverViewportStatus } from './lib/context-river/viewport';
  import { stepCallTarget } from './lib/context-river/viewport';
  import {
    createSessionController,
    type SessionControllerSnapshot,
  } from './lib/state/session-controller';
  import {
    parseViewLink,
    isViewLinkFragment,
    serializeViewLink,
    validateViewLink,
    viewLinkSignature,
    viewLinkRange,
    type ViewLinkState,
  } from './lib/state/view-link';

  const initialLink = parseViewLink(
    typeof window === 'undefined' ? '' : window.location.hash,
    presentation.river.display,
  );
  // Resolve grouping before the first geometry build; URL state wins over storage.
  presentation = {
    ...presentation,
    river: {
      ...presentation.river,
      display: initialLink.state?.display ?? presentation.river.display,
    },
  };
  let pendingViewLink: ViewLinkState | null = initialLink.state;
  let viewLinkNotice = initialLink.notice;
  let copyLinkNotice = '';
  let fallbackViewUrl = '';
  let fallbackLinkInput: HTMLInputElement;
  let urlMounted = false;
  let lastReadHash = typeof window === 'undefined' ? '' : window.location.hash;
  let lastUrlSignature = '';
  let replaceNextUrl = false;
  let settledUrlCommandId = 0;
  let urlNavigationRevision = 0;
  let rangeUrlTimer: number | null = null;
  let scheduledRangeUrl: { hash: string; signature: string } | null = null;
  let viewRestoreQueued = false;
  let urlViewportOverride: { range: ViewLinkState['range'] } | null = null;

  let interaction: InteractionState = resetInteraction();
  let appRoot: HTMLElement;
  let visualizationView: 'river' | 'composition' = 'river';
  let compositionScope: 'atCall' | 'cumulative' = 'cumulative';
  let compositionEndpointNotice = '';
  let navigationCommand: RiverNavigationCommand | null = null;
  let riverComponent: { dismissEconomics: () => boolean } | null = null;
  let navigationCommandId = 0;
  let viewDetailsRequestId = 0;
  let findInLifespansRequest: { requestId: number; itemId: string } | null = null;
  let findRequestId = 0;
  let viewportStatus: RiverViewportStatus = {
    ready: false,
    isFitAll: true,
    zoomFactor: 1,
    canZoomIn: false,
    canZoomOut: false,
    totalCallCount: 0,
    firstVisibleCallIndex: null,
    lastVisibleCallIndex: null,
    hasOverflow: false,
  };
  let hoveredItemPoint: { x: number; y: number } | null = null;
  let riverSelectionVisibility: { itemId: string; visible: boolean } | null = null;
  let hoverCardHost: HTMLDivElement | null = null;
  let hoverCardPosition: { left: number; top: number } | null = null;

  const sessionController = createSessionController({
    initialSessionId: initialLink.state?.session,
    onAnalysisAccepted: ({ kind, previous, next }) => {
      if (kind === 'replacement' && previous) {
        replaceNextUrl = true;
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
      }
    },
    onSelectionChanged: () => {
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
    },
  });
  // Analysis identity is an explicit reactive boundary: request/status publications
  // must not invalidate geometry and projections when the analysis is unchanged.
  let indexed: IndexedAnalysis | null = null;
  $: if (indexed !== $sessionController.indexed) indexed = $sessionController.indexed;
  // A newly selected session's River mounts a frame after its summary, so the summary is shown
  // while the River, the slowest part to build, is laid out.
  let riverSessionId: string | null = null;
  $: if (indexed) deferRiver($sessionController.selectedSessionId);
  function deferRiver(sessionId: string | null): void {
    if (sessionId === riverSessionId) return;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if ($sessionController.selectedSessionId !== sessionId) return;
        riverSessionId = sessionId;
        if (pendingViewLink) queueViewRestore();
      }),
    );
  }
  $: quality = indexed ? estimateQuality(indexed.analysis) : null;
  $: pinnedCall =
    interaction.pinnedCallIndex === null
      ? null
      : (indexed?.callByIndex.get(interaction.pinnedCallIndex) ?? null);
  $: selectedItem = interaction.selectedItemId
    ? (indexed?.itemById.get(interaction.selectedItemId) ?? null)
    : null;
  $: selectedItemOutsideRiver =
    selectedItem !== null &&
    selectedItem.presence.length > 0 &&
    riverSelectionVisibility?.itemId === selectedItem.id &&
    !riverSelectionVisibility.visible;
  $: hoveredItem = interaction.hoveredItemId
    ? (indexed?.itemById.get(interaction.hoveredItemId) ?? null)
    : null;
  $: callIndices = indexed?.analysis.modelCalls.map((call) => call.index) ?? [];
  $: selectedSessionListing = $sessionController.sessions.find(
    (session) => session.id === $sessionController.selectedSessionId,
  );
  $: selectedSessionDetail = selectedSessionListing
    ? sessionDetailLine(selectedSessionListing)
    : '';
  $: explorationTitle = visualizationView === 'river' ? 'Context River' : 'Composition';
  $: if (
    indexed?.analysis.modelCalls.length === 0 &&
    (navigationCommand !== null ||
      viewportStatus.ready ||
      !viewportStatus.isFitAll ||
      viewportStatus.totalCallCount !== 0)
  ) {
    navigationCommand = null;
    resetViewportStatus();
  }

  $: linkedView = $sessionController.selectedSessionId
    ? ({
        session: $sessionController.selectedSessionId,
        view: visualizationView,
        display: presentation.river.display,
        scope: compositionScope,
        pin: interaction.pinnedCallIndex,
        item: interaction.selectedItemId,
        range: urlViewportOverride
          ? urlViewportOverride.range
          : viewLinkRange(viewportStatus, callIndices),
      } satisfies ViewLinkState)
    : null;
  $: linkedSignature = linkedView ? viewLinkSignature(linkedView, urlNavigationRevision) : '';
  $: if (urlMounted && pendingViewLink && !$sessionController.loading) queueViewRestore();
  $: if (
    urlMounted &&
    linkedView &&
    indexed &&
    !pendingViewLink &&
    !$sessionController.loading &&
    (visualizationView === 'composition' ||
      callIndices.length === 0 ||
      (viewportStatus.ready &&
        (!navigationCommand || settledUrlCommandId === navigationCommand.id)))
  )
    syncViewUrl(linkedView, linkedSignature);

  onMount(() => {
    urlMounted = true;
    window.addEventListener('popstate', readViewUrl);
    window.addEventListener('hashchange', readViewUrl);
    sessionController.start();
    return () => {
      urlMounted = false;
      cancelRangeUrl();
      window.removeEventListener('popstate', readViewUrl);
      window.removeEventListener('hashchange', readViewUrl);
      sessionController.dispose();
    };
  });

  function readViewUrl(): void {
    if (lastReadHash === window.location.hash) return;
    lastReadHash = window.location.hash;
    cancelRangeUrl();
    const storedDisplay = readPresentationPreferences().river.display;
    const parsed = parseViewLink(lastReadHash, storedDisplay);
    if (lastReadHash && !isViewLinkFragment(lastReadHash)) return;
    viewLinkNotice = parsed.notice;
    copyLinkNotice = '';
    fallbackViewUrl = '';
    pendingViewLink =
      parsed.state ??
      ($sessionController.selectedSessionId
        ? {
            session: $sessionController.selectedSessionId,
            view: 'river',
            display: storedDisplay,
            scope: 'cumulative',
            range: null,
            pin: null,
            item: null,
          }
        : null);
    if (
      pendingViewLink &&
      $sessionController.sessions.some((session) => session.id === pendingViewLink!.session) &&
      pendingViewLink.session !== $sessionController.selectedSessionId
    )
      sessionController.select(pendingViewLink.session);
  }

  function queueViewRestore(): void {
    if (viewRestoreQueued) return;
    viewRestoreQueued = true;
    // Apply outside the reactive derivation pass so inspector projections also
    // observe the restored selection/pin, not only raw child props.
    queueMicrotask(() => {
      viewRestoreQueued = false;
      if (urlMounted && !$sessionController.loading) restoreLinkedView($sessionController);
    });
  }

  function restoreLinkedView(snapshot: SessionControllerSnapshot): void {
    if (!pendingViewLink) return;
    let requested = pendingViewLink;
    if (!snapshot.sessions.some((session) => session.id === requested.session)) {
      viewLinkNotice =
        'The session in this view link is not available here. Showing the default view; choose a session or refresh after making it available.';
      if (!snapshot.selectedSessionId) {
        pendingViewLink = null;
        return;
      }
      requested = {
        session: snapshot.selectedSessionId,
        view: 'river',
        display: readPresentationPreferences().river.display,
        scope: 'cumulative',
        range: null,
        pin: null,
        item: null,
      };
    }
    if (snapshot.selectedSessionId !== requested.session || !snapshot.indexed) return;
    // Waits for the River to mount, so the linked range is applied at the River's size.
    if (riverSessionId !== requested.session) return;
    const validated = validateViewLink(requested, snapshot.indexed);
    if (validated.notice)
      viewLinkNotice = [viewLinkNotice, validated.notice].filter(Boolean).join(' ');
    const state = validated.state;
    interaction = { ...resetInteraction(), selectedItemId: state.item, pinnedCallIndex: state.pin };
    visualizationView = state.view;
    presentation = { ...presentation, river: { ...presentation.river, display: state.display } };
    compositionScope = state.scope;
    compositionEndpointNotice = '';
    urlViewportOverride = { range: state.range };
    navigationCommand = snapshot.indexed.analysis.modelCalls.length
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
    lastUrlSignature = viewLinkSignature(state, urlNavigationRevision);
    pendingViewLink = null;
  }

  function navigationSettled(id: number): void {
    settledUrlCommandId = id;
    if (id === navigationCommand?.id) urlViewportOverride = null;
  }

  function cancelRangeUrl(): void {
    if (rangeUrlTimer !== null) window.clearTimeout(rangeUrlTimer);
    rangeUrlTimer = null;
    scheduledRangeUrl = null;
  }

  function commitViewUrl(hash: string, signature: string, push: boolean): void {
    try {
      window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', hash);
      lastReadHash = hash;
      lastUrlSignature = signature;
      replaceNextUrl = false;
    } catch {
      viewLinkNotice =
        'The browser could not update the view URL. Copy view link is still available.';
    }
  }

  function syncViewUrl(state: ViewLinkState, signature: string): void {
    const hash = serializeViewLink(state);
    if (hash === window.location.hash && signature === lastUrlSignature) {
      cancelRangeUrl();
      replaceNextUrl = false;
      return;
    }
    const push =
      !replaceNextUrl &&
      lastUrlSignature !== '' &&
      signature !== lastUrlSignature &&
      hash !== window.location.hash;
    // Debounce continuous range movement, avoiding browser history API rate limits.
    // Copy uses the current measured state, even while this address update is queued.
    if (!replaceNextUrl && lastUrlSignature !== '' && signature === lastUrlSignature) {
      if (scheduledRangeUrl?.hash === hash) return;
      cancelRangeUrl();
      scheduledRangeUrl = { hash, signature };
      rangeUrlTimer = window.setTimeout(() => {
        const scheduled = scheduledRangeUrl;
        cancelRangeUrl();
        if (urlMounted && scheduled) commitViewUrl(scheduled.hash, scheduled.signature, false);
      }, 400);
      return;
    }
    const previous = scheduledRangeUrl;
    cancelRangeUrl();
    if (push && previous) commitViewUrl(previous.hash, previous.signature, false);
    commitViewUrl(hash, signature, push);
  }

  async function copyViewLink(): Promise<void> {
    if (!linkedView || pendingViewLink) return;
    const url = new URL(window.location.href);
    // Query parameters are not app navigation; never copy URL credentials/tokens.
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = serializeViewLink(linkedView);
    cancelRangeUrl();
    commitViewUrl(url.hash, linkedSignature, false);
    try {
      await navigator.clipboard.writeText(url.href);
      copyLinkNotice = 'View link copied. Recipients need access to this session.';
      fallbackViewUrl = '';
    } catch {
      copyLinkNotice = 'Clipboard access is unavailable. Copy the view link below.';
      fallbackViewUrl = url.href;
      await tick();
      fallbackLinkInput?.focus();
      fallbackLinkInput?.select();
    }
  }

  function selectSession(sessionId: string): void {
    pendingViewLink = null;
    urlViewportOverride = null;
    viewLinkNotice = '';
    copyLinkNotice = '';
    fallbackViewUrl = '';
    sessionController.select(sessionId);
  }

  function openSessionDetails(): void {
    const summary = document.getElementById('session-details-summary');
    const details = summary?.closest('details');
    if (!summary || !details) return;
    details.open = true;
    summary.focus();
  }

  function resetViewportStatus(): void {
    viewportStatus = {
      ready: false,
      isFitAll: true,
      zoomFactor: 1,
      canZoomIn: false,
      canZoomOut: false,
      totalCallCount: 0,
      firstVisibleCallIndex: null,
      lastVisibleCallIndex: null,
      hasOverflow: false,
    };
  }

  function hoverCall(index: number | null): void {
    if (interaction.hoveredCallIndex !== index)
      interaction = { ...interaction, hoveredCallIndex: index };
  }

  function pinCall(index: number): void {
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
    const requestedSessionId = $sessionController.selectedSessionId;
    const requestedItemId = selectedItem?.id ?? null;
    const requestId = ++viewDetailsRequestId;
    if (requestedItemId === null) {
      const inspector = document.getElementById('inspector');
      if (!inspector) return;
      inspector.scrollIntoView({ block: 'start' });
      inspector.focus({ preventScroll: true });
      return;
    }

    void tick().then(() => {
      if (
        requestId !== viewDetailsRequestId ||
        requestedSessionId !== $sessionController.selectedSessionId ||
        interaction.selectedItemId !== requestedItemId ||
        !indexed?.itemById.has(requestedItemId)
      ) {
        return;
      }

      const inspector = document.getElementById('inspector');
      const summary = document.getElementById('selected-item-summary');
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
    const sessionId = $sessionController.selectedSessionId;
    const sourceId = indexed.callByIndex.get(index)?.sourceRecordId;
    const itemId = interaction.selectedItemId;
    const requestId = ++viewDetailsRequestId;
    pinCall(index);
    void tick().then(() => {
      if (
        requestId !== viewDetailsRequestId ||
        sessionId !== $sessionController.selectedSessionId ||
        interaction.selectedItemId !== itemId ||
        pinnedCall?.sourceRecordId !== sourceId
      )
        return;
      const heading = document.getElementById('pinned-call-summary');
      heading?.scrollIntoView({ block: 'nearest' });
      heading?.focus({ preventScroll: true });
    });
  }

  function clearSelection(): void {
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

  function jumpToCall(callIndex: number): void {
    stepToCall(callIndex);
  }

  function jumpToLatest(): void {
    navigate('latest');
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
    document.getElementById(tabId)?.focus();
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

  afterUpdate(placeHoverCard);

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
    interaction = { ...interaction, pinnedCallIndex: index };
  }

  function handleEscape(): void {
    const disclosure =
      document.activeElement?.closest('details[open]') ??
      document.querySelector('.view-options[open]');
    if (disclosure instanceof HTMLDetailsElement) {
      disclosure.open = false;
      disclosure.querySelector('summary')?.focus();
      return;
    }
    if (riverComponent?.dismissEconomics()) return;
    if (interaction.selectedItemId !== null || interaction.pinnedCallIndex !== null) {
      interaction = escapeInteraction(interaction);
      if (
        navigationCommand?.kind === 'reveal-item' &&
        interaction.selectedItemId !== navigationCommand.itemId
      ) {
        navigationCommand = null;
      }
    } else if (!viewportStatus.isFitAll) {
      navigate('fit');
    }
  }

  function handleWindowKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      handleEscape();
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
    const bodyTarget = target === document.body && document.querySelectorAll('main').length === 1;
    if (!bodyTarget && !appRoot?.contains(target)) return;
    // Single-letter shortcuts are active only while the workspace has focus.
    if ((event.key === 'h' || event.key === 'l') && bodyTarget) return;
    if (
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tab"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="listbox"], [role="menu"], [role="radio"]',
      )
    )
      return;
    const callIndex = stepCallTarget(
      callIndices,
      interaction.pinnedCallIndex,
      viewportStatus,
      direction,
    );
    // Consume even at boundaries so an arrow cannot unexpectedly pan the chart.
    event.preventDefault();
    if (callIndex !== null) {
      if (bodyTarget)
        appRoot.querySelector<HTMLElement>('.river-scroll')?.focus({ preventScroll: true });
      stepToCall(callIndex);
    }
  }
</script>

<svelte:window onkeydown={handleWindowKey} onresize={placeHoverCard} />

<main bind:this={appRoot}>
  <header class="titlebar">
    <div>
      <h1>TokenPlume</h1>
      <p class="live-status">
        <span data-testid="live-status">Live updates: {$sessionController.liveStatus}</span
        >{#if selectedSessionDetail}<span class="session-detail" title={selectedSessionDetail}
            >{' · '}{selectedSessionDetail}</span
          >{/if}
      </p>
      {#if $sessionController.refreshing && !$sessionController.loading}
        <p role="status" aria-label="Refresh progress">Refreshing sessions…</p>
      {/if}
      {#if ($sessionController.liveStatus !== 'live' || $sessionController.sessions.length === 0) && !$sessionController.catalogueWarning && !$sessionController.analysisWarning && !$sessionController.sessionListError && !$sessionController.analysisError}
        <button type="button" onclick={() => sessionController.retry()}>Refresh</button>
      {/if}
    </div>
    {#if $sessionController.sessions.length > 0}<SessionPicker
        sessions={$sessionController.sessions}
        selectedId={$sessionController.selectedSessionId}
        onSelect={selectSession}
      />{/if}
  </header>

  {#if viewLinkNotice || copyLinkNotice}
    <p role="status" aria-label="View link status">{viewLinkNotice} {copyLinkNotice}</p>
  {/if}
  {#if fallbackViewUrl}
    <label class="view-link-fallback"
      >View link <input bind:this={fallbackLinkInput} readonly value={fallbackViewUrl} /></label
    >
  {/if}

  {#if $sessionController.catalogueWarning || $sessionController.analysisWarning}
    <section class="refresh-warning" role="status" aria-label="Refresh warnings">
      {#if $sessionController.catalogueWarning}<p>{$sessionController.catalogueWarning}</p>{/if}
      {#if $sessionController.analysisWarning}<p>{$sessionController.analysisWarning}</p>{/if}
      <button type="button" onclick={() => sessionController.retry()}>Refresh</button>
    </section>
  {/if}
  {#if $sessionController.sessionListError}
    <section class="state error">
      <h2>Could not discover sessions</h2>
      <p>{$sessionController.sessionListError}</p>
      <button type="button" onclick={() => sessionController.retry()}>Retry</button>
    </section>
  {:else if $sessionController.sessions.length === 0 && !$sessionController.loading}
    {#if $sessionController.selectedRemoved}
      <section class="state">
        <h2>Selected session is no longer available</h2>
        <p>Choose another session after one appears in the session directory.</p>
      </section>
    {:else}
      <section class="state">
        <h2>No sessions discovered</h2>
        <p>Point TokenPlume at a session directory with <code>--session-root</code>.</p>
      </section>
    {/if}
  {:else if $sessionController.selectedRemoved}
    <section class="state">
      <h2>Selected session is no longer available</h2>
      <p>Choose another session from the refreshed list.</p>
    </section>
  {:else if $sessionController.loading}
    <section class="state"><p>Analysing session…</p></section>
  {:else if $sessionController.analysisError}
    <section class="state error">
      <h2>Could not render this session</h2>
      <p>{$sessionController.analysisError}</p>
      <button type="button" onclick={() => sessionController.retry()}>Retry</button>
    </section>
  {:else if indexed}
    {#key $sessionController.selectedSessionId}<SessionSummary {indexed} />{/key}

    <div class="exploration-grid" class:occupied={selectedItem !== null || pinnedCall !== null}>
      <section class="panel river-panel">
        <div class="panel-head">
          <div>
            <h2>{explorationTitle}</h2>
            {#if visualizationView === 'river' && quality}
              <ChartHelp
                {quality}
                isVisible={visualizationView === 'river'}
                onOpenDiagnostics={openSessionDetails}
              />
            {/if}
          </div>
          <div class="panel-actions">
            <button
              type="button"
              onclick={copyViewLink}
              disabled={pendingViewLink !== null ||
                (visualizationView === 'river' &&
                  callIndices.length > 0 &&
                  (!viewportStatus.ready ||
                    (navigationCommand !== null && settledUrlCommandId !== navigationCommand.id)))}
              >Copy view link</button
            >
            <a
              class="mobile-view-details"
              href="#selected-item-summary"
              onclick={(event) => {
                event.preventDefault();
                viewSelectedItemDetails();
              }}>View details</a
            >
            <button
              type="button"
              aria-label="Clear selected item and pinned call"
              title="Clears the selected item and pinned call"
              disabled={interaction.selectedItemId === null && interaction.pinnedCallIndex === null}
              onclick={clearSelection}>Clear selection</button
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
            {#key $sessionController.selectedSessionId}
              <ContextRiverNavigation
                isVisible={visualizationView === 'river'}
                viewport={viewportStatus}
                {callIndices}
                pinnedCallIndex={interaction.pinnedCallIndex}
                onSelectCall={stepToCall}
                onJumpToCall={jumpToCall}
                onLatest={jumpToLatest}
                onFitAll={() => navigate('fit')}
                onZoomIn={() => navigate('zoom-in')}
                onZoomOut={() => navigate('zoom-out')}
              />
            {/key}
            <div class="chart-area">
              {#if riverSessionId !== $sessionController.selectedSessionId}
                <p class="river-pending" role="status">Drawing the River…</p>
              {:else}
                {#key $sessionController.selectedSessionId}
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
              <p>This session has no completed assistant model responses on its current branch.</p>
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
          {#key $sessionController.selectedSessionId}
            <CallComposition
              {indexed}
              pinnedCallIndex={interaction.pinnedCallIndex}
              selectedItemId={interaction.selectedItemId}
              isVisible={visualizationView === 'composition'}
              scope={compositionScope}
              endpointNotice={compositionEndpointNotice}
              onScopeChange={setCompositionScope}
              onPinCall={pinCall}
              onUnpinCall={() => (interaction = { ...interaction, pinnedCallIndex: null })}
              onSelectItem={selectItem}
              onRevealInRiver={revealItemInRiver}
              onViewDetails={viewSelectedItemDetails}
              onFindInLifespans={findItemInLifespans}
            />
          {/key}
        </div>
      </section>

      <aside
        id="inspector"
        class="inspector-column"
        class:empty={!pinnedCall && !selectedItem}
        aria-label="Inspector"
        tabindex="-1"
      >
        <Inspector
          {indexed}
          {pinnedCall}
          {selectedItem}
          {callSections}
          {itemSections}
          pinnedCallIndex={interaction.pinnedCallIndex}
          hoveredCallIndex={interaction.hoveredCallIndex}
          hasCalls={callIndices.length > 0}
          onClosePinnedCall={() => (interaction = { ...interaction, pinnedCallIndex: null })}
          onCloseItem={() => selectItem(null)}
          onSelectItem={selectItem}
          onPinCall={pinCall}
          onInspectCall={inspectCall}
          onRevealInRiver={revealItemInRiver}
        />
      </aside>

      <section class="panel lifespan-panel">
        {#key $sessionController.selectedSessionId}
          <ContextLifespans
            {indexed}
            selectedItemId={interaction.selectedItemId}
            pinnedCallIndex={interaction.pinnedCallIndex}
            onSelectItem={selectLifespanItem}
            onHoverItem={hoverItem}
            findRequest={findInLifespansRequest}
          />
        {/key}
      </section>
    </div>
  {/if}
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(html) {
    color-scheme: dark;
  }
  :global(body) {
    margin: 0;
    background: var(--page);
    color: var(--text);
    font:
      14px/1.45 Inter,
      ui-sans-serif,
      system-ui,
      sans-serif;
  }
  :global(button),
  :global(select) {
    background: var(--surface);
    border: 1px solid var(--control-border);
    color: var(--text);
    border-radius: 7px;
    padding: 7px 9px;
  }
  :global(button) {
    cursor: pointer;
  }
  :global(button:hover) {
    background: #1a2541;
  }
  :global(button:focus-visible),
  :global(select:focus-visible) {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  main {
    max-width: 1500px;
    min-width: 0;
    margin: 0 auto;
    padding: 26px;
  }
  .titlebar {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 24px;
    min-width: 0;
  }
  .titlebar > * {
    min-width: 0;
    max-width: 100%;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: -0.03em;
  }
  .titlebar p {
    color: #96a2b8;
    margin: 4px 0 0;
  }
  .live-status {
    max-width: 640px;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .panel {
    background: var(--surface);
    border: 0;
    border-radius: var(--radius);
    padding: 15px;
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
    font-size: 15px;
    margin: 0;
  }
  .view-link-fallback {
    display: block;
  }
  .view-link-fallback input {
    display: block;
    box-sizing: border-box;
    width: min(100%, 64rem);
  }
  .panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mobile-view-details {
    display: none;
    padding: 7px 9px;
    border: 1px solid #34415f;
    border-radius: 7px;
    background: #151e35;
    color: #e2e8f3;
    text-decoration: none;
    white-space: nowrap;
  }
  .mobile-view-details:hover {
    background: #1a2541;
  }
  .mobile-view-details:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  #inspector {
    scroll-margin-top: 16px;
  }
  :global(.selected-item-summary) {
    scroll-margin: 16px;
  }
  .exploration-grid {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-items: start;
    gap: 14px;
    margin-top: 14px;
  }
  .exploration-grid.occupied {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .inspector-column.empty {
    grid-column: 1;
    grid-row: 2;
    position: static;
    max-height: none;
    overflow: visible;
  }
  .exploration-grid:not(.occupied) .lifespan-panel {
    grid-row: 3;
  }
  .river-panel {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    margin-top: 0;
  }
  .visualization-tabs {
    display: flex;
    gap: 6px;
    margin: 0 0 10px;
    border-bottom: 1px solid #293651;
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
    border: 1px solid #293651;
    border-radius: 8px;
    background: #0b1223;
  }
  .no-model-calls h3 {
    margin: 0;
    color: #f4f6fb;
    font-size: 14px;
  }
  .no-model-calls p {
    margin: 4px 0 0;
    color: #aebbd0;
    font-size: 12px;
  }
  .inspector-column {
    display: grid;
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: start;
    gap: 14px;
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    max-height: calc(100dvh - 32px);
    min-width: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-color: #506385 #10172a;
    scrollbar-width: thin;
  }
  .lifespan-panel {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    margin-top: 0;
  }
  .chart-area {
    position: relative;
    min-width: 0;
  }
  .river-pending {
    min-height: 360px;
    margin: 0;
    padding: 24px;
    color: #bdc7d8;
  }
  .selection-location-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: #bdc7d8;
    font-size: 12px;
  }
  .item-hover-position {
    position: fixed;
    z-index: 5;
    pointer-events: none;
  }
  .state {
    margin-top: 24px;
    padding: 24px;
    border-radius: 12px;
    background: #11182c;
    border: 1px solid #26324f;
  }
  .state h2 {
    font-size: 18px;
  }
  .state.error {
    border-color: #7d493f;
    color: #ffc3b3;
  }
  .refresh-warning {
    margin-top: 14px;
    padding: 10px 14px;
    border: 1px solid #7d6840;
    border-radius: 8px;
    background: #2a2415;
    color: #f2d28b;
  }
  code {
    color: #a8bce0;
  }
  @media (max-width: 1050px) {
    .mobile-view-details {
      display: inline-flex;
      align-items: center;
    }
    .exploration-grid,
    .exploration-grid.occupied {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
    }
    .river-panel,
    .inspector-column,
    .lifespan-panel {
      grid-column: 1;
      grid-row: auto;
    }
    .inspector-column {
      position: static;
      max-height: none;
      overflow: visible;
    }
  }
  @media (max-width: 850px) {
    main {
      padding: 16px;
    }
    .titlebar {
      flex-direction: column;
    }
    .item-hover-position {
      display: none;
    }
  }
</style>
