<script lang="ts">
  import { onMount } from 'svelte';
  export let anchor: { x: number; y: number };
  export let label: string;
  export let memberLabels: string[];
  export let memberCount: number;
  export let callIndex: number | null;
  export let onClose: () => void;
  export let onShowItems: () => void;

  let element: HTMLDivElement;
  let panelWidth = 340;
  let panelHeight = 220;
  let viewportWidth = 1280;
  let viewportHeight = 800;
  $: left = Math.max(8, Math.min(anchor.x + 8, viewportWidth - panelWidth - 8));
  $: top = Math.max(8, Math.min(anchor.y + 8, viewportHeight - panelHeight - 8));

  onMount(() => {
    const measure = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const bounds = element.getBoundingClientRect();
      panelWidth = bounds.width;
      panelHeight = bounds.height;
    };
    // Ignore queued scroll events from the activation's prior scroll-into-view.
    // Only actual movement after mounting dismisses this viewport-anchored panel.
    const host = element.closest('.chart-frame')?.querySelector('[data-testid="river-host"]');
    const initial = {
      x: window.scrollX,
      y: window.scrollY,
      left: host?.scrollLeft,
      top: host?.scrollTop,
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && element.contains(event.target)) return;
      if (
        window.scrollX !== initial.x ||
        window.scrollY !== initial.y ||
        host?.scrollLeft !== initial.left ||
        host?.scrollTop !== initial.top
      )
        onClose();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', scroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', scroll, true);
    };
  });

  function keydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }
</script>

<div
  class="group-breakdown"
  bind:this={element}
  style:left={`${left}px`}
  style:top={`${top}px`}
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
    {memberCount}
    {memberCount === 1 ? 'member' : 'members'}{callIndex === null ? '' : ` at call ${callIndex}`}.
  </p>
  <ul>
    {#each memberLabels as label}<li>{label}</li>{/each}
  </ul>
  {#if memberCount > 12}<p>Showing the first 12 members.</p>{/if}
  <button type="button" onclick={onShowItems}>Show items here</button>
</div>

<style>
  .group-breakdown {
    position: fixed;
    box-sizing: border-box;
    z-index: 6;
    width: min(340px, calc(100vw - 16px));
    max-height: min(220px, calc(100vh - 16px));
    overflow: auto;
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
