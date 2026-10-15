<script lang="ts">
  import CallDetails from './CallDetails.svelte';
  import ItemDetails from './ItemDetails.svelte';
  import type { ContextItem, IndexedAnalysis, ModelCall } from '../types';
  import type { inspectorSections } from '../state/inspector-sections';

  let {
    indexed,
    pinnedCall,
    selectedItem,
    callSections,
    itemSections,
    pinnedCallIndex,
    hoveredCallIndex,
    hasCalls,
    onClosePinnedCall,
    onCloseItem,
    onSelectItem,
    onPinCall,
    onInspectCall,
    onRevealInRiver,
  }: {
    indexed: IndexedAnalysis;
    pinnedCall: ModelCall | null;
    selectedItem: ContextItem | null;
    callSections: ReturnType<typeof inspectorSections>;
    itemSections: ReturnType<typeof inspectorSections>;
    pinnedCallIndex: number | null;
    hoveredCallIndex: number | null;
    hasCalls: boolean;
    onClosePinnedCall: () => void;
    onCloseItem: () => void;
    onSelectItem: (id: string | null) => void;
    onPinCall: (index: number) => void;
    onInspectCall: (index: number) => void;
    onRevealInRiver: (itemId: string) => void;
  } = $props();
</script>

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
        <button
          type="button"
          class="panel-close"
          aria-label="Close pinned call"
          onclick={onClosePinnedCall}>×</button
        >
      </div>
      <CallDetails
        sections={callSections}
        call={pinnedCall}
        {indexed}
        pinned
        {onSelectItem}
        {onPinCall}
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
        <button
          type="button"
          class="panel-close"
          aria-label="Close context item"
          onclick={onCloseItem}>×</button
        >
      </div>
      <ItemDetails
        item={selectedItem}
        sections={itemSections}
        {onInspectCall}
        {indexed}
        callIndex={pinnedCallIndex ?? hoveredCallIndex}
        {pinnedCallIndex}
        {onSelectItem}
        {onRevealInRiver}
      />
    </section>
  {/if}
  {#if !pinnedCall}
    <p class="inspector-secondary-prompt muted">
      {hasCalls ? 'Select a call to inspect usage.' : 'No call usage is available in this session.'}
    </p>
  {/if}
  {#if !selectedItem}
    <p class="inspector-secondary-prompt muted">Select an item to inspect its context.</p>
  {/if}
{/if}

<style>
  .panel {
    background: var(--surface);
    border: 0;
    border-radius: var(--radius);
    padding: 15px;
    margin-top: 0;
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
  .panel-head p {
    color: var(--secondary);
    margin: 4px 0 0;
    font-size: var(--text-sm);
  }
  h2 {
    font-size: var(--text-lg);
    margin: 0;
  }
  .inspector-empty-prompt {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 0;
    padding: 0;
    background: transparent;
  }
  .inspector-empty-prompt .panel-head {
    display: none;
  }
  .inspector-empty-prompt p {
    margin: 0;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .inspector-empty-prompt p + p::before {
    content: '·';
    margin: 0 10px;
  }
  .panel-close {
    flex-shrink: 0;
    align-self: flex-start;
    font-size: 18px;
    padding: 1px 7px;
  }
  .inspector-secondary-prompt {
    margin: 0;
    padding: 9px 11px;
    border: 1px solid var(--separator);
    border-radius: var(--radius);
    background: var(--plot);
    font-size: var(--text-sm);
  }
  .muted {
    color: var(--secondary);
  }
</style>
