<script lang="ts">
  import EventGlyph from './EventGlyph.svelte';
  import type { EconomicsEventBreakdown } from './economics-track';
  let {
    breakdown,
    element = $bindable(null),
    positionStyle = '',
    canZoomIn,
    onClose,
    onZoom,
    onInspect,
  }: {
    breakdown: EconomicsEventBreakdown;
    element?: HTMLDivElement | null;
    positionStyle?: string;
    canZoomIn: boolean;
    onClose: () => void;
    onZoom: () => void;
    onInspect: (callIndex: number) => void;
  } = $props();

  function keydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }
</script>

<div
  bind:this={element}
  class="event-breakdown"
  role="dialog"
  tabindex="-1"
  aria-label="Economics event breakdown"
  style={positionStyle}
  onkeydown={keydown}
>
  <div class="event-breakdown-header">
    <strong
      >{breakdown.events.length}
      {breakdown.events.length === 1 ? 'event' : 'events'} · calls {breakdown.callIndices.join(
        ', ',
      )}</strong
    >
    <button
      id={`${breakdown.id}-close`}
      type="button"
      aria-label="Close event breakdown"
      onclick={onClose}>×</button
    >
  </div>
  <button
    type="button"
    class="zoom-events-button"
    disabled={!canZoomIn || breakdown.callIndices.length === 0}
    onclick={onZoom}>Zoom to these calls</button
  >
  <ul>
    {#each breakdown.events as event (event.id)}
      <li>
        <span class="event-list-label"
          ><EventGlyph kind={event.kind} direction={event.direction} size={18} />{event.label} · call
          {event.callIndex}</span
        >
        <button type="button" onclick={() => onInspect(event.callIndex)}
          >Inspect call {event.callIndex}</button
        >
      </li>
    {/each}
  </ul>
</div>

<style>
  .event-breakdown {
    position: fixed;
    z-index: 6;
    width: min(300px, calc(100vw - 16px));
    max-height: min(220px, calc(100vh - 16px));
    overflow: auto;
    padding: 8px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
  }
  .event-breakdown-header,
  li {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
  }
  .event-breakdown-header {
    color: #fff;
    font-size: var(--text-sm);
  }
  .event-breakdown-header button {
    padding: 1px 6px;
    font-size: var(--text-lg);
    line-height: 1.1;
  }
  ul {
    display: grid;
    gap: 7px;
    margin: 7px 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-xs);
  }
  li > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .event-list-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  li button {
    flex: 0 0 auto;
    padding: 3px 6px;
    font-size: 10px;
    white-space: nowrap;
  }
  @media (max-width: 620px) {
    .event-breakdown {
      position: static;
      width: 100%;
      max-height: 180px;
      margin: 8px 0 0;
    }
  }
</style>
