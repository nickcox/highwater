<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ApiError,
    fetchAnalysis,
    fetchSessions,
    type LiveAvailability,
    type SessionListItem,
  } from './lib/api/client';
  import {
    connectEvents,
    type AvailabilityUpdate,
    type CatalogueInvalidation,
  } from './lib/api/events';
  import { AnalysisValidationError, indexAnalysis } from './lib/analysis';
  import CallDetails from './lib/components/CallDetails.svelte';
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

  let sessions: SessionListItem[] = [];
  let selectedSessionId: string | null = null;
  let indexed: IndexedAnalysis | null = null;
  let interaction: InteractionState = resetInteraction();
  let loading = true;
  let sessionListError = '';
  let analysisError = '';
  let refreshWarning = '';
  let selectedRemoved = false;

  let catalogueGeneration: string | null = null;
  let appliedRevision: bigint | null = null;
  let latestObservedRevision: bigint | null = null;
  let listEtag: string | null = null;
  let listInitialized = false;
  let reconciliationEpoch = 0;
  let listRequest: { controller: AbortController; epoch: number } | null = null;
  let listDirty = false;
  let listForce = false;
  let listReconnect = false;

  let activeRequest: AbortController | null = null;
  let refreshRequest: AbortController | null = null;
  let refreshDirty = false;
  let hoveredItemPoint: { x: number; y: number } | null = null;
  let hoveredItemPlacement: { horizontal: 'left' | 'right'; vertical: 'above' | 'below' } = {
    horizontal: 'right',
    vertical: 'below',
  };
  let transportState: 'connecting' | 'open' | 'reconnecting' | 'closed' = 'connecting';
  let reportedAvailability: LiveAvailability | null = null;

  const indexedCache = new Map<string, { etag: string | null; indexed: IndexedAnalysis }>();
  const INDEXED_CACHE_CAPACITY = 3;

  $: pinnedCall = interaction.pinnedCallIndex === null
    ? null
    : indexed?.callByIndex.get(interaction.pinnedCallIndex) ?? null;
  $: selectedItem = interaction.selectedItemId
    ? indexed?.itemById.get(interaction.selectedItemId) ?? null
    : null;
  $: hoveredItem = interaction.hoveredItemId
    ? indexed?.itemById.get(interaction.hoveredItemId) ?? null
    : null;
  $: liveStatus = transportState === 'open' && reportedAvailability === 'active'
    ? 'live'
    : transportState === 'connecting' || transportState === 'reconnecting'
      ? 'reconnecting'
      : 'live updates unavailable';

  onMount(() => {
    let stopEvents = () => {};
    try {
      stopEvents = connectEvents({
        onOpen: () => {
          transportState = 'open';
          reportedAvailability = null;
          void reconcileSessions(false, true);
        },
        onReconnecting: () => {
          transportState = 'reconnecting';
          reportedAvailability = null;
        },
        onClosed: () => {
          transportState = 'closed';
          reportedAvailability = null;
        },
        onCatalogue: handleCatalogueInvalidation,
        onAvailability: handleAvailabilityUpdate,
        onWarning: () => {
          // Malformed advisory events never replace authoritative HTTP state.
        },
      });
    } catch {
      transportState = 'closed';
    }
    void reconcileSessions(true);
    return stopEvents;
  });

  function cacheAnalysis(id: string, value: { etag: string | null; indexed: IndexedAnalysis }): void {
    indexedCache.delete(id);
    indexedCache.set(id, value);
    while (indexedCache.size > INDEXED_CACHE_CAPACITY) {
      const oldest = indexedCache.keys().next().value;
      if (oldest === undefined) break;
      indexedCache.delete(oldest);
    }
  }

  function maxRevision(left: bigint | null, right: bigint | null): bigint | null {
    if (left === null) return right;
    if (right === null) return left;
    return left > right ? left : right;
  }

  function adoptGeneration(
    generation: string,
    revision: bigint | null = null,
    abortCurrentList = true,
  ): boolean {
    if (catalogueGeneration === generation) {
      latestObservedRevision = maxRevision(latestObservedRevision, revision);
      return false;
    }
    catalogueGeneration = generation;
    appliedRevision = null;
    latestObservedRevision = revision;
    listEtag = null;
    reconciliationEpoch += 1;
    activeRequest?.abort();
    refreshRequest?.abort();
    refreshDirty = false;
    if (abortCurrentList && listRequest) {
      listRequest.controller.abort();
      listDirty = true;
      listForce = true;
    }
    return true;
  }

  function requestAuthoritativeReconciliation(): void {
    if (listRequest) {
      listRequest.controller.abort();
      listDirty = true;
      listForce = true;
    }
    void reconcileSessions(true);
  }

  function handleCatalogueInvalidation(event: CatalogueInvalidation): void {
    if (catalogueGeneration !== null && event.generation !== catalogueGeneration) {
      requestAuthoritativeReconciliation();
      return;
    }
    const generationChanged = adoptGeneration(event.generation, event.revision);
    if (!generationChanged && latestObservedRevision !== null && appliedRevision !== null
      && event.revision <= appliedRevision) return;
    void reconcileSessions(generationChanged);
  }

  function handleAvailabilityUpdate(event: AvailabilityUpdate): void {
    if (catalogueGeneration !== null && event.generation !== catalogueGeneration) {
      requestAuthoritativeReconciliation();
      return;
    }
    const generationChanged = adoptGeneration(event.generation);
    reportedAvailability = event.availability;
    if (generationChanged) void reconcileSessions(true);
  }

  async function reconcileSessions(force = false, reconnect = false): Promise<void> {
    if (listRequest) {
      listDirty = true;
      listForce ||= force;
      listReconnect ||= reconnect;
      return;
    }
    const controller = new AbortController();
    const request = { controller, epoch: reconciliationEpoch };
    listRequest = request;
    const requestEtag = force ? null : listEtag;
    const requestGeneration = catalogueGeneration;
    try {
      const result = await fetchSessions(controller.signal, requestEtag);
      if (controller.signal.aborted || listRequest !== request) return;
      if (request.epoch !== reconciliationEpoch && result.generation === requestGeneration) return;

      const previousAppliedRevision = appliedRevision;
      const generationChanged = adoptGeneration(result.generation, result.revision, false);
      const revisionChanged = generationChanged
        || previousAppliedRevision === null
        || result.revision > previousAppliedRevision;
      const sameGeneration = catalogueGeneration === result.generation;
      if (!sameGeneration) return;
      const observedRevision = latestObservedRevision;
      if (!generationChanged && observedRevision !== null && result.revision < observedRevision) {
        listDirty = true;
        return;
      }
      if (!generationChanged && appliedRevision !== null && result.revision < appliedRevision) {
        listDirty = true;
        return;
      }

      if (result.status === 'notModified') {
        if (!listInitialized || !listEtag || result.etag !== listEtag) {
          throw new ApiError('Server returned not modified without the matching catalogue', 304, 'INVALID_CATALOG_HEADERS');
        }
      } else {
        if (!result.sessions) throw new ApiError('Server returned an empty catalogue body', 200, 'INVALID_CATALOG_BODY');
        sessions = result.sessions;
        listInitialized = true;
      }
      listEtag = result.etag;
      appliedRevision = result.revision;
      latestObservedRevision = maxRevision(latestObservedRevision, result.revision);
      sessionListError = '';
      if (sessions.length === 0) {
        if (selectedSessionId !== null) removeSelectedSession();
        loading = false;
      } else if (selectedSessionId === null) {
        loading = true;
        void loadSession(sessions[0].id);
      } else if (!sessions.some((session) => session.id === selectedSessionId)) {
        removeSelectedSession();
      } else {
        selectedRemoved = false;
        if (revisionChanged || reconnect) {
          void refreshSelectedAnalysis();
        }
      }
    } catch (error) {
      if (controller.signal.aborted || listRequest !== request) return;
      const message = error instanceof Error ? error.message : String(error);
      if (!listInitialized) {
        sessionListError = message;
        loading = false;
      } else {
        refreshWarning = `Session list refresh failed; showing previous state. ${message}`;
      }
    } finally {
      if (listRequest === request) listRequest = null;
      if (listDirty) {
        const nextForce = listForce;
        const nextReconnect = listReconnect;
        listDirty = false;
        listForce = false;
        listReconnect = false;
        void reconcileSessions(nextForce, nextReconnect);
      }
    }
  }

  function removeSelectedSession(): void {
    activeRequest?.abort();
    refreshRequest?.abort();
    refreshDirty = false;
    activeRequest = null;
    refreshRequest = null;
    selectedSessionId = null;
    indexed = null;
    interaction = resetInteraction();
    selectedRemoved = true;
    analysisError = '';
    loading = false;
  }

  async function loadSession(id: string): Promise<void> {
    activeRequest?.abort();
    refreshRequest?.abort();
    refreshDirty = false;
    activeRequest = null;
    refreshRequest = null;
    const request = new AbortController();
    activeRequest = request;
    selectedSessionId = id;
    selectedRemoved = false;
    analysisError = '';
    refreshWarning = '';
    interaction = resetInteraction();
    const cached = indexedCache.get(id);
    if (cached) {
      cacheAnalysis(id, cached);
      indexed = cached.indexed;
      loading = false;
    } else {
      indexed = null;
      loading = true;
    }
    try {
      const result = await fetchAnalysis(id, request.signal, cached?.etag);
      if (request.signal.aborted || activeRequest !== request || selectedSessionId !== id) return;
      if (result.status === 'notModified') {
        if (!cached) throw new Error('Server returned not modified without a cached analysis');
        cacheAnalysis(id, { ...cached, etag: result.etag ?? cached.etag });
        refreshWarning = '';
        return;
      }
      const next = indexAnalysis(result.analysis);
      if (request.signal.aborted || activeRequest !== request || selectedSessionId !== id) return;
      indexed = next;
      cacheAnalysis(id, { etag: result.etag, indexed: next });
      refreshWarning = '';
    } catch (error) {
      if (request.signal.aborted || activeRequest !== request || selectedSessionId !== id) return;
      const message = error instanceof AnalysisValidationError
        ? `Analysis is inconsistent: ${error.message}`
        : error instanceof Error ? error.message : String(error);
      if (cached) refreshWarning = `Refresh failed; showing cached analysis. ${message}`;
      else analysisError = message;
    } finally {
      if (!request.signal.aborted && activeRequest === request && selectedSessionId === id) {
        loading = false;
        activeRequest = null;
      }
    }
  }

  async function refreshSelectedAnalysis(): Promise<void> {
    const id = selectedSessionId;
    const previous = indexed;
    if (!id || !previous) return;
    if (refreshRequest) {
      refreshDirty = true;
      return;
    }
    const request = new AbortController();
    refreshRequest = request;
    const cached = indexedCache.get(id);
    try {
      const result = await fetchAnalysis(id, request.signal, cached?.etag ?? null);
      if (request.signal.aborted || refreshRequest !== request || selectedSessionId !== id || indexed !== previous) return;
      if (result.status === 'notModified') {
        if (!cached) throw new Error('Server returned not modified without a cached analysis');
        cacheAnalysis(id, { ...cached, etag: result.etag ?? cached.etag });
        refreshWarning = '';
      } else {
        const next = indexAnalysis(result.analysis);
        if (request.signal.aborted || refreshRequest !== request || selectedSessionId !== id) return;
        interaction = reconcileInteraction(interaction, previous, next);
        indexed = next;
        cacheAnalysis(id, { etag: result.etag, indexed: next });
        refreshWarning = '';
      }
    } catch (error) {
      if (request.signal.aborted || refreshRequest !== request || selectedSessionId !== id) return;
      const message = error instanceof AnalysisValidationError
        ? `Analysis is inconsistent: ${error.message}`
        : error instanceof ApiError && error.code === 'SESSION_SOURCE_CHANGED'
          ? 'Update not yet readable; showing previous analysis.'
          : error instanceof Error ? error.message : String(error);
      refreshWarning = `Refresh failed; showing cached analysis. ${message}`;
    } finally {
      if (refreshRequest === request) refreshRequest = null;
      if (refreshDirty && selectedSessionId === id && indexed !== null) {
        refreshDirty = false;
        void refreshSelectedAnalysis();
      }
    }
  }

  function hoverCall(index: number | null): void {
    if (interaction.hoveredCallIndex !== index) interaction = { ...interaction, hoveredCallIndex: index };
  }

  function pinCall(index: number): void {
    interaction = { ...interaction, pinnedCallIndex: index };
  }

  function hoverItem(id: string | null, event?: PointerEvent): void {
    if (id === null) {
      hoveredItemPoint = null;
    } else if (event) {
      hoveredItemPoint = { x: event.clientX, y: event.clientY };
      hoveredItemPlacement = {
        horizontal: event.clientX > window.innerWidth - 390 ? 'left' : 'right',
        vertical: event.clientY > window.innerHeight - 300 ? 'above' : 'below',
      };
    }
    if (interaction.hoveredItemId !== id) interaction = { ...interaction, hoveredItemId: id };
  }

  function selectItem(id: string): void {
    interaction = { ...interaction, selectedItemId: id };
  }

  function emptyClick(index: number): void {
    interaction = { ...interaction, selectedItemId: null, pinnedCallIndex: index };
  }

  function handleEscape(): void {
    interaction = escapeInteraction(interaction);
  }

  function handleWindowKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && (interaction.selectedItemId !== null || interaction.pinnedCallIndex !== null)) {
      event.preventDefault();
      handleEscape();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKey} />

<main>
  <header class="titlebar">
    <div>
      <h1>TokenPlume</h1>
      <p>Follow persistent context through model calls and explicit compaction boundaries.</p>
      <p class="live-status" data-testid="live-status">Live updates: {liveStatus}</p>
    </div>
    {#if sessions.length > 0}<SessionPicker {sessions} selectedId={selectedSessionId} onSelect={loadSession} />{/if}
  </header>

  {#if refreshWarning && !indexed}<section class="refresh-warning" role="status">{refreshWarning}</section>{/if}
  {#if sessionListError}
    <section class="state error"><h2>Could not discover sessions</h2><p>{sessionListError}</p></section>
  {:else if sessions.length === 0 && !loading}
    {#if selectedRemoved}
      <section class="state"><h2>Selected session is no longer available</h2><p>Choose another session after one appears in the session directory.</p></section>
    {:else}
      <section class="state"><h2>No sessions discovered</h2><p>Point TokenPlume at a session directory with <code>--session-root</code>.</p></section>
    {/if}
  {:else if selectedRemoved}
    <section class="state"><h2>Selected session is no longer available</h2><p>Choose another session from the refreshed list.</p></section>
  {:else if loading}
    <section class="state"><p>Analysing session…</p></section>
  {:else if analysisError}
    <section class="state error"><h2>Could not render this session</h2><p>{analysisError}</p><p>Select another session above.</p></section>
  {:else if indexed && indexed.analysis.modelCalls.length === 0}
    {#if refreshWarning}<section class="refresh-warning" role="status">{refreshWarning}</section>{/if}
    <section class="state"><h2>No model calls</h2><p>This session has no completed assistant model responses on its current branch.</p></section>
  {:else if indexed}
    {#if refreshWarning}<section class="refresh-warning" role="status">{refreshWarning}</section>{/if}
    <SessionSummary {indexed} />

    <section class="panel river-panel">
      <div class="panel-head">
        <div><h2>Context River · {chartUnitLabel(indexed.analysis.displayWeightUnit)}</h2><p>{indexed.analysis.displayWeightUnit === 'unavailable' ? 'Token geometry is unavailable; item regions are shown as structural placeholders.' : indexed.analysis.tokenAnalysis.fallbackReason ? `Some token estimates are best-effort: ${indexed.analysis.tokenAnalysis.fallbackReason}.` : 'Ribbon thickness uses calculated item tokens under each call’s model profile. Provider-reported totals remain separate.'}</p></div>
        <button type="button" onclick={() => interaction = resetInteraction()}>Reset focus</button>
      </div>
      <div class="chart-area">
        <ContextRiver
          {indexed}
          {interaction}
          onHoverCall={hoverCall}
          onPinCall={pinCall}
          onHoverItem={hoverItem}
          onSelectItem={selectItem}
          onEmptyClick={emptyClick}
          onEscape={handleEscape}
        />
        {#if hoveredItem && interaction.selectedItemId !== interaction.hoveredItemId}
          <div
            class="item-hover-position"
            class:item-hover-left={hoveredItemPlacement.horizontal === 'left'}
            class:item-hover-above={hoveredItemPlacement.vertical === 'above'}
            style={`--pointer-x: ${hoveredItemPoint?.x ?? 0}px; --pointer-y: ${hoveredItemPoint?.y ?? 0}px`}
          ><ItemHoverCard item={hoveredItem} {indexed} /></div>
        {/if}
      </div>
    </section>

    <div class="details-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>Model call</h2><p>{pinnedCall ? 'Pinned details persist while you hover' : 'Click chart space or a call target to pin details'}</p></div></div>
        {#if pinnedCall}
          <CallDetails call={pinnedCall} {indexed} pinned onSelectItem={selectItem} onClose={() => interaction = { ...interaction, pinnedCallIndex: null }} />
        {:else}<p class="muted">No call pinned.</p>{/if}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>Context item</h2><p>{interaction.selectedItemId ? 'Follow Context active' : 'Click a ribbon or lifespan segment to select'}</p></div></div>
        <ItemDetails
          item={selectedItem}
          {indexed}
          callIndex={interaction.pinnedCallIndex ?? interaction.hoveredCallIndex}
          onSelectItem={selectItem}
        />
      </section>
    </div>

    <section class="panel"><ContextLifespans {indexed} {interaction} onSelectItem={selectItem} onHoverItem={hoverItem} /></section>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; }
  :global(body) { margin: 0; background: radial-gradient(circle at 20% -10%,#19264a 0,#0b1020 38%),#0b1020; color: #e8ecf5; font: 14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; }
  :global(button), :global(select) { background: #151e35; border: 1px solid #34415f; color: #e2e8f3; border-radius: 7px; padding: 7px 9px; }
  :global(button) { cursor: pointer; }
  :global(button:hover) { background: #1a2541; }
  :global(button:focus-visible), :global(select:focus-visible) { outline: 2px solid #9fc0ff; outline-offset: 2px; }
  main { max-width: 1500px; margin: 0 auto; padding: 26px; }
  .titlebar { display: flex; justify-content: space-between; align-items: start; gap: 24px; }
  h1 { margin: 0; font-size: 28px; letter-spacing: -.03em; }
  .titlebar p, .panel-head p { color: #96a2b8; margin: 4px 0 0; }
  .live-status { font-size: 12px; }
  .panel { background: linear-gradient(180deg,#121a30,#0f1629); border: 1px solid #26324f; border-radius: 13px; padding: 15px; margin-top: 14px; min-width: 0; }
  .panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 10px; }
  h2 { font-size: 15px; margin: 0; }
  .panel-head p { font-size: 12px; }
  .chart-area { position: relative; }
  .item-hover-position {
    position: fixed;
    z-index: 5;
    left: var(--pointer-x);
    top: var(--pointer-y);
    transform: translate(14px, 14px);
    pointer-events: none;
  }
  .item-hover-position.item-hover-left { transform: translate(calc(-100% - 14px), 14px); }
  .item-hover-position.item-hover-above { transform: translate(14px, calc(-100% - 14px)); }
  .item-hover-position.item-hover-left.item-hover-above { transform: translate(calc(-100% - 14px), calc(-100% - 14px)); }
  .details-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; }
  .state { margin-top: 24px; padding: 24px; border-radius: 12px; background: #11182c; border: 1px solid #26324f; }
  .state h2 { font-size: 18px; }
  .state.error { border-color: #7d493f; color: #ffc3b3; }
  .refresh-warning { margin-top: 14px; padding: 10px 14px; border: 1px solid #7d6840; border-radius: 8px; background: #2a2415; color: #f2d28b; }
  .muted { color: #8f9cb2; }
  code { color: #a8bce0; }
  @media(max-width: 850px) { main { padding: 16px; } .titlebar { flex-direction: column; } .details-grid { grid-template-columns: 1fr; } .item-hover-position { display: none; } }
</style>
