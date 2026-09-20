<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchAnalysis, fetchSessions, type SessionListItem } from './lib/api/client';
  import { AnalysisValidationError, indexAnalysis } from './lib/analysis';
  import CallDetails from './lib/components/CallDetails.svelte';
  import ContextLifespans from './lib/components/ContextLifespans.svelte';
  import ItemDetails from './lib/components/ItemDetails.svelte';
  import ItemHoverCard from './lib/components/ItemHoverCard.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import SessionSummary from './lib/components/SessionSummary.svelte';
  import ContextRiver from './lib/context-river/ContextRiver.svelte';
  import { escapeInteraction, resetInteraction } from './lib/state/interaction';
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
  let activeRequest: AbortController | null = null;
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

  onMount(async () => {
    try {
      sessions = await fetchSessions();
      if (sessions.length > 0) await loadSession(sessions[0].id);
      else loading = false;
    } catch (error) {
      sessionListError = error instanceof Error ? error.message : String(error);
      loading = false;
    }
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

  async function loadSession(id: string): Promise<void> {
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    selectedSessionId = id;
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

  function hoverCall(index: number | null): void {
    if (interaction.hoveredCallIndex !== index) interaction = { ...interaction, hoveredCallIndex: index };
  }

  function pinCall(index: number): void {
    interaction = { ...interaction, pinnedCallIndex: index };
  }

  function hoverItem(id: string | null): void {
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
    <div><h1>TokenPlume</h1><p>Follow persistent context through model calls and explicit compaction boundaries.</p></div>
    {#if sessions.length > 0}<SessionPicker {sessions} selectedId={selectedSessionId} onSelect={loadSession} />{/if}
  </header>

  {#if sessionListError}
    <section class="state error"><h2>Could not discover sessions</h2><p>{sessionListError}</p></section>
  {:else if sessions.length === 0 && !loading}
    <section class="state"><h2>No sessions discovered</h2><p>Point TokenPlume at a session directory with <code>--session-root</code>.</p></section>
  {:else if loading}
    <section class="state"><p>Analysing session…</p></section>
  {:else if analysisError}
    <section class="state error"><h2>Could not render this session</h2><p>{analysisError}</p><p>Select another session above.</p></section>
  {:else if indexed && indexed.analysis.modelCalls.length === 0}
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
          <div class="item-hover-position"><ItemHoverCard item={hoveredItem} {indexed} /></div>
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
  .panel { background: linear-gradient(180deg,#121a30,#0f1629); border: 1px solid #26324f; border-radius: 13px; padding: 15px; margin-top: 14px; min-width: 0; }
  .panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 10px; }
  h2 { font-size: 15px; margin: 0; }
  .panel-head p { font-size: 12px; }
  .chart-area { position: relative; }
  .item-hover-position { position: absolute; z-index: 5; top: 8px; right: 12px; pointer-events: none; }
  .details-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; }
  .state { margin-top: 24px; padding: 24px; border-radius: 12px; background: #11182c; border: 1px solid #26324f; }
  .state h2 { font-size: 18px; }
  .state.error { border-color: #7d493f; color: #ffc3b3; }
  .refresh-warning { margin-top: 14px; padding: 10px 14px; border: 1px solid #7d6840; border-radius: 8px; background: #2a2415; color: #f2d28b; }
  .muted { color: #8f9cb2; }
  code { color: #a8bce0; }
  @media(max-width: 850px) { main { padding: 16px; } .titlebar { flex-direction: column; } .details-grid { grid-template-columns: 1fr; } .item-hover-position { display: none; } }
</style>
