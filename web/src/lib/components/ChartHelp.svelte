<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import type { EstimateQuality } from '../estimate-quality';

  export let quality: EstimateQuality;
  export let onOpenDiagnostics: () => void = () => {};
  export let isVisible = true;
  $: if (!isVisible) close(false);

  let container: HTMLDivElement | null = null;
  let trigger: HTMLButtonElement | null = null;
  let popover: HTMLDivElement | null = null;
  let popoverStyle = '';
  let expanded = false;

  function placePopover(): void {
    if (!expanded || !trigger || !popover) return;
    const margin = 12;
    const width = Math.min(480, Math.max(0, window.innerWidth - margin * 2));
    const height = Math.min(popover.scrollHeight, Math.max(0, window.innerHeight - margin * 2));
    const triggerBounds = trigger.getBoundingClientRect();
    const left = Math.max(
      margin,
      Math.min(triggerBounds.right - width, window.innerWidth - width - margin),
    );
    const below = triggerBounds.bottom + 8;
    const top =
      below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, triggerBounds.top - height - 8);
    popoverStyle = `left:${Math.round(left)}px;top:${Math.round(top)}px;width:${Math.round(width)}px;max-height:${Math.round(height)}px`;
  }

  function close(restoreFocus = true): void {
    if (!expanded) return;
    expanded = false;
    if (restoreFocus) trigger?.focus();
  }

  function toggleHelp(): void {
    if (expanded) close();
    else expanded = true;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (
      event.key === 'Escape' &&
      expanded &&
      event.target instanceof Node &&
      container?.contains(event.target)
    ) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  function openDiagnostics(): void {
    close(false);
    onOpenDiagnostics();
  }

  afterUpdate(placePopover);
  onMount(() => {
    container?.addEventListener('keydown', handleKeyDown);
    return () => container?.removeEventListener('keydown', handleKeyDown);
  });
</script>

<svelte:window onresize={placePopover} onscroll={placePopover} />

<div class="chart-help" bind:this={container}>
  <button
    bind:this={trigger}
    type="button"
    class="help-trigger"
    aria-label="Chart help"
    aria-expanded={expanded}
    aria-controls="chart-help-popover"
    onclick={toggleHelp}
  >
    Chart help
  </button>
  <div
    id="chart-help-popover"
    class="help-popover"
    bind:this={popover}
    role="group"
    aria-labelledby="chart-help-title"
    aria-hidden={!expanded}
    hidden={!expanded}
    style={popoverStyle}
  >
    <h3 id="chart-help-title">Chart help</h3>
    <p class="quality-message">{quality.message}</p>
    <button type="button" class="diagnostics-link" onclick={openDiagnostics}>
      Open Session details
    </button>
    <h4>Navigate the river</h4>
    <ul>
      <li>Drag across a range to zoom; scroll horizontally or Shift-drag to pan.</li>
      <li>Use pinch or modifier-wheel zoom; ordinary page scrolling remains available.</li>
      <li>
        Use Go to call beside the zoom controls to pin a call without changing zoom. Drag an area to
        zoom to a range.
      </li>
      <li>The lifespan list spans the full session; filter or search it to locate an item.</li>
      <li>Use Find in lifespans from Composition to open and focus a selected item's row.</li>
      <li>Escape closes this help first, then clears the selected item, the pin, and Fit all.</li>
    </ul>
    <h4>System and tools</h4>
    <p>
      Recorded Pi instructions and tool declarations are replayed into per-call revisions. Their
      token sizes estimate logical context, not exact provider wire framing. Older logs may lack
      this material; missing does not mean zero. Provider-reported input and cost remain independent
      totals.
    </p>
    <h4>Read the scale</h4>
    <p>
      Session scale keeps ribbon heights comparable across calls. Visible calls mode rescales to
      visible columns and interpolated viewport edges, so heights can change while panning or
      zooming. Cached tokens still occupy context capacity.
    </p>
  </div>
</div>

<style>
  .chart-help {
    display: flex;
    align-items: center;
    gap: 6px 12px;
    min-height: 30px;
    color: #aebbd0;
    font-size: 12px;
  }
  .help-trigger {
    cursor: pointer;
    padding: 5px 8px;
    white-space: nowrap;
    border: 1px solid #34415f;
    border-radius: 6px;
    color: var(--text);
    background: var(--surface);
    font: inherit;
  }
  .help-trigger:hover {
    background: #1b2942;
  }
  .help-trigger:focus-visible,
  button:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .help-popover {
    position: fixed;
    z-index: 20;
    left: 12px;
    top: 12px;
    width: min(30rem, calc(100vw - 24px));
    max-height: min(70vh, calc(100vh - 24px));
    overflow: auto;
    overscroll-behavior: contain;
    padding: 14px 16px;
    border: 1px solid #465574;
    border-radius: 9px;
    background: var(--surface);
    color: #d5deed;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    font-size: 13px;
  }
  h3,
  h4 {
    margin: 0 0 6px;
    color: #f0f3f8;
  }
  h3 {
    font-size: 15px;
  }
  h4 {
    margin-top: 12px;
    font-size: 12px;
  }
  p {
    margin: 5px 0;
  }
  .quality-message {
    color: #e2e8f3;
  }
  ul {
    margin: 5px 0;
    padding-left: 20px;
  }
  li + li {
    margin-top: 4px;
  }
  .diagnostics-link {
    min-height: 34px;
    padding: 6px 9px;
    border: 1px solid #52678c;
    border-radius: 6px;
    color: #eef2f8;
    background: #1b2a46;
    font: inherit;
    cursor: pointer;
  }
  .diagnostics-link:hover {
    background: #253958;
  }
</style>
