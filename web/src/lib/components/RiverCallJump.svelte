<script lang="ts">
  import { resolveJumpCallIndex } from '../context-river/viewport';
  export let callIndices: number[];
  export let ready = false;
  export let onJumpToCall: (index: number) => void;
  export let onDone: () => void = () => {};
  let jumpValue: string | number = '';
  export let message = '';
  export let hideMessage = false;
  $: disabled = !ready || callIndices.length === 0;
  $: first = callIndices[0] ?? 1;
  $: last = callIndices[callIndices.length - 1] ?? 1;
  function cancelEntry(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    // Let the input/IME cancel composition without bubbling into workspace dismissal.
    if (event.isComposing) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    jumpValue = '';
    message = '';
  }
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
</script>

<div class="call-jump">
  <form onsubmit={jump} novalidate>
    <label
      >Go to call <input
        aria-label="Call number"
        type="number"
        inputmode="numeric"
        step="1"
        min={first}
        max={last}
        bind:value={jumpValue}
        onkeydown={cancelEntry}
        {disabled}
      /></label
    >
    <button type="submit" {disabled} title="Pin this call without changing zoom">Go</button>
  </form>
  {#if message && !hideMessage}<p role="status">{message}</p>{/if}
</div>

<style>
  .call-jump {
    min-width: 0;
    margin-left: 7px;
  }
  form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  input {
    width: 64px;
    min-width: 0;
    padding: 5px;
  }
  p {
    color: var(--secondary);
    font-size: 12px;
  }
</style>
