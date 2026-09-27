<script lang="ts">
  import type { RiverViewportStatus } from '../context-river/viewport';
  import { resolveJumpCallIndex } from '../context-river/viewport';

  export let viewport: RiverViewportStatus;
  export let callIndices: number[];
  export let onJumpToCall: (callIndex: number) => void;
  export let onZoomToRange: (startCallIndex: number, endCallIndex: number) => void;
  export let onLatest: () => void;
  export let onFitAll: () => void;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;

  let jumpValue: string | number = '';
  let jumpMessage = '';
  let rangeStartValue: string | number = '';
  let rangeEndValue: string | number = '';
  let rangeMessage = '';
  let goToDisclosure: HTMLDetailsElement;
  let goToSummary: HTMLElement;

  $: firstCall = callIndices.length > 0 ? callIndices[0] : null;
  $: lastCall = callIndices.length > 0 ? callIndices[callIndices.length - 1] : null;
  $: noCalls = callIndices.length === 0;
  $: fitDisabled = !viewport.ready || noCalls || viewport.isFitAll;
  $: latestDisabled = !viewport.ready || noCalls || !viewport.hasOverflow;
  $: rangeText = noCalls
    ? 'No model calls'
    : !viewport.ready
      ? 'Measuring chart viewport…'
      : viewport.firstVisibleCallIndex === null || viewport.lastVisibleCallIndex === null
        ? `No call markers visible of ${callIndices.length}`
        : viewport.firstVisibleCallIndex === viewport.lastVisibleCallIndex
          ? `Call ${viewport.firstVisibleCallIndex} of ${callIndices.length}`
          : `Calls ${viewport.firstVisibleCallIndex}–${viewport.lastVisibleCallIndex} of ${callIndices.length}`;
  $: zoomText = `Zoom ${viewport.zoomFactor.toFixed(1)}×`;

  function closeGoTo(): void {
    if (!goToDisclosure?.open) return;
    goToDisclosure.open = false;
    goToSummary?.focus();
  }

  function handleGoToKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (
      event.key === 'Escape' &&
      goToDisclosure?.open &&
      target instanceof Node &&
      goToDisclosure.contains(target)
    ) {
      event.preventDefault();
      event.stopPropagation();
      closeGoTo();
    }
  }

  function submitJump(event: SubmitEvent): void {
    event.preventDefault();
    const input = String(jumpValue);
    const target = resolveJumpCallIndex(input, callIndices);
    if (target === null) {
      jumpMessage = 'Enter a whole-number call index.';
      return;
    }
    const requested = Number(input);
    jumpMessage =
      requested === target ? '' : `Call ${input} is not available; moving to call ${target}.`;
    onJumpToCall(target);
    closeGoTo();
  }

  function submitRange(event: SubmitEvent): void {
    event.preventDefault();
    const start = resolveJumpCallIndex(String(rangeStartValue), callIndices);
    const end = resolveJumpCallIndex(String(rangeEndValue), callIndices);
    if (start === null || end === null) {
      rangeMessage = 'Enter whole-number start and end call indices.';
      return;
    }
    const startPosition = callIndices.indexOf(start);
    const endPosition = callIndices.indexOf(end);
    rangeMessage = '';
    if (startPosition <= endPosition) onZoomToRange(start, end);
    else onZoomToRange(end, start);
    closeGoTo();
  }
</script>

<svelte:document onkeydown={handleGoToKeyDown} />

<div class="viewport-navigation" role="group" aria-label="Context River navigation">
  <div class="viewport-status">
    <span class="range" aria-live="polite" data-testid="visible-call-range">{rangeText}</span>
  </div>

  <div class="controls" role="group" aria-label="Chart zoom and navigation">
    <span class="zoom-level">{zoomText}</span>
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
      disabled={fitDisabled}
      aria-label="Fit all calls"
      title="Fit all calls"
      onclick={onFitAll}>Fit all</button
    >
    <button type="button" disabled={latestDisabled} onclick={onLatest}>Latest</button>
    <details class="go-to-disclosure" bind:this={goToDisclosure}>
      <summary bind:this={goToSummary}>Go to…</summary>
      <div class="go-to-panel">
        <form class="range-form" onsubmit={submitRange} novalidate>
          <label for="zoom-range-start">From call</label>
          <input
            id="zoom-range-start"
            aria-label="Range start call"
            type="number"
            inputmode="numeric"
            step="1"
            min={firstCall ?? 1}
            max={lastCall ?? 1}
            bind:value={rangeStartValue}
            disabled={!viewport.ready || noCalls}
          />
          <label for="zoom-range-end">to</label>
          <input
            id="zoom-range-end"
            aria-label="Range end call"
            type="number"
            inputmode="numeric"
            step="1"
            min={firstCall ?? 1}
            max={lastCall ?? 1}
            bind:value={rangeEndValue}
            disabled={!viewport.ready || noCalls}
          />
          <button type="submit" disabled={!viewport.ready || noCalls}>Zoom to range</button>
        </form>
        <form class="jump-form" onsubmit={submitJump} novalidate>
          <label for="jump-to-call">Call number</label>
          <input
            id="jump-to-call"
            aria-label="Call number"
            type="number"
            inputmode="numeric"
            step="1"
            min={firstCall ?? 1}
            max={lastCall ?? 1}
            bind:value={jumpValue}
            disabled={!viewport.ready || noCalls}
          />
          <button type="submit" disabled={!viewport.ready || noCalls}>Go</button>
        </form>
      </div>
    </details>
  </div>

  {#if rangeMessage}<span class="jump-message" role="status">{rangeMessage}</span>{/if}
  {#if jumpMessage}<span class="jump-message" role="status">{jumpMessage}</span>{/if}
</div>

<style>
  .viewport-navigation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
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
  .jump-message {
    color: #96a2b8;
    font-size: 12px;
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
  .zoom-level {
    color: #aebbd0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .go-to-disclosure {
    position: relative;
  }
  .go-to-disclosure > summary {
    list-style: none;
    cursor: pointer;
    padding: 7px 9px;
    background: #151e35;
    border: 1px solid #34415f;
    border-radius: 7px;
    color: #e2e8f3;
    white-space: nowrap;
  }
  .go-to-disclosure > summary::-webkit-details-marker {
    display: none;
  }
  .go-to-disclosure > summary::after {
    content: ' ▾';
    color: #aebbd0;
  }
  .go-to-disclosure[open] > summary::after {
    content: ' ▴';
  }
  .go-to-disclosure > summary:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .go-to-panel {
    position: absolute;
    z-index: 4;
    top: calc(100% + 6px);
    right: 0;
    display: grid;
    gap: 9px;
    min-width: 270px;
    padding: 10px;
    background: #11182c;
    border: 1px solid #3a496a;
    border-radius: 8px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.38);
  }
  .go-to-panel form {
    display: grid;
    grid-template-columns: auto 76px auto 76px;
    align-items: center;
    gap: 5px;
  }
  .go-to-panel .jump-form {
    grid-template-columns: auto 76px auto;
  }
  label {
    color: #aebbd0;
    font-size: 12px;
  }
  input[type='number'] {
    width: 76px;
    min-width: 60px;
    background: #0b1223;
    color: #eef2f8;
    border: 1px solid #34415f;
    border-radius: 6px;
    padding: 6px 7px;
    font: inherit;
    font-variant-numeric: tabular-nums;
  }
  input:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .jump-message {
    grid-column: 1 / -1;
    min-width: 0;
  }
  @media (max-width: 850px) {
    .viewport-navigation {
      grid-template-columns: minmax(0, 1fr);
    }
    .viewport-status {
      min-height: 38px;
    }
    .controls {
      grid-column: 1;
      grid-row: auto;
      justify-content: flex-start;
    }
  }
  @media (max-width: 650px) {
    .go-to-panel {
      right: auto;
      left: 0;
    }
  }
  @media (max-width: 350px) {
    .go-to-panel {
      left: auto;
      right: 0;
      min-width: min(270px, calc(100vw - 40px));
    }
    .go-to-panel form,
    .go-to-panel .jump-form {
      grid-template-columns: auto minmax(55px, 1fr) auto minmax(55px, 1fr);
    }
    .go-to-panel .jump-form {
      grid-template-columns: auto minmax(55px, 1fr) auto;
    }
  }
</style>
