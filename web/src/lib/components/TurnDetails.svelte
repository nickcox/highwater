<script lang="ts">
  import type { IndexedAnalysis, RecordedTurn } from '../types';
  import { responseDuration } from './call-timing';
  import InfoPopover from './InfoPopover.svelte';

  let {
    turn,
    callIndex,
    indexed,
  }: {
    turn: RecordedTurn;
    callIndex: number;
    indexed: IndexedAnalysis;
  } = $props();
  let count = $derived(turn.lastCall - turn.firstCall + 1);
  let tools = $derived.by(() => {
    let total = 0;
    for (let i = turn.firstCall; i <= turn.lastCall; i++) {
      total += indexed.callByIndex.get(i)?.toolCallsAfter.length ?? 0;
    }
    return total;
  });
  const timingId = $props.id();
  let position = $derived(callIndex - turn.firstCall + 1);
  let positionPercent = $derived(count > 1 ? ((position - 1) / (count - 1)) * 100 : 0);
  let timingNote = $derived(
    indexed.analysis.session.source === 'vscode-copilot'
      ? 'From the saved request and completion timestamps, including tool work.'
      : 'Whole-turn time reported by the harness, including tool work.',
  );
  const statuses = { completed: 'Completed', failed: 'Failed', interrupted: 'Interrupted' };
</script>

<section class="turn" aria-label="Turn">
  <div class="heading">
    <h4>Turn</h4>
    {#if turn.status}<span class="status">{statuses[turn.status]}</span>{/if}
  </div>
  {#if turn.prompt}<p class="prompt">{turn.prompt}</p>{/if}
  <dl>
    <div>
      <dt>
        Elapsed{#if turn.durationMs !== null}<InfoPopover
            id={`${timingId}-elapsed`}
            label="What turn elapsed time measures">{timingNote}</InfoPopover
          >{/if}
      </dt>
      <dd class:duration={turn.durationMs !== null}>{responseDuration(turn.durationMs)}</dd>
    </div>
    <div>
      <dt>{turn.combinedCalls ? 'Call entries' : 'Recorded model calls'}</dt>
      <dd>{count}</dd>
    </div>
    <div>
      <dt>Recorded tool calls</dt>
      <dd>{tools}</dd>
    </div>
  </dl>
  {#if turn.combinedCalls}<p class="note">
      Some model calls are recorded together, so the exact count is unavailable.
    </p>{/if}
  <p class="position">
    <span class="position-label"
      >{turn.combinedCalls ? 'Entry' : 'Call'} {position} of {count} in this turn</span
    >
    {#if count > 1}
      <span class="track" aria-hidden="true"
        ><span class="marker" style:left={`${positionPercent}%`}></span></span
      >
    {/if}
  </p>
</section>

<style>
  .turn {
    border-block-start: 1px solid var(--separator);
    margin-block-start: 0.75rem;
    padding-block-start: 0.75rem;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }
  h4,
  p {
    margin: 0;
  }
  .status,
  .note,
  dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .prompt {
    margin-block-start: 0.4rem;
    overflow-wrap: anywhere;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
    margin: 0.5rem 0;
  }
  dd {
    margin: 0.15rem 0 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .duration {
    white-space: nowrap;
  }
  .position {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-block-start: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .position-label {
    flex: 0 1 auto;
  }
  .track {
    flex: 1 1 2rem;
    min-width: 2rem;
    position: relative;
    height: 2px;
    margin-inline: 4px;
    background: var(--control-border);
  }
  .marker {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    transform: translate(-50%, -50%);
  }
</style>
