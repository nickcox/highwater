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
  import CallDetails from './lib/components/CallDetails.svelte';
  import CallComposition from './lib/components/CallComposition.svelte';
  import ContextRiverNavigation from './lib/components/ContextRiverNavigation.svelte';
  import ContextLifespans from './lib/components/ContextLifespans.svelte';
  import ItemDetails from './lib/components/ItemDetails.svelte';
  import ItemHoverCard from './lib/components/ItemHoverCard.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import SessionSummary from './lib/components/SessionSummary.svelte';
  import ContextRiver from './lib/context-river/ContextRiver.svelte';
  import ChartHelp from './lib/components/ChartHelp.svelte';
  import {
    escapeInteraction,
    reconcileInteraction,
    resetInteraction,
  } from './lib/state/interaction';
  import type { IndexedAnalysis, InteractionState } from './lib/types';
  import { estimateQuality } from './lib/estimate-quality';
  import type { RiverNavigationCommand, RiverViewportStatus } from './lib/context-river/viewport';
  import { stepCallTarget } from './lib/context-river/viewport';
  import { createSessionController } from './lib/state/session-controller';

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
    onAnalysisAccepted: ({ kind, previous, next }) => {
      if (kind === 'replacement' && previous) {
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
    },
  });
  // Analysis identity is an explicit reactive boundary: request/status publications
  // must not invalidate geometry and projections when the analysis is unchanged.
  let indexed: IndexedAnalysis | null = null;
  $: if (indexed !== $sessionController.indexed) indexed = $sessionController.indexed;
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

  onMount(() => {
    sessionController.start();
    return () => sessionController.dispose();
  });

  function selectSession(sessionId: string): void {
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
    viewportStatus = status;
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
    navigationCommand = { id: ++navigationCommandId, kind };
  }

  function stepToCall(callIndex: number): void {
    pinCall(callIndex);
    navigationCommand = { id: ++navigationCommandId, kind: 'ensure-call', callIndex };
  }

  function jumpToCall(callIndex: number): void {
    navigationCommand = { id: ++navigationCommandId, kind: 'call', callIndex };
  }

  function zoomToRange(startCallIndex: number, endCallIndex: number): void {
    navigationCommand = { id: ++navigationCommandId, kind: 'range', startCallIndex, endCallIndex };
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
    interaction = { ...interaction, selectedItemId: null, pinnedCallIndex: index };
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
      <p class="live-status" data-testid="live-status">
        Live updates: {$sessionController.liveStatus}
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
                onLatest={jumpToLatest}
                onFitAll={() => navigate('fit')}
                onZoomIn={() => navigate('zoom-in')}
                onZoomOut={() => navigate('zoom-out')}
              />
            {/key}
            <div class="chart-area">
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
                  onJumpToCall={jumpToCall}
                  onZoomToRange={zoomToRange}
                  isVisible={visualizationView === 'river'}
                  onViewportChange={updateViewport}
                  onSelectionVisibility={updateSelectionVisibility}
                  onHoverCall={hoverCall}
                  onPinCall={pinCall}
                  onHoverItem={hoverItem}
                  onSelectItem={selectItem}
                  onEmptyClick={emptyClick}
                  onEscape={handleEscape}
                />
              {/key}
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
        {#if !pinnedCall && !selectedItem}
          <section class="panel inspector-empty-prompt">
            <div class="panel-head"><div><h2>Inspect workspace details</h2></div></div>
            <p class="muted">Select a call to inspect usage.</p>
            <p class="muted">Select an item to inspect its context.</p>
          </section>
        {:else}
          {#if pinnedCall}
            <section class="panel">
              <div class="panel-head">
                <div><h2>Model call</h2></div>
              </div>
              <CallDetails
                sections={callSections}
                call={pinnedCall}
                {indexed}
                pinned
                onSelectItem={selectItem}
                onClose={() => (interaction = { ...interaction, pinnedCallIndex: null })}
                onPinCall={pinCall}
              />
            </section>
          {/if}
          {#if selectedItem}
            <section class="panel">
              <div class="panel-head">
                <div>
                  <h2>Context item</h2>
                  <p>Selected item</p>
                </div>
              </div>
              <ItemDetails
                item={selectedItem}
                sections={itemSections}
                onClear={() => selectItem(null)}
                onInspectCall={inspectCall}
                {indexed}
                callIndex={interaction.pinnedCallIndex ?? interaction.hoveredCallIndex}
                pinnedCallIndex={interaction.pinnedCallIndex}
                onSelectItem={selectItem}
                onRevealInRiver={revealItemInRiver}
              />
            </section>
          {/if}
          {#if !pinnedCall}
            <p class="inspector-secondary-prompt muted">
              {callIndices.length > 0
                ? 'Select a call to inspect usage.'
                : 'No call usage is available in this session.'}
            </p>
          {/if}
          {#if !selectedItem}
            <p class="inspector-secondary-prompt muted">Select an item to inspect its context.</p>
          {/if}
        {/if}
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
  }
  h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: -0.03em;
  }
  .titlebar p,
  .panel-head p {
    color: #96a2b8;
    margin: 4px 0 0;
  }
  .live-status {
    font-size: 12px;
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
  .panel-head p {
    font-size: 12px;
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
  .inspector-empty-prompt {
    padding: 0;
  }
  .inspector-empty-prompt .panel-head {
    display: none;
  }
  .inspector-empty-prompt p {
    display: inline;
    margin: 0 12px 0 0;
    font-size: 12px;
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
  .inspector-column > .panel {
    min-width: 0;
    margin-top: 0;
  }
  .inspector-secondary-prompt {
    margin: 0;
    padding: 9px 11px;
    border: 1px solid #293651;
    border-radius: 8px;
    background: #10172a;
    font-size: 12px;
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
  .muted {
    color: #8f9cb2;
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
