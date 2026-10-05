<script lang="ts">
  import { resolveJumpCallIndex } from '../context-river/viewport';
  export let callIndices: number[];
  export let ready = false;
  export let onJumpToCall: (index: number) => void;
  export let onZoomToRange: (start: number, end: number) => void;
  export let onDone: () => void;
  let jumpValue: string | number = '';
  let startValue: string | number = '';
  let endValue: string | number = '';
  export let message = '';
  export let hideMessage = false;
  $: disabled = !ready || callIndices.length === 0;
  $: first = callIndices[0] ?? 1;
  $: last = callIndices[callIndices.length - 1] ?? 1;
  function jump(event: SubmitEvent) {
    event.preventDefault();
    const target = resolveJumpCallIndex(String(jumpValue), callIndices);
    if (target === null) {
      message = 'Enter a whole-number call index.';
      return;
    }
    message =
      Number(jumpValue) === target
        ? ''
        : `Call ${jumpValue} is not available; moving to call ${target}.`;
    onJumpToCall(target);
    onDone();
  }
  function range(event: SubmitEvent) {
    event.preventDefault();
    const start = resolveJumpCallIndex(String(startValue), callIndices);
    const end = resolveJumpCallIndex(String(endValue), callIndices);
    if (start === null || end === null) {
      message = 'Enter whole-number start and end call indices.';
      return;
    }
    message = '';
    onZoomToRange(Math.min(start, end), Math.max(start, end));
    onDone();
  }
</script>

<div class="precision-navigation">
  <h4>Precise navigation</h4>
  <form class="jump-form" onsubmit={jump} novalidate>
    <label
      >Call number <input
        aria-label="Call number"
        type="number"
        inputmode="numeric"
        step="1"
        min={first}
        max={last}
        bind:value={jumpValue}
        {disabled}
      /></label
    >
    <button type="submit" {disabled}>Go</button>
  </form>
  <form class="range-form" onsubmit={range} novalidate>
    <label
      >From call <input
        aria-label="Range start call"
        type="number"
        inputmode="numeric"
        step="1"
        min={first}
        max={last}
        bind:value={startValue}
        {disabled}
      /></label
    >
    <label
      >to <input
        aria-label="Range end call"
        type="number"
        inputmode="numeric"
        step="1"
        min={first}
        max={last}
        bind:value={endValue}
        {disabled}
      /></label
    >
    <button type="submit" {disabled}>Zoom to range</button>
  </form>
  {#if message && !hideMessage}<p role="status">{message}</p>{/if}
</div>

<style>
  .precision-navigation {
    flex-basis: 100%;
    min-width: 0;
  }
  h4 {
    margin: 4px 0 8px;
    font-size: 12px;
    color: var(--secondary);
  }
  form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    margin-top: 7px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  input {
    width: 80px;
    min-width: 0;
    padding: 5px;
  }
  p {
    color: var(--secondary);
    font-size: 12px;
  }
</style>
