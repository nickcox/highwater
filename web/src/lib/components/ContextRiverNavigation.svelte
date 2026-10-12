<script lang="ts">
  import { tick } from 'svelte';
  import type { RiverViewportStatus } from '../context-river/viewport';
  import { stepCallTarget } from '../context-river/viewport';
  import RiverCallJump from './RiverCallJump.svelte';
  export let viewport: RiverViewportStatus;
  export let callIndices: number[];
  export let pinnedCallIndex: number | null = null;
  export let onSelectCall: (index: number) => void = () => {};
  export let onJumpToCall: (index: number) => void = (index) => onSelectCall(index);
  let jumpMessage = '';
  export let onLatest: () => void;
  export let onFitAll: () => void;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;
  export let isVisible = true;
  $: noCalls = callIndices.length === 0;
  $: previous = viewport.ready ? stepCallTarget(callIndices, pinnedCallIndex, viewport, -1) : null;
  $: next = viewport.ready ? stepCallTarget(callIndices, pinnedCallIndex, viewport, 1) : null;
  let previousButton: HTMLButtonElement;
  let nextButton: HTMLButtonElement;
  // A focused button that becomes disabled leaves focus on the page, where the single-letter
  // h and l shortcuts do nothing. Moving focus to the other step button keeps them working at
  // the first and last calls. The focused button is checked before the buttons update, and the
  // other one is focused after, once it is enabled.
  $: if (next === null && previous !== null && document.activeElement === nextButton)
    void tick().then(() => previousButton.focus());
  $: if (previous === null && next !== null && document.activeElement === previousButton)
    void tick().then(() => nextButton.focus());
  $: rangeText = noCalls
    ? 'No model calls'
    : !viewport.ready
      ? 'Measuring chart viewport…'
      : viewport.firstVisibleCallIndex === null || viewport.lastVisibleCallIndex === null
        ? `No call markers visible of ${callIndices.length}`
        : viewport.firstVisibleCallIndex === viewport.lastVisibleCallIndex
          ? `Call ${viewport.firstVisibleCallIndex} of ${callIndices.length}`
          : `Calls ${viewport.firstVisibleCallIndex}–${viewport.lastVisibleCallIndex} of ${callIndices.length}`;
</script>

<div class="viewport-navigation" role="group" aria-label="Context River navigation">
  <div class="viewport-status">
    <span class="range" aria-live="polite" data-testid="visible-call-range">{rangeText}</span>
  </div>
  <div class="controls" role="group" aria-label="Chart zoom and navigation">
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
  </div>
  {#if jumpMessage}<p class="jump-message" role="status">{jumpMessage}</p>{/if}
</div>

<style>
  .viewport-navigation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    align-items: start;
    gap: 10px 16px;
    margin: 8px 0 12px;
    min-width: 0;
  }
  .viewport-status {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    min-width: 0;
  }
  .range {
    color: #e5ebf7;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .controls {
    display: flex;
    grid-column: 2;
    grid-row: 1;
    align-self: start;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
  }
  .jump-message {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--secondary);
    font-size: 12px;
  }
  .step-call {
    width: 32px;
    height: 32px;
    padding: 0;
    flex: 0 0 32px;
    font-size: 22px;
    line-height: 1;
  }
  .zoom-level {
    color: #aebbd0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 760px) {
    .viewport-navigation {
      grid-template-columns: minmax(0, 1fr);
    }
    .controls {
      grid-column: 1;
      grid-row: 2;
      justify-content: flex-start;
    }
  }
</style>
