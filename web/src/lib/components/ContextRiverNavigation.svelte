<script lang="ts">
  import { tick } from 'svelte';
  import { domRoot } from '../dom-root';
  import type { RiverViewportStatus } from '../context-river/viewport';
  import { stepCallTarget } from '../context-river/viewport';
  import RiverCallJump from './RiverCallJump.svelte';
  import CompactMenu from './CompactMenu.svelte';
  let {
    viewport,
    callIndices,
    pinnedCallIndex = null,
    onSelectCall = () => {},
    onJumpToCall = (index) => onSelectCall(index),
    onLatest,
    onFitAll,
    onZoomIn,
    onZoomOut,
    isVisible = true,
    compact = false,
  }: {
    viewport: RiverViewportStatus;
    callIndices: number[];
    pinnedCallIndex?: number | null;
    onSelectCall?: (index: number) => void;
    onJumpToCall?: (index: number) => void;
    onLatest: () => void;
    onFitAll: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    isVisible?: boolean;
    /** One row: the step buttons and range, with the other controls in a menu. */
    compact?: boolean;
  } = $props();
  let jumpMessage = $state('');
  let noCalls = $derived(callIndices.length === 0);
  let previous = $derived(
    viewport.ready ? stepCallTarget(callIndices, pinnedCallIndex, viewport, -1) : null,
  );
  let next = $derived(
    viewport.ready ? stepCallTarget(callIndices, pinnedCallIndex, viewport, 1) : null,
  );
  let previousButton: HTMLButtonElement;
  let nextButton: HTMLButtonElement;
  // A focused button that becomes disabled leaves focus on the page, where the single-letter
  // h and l shortcuts do nothing. Moving focus to the other step button keeps them working at
  // the first and last calls. The focused button is checked before the buttons update, and the
  // other one is focused after, once it is enabled.
  $effect.pre(() => {
    if (next === null && previous !== null && domRoot(nextButton).activeElement === nextButton)
      void tick().then(() => previousButton.focus());
    if (
      previous === null &&
      next !== null &&
      domRoot(previousButton).activeElement === previousButton
    )
      void tick().then(() => nextButton.focus());
  });
  let rangeText = $derived(
    noCalls
      ? 'No model calls'
      : !viewport.ready
        ? 'Measuring chart viewport…'
        : viewport.firstVisibleCallIndex === null || viewport.lastVisibleCallIndex === null
          ? `No call markers visible of ${callIndices.length}`
          : viewport.firstVisibleCallIndex === viewport.lastVisibleCallIndex
            ? `Call ${viewport.firstVisibleCallIndex} of ${callIndices.length}`
            : `Calls ${viewport.firstVisibleCallIndex}–${viewport.lastVisibleCallIndex} of ${callIndices.length}`,
  );
</script>

{#snippet previousStep()}
  <button
    type="button"
    class="step-call"
    bind:this={previousButton}
    aria-label="Previous call"
    aria-keyshortcuts="ArrowLeft h"
    title="Previous call (← / h)"
    disabled={previous === null || !isVisible}
    onclick={() => previous !== null && onSelectCall(previous)}>‹</button
  >
{/snippet}
{#snippet nextStep()}
  <button
    type="button"
    class="step-call"
    bind:this={nextButton}
    aria-label="Next call"
    aria-keyshortcuts="ArrowRight l"
    title="Next call (→ / l)"
    disabled={next === null || !isVisible}
    onclick={() => next !== null && onSelectCall(next)}>›</button
  >
{/snippet}
{#snippet secondaryControls()}
  <span class="zoom-level">Zoom {viewport.zoomFactor.toFixed(1)}×</span>
  <button
    type="button"
    aria-label="Zoom out"
    title="Zoom out"
    disabled={!viewport.ready || noCalls || !viewport.canZoomOut}
    onclick={onZoomOut}>−</button
  >
  <button
    type="button"
    aria-label="Zoom in"
    title="Zoom in"
    disabled={!viewport.ready || noCalls || !viewport.canZoomIn}
    onclick={onZoomIn}>+</button
  >
  <button
    type="button"
    aria-label="Fit all calls"
    title="Fit all calls"
    disabled={!viewport.ready || noCalls || viewport.isFitAll}
    onclick={onFitAll}>Fit all</button
  >
  <button
    type="button"
    disabled={!viewport.ready || noCalls || !viewport.hasOverflow}
    onclick={onLatest}>Latest</button
  >
  <RiverCallJump
    {callIndices}
    ready={viewport.ready && isVisible}
    {onJumpToCall}
    bind:message={jumpMessage}
    hideMessage={true}
  />
{/snippet}

<div class="viewport-navigation" class:compact role="group" aria-label="Context River navigation">
  {#if compact}
    <div class="controls" role="group" aria-label="Chart zoom and navigation">
      {@render previousStep()}
      <span class="range" aria-live="polite" data-testid="visible-call-range">{rangeText}</span>
      {@render nextStep()}
      <CompactMenu label="Zoom & jump">{@render secondaryControls()}</CompactMenu>
    </div>
  {:else}
    <div class="viewport-status">
      <span class="range" aria-live="polite" data-testid="visible-call-range">{rangeText}</span>
    </div>
    <div class="controls" role="group" aria-label="Chart zoom and navigation">
      {@render previousStep()}
      {@render nextStep()}
      {@render secondaryControls()}
    </div>
  {/if}
  {#if jumpMessage}<p class="jump-message" role="status">{jumpMessage}</p>{/if}
</div>

<style>
  .viewport-navigation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 8px 0 12px;
    min-width: 0;
  }
  .viewport-status {
    display: flex;
    align-items: center;
    min-width: 0;
    margin-inline-end: auto;
  }
  .range {
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .jump-message {
    flex-basis: 100%;
    margin: 0;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .step-call {
    width: var(--control-size);
    height: var(--control-size);
    padding: 0;
    flex: 0 0 var(--control-size);
    font-size: 22px;
    line-height: 1;
  }
  .zoom-level {
    color: var(--secondary);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .compact .controls {
    flex-basis: 100%;
    flex-wrap: nowrap;
  }
  .compact .range {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .compact :global(.compact-menu) {
    margin-left: auto;
  }
</style>
