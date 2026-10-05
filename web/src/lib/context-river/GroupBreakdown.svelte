<script lang="ts">
  export let label: string;
  export let memberLabels: string[];
  export let memberCount: number;
  export let callIndex: number | null;
  export let onClose: () => void;
  export let onShowItems: () => void;

  function keydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }
</script>

<div
  class="group-breakdown"
  role="dialog"
  tabindex="-1"
  aria-label={`Item type ${label} breakdown`}
  onkeydown={keydown}
>
  <div class="event-breakdown-header">
    <strong>Item type: {label}</strong>
    <button
      id="group-breakdown-close"
      type="button"
      aria-label="Close item type breakdown"
      onclick={onClose}>×</button
    >
  </div>
  <p>
    {memberCount} members{callIndex === null ? '' : ` at call ${callIndex}`}. Grouped geometry is
    presentation-only; individual item identities and totals are unchanged.
  </p>
  <ul>
    {#each memberLabels as label}<li>{label}</li>{/each}
  </ul>
  {#if memberCount > 12}<p>Showing the first 12 members.</p>{/if}
  <button type="button" onclick={onShowItems}>Show items here</button>
</div>

<style>
  .group-breakdown {
    position: static;
    z-index: 6;
    width: min(340px, calc(100vw - 16px));
    max-height: min(220px, calc(100vh - 16px));
    overflow: auto;
    margin-top: 8px;
    padding: 9px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--control-border);
    border-radius: 7px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
  }
  .event-breakdown-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
    color: #fff;
    font-size: 12px;
  }
  .event-breakdown-header button {
    padding: 1px 6px;
    font-size: 15px;
    line-height: 1.1;
  }
  p {
    margin: 7px 0;
    color: #bac5d8;
    font-size: 11px;
  }
  ul {
    max-height: 150px;
    overflow: auto;
    margin: 7px 0;
    padding-left: 18px;
    color: #d7e0ef;
    font-size: 11px;
  }
</style>
