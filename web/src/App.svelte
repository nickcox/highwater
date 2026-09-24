<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import type { SessionListItem } from './lib/api/client';
  import CallDetails from './lib/components/CallDetails.svelte';
  import ContextRiverNavigation from './lib/components/ContextRiverNavigation.svelte';
  import ContextLifespans from './lib/components/ContextLifespans.svelte';
  import ItemDetails from './lib/components/ItemDetails.svelte';
  import ItemHoverCard from './lib/components/ItemHoverCard.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import SessionSummary from './lib/components/SessionSummary.svelte';
  import ContextRiver from './lib/context-river/ContextRiver.svelte';
  import {
    escapeInteraction,
    reconcileInteraction,
    resetInteraction,
  } from './lib/state/interaction';
  import type { IndexedAnalysis, InteractionState } from './lib/types';
  import { chartUnitLabel } from './lib/context-river/format';
  import type { RiverNavigationCommand, RiverViewportStatus } from './lib/context-river/viewport';
  import {
    createSessionController,
    type SessionControllerSnapshot,
  } from './lib/state/session-controller';

  let interaction: InteractionState = resetInteraction();
  let navigationCommand: RiverNavigationCommand | null = null;
  let navigationCommandId = 0;
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
  let hoverCardHost: HTMLDivElement | null = null;
  let hoverCardPosition: { left: number; top: number } | null = null;

  const sessionController = createSessionController({
    onAnalysisAccepted: ({ kind, previous, next }) => {
      if (kind === 'replacement' && previous) {
        interaction = reconcileInteraction(interaction, previous, next);
      }
    },
    onSelectionChanged: () => {
      interaction = resetInteraction();
      navigationCommand = null;
      resetViewportStatus();
    },
  });
  let sessionState: SessionControllerSnapshot = get(sessionController);
  let sessions: SessionListItem[] = [];
  let selectedSessionId: string | null = null;
  let indexed: IndexedAnalysis | null = null;
  let loading = true;
  let sessionListError = '';
  let analysisError = '';
  let catalogueWarning = '';
  let analysisWarning = '';
  let selectedRemoved = false;
  let liveStatus: SessionControllerSnapshot['liveStatus'] = 'reconnecting';

  $: sessionState = $sessionController;
  $: sessions = sessionState.sessions;
  $: selectedSessionId = sessionState.selectedSessionId;
  $: indexed = sessionState.indexed;
  $: loading = sessionState.loading;
  $: sessionListError = sessionState.sessionListError;
  $: analysisError = sessionState.analysisError;
  $: catalogueWarning = sessionState.catalogueWarning;
  $: analysisWarning = sessionState.analysisWarning;
  $: selectedRemoved = sessionState.selectedRemoved;
  $: liveStatus = sessionState.liveStatus;
  $: pinnedCall =
    interaction.pinnedCallIndex === null
      ? null
      : (indexed?.callByIndex.get(interaction.pinnedCallIndex) ?? null);
  $: selectedItem = interaction.selectedItemId
    ? (indexed?.itemById.get(interaction.selectedItemId) ?? null)
    : null;
  $: hoveredItem = interaction.hoveredItemId
    ? (indexed?.itemById.get(interaction.hoveredItemId) ?? null)
    : null;
  $: callIndices = indexed?.analysis.modelCalls.map((call) => call.index) ?? [];
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
  }

  function updateViewport(status: RiverViewportStatus): void {
    viewportStatus = status;
  }

  function navigate(kind: 'fit' | 'zoom-in' | 'zoom-out' | 'latest'): void {
    navigationCommand = { id: ++navigationCommandId, kind };
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

  function selectItem(id: string): void {
    interaction = { ...interaction, selectedItemId: id };
  }

  function emptyClick(index: number): void {
    interaction = { ...interaction, selectedItemId: null, pinnedCallIndex: index };
  }

  function handleEscape(): void {
    if (interaction.selectedItemId !== null || interaction.pinnedCallIndex !== null) {
      interaction = escapeInteraction(interaction);
    } else if (!viewportStatus.isFitAll) {
      navigate('fit');
    }
  }

  function handleWindowKey(event: KeyboardEvent): void {
    if (
      event.key === 'Escape' &&
      (interaction.selectedItemId !== null ||
        interaction.pinnedCallIndex !== null ||
        !viewportStatus.isFitAll)
    ) {
      event.preventDefault();
      handleEscape();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKey} onresize={placeHoverCard} />

<main>
  <header class="titlebar">
    <div>
      <h1>TokenPlume</h1>
      <p>Follow persistent context through model calls and explicit compaction boundaries.</p>
      <p class="live-status" data-testid="live-status">Live updates: {liveStatus}</p>
    </div>
    {#if sessions.length > 0}<SessionPicker
        {sessions}
        selectedId={selectedSessionId}
        onSelect={selectSession}
      />{/if}
  </header>

  {#if catalogueWarning || analysisWarning}
    <section class="refresh-warning" role="status" aria-label="Refresh warnings">
      {#if catalogueWarning}<p>{catalogueWarning}</p>{/if}
      {#if analysisWarning}<p>{analysisWarning}</p>{/if}
    </section>
  {/if}
  {#if sessionListError}
    <section class="state error">
      <h2>Could not discover sessions</h2>
      <p>{sessionListError}</p>
    </section>
  {:else if sessions.length === 0 && !loading}
    {#if selectedRemoved}
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
  {:else if selectedRemoved}
    <section class="state">
      <h2>Selected session is no longer available</h2>
      <p>Choose another session from the refreshed list.</p>
    </section>
  {:else if loading}
    <section class="state"><p>Analysing session…</p></section>
  {:else if analysisError}
    <section class="state error">
      <h2>Could not render this session</h2>
      <p>{analysisError}</p>
      <p>Select another session above.</p>
    </section>
  {:else if indexed}
    <SessionSummary {indexed} />

    <div class="exploration-grid">
      {#if indexed.analysis.modelCalls.length > 0}
        <section class="panel river-panel">
          <div class="panel-head">
            <div>
              <h2>Context River · {chartUnitLabel(indexed.analysis.displayWeightUnit)}</h2>
              <p>
                {indexed.analysis.displayWeightUnit === 'unavailable'
                  ? 'Token geometry is unavailable; item regions are shown as structural placeholders.'
                  : indexed.analysis.tokenAnalysis.fallbackReason
                    ? `Some token estimates are best-effort: ${indexed.analysis.tokenAnalysis.fallbackReason}.`
                    : 'Ribbon thickness uses calculated item tokens under each call’s model profile. Provider-reported totals remain separate.'}
              </p>
            </div>
            <div class="panel-actions">
              <a class="mobile-view-details" href="#inspector">View details</a>
              <button
                type="button"
                aria-label="Clear selected item and pinned call"
                title="Clears the selected item and pinned call"
                onclick={() => (interaction = resetInteraction())}>Clear selection</button
              >
            </div>
          </div>
          <ContextRiverNavigation
            viewport={viewportStatus}
            {callIndices}
            onJumpToCall={jumpToCall}
            onZoomToRange={zoomToRange}
            onLatest={jumpToLatest}
            onFitAll={() => navigate('fit')}
            onZoomIn={() => navigate('zoom-in')}
            onZoomOut={() => navigate('zoom-out')}
          />
          <div class="chart-area">
            {#key selectedSessionId}
              <ContextRiver
                {indexed}
                {interaction}
                selectedItemId={interaction.selectedItemId}
                hoveredItemId={interaction.hoveredItemId}
                {navigationCommand}
                onViewportChange={updateViewport}
                onHoverCall={hoverCall}
                onPinCall={pinCall}
                onHoverItem={hoverItem}
                onSelectItem={selectItem}
                onEmptyClick={emptyClick}
                onEscape={handleEscape}
              />
            {/key}
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
        </section>
      {:else}
        <section class="panel no-model-calls">
          <div class="panel-head">
            <div>
              <h2>No model calls</h2>
              <p>This session has no completed assistant model responses on its current branch.</p>
              <p>
                Terminal compaction summaries, if present, remain available in Context lifespans.
              </p>
            </div>
            <a class="mobile-view-details" href="#inspector">View details</a>
          </div>
        </section>
      {/if}

      <aside id="inspector" class="inspector-column" aria-label="Inspector" tabindex="-1">
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Model call</h2>
              <p>
                {pinnedCall
                  ? 'Pinned details persist while you hover'
                  : callIndices.length > 0
                    ? 'Click chart space or a call target to pin details'
                    : 'No completed model calls in this session'}
              </p>
            </div>
          </div>
          {#if pinnedCall}
            <CallDetails
              call={pinnedCall}
              {indexed}
              pinned
              onSelectItem={selectItem}
              onClose={() => (interaction = { ...interaction, pinnedCallIndex: null })}
            />
          {:else if callIndices.length > 0}<p class="muted">No call pinned.</p>
          {:else}<p class="muted">No call details are available.</p>{/if}
        </section>
        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>Context item</h2>
              <p>
                {interaction.selectedItemId
                  ? 'Selected item'
                  : 'Click a ribbon or lifespan item to select'}
              </p>
            </div>
          </div>
          <ItemDetails
            item={selectedItem}
            {indexed}
            callIndex={interaction.pinnedCallIndex ?? interaction.hoveredCallIndex}
            onSelectItem={selectItem}
          />
        </section>
      </aside>

      <section class="panel lifespan-panel">
        {#key selectedSessionId}
          <ContextLifespans
            {indexed}
            {interaction}
            selectedItemId={interaction.selectedItemId}
            onSelectItem={selectItem}
            onHoverItem={hoverItem}
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
    background: radial-gradient(circle at 20% -10%, #19264a 0, #0b1020 38%), #0b1020;
    color: #e8ecf5;
    font:
      14px/1.45 Inter,
      ui-sans-serif,
      system-ui,
      sans-serif;
  }
  :global(button),
  :global(select) {
    background: #151e35;
    border: 1px solid #34415f;
    color: #e2e8f3;
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
    margin: 0 auto;
    padding: 26px;
  }
  .titlebar {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 24px;
  }
  h1 {
    margin: 0;
    font-size: 28px;
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
    background: linear-gradient(180deg, #121a30, #0f1629);
    border: 1px solid #26324f;
    border-radius: 13px;
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
  .exploration-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, min(36vw, 420px));
    grid-template-rows: auto auto;
    align-items: start;
    gap: 14px;
    margin-top: 14px;
  }
  .river-panel,
  .no-model-calls {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    margin-top: 0;
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
  .lifespan-panel {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    margin-top: 0;
  }
  .chart-area {
    position: relative;
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
    .exploration-grid {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
    }
    .river-panel,
    .no-model-calls,
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
